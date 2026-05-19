-- ====================================================================
-- ZAPROLL DATABASE VIEWS CONSOLIDATED BACKUP
-- Consolidates all reporting and analytics views from the database
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. VIEW: public.v_quota_usage
-- Purpose: Tracks used quota/role capacity against total allowed capacity.
-- --------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_quota_usage;

CREATE OR REPLACE VIEW public.v_quota_usage 
WITH (security_invoker = true)
AS
SELECT 
    q.id,
    q.event_id,
    q.name,
    q.capacity,
    q.registration_url,
    (SELECT count(*) FROM public.registrations r WHERE r.quota_id = q.id) as used_capacity
FROM public.event_quotas q;


-- --------------------------------------------------------------------
-- 2. VIEW: public.v_poster_clearance_whitelist
-- Purpose: Filters eligible 4th Year Poster Presenters requiring check-in/out.
-- --------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_poster_clearance_whitelist;

CREATE OR REPLACE VIEW public.v_poster_clearance_whitelist 
WITH (security_invoker = true)
AS
SELECT 
    r.id AS registration_id,
    r.full_name,
    r.email,
    r.external_id,
    r.event_id,
    r.metadata,
    r.reg_type,
    -- Timestamps for frontend display
    a.poster_scanned_at,
    a.poster_out_at,
    -- Eligibility: Pre-registered AND has both scans
    (
        r.reg_type = 'pre-reg' AND
        a.poster_scanned_at IS NOT NULL AND 
        a.poster_out_at IS NOT NULL
    ) AS is_eligible
FROM public.registrations r
LEFT JOIN public.attendance a ON a.registration_id = r.id
WHERE 
    (r.metadata->>'studentRole' ILIKE 'Poster Presenter') AND 
    (r.metadata->>'yearLevel' = '4th Year' OR r.metadata->>'year' = '4th Year');


-- --------------------------------------------------------------------
-- 3. VIEW: public.v_evaluation_analytics
-- Purpose: Flattens registration and evaluation data for analysis.
-- --------------------------------------------------------------------
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


-- --------------------------------------------------------------------
-- 4. VIEW: public.v_certificate_eligibility
-- Purpose: Evaluates criteria for claiming certificates.
-- --------------------------------------------------------------------
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


-- --------------------------------------------------------------------
-- 5. VIEW: public.v_event_stats
-- Purpose: High-level metric aggregation view for event statistics.
-- --------------------------------------------------------------------
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
     AND NOT ((metadata->>'studentRole' ILIKE 'Poster Presenter') AND (metadata->>'yearLevel' = '4th Year' OR metadata->>'year' = '4th Year'))) AS colloquium_registered,
    -- Poster Presenters Registered (Only 4th Year Poster Presenters)
    (SELECT count(*) FROM public.registrations 
     WHERE event_id = e.id 
     AND ((metadata->>'studentRole' ILIKE 'Poster Presenter') AND (metadata->>'yearLevel' = '4th Year' OR metadata->>'year' = '4th Year'))) AS poster_presenters_registered,
    -- Poster Presenters Pre-Reg
    (SELECT count(*) FROM public.registrations 
     WHERE event_id = e.id AND reg_type = 'pre-reg'
     AND ((metadata->>'studentRole' ILIKE 'Poster Presenter') AND (metadata->>'yearLevel' = '4th Year' OR metadata->>'year' = '4th Year'))) AS poster_pre_reg_count,
    -- Poster Presenters Walk-in
    (SELECT count(*) FROM public.registrations 
     WHERE event_id = e.id AND reg_type = 'walk-in'
     AND ((metadata->>'studentRole' ILIKE 'Poster Presenter') AND (metadata->>'yearLevel' = '4th Year' OR metadata->>'year' = '4th Year'))) AS poster_walkin_count,
    -- Poster Presenters Attended (Scanned for Clearance - Start)
    (SELECT count(DISTINCT r.id) FROM public.registrations r
     JOIN public.attendance a ON a.registration_id = r.id
     WHERE r.event_id = e.id 
     AND ((r.metadata->>'studentRole' ILIKE 'Poster Presenter') AND (r.metadata->>'yearLevel' = '4th Year' OR r.metadata->>'year' = '4th Year'))
     AND a.poster_scanned_at IS NOT NULL) AS poster_attended_count,
    -- Poster Presenters Cleared (Scanned for Clearance - End)
    (SELECT count(DISTINCT r.id) FROM public.registrations r
     JOIN public.attendance a ON a.registration_id = r.id
     WHERE r.event_id = e.id 
     AND ((r.metadata->>'studentRole' ILIKE 'Poster Presenter') AND (r.metadata->>'yearLevel' = '4th Year' OR r.metadata->>'year' = '4th Year'))
     AND a.poster_scanned_at IS NOT NULL AND a.poster_out_at IS NOT NULL) AS poster_cleared_count,
    -- Colloquium Presenters Registered (4th Year)
    (SELECT count(*) FROM public.registrations 
     WHERE event_id = e.id 
     AND ((metadata->>'studentRole' ILIKE 'Colloquium Presenter') AND (metadata->>'yearLevel' = '4th Year' OR metadata->>'year' = '4th Year'))) AS colloquium_presenters_registered,
    -- Colloquium Presenters Attended (4th Year)
    (SELECT count(DISTINCT r.id) FROM public.registrations r
     JOIN public.attendance a ON a.registration_id = r.id
     WHERE r.event_id = e.id 
     AND ((r.metadata->>'studentRole' ILIKE 'Colloquium Presenter') AND (r.metadata->>'yearLevel' = '4th Year' OR r.metadata->>'year' = '4th Year'))
     AND (a.am_scanned_at IS NOT NULL OR a.pm_scanned_at IS NOT NULL)) AS colloquium_presenters_attended,
    -- Colloquium Participants Registered (4th Year)
    (SELECT count(*) FROM public.registrations 
     WHERE event_id = e.id 
     AND ((metadata->>'studentRole' ILIKE 'Colloquium Participant') AND (metadata->>'yearLevel' = '4th Year' OR metadata->>'year' = '4th Year'))) AS colloquium_participants_registered,
    -- Colloquium Participants Attended (4th Year)
    (SELECT count(DISTINCT r.id) FROM public.registrations r
     JOIN public.attendance a ON a.registration_id = r.id
     WHERE r.event_id = e.id 
     AND ((r.metadata->>'studentRole' ILIKE 'Colloquium Participant') AND (r.metadata->>'yearLevel' = '4th Year' OR r.metadata->>'year' = '4th Year'))
     AND (a.am_scanned_at IS NOT NULL OR a.pm_scanned_at IS NOT NULL)) AS colloquium_participants_attended,
    -- Total Attendance Scans (Overall)
    (SELECT coalesce(sum(
        GREATEST(
            (CASE WHEN am_scanned_at IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN pm_scanned_at IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN employee_scanned_at IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN poster_scanned_at IS NOT NULL THEN 1 ELSE 0 END),
            (CASE WHEN session_id IS NOT NULL THEN 1 ELSE 0 END)
        )
     ), 0) FROM public.attendance WHERE event_id = e.id) AS total_attendance_scans,
    -- Total Evaluations
    (SELECT count(*) FROM public.evaluation_responses er 
     JOIN public.registrations r ON er.registration_id = r.id 
     WHERE r.event_id = e.id) AS total_evaluations
FROM public.events e;
