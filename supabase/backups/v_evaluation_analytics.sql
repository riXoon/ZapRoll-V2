-- VIEW: public.v_evaluation_analytics
-- Purpose: Dedicated view for evaluation analytics that flattens registration and evaluation data for easier reporting.

DROP VIEW IF EXISTS public.v_evaluation_analytics;

CREATE OR REPLACE VIEW public.v_evaluation_analytics
WITH (security_invoker = true)
AS
SELECT 
    er.id AS response_id,
    r.id AS registration_id,
    r.full_name,
    r.email,
    r.metadata,
    r.event_id,
    er.am_eval_submitted_at,
    er.pm_eval_submitted_at,
    er.am_eval_responses,
    er.pm_eval_responses
FROM public.registrations r
JOIN public.evaluation_responses er ON er.registration_id = r.id;
