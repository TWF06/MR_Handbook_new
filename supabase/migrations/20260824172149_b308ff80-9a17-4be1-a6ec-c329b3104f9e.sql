CREATE OR REPLACE FUNCTION app.role_level(_role app_role)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  SELECT CASE _role
    WHEN 'director' THEN 9
    WHEN 'administrative' THEN 8
    WHEN 'hr' THEN 7
    WHEN 'boh_manager' THEN 6
    WHEN 'foh_manager' THEN 5
    WHEN 'cdp' THEN 4
    WHEN 'sous' THEN 3
    WHEN 'boh_crew' THEN 2
    WHEN 'waiter' THEN 1
    WHEN 'cashier' THEN 1
    WHEN 'barista' THEN 0
  END;
$function$;

CREATE OR REPLACE FUNCTION app.can_configure()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT app.user_level(auth.uid()) >= 8;
$function$;

REVOKE EXECUTE ON FUNCTION app.can_configure() FROM anon, public;
GRANT EXECUTE ON FUNCTION app.can_configure() TO authenticated, service_role;

CREATE TABLE public.org_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('outlet','station','department','role')),
  value text NOT NULL,
  label text NOT NULL,
  order_num integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, value)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_settings TO authenticated;
GRANT SELECT ON public.org_settings TO anon;
GRANT ALL ON public.org_settings TO service_role;

ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_settings_select" ON public.org_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "org_settings_select_public" ON public.org_settings FOR SELECT TO anon USING (true);
CREATE POLICY "org_settings_update" ON public.org_settings FOR UPDATE TO authenticated
  USING (app.can_configure()) WITH CHECK (app.can_configure());
CREATE POLICY "org_settings_insert" ON public.org_settings FOR INSERT TO authenticated
  WITH CHECK (
    (kind IN ('outlet','station') AND app.can_configure())
    OR (kind IN ('department','role') AND app.is_director())
  );
CREATE POLICY "org_settings_delete" ON public.org_settings FOR DELETE TO authenticated
  USING (
    (kind IN ('outlet','station') AND app.can_configure())
    OR (kind IN ('department','role') AND app.is_director())
  );

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER org_settings_updated_at BEFORE UPDATE ON public.org_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.org_settings (kind, value, label, order_num) VALUES
  ('outlet', 'Marco 1U', 'Marco 1U', 1),
  ('outlet', 'Marco TGM', 'Marco TGM', 2),
  ('outlet', 'Rebel Pasta', 'Rebel Pasta', 3),
  ('station', 'Station 1', 'Station 1', 1),
  ('station', 'Station 2', 'Station 2', 2),
  ('station', 'Station 3', 'Station 3', 3),
  ('station', 'Station 4', 'Station 4', 4),
  ('station', 'Station 5', 'Station 5', 5),
  ('department', 'Management', 'Management', 1),
  ('department', 'BOH', 'BOH', 2),
  ('department', 'FOH', 'FOH', 3),
  ('role', 'director', 'Director', 9),
  ('role', 'administrative', 'Admin', 8),
  ('role', 'hr', 'HR (Editor)', 7),
  ('role', 'boh_manager', 'BOH Manager', 6),
  ('role', 'foh_manager', 'FOH Manager', 5),
  ('role', 'cdp', 'CDP', 4),
  ('role', 'sous', 'SOUS', 3),
  ('role', 'boh_crew', 'BOH Crew', 2),
  ('role', 'waiter', 'Waiter', 1),
  ('role', 'cashier', 'Cashier', 1),
  ('role', 'barista', 'Barista', 0);

DROP POLICY IF EXISTS sections_update ON public.sections;
DROP POLICY IF EXISTS sections_delete ON public.sections;
DROP POLICY IF EXISTS sections_insert ON public.sections;
DROP POLICY IF EXISTS documents_update ON public.documents;
DROP POLICY IF EXISTS documents_delete ON public.documents;
DROP POLICY IF EXISTS documents_insert ON public.documents;

CREATE POLICY sections_insert ON public.sections FOR INSERT TO authenticated
  WITH CHECK (app.is_admin() AND (app.can_configure() OR created_by = app.current_employee_id()));
CREATE POLICY sections_update ON public.sections FOR UPDATE TO authenticated
  USING (app.can_configure() OR (app.is_admin() AND created_by = app.current_employee_id()))
  WITH CHECK (app.can_configure() OR (app.is_admin() AND created_by = app.current_employee_id()));
CREATE POLICY sections_delete ON public.sections FOR DELETE TO authenticated
  USING (app.can_configure() OR (app.is_admin() AND created_by = app.current_employee_id()));

CREATE POLICY documents_insert ON public.documents FOR INSERT TO authenticated
  WITH CHECK (app.is_admin() AND (app.can_configure() OR created_by = app.current_employee_id()));
CREATE POLICY documents_update ON public.documents FOR UPDATE TO authenticated
  USING (app.can_configure() OR (app.is_admin() AND created_by = app.current_employee_id()))
  WITH CHECK (app.can_configure() OR (app.is_admin() AND created_by = app.current_employee_id()));
CREATE POLICY documents_delete ON public.documents FOR DELETE TO authenticated
  USING (app.can_configure() OR (app.is_admin() AND created_by = app.current_employee_id()));