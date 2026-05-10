-- Refactor attendance table to support multiple sessions in a single row
-- This improves scalability and simplifies turnout calculations

-- 1. Add new timestamp columns for each session type
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS am_scanned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS pm_scanned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS employee_scanned_at TIMESTAMP WITH TIME ZONE;

-- 1b. Make session_id nullable if it exists (consolidation means one row covers multiple sessions)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'session_id') THEN
        ALTER TABLE public.attendance ALTER COLUMN session_id DROP NOT NULL;
    END IF;
END $$;

-- 2. Migrate existing data if table is not empty
DO $$
BEGIN
    -- Move AM scans
    UPDATE public.attendance SET am_scanned_at = scanned_at 
    WHERE session_type = 'am-reg' AND am_scanned_at IS NULL;
    
    -- Move PM scans
    UPDATE public.attendance SET pm_scanned_at = scanned_at 
    WHERE session_type = 'pm-reg' AND pm_scanned_at IS NULL;
    
    -- Move Employee scans
    UPDATE public.attendance SET employee_scanned_at = scanned_at 
    WHERE session_type = 'employee-reg' AND employee_scanned_at IS NULL;
END $$;

-- 3. Consolidate rows for the same participant in the same event
-- Note: This is a bit complex in SQL, but since we are refactoring, 
-- we'll use a temporary strategy: remove duplicates and keep the first scan time.
-- For a fresh project, we can just drop and recreate, but let's be safe.

-- 4. Clean up old columns and constraints
-- We need to drop the old UNIQUE constraint first
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_event_id_participant_id_session_type_key;

-- 5. Add the new UNIQUE constraint (One row per person per event)
-- We use a temporary table to deduplicate if there are already multiple rows per person
CREATE TEMP TABLE attendance_temp AS
SELECT 
    event_id,
    participant_id,
    registration_id,
    MIN(am_scanned_at) as am_scanned_at,
    MIN(pm_scanned_at) as pm_scanned_at,
    MIN(employee_scanned_at) as employee_scanned_at
FROM public.attendance
GROUP BY event_id, participant_id, registration_id;

TRUNCATE public.attendance;

INSERT INTO public.attendance (event_id, participant_id, registration_id, am_scanned_at, pm_scanned_at, employee_scanned_at)
SELECT event_id, participant_id, registration_id, am_scanned_at, pm_scanned_at, employee_scanned_at FROM attendance_temp;

-- 6. Now we can safely add the unique constraint
ALTER TABLE public.attendance 
ADD CONSTRAINT attendance_unique_participant_event UNIQUE (event_id, participant_id);

-- 7. Remove old columns
ALTER TABLE public.attendance DROP COLUMN IF EXISTS session_type;
ALTER TABLE public.attendance DROP COLUMN IF EXISTS scanned_at;
