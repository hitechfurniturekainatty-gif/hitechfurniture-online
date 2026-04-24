import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

/**
 * Revokes a worker's app login. Called when an admin soft-deletes (Trashes)
 * a worker so the deleted worker can no longer sign in to /worker/login.
 *
 * - Deletes the auth.users row that was provisioned for the worker
 * - Clears workers.user_id + workers.login_phone so the row is reusable later
 *   (a fresh login can be created if the worker is restored from Trash)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !serviceKey || !anonKey) return json({ error: 'Server not configured' }, 200);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing auth' }, 200);

    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Invalid token' }, 200);

    const admin = createClient(url, serviceKey);
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });
    if (!isAdmin) return json({ error: 'Admin only' }, 200);

    const body = await req.json().catch(() => ({}));
    const { worker_id } = body || {};
    if (!worker_id) return json({ error: 'worker_id required' }, 200);

    const { data: worker, error: wErr } = await admin
      .from('workers')
      .select('id, user_id')
      .eq('id', worker_id)
      .maybeSingle();
    if (wErr) return json({ error: wErr.message }, 200);
    if (!worker) return json({ error: 'Worker not found' }, 200);

    // No login provisioned — nothing to revoke.
    if (!worker.user_id) return json({ ok: true, revoked: false });

    // Best-effort delete of auth.users; cascades will clean user_roles via FK.
    const { error: delErr } = await admin.auth.admin.deleteUser(worker.user_id);
    if (delErr && !/not.*found/i.test(delErr.message)) {
      return json({ error: delErr.message }, 200);
    }

    // Belt-and-braces: ensure the worker role row is gone for that user.
    await admin.from('user_roles').delete().eq('user_id', worker.user_id);

    // Clear the link on the worker so login_phone is freed up.
    await admin
      .from('workers')
      .update({ user_id: null, login_phone: null })
      .eq('id', worker_id);

    return json({ ok: true, revoked: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return json({ error: msg }, 200);
  }
});