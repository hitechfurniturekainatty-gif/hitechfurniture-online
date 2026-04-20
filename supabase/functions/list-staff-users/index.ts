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
    if (!url || !serviceKey || !anonKey) {
      return json({ error: 'Server not configured', stage: 'env' }, 200);
    }
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing auth' }, 200);

    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Invalid token', detail: userErr?.message }, 200);

    const admin = createClient(url, serviceKey);
    // Allow any authenticated staff user (admin, office staff, or measurement staff) — they all
    // need to see staff names/roles inside the admin shell (e.g. assigned-to labels).
    const { data: rolesRows, error: rolesErr } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id);
    if (rolesErr) return json({ error: 'Role lookup failed', detail: rolesErr.message }, 200);
    const callerRoles = (rolesRows || []).map((r: { role: string }) => r.role);
    const allowed = callerRoles.some((r) => r === 'admin' || r === 'staff' || r === 'measurement_staff' || r === 'delivery');
    if (!allowed) return json({ error: 'Forbidden', detail: 'No staff role assigned to your account.' }, 200);

    const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 200 });
    if (error) return json({ error: error.message, stage: 'listUsers' }, 200);

    const [{ data: roles }, { data: profiles }] = await Promise.all([
      admin.from('user_roles').select('user_id, role'),
      admin.from('profiles').select('user_id, whatsapp_number'),
    ]);
    const rolesByUser: Record<string, string[]> = {};
    (roles || []).forEach((r: { user_id: string; role: string }) => {
      (rolesByUser[r.user_id] ||= []).push(r.role);
    });
    const waByUser: Record<string, string | null> = {};
    (profiles || []).forEach((p: { user_id: string; whatsapp_number: string | null }) => {
      waByUser[p.user_id] = p.whatsapp_number ?? null;
    });
    const users = list.users.map((u) => {
      const userRoles = rolesByUser[u.id] || [];
      const role = userRoles.includes('admin')
        ? 'admin'
        : userRoles.includes('staff')
          ? 'staff'
          : userRoles.includes('measurement_staff')
            ? 'measurement_staff'
            : userRoles.includes('delivery')
              ? 'delivery'
              : null;
      return {
        user_id: u.id,
        id: u.id,
        email: u.email,
        display_name: (u.user_metadata as Record<string, unknown>)?.display_name || u.email?.split('@')[0],
        whatsapp_number: waByUser[u.id] ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        role,
        roles: userRoles,
      };
    });
    return json({ users });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return json({ error: msg, stage: 'exception' }, 200);
  }
});
