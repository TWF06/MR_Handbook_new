ALTER TABLE public.profiles ADD COLUMN last_login_at timestamptz;

COMMENT ON COLUMN public.profiles.last_login_at IS 'Most recent sign-in, maintained by trigger on audit_logs.';

UPDATE public.profiles p
SET last_login_at = sub.ts
FROM (
  SELECT user_id, MAX(timestamp) AS ts
  FROM public.audit_logs
  WHERE action = 'Signed in'
  GROUP BY user_id
) sub
WHERE p.employee_id = sub.user_id;

CREATE OR REPLACE FUNCTION public.record_last_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.action = 'Signed in' AND NEW.user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET last_login_at = NEW.timestamp
    WHERE employee_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_last_login() FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.record_last_login() TO service_role;

CREATE TRIGGER audit_logs_record_last_login
AFTER INSERT ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.record_last_login();