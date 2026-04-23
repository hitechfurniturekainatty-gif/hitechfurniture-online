import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Normalize phone -> digits only (e.g., "+91 95266 10404" -> "919526610404")
const normalizePhone = (raw: string) => (raw || '').replace(/\D+/g, '');

// We use Supabase email/password auth under the hood, with a synthetic email
// derived from the phone number, e.g. "919526610404@workers.local".
// The PIN (4-6 digits) acts as the password — we pad it to satisfy the
// 6-char minimum that Supabase enforces.
const phoneToEmail = (phone: string) => `${phone}@workers.local`;
const pinToPassword = (pin: string) => `wkr_${pin}_pin`; // >= 8 chars, deterministic

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
    const { data: isStaff } = await admin.rpc('has_role', { _user_id: userData.user.id, _role: 'staff' });
    if (!isAdmin && !isStaff) return json({ error: 'Office staff only' }, 200);

    const body = await req.json().catch(() => ({}));
    const { worker_id, phone, pin, action } = body || {};
    if (!worker_id) return json({ error: 'worker_id required' }, 200);

    const { data: worker, error: wErr } = await admin
      .from('workers')
      .select('id, name, user_id, login_phone, whatsapp_number')
      .eq('id', worker_id)
      .maybeSingle();
    if (wErr || !worker) return json({ error: 'Worker not found' }, 200);

    // Action: reset_pin only
    if (action === 'reset_pin') {
      if (!worker.user_id) return json({ error: 'No login yet' }, 200);
      const cleanPin = (pin || '').toString().replace(/\D+/g, '');
      if (cleanPin.length < 4 || cleanPin.length > 6) return json({ error: 'PIN must be 4–6 digits' }, 200);
      const { error: updErr } = await admin.auth.admin.updateUserById(worker.user_id, {
        password: pinToPassword(cleanPin),
      });
      if (updErr) return json({ error: updErr.message }, 200);
      return json({ ok: true, action: 'reset_pin' });
    }

    // Action: create or sync login
    const cleanPhone = normalizePhone(phone || worker.login_phone || worker.whatsapp_number || '');
    if (cleanPhone.length < 8) return json({ error: 'Phone number is too short' }, 200);
    const cleanPin = (pin || '').toString().replace(/\D+/g, '');
    if (cleanPin.length < 4 || cleanPin.length > 6) return json({ error: 'PIN must be 4–6 digits' }, 200);

    // If worker already has a user_id, just update phone + password
    if (worker.user_id) {
      const { error: updErr } = await admin.auth.admin.updateUserById(worker.user_id, {
        email: phoneToEmail(cleanPhone),
        password: pinToPassword(cleanPin),
        email_confirm: true,
      });
      if (updErr) return json({ error: updErr.message }, 200);
      await admin.from('workers').update({ login_phone: cleanPhone }).eq('id', worker_id);
      return json({ ok: true, user_id: worker.user_id, phone: cleanPhone, pin: cleanPin });
    }

    // Reject if phone already used by another worker
    const { data: existing } = await admin
      .from('workers')
      .select('id')
      .eq('login_phone', cleanPhone)
      .neq('id', worker_id)
      .maybeSingle();
    if (existing) return json({ error: 'This phone is already used by another worker' }, 200);

    // Create the auth user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: phoneToEmail(cleanPhone),
      password: pinToPassword(cleanPin),
      email_confirm: true,
      user_metadata: { display_name: worker.name, kind: 'worker' },
    });
    if (createErr || !created.user) return json({ error: createErr?.message || 'create failed' }, 200);

    const newUserId = created.user.id;

    // Assign worker role
    await admin.from('user_roles').delete().eq('user_id', newUserId);
    const { error: roleErr } = await admin.from('user_roles').insert({ user_id: newUserId, role: 'worker' });
    if (roleErr) return json({ error: roleErr.message }, 200);

    // Link worker -> user
    const { error: linkErr } = await admin
      .from('workers')
      .update({ user_id: newUserId, login_phone: cleanPhone })
      .eq('id', worker_id);
    if (linkErr) return json({ error: linkErr.message }, 200);

    return json({ ok: true, user_id: newUserId, phone: cleanPhone, pin: cleanPin });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return json({ error: msg }, 200);
  }
});