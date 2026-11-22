-- Migration to fix certificate eligibility logic for Poster Presenters.
-- Removes the special bypass that automatically made them eligible with only scans,
-- requiring all participants (including Poster Presenters) to meet the standard 4-point check:
-- 1. Attendance scan in AM (am_scanned_at is not null)
-- 2. Submission of AM evaluation (am_eval_submitted_at is not null)
-- 3. Attendance scan in PM (pm_scanned_at is not null)
-- 4. Submission of PM evaluation (pm_eval_submitted_at is not null)

DROP VIEW IF EXISTS public.v_certificate_eligibility;

CREATE OR REPLACE VIEW public.v_certificate_eligibility 
WITH (security_invoker = true)
AS
SELECT 
    r.id AS registration_id,
    r.full_name,
    r.email,
    r.external_id,
    r.event_id,
    r.metadata,
    -- Timestamps for frontend display
    a.am_scanned_at,
    a.pm_scanned_at,
    er.am_eval_submitted_at,
    er.pm_eval_submitted_at,
    -- Combined Eligibility (All students, including Poster Presenters, need standard 4-point check)
    (
        a.am_scanned_at IS NOT NULL AND 
        a.pm_scanned_at IS NOT NULL AND
        er.am_eval_submitted_at IS NOT NULL AND
        er.pm_eval_submitted_at IS NOT NULL
    ) AS is_eligible,
    -- Role helper for frontend
    (r.metadata->>'studentRole' = 'Poster Presenter' AND r.metadata->>'yearLevel' = '4th Year') AS is_poster_presenter
FROM public.registrations r
LEFT JOIN public.attendance a ON a.registration_id = r.id
LEFT JOIN public.evaluation_responses er ON er.registration_id = r.id;
