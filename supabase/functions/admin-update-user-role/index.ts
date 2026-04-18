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
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing auth' }, 401);

    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await callerClient.auth.getUser();
    if (!userData.user) return json({ error: 'Invalid token' }, 401);

    const admin = createClient(url, serviceKey);
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });
    if (!isAdmin) return json({ error: 'Admin only' }, 403);

    const body = await req.json();
    const { user_id, role, action, password, display_name, email, whatsapp_number } = body ?? {};
    if (!user_id) return json({ error: 'user_id required' }, 400);

    // Default action for backwards compatibility
    const act = action || (role ? 'set_role' : null);
    if (!act) return json({ error: 'action required' }, 400);

    if (act === 'delete') {
      if (user_id === userData.user.id) return json({ error: 'You cannot delete yourself' }, 400);
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (act === 'set_role') {
      if (!['admin', 'staff', 'measurement_staff'].includes(role)) return json({ error: 'invalid role' }, 400);
      await admin.from('user_roles').delete().eq('user_id', user_id);
      const { error } = await admin.from('user_roles').insert({ user_id, role });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (act === 'set_password') {
      if (!password || typeof password !== 'string' || password.length < 8) {
        return json({ error: 'Password must be at least 8 characters' }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(user_id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (act === 'update_profile') {
      const updates: Record<string, unknown> = {};
      if (typeof email === 'string' && email.trim()) updates.email = email.trim();
      const meta: Record<string, unknown> = {};
      if (typeof display_name === 'string') meta.display_name = display_name;
      if (Object.keys(meta).length) updates.user_metadata = meta;
      if (Object.keys(updates).length) {
        const { error } = await admin.auth.admin.updateUserById(user_id, updates as any);
        if (error) return json({ error: error.message }, 400);
      }
      const profilePatch: Record<string, unknown> = {};
      if (typeof display_name === 'string') profilePatch.display_name = display_name;
      if (typeof email === 'string' && email.trim()) profilePatch.email = email.trim();
      if (typeof whatsapp_number === 'string') profilePatch.whatsapp_number = whatsapp_number.trim() || null;
      if (Object.keys(profilePatch).length) {
        await admin.from('profiles').update(profilePatch).eq('user_id', user_id);
      }
      return json({ ok: true });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return json({ error: msg }, 500);
  }
});
