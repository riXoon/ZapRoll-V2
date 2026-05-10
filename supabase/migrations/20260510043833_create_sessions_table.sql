-- Create normalized sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    session_type TEXT NOT NULL, -- 'am-reg', 'pm-reg', 'employee-reg'
    registration_link TEXT DEFAULT '',
    is_open BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(event_id, session_type)
);

-- Enable RLS on sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Policy for admins to manage their own event sessions
DROP POLICY IF EXISTS "Admins can manage sessions" ON public.sessions;
CREATE POLICY "Admins can manage sessions" ON public.sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = sessions.event_id
            AND events.created_by = auth.uid()
        )
    );

-- Update attendance table to point to session if needed (optional for now, we'll keep it simple)
-- For now, attendance table already tracks event_id and session_type, which is sufficient.
