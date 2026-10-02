-- Public read access for the handbook site
GRANT SELECT ON public.sections TO anon;
GRANT SELECT ON public.documents TO anon;

CREATE POLICY "Public can view all sections" ON public.sections FOR SELECT TO anon USING (true);
CREATE POLICY "Public can view all documents" ON public.documents FOR SELECT TO anon USING (true);

-- Rename outlets to match the Marco brand names
UPDATE public.profiles
SET outlets = array_replace(
  array_replace(
    array_replace(outlets, 'Outlet A', 'Marco 1U'),
    'Outlet B', 'Marco TGM'
  ),
  'Outlet C', 'Rebel Pasta'
)
WHERE outlets && ARRAY['Outlet A', 'Outlet B', 'Outlet C']::text[];

UPDATE public.documents
SET target_outlets = array_replace(
  array_replace(
    array_replace(target_outlets, 'Outlet A', 'Marco 1U'),
    'Outlet B', 'Marco TGM'
  ),
  'Outlet C', 'Rebel Pasta'
)
WHERE target_outlets && ARRAY['Outlet A', 'Outlet B', 'Outlet C']::text[];