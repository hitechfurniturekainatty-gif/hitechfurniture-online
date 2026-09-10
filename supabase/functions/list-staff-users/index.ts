import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !serviceKey || !anonKey) return json({ error: 'Server not configured', stage: 'env' });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing auth' });

    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Invalid token', detail: userErr?.message });

    const admin = createClient(url, serviceKey);
    const { data: rolesRows, error: rolesErr } = await admin.from('user_roles').select('role').eq('user_id', userData.user.id);
    if (rolesErr) return json({ error: 'Role lookup failed', detail: rolesErr.message });
    const callerRoles = (rolesRows || []).map((r: { role: string }) => r.role);
    const allowed = callerRoles.some((r) => ['admin', 'staff', 'measurement_staff', 'delivery'].includes(r));
    if (!allowed) return json({ error: 'Forbidden', detail: 'No staff role assigned to your account.' });

    const [{ data: authUsers, error: listErr }, { data: roles }, { data: profiles }] = await Promise.all([
      admin.rpc('get_all_auth_users'),
      admin.from('user_roles').select('user_id, role'),
      admin.from('profiles').select('user_id, display_name, email, whatsapp_number'),
    ]);
    if (listErr) return json({ error: listErr.message, stage: 'listUsers', detail: JSON.stringify(listErr) });

    const rolesByUser: Record<string, string[]> = {};
    (roles || []).forEach((r: { user_id: string; role: string }) => {
      (rolesByUser[r.user_id] ||= []).push(r.role);
    });
    const profileByUser: Record<string, { display_name: string | null; email: string | null; whatsapp_number: string | null }> = {};
    (profiles || []).forEach((p: { user_id: string; display_name: string | null; email: string | null; whatsapp_number: string | null }) => {
      profileByUser[p.user_id] = p;
    });

    const users = (authUsers || []).map((u: { id: string; email: string; created_at: string; last_sign_in_at: string; user_metadata: Record<string, unknown> | null }) => {
      const userRoles = rolesByUser[u.id] || [];
      const role = userRoles.includes('admin') ? 'admin'
        : userRoles.includes('staff') ? 'staff'
        : userRoles.includes('measurement_staff') ? 'measurement_staff'
        : userRoles.includes('delivery') ? 'delivery'
        : userRoles.includes('warehouse') ? 'warehouse' : null;
      const profile = profileByUser[u.id];
      const metaName = (u.user_metadata as Record<string, unknown> | null)?.display_name;
      return {
        user_id: u.id,
        id: u.id,
        email: profile?.email || u.email,
        display_name: profile?.display_name || metaName || u.email?.split('@')[0],
        whatsapp_number: profile?.whatsapp_number ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        role,
        roles: userRoles,
      };
    });
    return json({ users });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return json({ error: msg, stage: 'exception' });
  }
});
