-- Migration to allow all authenticated admin users to share and access all data (1 source of truth)

DO $$
BEGIN
    -- 1. Drop existing restricted policies
    DROP POLICY IF EXISTS admin_all_on_events ON public.events;
    DROP POLICY IF EXISTS admin_all_on_quotas ON public.event_quotas;
    DROP POLICY IF EXISTS admin_all_on_registrations ON public.registrations;
    DROP POLICY IF EXISTS admin_all_on_sessions ON public.sessions;
    DROP POLICY IF EXISTS admin_all_on_attendance ON public.attendance;
    DROP POLICY IF EXISTS admin_all_on_templates ON public.evaluation_templates;
    DROP POLICY IF EXISTS admin_all_on_responses ON public.evaluation_responses;
    DROP POLICY IF EXISTS admin_all_on_certificates ON public.certificates;

    -- 2. Create new shared policies for authenticated users
    CREATE POLICY admin_all_on_events ON public.events 
        FOR ALL USING (auth.role() = 'authenticated');

    CREATE POLICY admin_all_on_quotas ON public.event_quotas 
        FOR ALL USING (auth.role() = 'authenticated');

    CREATE POLICY admin_all_on_registrations ON public.registrations 
        FOR ALL USING (auth.role() = 'authenticated');

    CREATE POLICY admin_all_on_sessions ON public.sessions 
        FOR ALL USING (auth.role() = 'authenticated');

    CREATE POLICY admin_all_on_attendance ON public.attendance 
        FOR ALL USING (auth.role() = 'authenticated');

    CREATE POLICY admin_all_on_templates ON public.evaluation_templates 
        FOR ALL USING (auth.role() = 'authenticated');

    CREATE POLICY admin_all_on_responses ON public.evaluation_responses 
        FOR ALL USING (auth.role() = 'authenticated');

    CREATE POLICY admin_all_on_certificates ON public.certificates 
        FOR ALL USING (auth.role() = 'authenticated');

END $$;
