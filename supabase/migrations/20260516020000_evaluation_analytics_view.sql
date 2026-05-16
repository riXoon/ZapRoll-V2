-- Create a dedicated view for evaluation analytics
-- This view flattens registration and evaluation data for easier reporting

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

-- Ensure RLS is handled via security_invoker or explicit policies if needed
-- (Already handled by security_invoker = true)
