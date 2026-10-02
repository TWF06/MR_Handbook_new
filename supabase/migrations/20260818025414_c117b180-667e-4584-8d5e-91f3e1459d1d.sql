CREATE OR REPLACE FUNCTION app.section_visible(_target text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app.is_management()
      OR _target IN ('All', 'Both')
      OR _target = app.current_department();
$$;

ALTER TABLE public.sections ALTER COLUMN target_category SET DEFAULT 'All';

UPDATE public.sections SET target_category = 'All' WHERE target_category = 'Both';