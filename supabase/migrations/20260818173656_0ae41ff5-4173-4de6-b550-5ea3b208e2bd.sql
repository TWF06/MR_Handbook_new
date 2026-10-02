ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS created_by text;

CREATE OR REPLACE FUNCTION app.is_director()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT app.has_role(auth.uid(), 'director'::app_role);
$$;

UPDATE public.sections SET created_by = (
  SELECT p.employee_id FROM public.profiles p
  JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'director'::app_role
  ORDER BY p.created_at LIMIT 1
) WHERE created_by IS NULL;

UPDATE public.documents SET created_by = (
  SELECT p.employee_id FROM public.profiles p
  JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'director'::app_role
  ORDER BY p.created_at LIMIT 1
) WHERE created_by IS NULL;

DROP POLICY IF EXISTS sections_write ON public.sections;
CREATE POLICY sections_insert ON public.sections FOR INSERT TO authenticated
  WITH CHECK (app.is_admin() AND (app.is_director() OR created_by = app.current_employee_id()));
CREATE POLICY sections_update ON public.sections FOR UPDATE TO authenticated
  USING (app.is_director() OR (app.is_admin() AND created_by = app.current_employee_id()))
  WITH CHECK (app.is_director() OR (app.is_admin() AND created_by = app.current_employee_id()));
CREATE POLICY sections_delete ON public.sections FOR DELETE TO authenticated
  USING (app.is_director() OR (app.is_admin() AND created_by = app.current_employee_id()));

DROP POLICY IF EXISTS documents_write ON public.documents;
CREATE POLICY documents_insert ON public.documents FOR INSERT TO authenticated
  WITH CHECK (app.is_admin() AND (app.is_director() OR created_by = app.current_employee_id()));
CREATE POLICY documents_update ON public.documents FOR UPDATE TO authenticated
  USING (app.is_director() OR (app.is_admin() AND created_by = app.current_employee_id()))
  WITH CHECK (app.is_director() OR (app.is_admin() AND created_by = app.current_employee_id()));
CREATE POLICY documents_delete ON public.documents FOR DELETE TO authenticated
  USING (app.is_director() OR (app.is_admin() AND created_by = app.current_employee_id()));