alter table public.event_roles
  add column registration_template jsonb
  check (jsonb_typeof(registration_template) = 'object');
