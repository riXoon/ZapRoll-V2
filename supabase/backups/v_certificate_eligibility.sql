-- VIEW: public.v_certificate_eligibility
-- Purpose: Determines certificate eligibility based on attendance and evaluation responses.
-- Specific logic separated for 4th Year Poster Presenters who only need poster clearance (pm_scanned_at).

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
