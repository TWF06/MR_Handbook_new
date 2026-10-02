DROP POLICY IF EXISTS faq_threads_select ON public.faq_threads;
CREATE POLICY faq_threads_select ON public.faq_threads FOR SELECT TO authenticated USING (app.is_active_user());
DROP POLICY IF EXISTS faq_replies_select ON public.faq_replies;
CREATE POLICY faq_replies_select ON public.faq_replies FOR SELECT TO authenticated USING (app.is_active_user());
DROP POLICY IF EXISTS org_settings_select ON public.org_settings;
DROP POLICY IF EXISTS org_settings_select_public ON public.org_settings;
CREATE POLICY org_settings_select ON public.org_settings FOR SELECT TO authenticated USING (app.is_active_user());
REVOKE SELECT ON public.org_settings FROM anon;