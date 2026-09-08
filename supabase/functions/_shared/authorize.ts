import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export async function authorizeStaff(req: Request, roles = ['admin','staff'], serviceOnly = false): Promise<boolean> {
  const bearer = req.headers.get('Authorization');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceKey && bearer === `Bearer ${serviceKey}`) return true;
  if (serviceOnly || !bearer?.startsWith('Bearer ')) return false;
  const client = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{
    global:{headers:{Authorization:bearer}},auth:{persistSession:false,autoRefreshToken:false},
  });
  const {data,error} = await client.auth.getUser();
  if (error || !data.user) return false;
  const {data:assigned,error:roleError} = await client.from('user_roles').select('role').eq('user_id',data.user.id);
  return !roleError && (assigned ?? []).some(r=>roles.includes(r.role));
}
