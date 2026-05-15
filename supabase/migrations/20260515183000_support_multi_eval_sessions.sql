-- Migration to support multiple evaluation sessions (AM/PM) per event
-- 1. Add session_type column to evaluation_templates
ALTER TABLE public.evaluation_templates ADD COLUMN IF NOT EXISTS session_type TEXT;

-- 2. Handle unique constraint update
DO $$
BEGIN
    -- Drop the old unique constraint on event_id if it exists
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evaluation_templates_event_id_key') THEN
        ALTER TABLE public.evaluation_templates DROP CONSTRAINT evaluation_templates_event_id_key;
    END IF;

    -- Add new unique constraint on (event_id, session_type)
    -- We use COALESCE for session_type to handle existing nulls if any, but ideally we should update them
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evaluation_templates_event_session_key') THEN
        -- First update existing nulls to 'am-eval' as a default
        UPDATE public.evaluation_templates SET session_type = 'am-eval' WHERE session_type IS NULL;
        ALTER TABLE public.evaluation_templates ALTER COLUMN session_type SET NOT NULL;
        ALTER TABLE public.evaluation_templates ADD CONSTRAINT evaluation_templates_event_session_key UNIQUE(event_id, session_type);
    END IF;
END $$;
