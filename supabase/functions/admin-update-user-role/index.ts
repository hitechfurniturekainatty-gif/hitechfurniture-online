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
    if (!url || !serviceKey || !anonKey) return json({ error: 'Server not configured' });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing auth' });

    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Invalid token', detail: userErr?.message });

    const admin = createClient(url, serviceKey);
    const { data: isAdmin, error: roleErr } = await admin.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });
    if (roleErr) return json({ error: 'Role check failed', detail: roleErr.message });
    if (!isAdmin) return json({ error: 'Admin only' });

    const body = await req.json().catch(() => ({}));
    const { user_id, role, action, password, display_name, email, whatsapp_number } = body ?? {};
    if (!user_id) return json({ error: 'user_id required' });

    const act = action || (role ? 'set_role' : null);
    if (!act) return json({ error: 'action required' });

    const protectLastAdmin = async () => {
      const { data: targetAdmin, error: targetErr } = await admin
        .from('user_roles')
        .select('user_id')
        .eq('user_id', user_id)
        .eq('role', 'admin')
        .maybeSingle();
      if (targetErr) throw targetErr;
      if (!targetAdmin) return null;
      const { count, error: countErr } = await admin
        .from('user_roles')
        .select('user_id', { count: 'exact', head: true })
        .eq('role', 'admin');
      if (countErr) throw countErr;
      return (count ?? 0) <= 1 ? 'The last admin account cannot be removed or downgraded. Add another admin first.' : null;
    };

    if (act === 'delete') {
      if (user_id === userData.user.id) return json({ error: 'You cannot delete yourself' });
      const protection = await protectLastAdmin();
      if (protection) return json({ error: protection });
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) return json({ error: error.message });
      return json({ ok: true });
    }

    if (act === 'set_role') {
      if (!['admin', 'staff', 'measurement_staff', 'delivery', 'warehouse'].includes(role)) return json({ error: 'invalid role' });
      if (role !== 'admin') {
        const protection = await protectLastAdmin();
        if (protection) return json({ error: protection });
      }
      const { error: deleteErr } = await admin.from('user_roles').delete().eq('user_id', user_id);
      if (deleteErr) return json({ error: deleteErr.message });
      const { error } = await admin.from('user_roles').insert({ user_id, role });
      if (error) return json({ error: error.message });
      return json({ ok: true });
    }

    if (act === 'set_password') {
      if (!password || typeof password !== 'string' || password.length < 8) {
        return json({ error: 'Password must be at least 8 characters' });
      }
      const { error } = await admin.auth.admin.updateUserById(user_id, { password });
      if (error) return json({ error: error.message });
      return json({ ok: true });
    }

    if (act === 'update_profile') {
      const normalizedEmail = typeof email === 'string' ? email.trim() : '';
      if (normalizedEmail) {
        const { data: target, error: getErr } = await admin.auth.admin.getUserById(user_id);
        if (getErr) return json({ error: getErr.message });
        if (target.user?.email !== normalizedEmail) {
          const { error: emailErr } = await admin.auth.admin.updateUserById(user_id, { email: normalizedEmail });
          if (emailErr) return json({ error: emailErr.message });
        }
      }

      const profilePatch: Record<string, unknown> = {};
      if (typeof display_name === 'string') profilePatch.display_name = display_name.trim() || null;
      if (normalizedEmail) profilePatch.email = normalizedEmail;
      if (typeof whatsapp_number === 'string') profilePatch.whatsapp_number = whatsapp_number.trim() || null;
      if (Object.keys(profilePatch).length) {
        const { error: profileErr } = await admin.from('profiles').upsert(
          { user_id, ...profilePatch },
          { onConflict: 'user_id', ignoreDuplicates: false }
        );
        if (profileErr) return json({ error: profileErr.message });
      }
      return json({ ok: true });
    }

    return json({ error: 'unknown action' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return json({ error: msg });
  }
});
