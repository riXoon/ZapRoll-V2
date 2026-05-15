-- Update reporting views to support both consolidated and legacy attendance schemas
-- This migration updates v_event_stats and v_certificate_eligibility to count scans 
-- from the new am_scanned_at, pm_scanned_at, employee_scanned_at columns.
-- It also includes specific AM/PM validation flags for certification eligibility.

-- 0. Drop existing views to avoid column mismatch errors
DROP VIEW IF EXISTS public.v_event_stats CASCADE;
DROP VIEW IF EXISTS public.v_certificate_eligibility CASCADE;

-- 1. Update v_event_stats
CREATE OR REPLACE VIEW public.v_event_stats 
WITH (security_invoker = true)
AS
SELECT 
    e.id AS event_id,
    e.name AS event_name,
    (SELECT count(*) FROM public.registrations WHERE event_id = e.id) AS total_registered,
    (SELECT coalesce(sum(
        GREATEST(
            (CASE WHEN am_scanned_at IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN pm_scanned_at IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN employee_scanned_at IS NOT NULL THEN 1 ELSE 0 END),
            (CASE WHEN session_id IS NOT NULL THEN 1 ELSE 0 END)
        )
     ), 0) FROM public.attendance WHERE event_id = e.id) AS total_attendance_scans,
    (SELECT count(*) FROM public.evaluation_responses er 
     JOIN public.registrations r ON er.registration_id = r.id 
     WHERE r.event_id = e.id) AS total_evaluations
FROM public.events e;

-- 2. Update v_certificate_eligibility with consolidated AM/PM evaluation columns
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
    -- Combined Eligibility (Must meet all 4 criteria)
    (
        a.am_scanned_at IS NOT NULL AND 
        a.pm_scanned_at IS NOT NULL AND
        er.am_eval_submitted_at IS NOT NULL AND
        er.pm_eval_submitted_at IS NOT NULL
    ) AS is_eligible
FROM public.registrations r
LEFT JOIN public.attendance a ON a.registration_id = r.id
LEFT JOIN public.evaluation_responses er ON er.registration_id = r.id;
