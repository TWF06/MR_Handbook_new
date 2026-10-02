ALTER TABLE public.libraries ADD COLUMN IF NOT EXISTS target_departments text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS target_stations text[] NOT NULL DEFAULT '{}'::text[];

CREATE OR REPLACE FUNCTION app.library_visible(_departments text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app.is_management()
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
  SELECT app.is_management()
    OR _stations IS NULL
    OR cardinality(_stations) = 0
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.stations && _stations
    );
$$;

CREATE OR REPLACE FUNCTION app.doc_visible_roles(_roles app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app.is_management()
    OR _roles IS NULL
    OR cardinality(_roles) = 0
    OR EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = auth.uid() AND r.role = ANY(_roles)
    );
$$;

CREATE OR REPLACE FUNCTION app.section_gate(_library_id text, _stations text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app.station_visible(_stations)
    AND EXISTS (
      SELECT 1 FROM public.libraries l
      WHERE l.id = _library_id AND app.library_visible(l.target_departments)
    );
$$;

DROP POLICY IF EXISTS libraries_select ON public.libraries;
CREATE POLICY libraries_select ON public.libraries
  FOR SELECT TO authenticated
  USING (app.library_visible(target_departments));

DROP POLICY IF EXISTS sections_select ON public.sections;
CREATE POLICY sections_select ON public.sections
  FOR SELECT TO authenticated
  USING (app.section_gate(library_id, target_stations));

DROP POLICY IF EXISTS documents_select ON public.documents;
CREATE POLICY documents_select ON public.documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sections s
      WHERE s.id = documents.section_id
        AND app.section_gate(s.library_id, s.target_stations)
    )
    AND app.doc_visible_roles(target_roles)
  );