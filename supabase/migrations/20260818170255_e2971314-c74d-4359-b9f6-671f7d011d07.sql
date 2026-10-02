-- 1. Assignment columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS outlets text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stations text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS departments text[] NOT NULL DEFAULT '{}';

-- Existing employees keep full access to every outlet/station.
UPDATE public.profiles
SET outlets = ARRAY['Outlet A','Outlet B','Outlet C'],
    stations = ARRAY['Station 1','Station 2','Station 3','Station 4','Station 5']
WHERE cardinality(outlets) = 0;

-- 2. Primary role flag: rank comes from the primary role, extras are visibility only.
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

UPDATE public.user_roles ur
SET is_primary = true
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles o WHERE o.user_id = ur.user_id AND o.is_primary
) AND ur.id = (
  SELECT i.id FROM public.user_roles i WHERE i.user_id = ur.user_id
  ORDER BY app.role_level(i.role) DESC LIMIT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_one_primary
  ON public.user_roles (user_id) WHERE is_primary;

CREATE OR REPLACE FUNCTION app.user_level(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(app.role_level((
    SELECT role FROM public.user_roles
    WHERE user_id = _user_id
    ORDER BY is_primary DESC, app.role_level(role) DESC
    LIMIT 1
  )), -1);
$$;

-- 3. Document audience tags (empty array = everyone)
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS target_outlets text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_stations text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_departments text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_roles app_role[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION app.doc_visible(
  _outlets text[], _stations text[], _departments text[], _roles app_role[]
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT app.is_management()
    OR (
      (cardinality(_outlets) = 0 OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.outlets && _outlets))
      AND (cardinality(_stations) = 0 OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.stations && _stations))
      AND (cardinality(_departments) = 0 OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND (ARRAY[p.department] || p.departments) && _departments))
      AND (cardinality(_roles) = 0 OR EXISTS (
        SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = ANY(_roles)))
    );
$$;

DROP POLICY IF EXISTS documents_select ON public.documents;
CREATE POLICY documents_select ON public.documents FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sections s
    WHERE s.id = documents.section_id AND app.section_visible(s.target_category)
  )
  AND app.doc_visible(target_outlets, target_stations, target_departments, target_roles)
);