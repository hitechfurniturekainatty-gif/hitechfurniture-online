// Persist stable object references; use short-lived URLs only for display.
export const backendUrl = 'https://ejxautrxbcemrncpzjyg.supabase.co';
const pattern = /https:\/\/ejxautrxbcemrncpzjyg\.supabase\.co\/storage\/v1\/object\/(?:public|sign)\/quotations\/[^\s"'\\<>|,]+/g;
const SIGNED_URL_TTL_MS = 50 * 60 * 1000;
const signedCache = new Map<string, { url: string; expiresAt: number }>();

export function mediaPath(url: string): string {
  return decodeURIComponent(new URL(url).pathname.split('/quotations/')[1]);
}

export function mediaUrls(value: unknown): string[] {
  const result = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string') for (const url of v.match(pattern) ?? []) result.add(url);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(value);
  return [...result];
}

export function mapMedia(value: unknown, map: (url: string) => string): unknown {
  if (typeof value === 'string') return value.replace(pattern, map);
  if (Array.isArray(value)) return value.map(v => mapMedia(v, map));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,mapMedia(v,map)]));
  return value;
}

export function canonicalMedia(value: unknown): unknown {
  return mapMedia(value, url => `${backendUrl}/storage/v1/object/public/quotations/${mediaPath(url).split('/').map(encodeURIComponent).join('/')}`);
}

function cacheKey(scope: string, path: string) {
  return `${scope}\n${path}`;
}

function cachedSignedUrl(scope: string, path: string): string | undefined {
  const key = cacheKey(scope, path);
  const cached = signedCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    signedCache.delete(key);
    return undefined;
  }
  return cached.url;
}

function cacheSignedUrls(scope: string, urls: Record<string, string>) {
  const expiresAt = Date.now() + SIGNED_URL_TTL_MS;
  for (const [path, url] of Object.entries(urls)) {
    if (url) signedCache.set(cacheKey(scope, path), { url, expiresAt });
  }
}

/** PostgREST remains the authority for records; the signer independently checks file access. */
export function privateMediaFetch(baseFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.origin !== backendUrl || !url.pathname.startsWith('/rest/v1/')) return baseFetch(input, init);
    let body: unknown;
    if (typeof init?.body === 'string') {
      try { body = JSON.parse(init.body); init = {...init, body:JSON.stringify(canonicalMedia(body))}; } catch { /* Not JSON. */ }
    }
    const response = await baseFetch(input, init);
    if (!response.ok || !response.headers.get('content-type')?.includes('json')) return response;
    const value = await response.clone().json();
    const urls = mediaUrls(value);
    if (!urls.length) return response;

    const sourceHeaders = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const rpc = url.pathname.split('/rpc/')[1];
    const shared = ['get_shared_quotation','get_shared_job_work_order','get_shared_delivery_note'].includes(rpc);
    const token = shared ? (body as {p_token?:string})?.p_token ?? url.searchParams.get('p_token') : undefined;
    const authorization = sourceHeaders.get('authorization') ?? '';
    // Signed URLs are bearer capabilities. Never reuse one across a different
    // authenticated session or a different public share token.
    const scope = shared ? `share:${rpc}:${token ?? ''}` : `auth:${authorization}`;

    const paths = [...new Set(urls.map(mediaPath))];
    const signed: Record<string,string> = {};
    const missing: string[] = [];
    for (const path of paths) {
      const cached = cachedSignedUrl(scope, path);
      if (cached) signed[path] = cached;
      else missing.push(path);
    }

    if (missing.length) {
      const headers = new Headers();
      // Do not forward PostgREST schema, pagination or representation headers to Storage.
      for (const name of ['authorization', 'apikey', 'x-client-info']) {
        const value = sourceHeaders.get(name);
        if (value) headers.set(name, value);
      }
      headers.set('Content-Type','application/json');
      const batches: string[][] = [];
      for (let i = 0; i < missing.length; i += 100) batches.push(missing.slice(i, i + 100));

      // Attachment signing must never make the quotation/items query itself fail.
      // If signing is temporarily unavailable, return the business data and leave
      // only the affected attachment blank so office work can continue.
      const results = await Promise.allSettled(batches.map(async batch => {
        const reply = await baseFetch(`${backendUrl}/functions/v1/private-media`, {
          method:'POST', headers, signal:init?.signal,
          body:JSON.stringify({paths:batch,rpc:shared?rpc:undefined,token}),
        });
        if (!reply.ok) throw new Error(`private-media ${reply.status}`);
        const payload = await reply.json() as { urls?: Record<string,string> };
        return payload.urls ?? {};
      }));

      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        Object.assign(signed, result.value);
        cacheSignedUrls(scope, result.value);
      }
    }

    const mapped = mapMedia(value, u => signed[mediaPath(u)] ?? '');
    const outputHeaders = new Headers(response.headers);
    outputHeaders.delete('content-length');
    outputHeaders.delete('content-encoding');
    return new Response(JSON.stringify(mapped),{status:response.status,statusText:response.statusText,headers:outputHeaders});
  };
}
