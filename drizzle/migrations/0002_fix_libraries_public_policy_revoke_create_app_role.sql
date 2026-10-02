DROP POLICY IF EXISTS libraries_select_public ON public.libraries;
CREATE POLICY libraries_select_public ON public.libraries
  FOR SELECT TO anon
  USING (visibility = 'public');

REVOKE EXECUTE ON FUNCTION public.create_app_role(text, text, integer, text) FROM authenticated;