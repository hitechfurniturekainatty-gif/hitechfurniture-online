import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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
    if (userErr || !userData.user) return json({ error: 'Invalid token', detail: userErr?.message }, 200);

    const admin = createClient(url, serviceKey);
    const { data: isAdmin, error: roleErr } = await admin.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });
    if (roleErr) return json({ error: 'Role check failed', detail: roleErr.message }, 200);
    if (!isAdmin) return json({ error: 'Admin only' }, 200);

    const body = await req.json().catch(() => ({}));
    const { email, password, display_name, role, whatsapp_number } = body || {};
    if (!email || !password || !role) return json({ error: 'email, password, role required' }, 200);
    if (!['admin', 'staff', 'measurement_staff', 'delivery', 'warehouse'].includes(role)) return json({ error: 'invalid role' }, 200);
    if (typeof password !== 'string' || password.length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, 200);
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: display_name || email.split('@')[0] },
    });
    if (createErr || !created.user) return json({ error: createErr?.message || 'create failed' }, 200);

    const newUserId = created.user.id;
    await admin.from('user_roles').delete().eq('user_id', newUserId);
    const { error: roleInsertErr } = await admin.from('user_roles').insert({ user_id: newUserId, role });
    if (roleInsertErr) return json({ error: roleInsertErr.message }, 200);

    // Upsert profile so whatsapp is saved even when no auto-create trigger exists
    await admin.from('profiles').upsert(
      { user_id: newUserId, whatsapp_number: (typeof whatsapp_number === 'string' && whatsapp_number.trim()) ? whatsapp_number.trim() : null },
      { onConflict: 'user_id', ignoreDuplicates: false }
    );

    return json({ ok: true, user_id: newUserId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return json({ error: msg }, 200);
  }
});
