-- Level 8+ sees every library and section; level 7 (HR editor) is scoped to
-- the departments and stations they are assigned to.
CREATE OR REPLACE FUNCTION app.sees_all()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app.user_level(auth.uid()) >= 8;
$$;

CREATE OR REPLACE FUNCTION app.library_visible(_departments text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app.sees_all()
    OR _departments IS NULL
    OR cardinality(_departments) = 0
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (ARRAY[p.department] || p.departments) && _departments
    );
$$;

CREATE OR REPLACE FUNCTION app.station_visible(_stations text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app.sees_all()
    OR _stations IS NULL
    OR cardinality(_stations) = 0
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.stations && _stations
    );
$$;

-- True when the caller is an HR-level editor (7) and the section is inside
-- their assigned scope.
CREATE OR REPLACE FUNCTION app.can_edit_section_content(_section_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app.user_level(auth.uid()) >= 7
    AND EXISTS (
      SELECT 1 FROM public.sections s
      WHERE s.id = _section_id
        AND app.section_gate(s.library_id, s.target_stations)
    );
$$;

DROP POLICY IF EXISTS documents_insert ON public.documents;
CREATE POLICY documents_insert ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    app.is_admin()
    AND (
      app.can_configure()
      OR app.can_edit_section_content(section_id)
      OR created_by = app.current_employee_id()
    )
  );

DROP POLICY IF EXISTS documents_update ON public.documents;
CREATE POLICY documents_update ON public.documents
  FOR UPDATE TO authenticated
  USING (
    app.can_configure()
    OR app.can_edit_section_content(section_id)
    OR (app.is_admin() AND created_by = app.current_employee_id())
  )
  WITH CHECK (
    app.can_configure()
    OR app.can_edit_section_content(section_id)
    OR (app.is_admin() AND created_by = app.current_employee_id())
  );

DROP POLICY IF EXISTS documents_delete ON public.documents;
CREATE POLICY documents_delete ON public.documents
  FOR DELETE TO authenticated
  USING (
    app.can_configure()
    OR app.can_edit_section_content(section_id)
    OR (app.is_admin() AND created_by = app.current_employee_id())
  );
