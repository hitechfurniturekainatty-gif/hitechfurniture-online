// Persist stable object references; use short-lived URLs only for display.
export const backendUrl = 'https://ejxautrxbcemrncpzjyg.supabase.co';
const pattern = /https:\/\/ejxautrxbcemrncpzjyg\.supabase\.co\/storage\/v1\/object\/(?:public|sign)\/quotations\/[^\s"'\\<>|,]+/g;

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
    const paths = [...new Set(urls.map(mediaPath))];
    const sourceHeaders = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const headers = new Headers();
    // Do not forward PostgREST schema, pagination or representation headers to Storage.
    for (const name of ['authorization', 'apikey', 'x-client-info']) {
      const value = sourceHeaders.get(name);
      if (value) headers.set(name, value);
    }
    headers.set('Content-Type','application/json');
    const rpc = url.pathname.split('/rpc/')[1];
    const shared = ['get_shared_quotation','get_shared_job_work_order','get_shared_delivery_note'].includes(rpc);
    const token = shared ? (body as {p_token?:string})?.p_token ?? url.searchParams.get('p_token') : undefined;
    const signed: Record<string,string> = {};
    for (let i=0;i<paths.length;i+=100) {
      const reply = await baseFetch(`${backendUrl}/functions/v1/private-media`, {method:'POST',headers,signal:init?.signal,body:JSON.stringify({paths:paths.slice(i,i+100),rpc:shared?rpc:undefined,token})});
      if (!reply.ok) throw new Error('Unable to load private attachments. Please sign in again or refresh this link.');
      Object.assign(signed, (await reply.json()).urls);
    }
    const mapped = mapMedia(value, u => signed[mediaPath(u)] ?? '');
    const outputHeaders = new Headers(response.headers);
    outputHeaders.delete('content-length');
    outputHeaders.delete('content-encoding');
    return new Response(JSON.stringify(mapped),{status:response.status,statusText:response.statusText,headers:outputHeaders});
  };
}
