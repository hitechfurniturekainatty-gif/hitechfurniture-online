// Server-side image fetch for PDF generation, for hosts that send no CORS
// headers (Output Books product photos). Logged-in staff only; host allowlist.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const ALLOWED = new Set(['books.hitechfurniture.online', 'hitechfurniture.online', 'www.hitechfurniture.online', 'ejxautrxbcemrncpzjyg.supabase.co']);
const MAX = 15 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return new Response('Auth required', { status: 401, headers: cors });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: u, error: ue } = await sb.auth.getUser();
  if (ue || !u.user) return new Response('Invalid session', { status: 401, headers: cors });
  try {
    const { url } = await req.json();
    const target = new URL(String(url));
    if (target.protocol !== 'https:' || !ALLOWED.has(target.hostname)) return new Response('Host not allowed', { status: 403, headers: cors });
    const r = await fetch(target.href, { headers: { 'User-Agent': 'Mozilla/5.0 HitechPDF', Accept: 'image/*' }, redirect: 'follow' });
    if (!r.ok) return new Response(`Upstream ${r.status}`, { status: 502, headers: cors });
    const type = r.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) return new Response('Not an image', { status: 415, headers: cors });
    const buf = await r.arrayBuffer();
    if (buf.byteLength > MAX) return new Response('Too large', { status: 413, headers: cors });
    return new Response(buf, { headers: { ...cors, 'Content-Type': type, 'Cache-Control': 'private, max-age=3600' } });
  } catch {
    return new Response('Bad request', { status: 400, headers: cors });
  }
});
