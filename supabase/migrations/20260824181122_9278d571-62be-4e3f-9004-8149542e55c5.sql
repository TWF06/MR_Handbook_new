DROP POLICY IF EXISTS org_settings_update ON public.org_settings;
CREATE POLICY org_settings_update ON public.org_settings
FOR UPDATE TO authenticated
USING (
  ((kind = ANY (ARRAY['outlet'::text,'station'::text])) AND app.can_configure())
  OR ((kind = ANY (ARRAY['department'::text,'role'::text])) AND app.is_director())
)
WITH CHECK (
  ((kind = ANY (ARRAY['outlet'::text,'station'::text])) AND app.can_configure())
  OR ((kind = ANY (ARRAY['department'::text,'role'::text])) AND app.is_director())
);