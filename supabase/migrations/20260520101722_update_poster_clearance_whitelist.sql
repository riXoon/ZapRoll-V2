-- Migration to update poster clearance eligibility logic for Poster Presenters.
-- Eligibility now requires:
-- 1. reg_type to be either 'pre-reg' or 'walk-in'
-- 2. At least one start scan (am_scanned_at or poster_scanned_at) paired with one end scan (pm_scanned_at or poster_out_at).
-- Supports dual roles (e.g. string contains "Poster Presenter" or JSON array contains "Poster Presenter").

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
    a.am_scanned_at,
    a.pm_scanned_at,
    a.poster_scanned_at,
    a.poster_out_at,
    -- Eligibility: Pre-registered or Walk-in AND has at least one start scan and one end scan
    (
        r.reg_type IN ('pre-reg', 'walk-in') AND
        (a.am_scanned_at IS NOT NULL OR a.poster_scanned_at IS NOT NULL) AND 
        (a.pm_scanned_at IS NOT NULL OR a.poster_out_at IS NOT NULL)
    ) AS is_eligible
FROM public.registrations r
LEFT JOIN public.attendance a ON a.registration_id = r.id
WHERE 
    (
        r.metadata->>'studentRole' ILIKE '%Poster Presenter%'
        OR r.metadata->>'roleName' ILIKE '%Poster Presenter%'
        OR (
            jsonb_typeof(r.metadata->'studentRole') = 'array' 
            AND r.metadata->'studentRole' @> '"Poster Presenter"'::jsonb
        )
        OR (
            jsonb_typeof(r.metadata->'roleName') = 'array' 
            AND r.metadata->'roleName' @> '"Poster Presenter"'::jsonb
        )
    ) AND 
    (r.metadata->>'yearLevel' = '4th Year' OR r.metadata->>'year' = '4th Year');
