alter table public.event_schedule
  add column feedback_template jsonb
  check (jsonb_typeof(feedback_template) = 'object');
