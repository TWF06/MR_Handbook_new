-- Audit log readable by Director only
DROP POLICY IF EXISTS audit_logs_select_admin ON public.audit_logs;
CREATE POLICY audit_logs_select_director ON public.audit_logs
  FOR SELECT TO authenticated
  USING (app.is_director());

-- Outlets, stations, departments and roles configurable by Director only
DROP POLICY IF EXISTS org_settings_insert ON public.org_settings;
DROP POLICY IF EXISTS org_settings_update ON public.org_settings;
DROP POLICY IF EXISTS org_settings_delete ON public.org_settings;

CREATE POLICY org_settings_insert ON public.org_settings
  FOR INSERT TO authenticated
  WITH CHECK (app.is_director());

CREATE POLICY org_settings_update ON public.org_settings
  FOR UPDATE TO authenticated
  USING (app.is_director())
  WITH CHECK (app.is_director());

CREATE POLICY org_settings_delete ON public.org_settings
  FOR DELETE TO authenticated
  USING (app.is_director());