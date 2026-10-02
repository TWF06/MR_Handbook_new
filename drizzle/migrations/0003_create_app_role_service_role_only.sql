-- EXECUTE is revoked from authenticated; only the service role can call this
-- function, and the server function already verifies the caller is a Director.
-- The in-function app.is_director() check always failed under the service role
-- because there is no auth.uid() in that context.
CREATE OR REPLACE FUNCTION public.create_app_role(_value text, _label text, _level integer, _department text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
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

REVOKE ALL ON FUNCTION public.create_app_role(text, text, integer, text) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_app_role(text, text, integer, text) TO service_role;
