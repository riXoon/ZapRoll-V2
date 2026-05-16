-- Separate 4th Year Poster Presenters from main event stats and update certificate eligibility

-- 1. Update v_event_stats to separate counts
DROP VIEW IF EXISTS public.v_event_stats;
CREATE OR REPLACE VIEW public.v_event_stats 
WITH (security_invoker = true)
AS
SELECT 
    e.id AS event_id,
    e.name AS event_name,
    -- Total Registered (Includes everyone)
    (SELECT count(*) FROM public.registrations WHERE event_id = e.id) AS total_registered,
    -- Colloquium Registered (Excludes 4th Year Poster Presenters)
    (SELECT count(*) FROM public.registrations 
     WHERE event_id = e.id 
     AND NOT (metadata->>'studentRole' = 'Poster Presenter' AND metadata->>'yearLevel' = '4th Year')) AS colloquium_registered,
    -- Poster Presenters Registered (Only 4th Year Poster Presenters)
    (SELECT count(*) FROM public.registrations 
     WHERE event_id = e.id 
     AND (metadata->>'studentRole' = 'Poster Presenter' AND metadata->>'yearLevel' = '4th Year')) AS poster_presenters_registered,
    -- Poster Presenters Pre-Reg
    (SELECT count(*) FROM public.registrations 
     WHERE event_id = e.id AND reg_type = 'pre-reg'
     AND (metadata->>'studentRole' = 'Poster Presenter' AND metadata->>'yearLevel' = '4th Year')) AS poster_pre_reg_count,
    -- Poster Presenters Walk-in
    (SELECT count(*) FROM public.registrations 
     WHERE event_id = e.id AND reg_type = 'walk-in'
     AND (metadata->>'studentRole' = 'Poster Presenter' AND metadata->>'yearLevel' = '4th Year')) AS poster_walkin_count,
    -- Poster Presenters Attended (Scanned for Clearance)
    (SELECT count(DISTINCT r.id) FROM public.registrations r
     JOIN public.attendance a ON a.registration_id = r.id
     WHERE r.event_id = e.id 
     AND (r.metadata->>'studentRole' = 'Poster Presenter' AND r.metadata->>'yearLevel' = '4th Year')) AS poster_attended_count,
    -- Colloquium Presenters Registered (4th Year)
    (SELECT count(*) FROM public.registrations 
     WHERE event_id = e.id 
     AND (metadata->>'studentRole' = 'Colloquium Presenter' AND metadata->>'yearLevel' = '4th Year')) AS colloquium_presenters_registered,
    -- Colloquium Presenters Attended (4th Year)
    (SELECT count(DISTINCT r.id) FROM public.registrations r
     JOIN public.attendance a ON a.registration_id = r.id
     WHERE r.event_id = e.id 
     AND (r.metadata->>'studentRole' = 'Colloquium Presenter' AND r.metadata->>'yearLevel' = '4th Year')) AS colloquium_presenters_attended,
    -- Colloquium Participants Registered (4th Year)
    (SELECT count(*) FROM public.registrations 
     WHERE event_id = e.id 
     AND (metadata->>'studentRole' = 'Colloquium Participant' AND metadata->>'yearLevel' = '4th Year')) AS colloquium_participants_registered,
    -- Colloquium Participants Attended (4th Year)
    (SELECT count(DISTINCT r.id) FROM public.registrations r
     JOIN public.attendance a ON a.registration_id = r.id
     WHERE r.event_id = e.id 
     AND (r.metadata->>'studentRole' = 'Colloquium Participant' AND r.metadata->>'yearLevel' = '4th Year')) AS colloquium_participants_attended,
    -- Total Attendance Scans
    (SELECT coalesce(sum(
        GREATEST(
            (CASE WHEN am_scanned_at IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN pm_scanned_at IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN employee_scanned_at IS NOT NULL THEN 1 ELSE 0 END),
            (CASE WHEN session_id IS NOT NULL THEN 1 ELSE 0 END)
        )
     ), 0) FROM public.attendance WHERE event_id = e.id) AS total_attendance_scans,
    -- Total Evaluations
    (SELECT count(*) FROM public.evaluation_responses er 
     JOIN public.registrations r ON er.registration_id = r.id 
     WHERE r.event_id = e.id) AS total_evaluations
FROM public.events e;

-- 2. Update v_certificate_eligibility with specific logic for Poster Presenters
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
    -- Combined Eligibility
    (
        CASE 
            WHEN (r.metadata->>'studentRole' = 'Poster Presenter' AND r.metadata->>'yearLevel' = '4th Year') THEN
                -- Poster Presenters only need Registration + Poster Clearance (tracked in pm_scanned_at)
                a.pm_scanned_at IS NOT NULL
            ELSE
                -- Others need standard 4-point check
                a.am_scanned_at IS NOT NULL AND 
                a.pm_scanned_at IS NOT NULL AND
                er.am_eval_submitted_at IS NOT NULL AND
                er.pm_eval_submitted_at IS NOT NULL
        END
    ) AS is_eligible,
    -- Role helper for frontend
    (r.metadata->>'studentRole' = 'Poster Presenter' AND r.metadata->>'yearLevel' = '4th Year') AS is_poster_presenter
FROM public.registrations r
LEFT JOIN public.attendance a ON a.registration_id = r.id
LEFT JOIN public.evaluation_responses er ON er.registration_id = r.id;
