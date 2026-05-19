-- VIEW: public.v_quota_usage
-- Purpose: Tracks current registration count (used_capacity) against maximum capacity for event roles/quotas.

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
