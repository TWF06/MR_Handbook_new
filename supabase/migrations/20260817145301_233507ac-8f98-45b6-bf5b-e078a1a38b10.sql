ALTER FUNCTION public.role_level(public.app_role) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.role_level(public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_level(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_department() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_employee_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_management() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_active_user() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.section_visible(text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.role_level(public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_level(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_department() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_employee_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_management() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.section_visible(text) TO authenticated, service_role;