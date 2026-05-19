-- VIEW: public.v_poster_clearance_whitelist
-- Purpose: Identifies pre-registered 4th Year Poster Presenters who are eligible for poster clearance.
-- Eligibility requires both dynamic poster_scanned_at (Start of presentation) and poster_out_at (End of presentation) timestamps.

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
