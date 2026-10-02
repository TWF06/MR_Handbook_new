CREATE TABLE public.libraries (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  order_num integer NOT NULL DEFAULT 1,
  visibility text NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.libraries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.libraries TO authenticated;
GRANT ALL ON public.libraries TO service_role;

ALTER TABLE public.libraries ENABLE ROW LEVEL SECURITY;

CREATE POLICY libraries_select_public ON public.libraries FOR SELECT TO anon USING (true);
CREATE POLICY libraries_select ON public.libraries FOR SELECT TO authenticated USING (true);
CREATE POLICY libraries_insert ON public.libraries FOR INSERT TO authenticated WITH CHECK (app.is_director());
CREATE POLICY libraries_update ON public.libraries FOR UPDATE TO authenticated USING (app.is_director()) WITH CHECK (app.is_director());
CREATE POLICY libraries_delete ON public.libraries FOR DELETE TO authenticated USING (app.is_director());

INSERT INTO public.libraries (id, slug, title, order_num, visibility)
VALUES ('handbook', 'handbook', 'Handbook', 1, 'public');

ALTER TABLE public.sections
  ADD COLUMN library_id text NOT NULL DEFAULT 'handbook' REFERENCES public.libraries(id);

CREATE INDEX sections_library_id_idx ON public.sections (library_id);

DROP POLICY IF EXISTS "Public can view all sections" ON public.sections;
CREATE POLICY "Public can view public library sections" ON public.sections
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.libraries l
    WHERE l.id = sections.library_id AND l.visibility = 'public'
  ));

DROP POLICY IF EXISTS "Public can view all documents" ON public.documents;
CREATE POLICY "Public can view public library documents" ON public.documents
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.sections s
    JOIN public.libraries l ON l.id = s.library_id
    WHERE s.id = documents.section_id AND l.visibility = 'public'
  ));