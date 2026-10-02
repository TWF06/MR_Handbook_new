ALTER TABLE public.org_settings ADD COLUMN IF NOT EXISTS department text;

UPDATE public.org_settings SET department = CASE value
  WHEN 'director' THEN 'Management'
  WHEN 'administrative' THEN 'Management'
  WHEN 'hr' THEN 'Management'
  WHEN 'boh_manager' THEN 'BOH'
  WHEN 'cdp' THEN 'BOH'
  WHEN 'sous' THEN 'BOH'
  WHEN 'boh_crew' THEN 'BOH'
  WHEN 'foh_manager' THEN 'FOH'
  WHEN 'waiter' THEN 'FOH'
  WHEN 'cashier' THEN 'FOH'
  WHEN 'barista' THEN 'FOH'
  ELSE department END
WHERE kind = 'role';

CREATE OR REPLACE FUNCTION app.role_level(_role app_role)
RETURNS integer LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT order_num FROM public.org_settings WHERE kind = 'role' AND value = _role::text LIMIT 1),
    CASE _role
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
    END);
$function$;

CREATE OR REPLACE FUNCTION public.create_app_role(_value text, _label text, _level integer, _department text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT app.is_director() THEN
    RAISE EXCEPTION 'Only a Director can add roles.';
  END IF;
  IF _value !~ '^[a-z][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'Role key must be lowercase letters, numbers and underscores.';
  END IF;
  IF _level < 0 OR _level > 9 THEN
    RAISE EXCEPTION 'Level must be between 0 and 9.';
  END IF;

  EXECUTE format('ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS %L', _value);

  INSERT INTO public.org_settings (kind, value, label, order_num, department)
  VALUES ('role', _value, _label, _level, _department)
  ON CONFLICT (kind, value) DO UPDATE
    SET label = EXCLUDED.label, order_num = EXCLUDED.order_num, department = EXCLUDED.department;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_app_role(text, text, integer, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_app_role(text, text, integer, text) TO authenticated, service_role;