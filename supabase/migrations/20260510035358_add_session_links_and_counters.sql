-- Add session links and open/close flags to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS student_am_link TEXT DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS student_pm_link TEXT DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS employee_reg_link TEXT DEFAULT '';

-- Add "Kill Switch" flags for each session
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS student_am_open BOOLEAN DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS student_pm_open BOOLEAN DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS employee_reg_open BOOLEAN DEFAULT false;

-- Create attendance table to track session submissions
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES public.registrations(id) ON DELETE CASCADE,
    session_type TEXT NOT NULL, -- 'am-reg', 'pm-reg', 'employee-reg'
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(event_id, participant_id, session_type)
);

-- Enable RLS on attendance
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Policy for admins to read attendance
DROP POLICY IF EXISTS "Admins can view attendance" ON public.attendance;
CREATE POLICY "Admins can view attendance" ON public.attendance
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = attendance.event_id
            AND events.created_by = auth.uid()
        )
    );
