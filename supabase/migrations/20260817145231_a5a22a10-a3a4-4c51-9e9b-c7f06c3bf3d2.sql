-- Roles enum
CREATE TYPE public.app_role AS ENUM (
  'director','hr','administrative','boh_manager','foh_manager',
  'cdp','sous','boh_crew','waiter','barista'
);

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id text UNIQUE NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  department text NOT NULL,
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.role_level(_role public.app_role)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
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

CREATE OR REPLACE FUNCTION public.user_level(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(MAX(public.role_level(role)), -1) FROM public.user_roles WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.current_department()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT employee_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_level(auth.uid()) >= 5;
$$;

CREATE OR REPLACE FUNCTION public.is_management()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_level(auth.uid()) >= 7;
$$;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'Active');
$$;

-- Profiles policies
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "profiles_select_managed" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_management() OR (public.is_admin() AND department = public.current_department()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND status = 'Active');

-- User roles policies
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "user_roles_select_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_admin());

-- Sections
CREATE TABLE public.sections (
  id text PRIMARY KEY,
  title text NOT NULL,
  order_num integer NOT NULL,
  target_category text NOT NULL DEFAULT 'Both'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sections TO authenticated;
GRANT ALL ON public.sections TO service_role;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.section_visible(_target text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_management()
      OR _target = 'Both'
      OR _target = public.current_department();
$$;

CREATE POLICY "sections_select" ON public.sections FOR SELECT TO authenticated
  USING (public.section_visible(target_category));
CREATE POLICY "sections_write" ON public.sections FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Documents
CREATE TABLE public.documents (
  id text PRIMARY KEY,
  section_id text REFERENCES public.sections(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  order_num integer NOT NULL,
  last_updated timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select" ON public.documents FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sections s
    WHERE s.id = documents.section_id AND public.section_visible(s.target_category)
  ));
CREATE POLICY "documents_write" ON public.documents FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- FAQ threads
CREATE TABLE public.faq_threads (
  id text PRIMARY KEY,
  author_id text REFERENCES public.profiles(employee_id) ON DELETE SET NULL,
  author_name text NOT NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved boolean NOT NULL DEFAULT false,
  pinned_reply_id text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faq_threads TO authenticated;
GRANT ALL ON public.faq_threads TO service_role;
ALTER TABLE public.faq_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faq_threads_select" ON public.faq_threads FOR SELECT TO authenticated USING (true);
CREATE POLICY "faq_threads_insert" ON public.faq_threads FOR INSERT TO authenticated
  WITH CHECK (author_id = public.current_employee_id() AND public.is_active_user());
CREATE POLICY "faq_threads_update" ON public.faq_threads FOR UPDATE TO authenticated
  USING (public.is_admin() OR author_id = public.current_employee_id())
  WITH CHECK (public.is_admin() OR author_id = public.current_employee_id());
CREATE POLICY "faq_threads_delete" ON public.faq_threads FOR DELETE TO authenticated
  USING (public.is_admin() OR author_id = public.current_employee_id());

-- FAQ replies
CREATE TABLE public.faq_replies (
  id text PRIMARY KEY,
  thread_id text REFERENCES public.faq_threads(id) ON DELETE CASCADE,
  author_id text REFERENCES public.profiles(employee_id) ON DELETE SET NULL,
  author_name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faq_replies TO authenticated;
GRANT ALL ON public.faq_replies TO service_role;
ALTER TABLE public.faq_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faq_replies_select" ON public.faq_replies FOR SELECT TO authenticated USING (true);
CREATE POLICY "faq_replies_insert" ON public.faq_replies FOR INSERT TO authenticated
  WITH CHECK (author_id = public.current_employee_id() AND public.is_active_user());
CREATE POLICY "faq_replies_update" ON public.faq_replies FOR UPDATE TO authenticated
  USING (public.is_admin() OR author_id = public.current_employee_id())
  WITH CHECK (public.is_admin() OR author_id = public.current_employee_id());
CREATE POLICY "faq_replies_delete" ON public.faq_replies FOR DELETE TO authenticated
  USING (public.is_admin() OR author_id = public.current_employee_id());

-- Audit logs
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  user_name text,
  action text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select_admin" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_employee_id());

-- Seed sections
INSERT INTO public.sections (id, title, order_num, target_category) VALUES
  ('sec-intro','Company Introduction',1,'Both'),
  ('sec-safety','Safety Guidelines',2,'Both'),
  ('sec-warehouse','Warehouse Procedures',3,'BOH'),
  ('sec-hr','HR Policies',4,'Both'),
  ('sec-emergency','Emergency Procedures',5,'Both'),
  ('sec-foh','FOH Operations',6,'FOH');

-- Seed documents
INSERT INTO public.documents (id, section_id, title, content, order_num) VALUES
('doc-welcome','sec-intro','Welcome to MR','# Welcome to MR

We are glad to have you on the team. This handbook is the single source of truth for how we work.

## Our Mission

Serve outstanding food and drink with consistency, safety, and warmth.

## How to use this handbook

1. Browse sections in the left sidebar.
2. Use the search bar to jump straight to a topic.
3. Ask anything you cannot find on the FAQ board.

## Who to ask

Your department manager is your first point of contact. HR handles employment matters.',1),
('doc-values','sec-intro','Values and Conduct','# Values and Conduct

## Respect

Treat every colleague and guest with respect. Harassment of any kind is never tolerated.

## Ownership

If you see a problem, fix it or escalate it. Never walk past a hazard.

## Punctuality

Arrive five minutes before your shift in full uniform.',2),
('doc-ppe','sec-safety','PPE and Decibel Zones','# PPE and Decibel Zones

## Required PPE

- Non-slip closed-toe shoes at all times
- Cut-resistant gloves when using the mandoline or slicer
- Heat-resistant gloves for oven and fryer work
- Apron and hair restraint in all food-prep areas

## Decibel zone criteria

| Zone | Level | Requirement |
| --- | --- | --- |
| Green | Below 80 dB | No hearing protection required |
| Amber | 80-85 dB | Hearing protection available on request |
| Red | Above 85 dB | Hearing protection mandatory, exposure logged |

## Reporting

Report any damaged PPE to your manager immediately. Never continue a task with defective equipment.',1),
('doc-safe-ops','sec-safety','Standard Operating Safety','# Standard Operating Safety

## Before you start

1. Check the equipment log for open faults.
2. Confirm guards and interlocks are fitted.
3. Clear the workspace of clutter and standing water.

## While working

- Announce hot pans and sharp transfers out loud.
- Never carry knives point-forward.
- Clean spills immediately and place a wet-floor sign.

## After your shift

Shut down, clean, and sign the closing checklist.',2),
('doc-receiving','sec-warehouse','Receiving and Storage','# Receiving and Storage

## Deliveries

1. Check the temperature of chilled and frozen goods on arrival.
2. Reject any item above 5 C for chilled or above -15 C for frozen.
3. Record batch numbers and expiry dates.

## Storage rules

- First in, first out on every shelf.
- Raw above cooked is never acceptable.
- Keep all stock 15 cm off the floor.',1),
('doc-manual-handling','sec-warehouse','Manual Handling','# Manual Handling

## Lifting technique

1. Assess the load before lifting.
2. Bend the knees, keep the back straight.
3. Hold the load close to your body.
4. Turn with your feet, never twist your spine.

## Limits

Anything above 20 kg is a two-person lift. Use the trolley for repeated moves.',2),
('doc-leave','sec-hr','Leave and Attendance','# Leave and Attendance

## Requesting leave

Submit requests at least 14 days ahead through your manager. Approval depends on roster coverage.

## Sickness

Call your manager at least three hours before your shift. A medical certificate is required after two consecutive days.

## Overtime

Overtime must be approved in advance and is recorded on the roster.',1),
('doc-grievance','sec-hr','Grievance Procedure','# Grievance Procedure

## Step 1: Informal

Raise the issue with your manager. Most matters are resolved here.

## Step 2: Formal

Submit a written grievance to HR. You will receive acknowledgement within three working days.

## Step 3: Review

A meeting is held within ten working days. You may be accompanied by a colleague.',2),
('doc-pass','sec-emergency','Fire Extinguisher: PASS','# Fire Extinguisher Procedure (PASS)

Only fight a fire if it is small, you have an escape route, and you are trained.

## PASS

1. **P**ull the pin to break the tamper seal.
2. **A**im low at the base of the fire.
3. **S**queeze the handle to release the agent.
4. **S**weep side to side until the fire is out.

## Choosing the right extinguisher

- Water: paper, wood, textiles
- CO2: electrical equipment
- Wet chemical: cooking oils and fats
- Never use water on a fat fire.',1),
('doc-evacuation','sec-emergency','Evacuation Routes','# Evacuation Routes

## On hearing the alarm

1. Stop work and turn off gas and fryers if it is safe.
2. Leave by the nearest marked exit.
3. Do not use lifts. Do not return for belongings.

## Assembly points

- Kitchen and warehouse staff: rear loading bay
- Front of house and guests: front car park island

## Roll call

The duty manager takes the roll call. Report to them before leaving the site.',2),
('doc-greeting','sec-foh','Customer Service Greeting Standards','# Customer Service Greeting Standards

## The ten-second rule

Acknowledge every guest within ten seconds of arrival, even if you cannot seat them yet.

## Greeting script

1. Smile and make eye contact.
2. "Good morning / afternoon / evening, welcome to MR."
3. Confirm the party size and any booking.
4. Escort to the table and present menus.

## Tone

Warm, clear, unhurried. Never rush a guest through ordering.',1),
('doc-service-flow','sec-foh','Service Flow and Table Handover','# Service Flow and Table Handover

## Sequence of service

1. Greet and seat
2. Drinks order within three minutes
3. Food order and allergen check
4. Quality check two minutes after the main course lands
5. Clear, dessert, bill

## Handover

At shift change, walk the section with the incoming server and state the stage of each table.',2);