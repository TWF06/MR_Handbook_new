DROP POLICY IF EXISTS faq_threads_update ON public.faq_threads;
CREATE POLICY faq_threads_update ON public.faq_threads
  FOR UPDATE TO authenticated
  USING (app.is_management())
  WITH CHECK (app.is_management());