CREATE OR REPLACE FUNCTION app.section_visible(_target text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT app.is_management()
      OR _target IN ('All', 'Both')
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND _target = ANY(ARRAY[p.department] || p.departments)
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles r
        WHERE r.user_id = auth.uid()
          AND _target = CASE
            WHEN r.role IN ('director','hr','administrative') THEN 'Management'
            WHEN r.role IN ('boh_manager','cdp','sous','boh_crew') THEN 'BOH'
            WHEN r.role IN ('foh_manager','waiter','barista','cashier') THEN 'FOH'
          END
      );
$function$;

CREATE OR REPLACE FUNCTION app.role_level(_role app_role)
 RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  SELECT CASE _role
    WHEN 'director' THEN 9
    WHEN 'hr' THEN 8
    WHEN 'administrative' THEN 7
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