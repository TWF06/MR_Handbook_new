CREATE SCHEMA IF NOT EXISTS app;
GRANT USAGE ON SCHEMA app TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION app.role_level(_role public.app_role)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
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
    WHEN 'barista' THEN 0
  END;
$$;

CREATE OR REPLACE FUNCTION app.user_level(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(MAX(app.role_level(role)), -1) FROM public.user_roles WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION app.current_department()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION app.current_employee_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT employee_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION app.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app.user_level(auth.uid()) >= 5;
$$;

CREATE OR REPLACE FUNCTION app.is_management()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app.user_level(auth.uid()) >= 7;
$$;

CREATE OR REPLACE FUNCTION app.is_active_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'Active');
$$;

CREATE OR REPLACE FUNCTION app.section_visible(_target text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app.is_management()
      OR _target = 'Both'
      OR _target = app.current_department();
$$;

-- Recreate policies against the private helpers
DROP POLICY "profiles_select_managed" ON public.profiles;
CREATE POLICY "profiles_select_managed" ON public.profiles FOR SELECT TO authenticated
  USING (app.is_management() OR (app.is_admin() AND department = app.current_department()));

DROP POLICY "user_roles_select_admin" ON public.user_roles;
CREATE POLICY "user_roles_select_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (app.is_admin());

DROP POLICY "sections_select" ON public.sections;
CREATE POLICY "sections_select" ON public.sections FOR SELECT TO authenticated
  USING (app.section_visible(target_category));
DROP POLICY "sections_write" ON public.sections;
CREATE POLICY "sections_write" ON public.sections FOR ALL TO authenticated
  USING (app.is_admin()) WITH CHECK (app.is_admin());

DROP POLICY "documents_select" ON public.documents;
CREATE POLICY "documents_select" ON public.documents FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sections s
    WHERE s.id = documents.section_id AND app.section_visible(s.target_category)
  ));
DROP POLICY "documents_write" ON public.documents;
CREATE POLICY "documents_write" ON public.documents FOR ALL TO authenticated
  USING (app.is_admin()) WITH CHECK (app.is_admin());

DROP POLICY "faq_threads_insert" ON public.faq_threads;
CREATE POLICY "faq_threads_insert" ON public.faq_threads FOR INSERT TO authenticated
  WITH CHECK (author_id = app.current_employee_id() AND app.is_active_user());
DROP POLICY "faq_threads_update" ON public.faq_threads;
CREATE POLICY "faq_threads_update" ON public.faq_threads FOR UPDATE TO authenticated
  USING (app.is_admin() OR author_id = app.current_employee_id())
  WITH CHECK (app.is_admin() OR author_id = app.current_employee_id());
DROP POLICY "faq_threads_delete" ON public.faq_threads;
CREATE POLICY "faq_threads_delete" ON public.faq_threads FOR DELETE TO authenticated
  USING (app.is_admin() OR author_id = app.current_employee_id());

DROP POLICY "faq_replies_insert" ON public.faq_replies;
CREATE POLICY "faq_replies_insert" ON public.faq_replies FOR INSERT TO authenticated
  WITH CHECK (author_id = app.current_employee_id() AND app.is_active_user());
DROP POLICY "faq_replies_update" ON public.faq_replies;
CREATE POLICY "faq_replies_update" ON public.faq_replies FOR UPDATE TO authenticated
  USING (app.is_admin() OR author_id = app.current_employee_id())
  WITH CHECK (app.is_admin() OR author_id = app.current_employee_id());
DROP POLICY "faq_replies_delete" ON public.faq_replies;
CREATE POLICY "faq_replies_delete" ON public.faq_replies FOR DELETE TO authenticated
  USING (app.is_admin() OR author_id = app.current_employee_id());

DROP POLICY "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs FOR SELECT TO authenticated
  USING (app.is_admin());
DROP POLICY "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = app.current_employee_id());

-- Remove the public copies
DROP FUNCTION public.section_visible(text);
DROP FUNCTION public.is_active_user();
DROP FUNCTION public.is_management();
DROP FUNCTION public.is_admin();
DROP FUNCTION public.current_employee_id();
DROP FUNCTION public.current_department();
DROP FUNCTION public.user_level(uuid);
DROP FUNCTION public.has_role(uuid, public.app_role);
DROP FUNCTION public.role_level(public.app_role);