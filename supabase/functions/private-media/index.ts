import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json = (data: unknown, status=200) => new Response(JSON.stringify(data), {status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const sharedRpcs = new Set(['get_shared_quotation','get_shared_job_work_order','get_shared_delivery_note']);

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null,{headers:cors});
  if (req.method !== 'POST') return json({error:'Method not allowed'},405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const body = await req.json();
    const {paths,rpc,token} = body;
    if (!Array.isArray(paths) || paths.length > 100 || paths.some(p => typeof p !== 'string' || !p || p.length>1024 || p.split('/').some(s=>s==='..'||s==='.') || p.includes('\0'))) return json({error:'Invalid paths'},400);
    const options = {auth:{persistSession:false,autoRefreshToken:false}};
    let client;
    let allowed = new Set<string>();
    if (token !== undefined) {
      if (!sharedRpcs.has(rpc) || typeof token !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return json({error:'Invalid share link'},403);
      client = createClient(url,key,options);
      // Token lookup checks deleted/expired records. Never accept caller-supplied records.
      const {data,error} = await client.rpc(rpc,{p_token:token});
      if (error || !data || data.expired) return json({error:'Invalid or expired share link'},403);
      const walk = (v: unknown) => {
        if (typeof v === 'string') {
          for (const candidate of v.match(/https:\/\/[^\s"'\\<>|,]+/g) ?? []) {
            try {
              const u = new URL(candidate);
              const prefix='/storage/v1/object/public/quotations/';
              if (u.origin===url && u.pathname.startsWith(prefix)) allowed.add(decodeURIComponent(u.pathname.slice(prefix.length)));
            } catch { /* Ignore non-URLs. */ }
          }
        } else if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v==='object') Object.values(v).forEach(walk);
      };
      walk(data);
      if (paths.some(p=>!allowed.has(p))) return json({error:'File is not part of this shared document'},403);
    } else {
      const authorization=req.headers.get('Authorization');
      if (!authorization?.startsWith('Bearer ')) return json({error:'Authentication required'},401);
      client=createClient(url,anon,{...options,global:{headers:{Authorization:authorization}}});
      const {data,error}=await client.auth.getUser();
      if (error || !data.user) return json({error:'Invalid session'},401);
      // The user client signs only objects allowed by storage RLS, including job assignment.
    }
    const {data,error}=await client.storage.from('quotations').createSignedUrls(paths,3600);
    if (error) return json({error:'Attachment access denied'},403);
    const urls: Record<string,string>={};
    for (const row of data ?? []) if (!row.error && row.path && row.signedUrl) urls[row.path]=row.signedUrl;
    return json({urls});
  } catch { return json({error:'Could not load attachments'},400); }
});
