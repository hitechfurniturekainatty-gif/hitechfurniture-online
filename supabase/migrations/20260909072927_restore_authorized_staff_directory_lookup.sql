CREATE OR REPLACE FUNCTION public.get_all_auth_users()
RETURNS TABLE(id uuid,email text,created_at timestamptz,last_sign_in_at timestamptz,user_metadata jsonb)
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT u.id,u.email::text,u.created_at,u.last_sign_in_at,u.raw_user_meta_data
 FROM auth.users u
 WHERE coalesce(auth.jwt()->>'role','')='service_role'
 OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(),'admin'::public.app_role))
 ORDER BY u.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_all_auth_users() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_all_auth_users() TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
