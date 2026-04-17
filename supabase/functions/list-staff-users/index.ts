import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await callerClient.auth.getUser();
    if (!userData.user) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const admin = createClient(url, serviceKey);
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });
    if (!isAdmin) return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 200 });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data: roles } = await admin.from('user_roles').select('user_id, role');
    const rolesByUser: Record<string, string[]> = {};
    (roles || []).forEach((r: { user_id: string; role: string }) => {
      (rolesByUser[r.user_id] ||= []).push(r.role);
    });
    const users = list.users.map((u) => {
      const userRoles = rolesByUser[u.id] || [];
      // Pick the highest-privilege role for the UI (admin > staff > measurement_staff)
      const role = userRoles.includes('admin')
        ? 'admin'
        : userRoles.includes('staff')
          ? 'staff'
          : userRoles.includes('measurement_staff')
            ? 'measurement_staff'
            : null;
      return {
        user_id: u.id,
        id: u.id,
        email: u.email,
        display_name: (u.user_metadata as Record<string, unknown>)?.display_name || u.email?.split('@')[0],
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        role,
        roles: userRoles,
      };
    });
    return new Response(JSON.stringify({ users }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
