begin;

create function public.normalize_scheduled_student_number(p_value text)
returns text
language sql immutable strict set search_path = ''
as $$
  select case when student_number ~ '^[A-Z0-9][A-Z0-9-]{0,63}$' then student_number end
  from (
    select upper(regexp_replace(translate(p_value, '‐‑‒–—−', '------'), '[[:space:]]+', '', 'g')) as student_number
  ) normalized;
$$;

-- One student number can identify only one participant in the event.
create unique index event_student_number_idx
  on public.event_participants(event_id, public.normalize_scheduled_student_number(metadata->>'student_number'))
  where jsonb_typeof(metadata->'student_number') = 'string';

create function public.submit_scheduled_student_attendance(p_event uuid, p_session uuid, p_data jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  student_number text := public.normalize_scheduled_student_number(p_data->>'student_number');
  event_state text;
  session_config public.event_schedule%rowtype;
  participant_email text;
  receipt jsonb;
  check_time timestamptz;
begin
  if jsonb_typeof(p_data->'student_number') is distinct from 'string' or student_number is null then
    raise sqlstate 'PT400' using message = 'Enter a valid student number.';
  end if;

  select lifecycle into event_state from public.events
    where id = p_event and event_mode = 'scheduled' for update;
  if not found then raise sqlstate 'PT404' using message = 'Event not found.'; end if;
  if event_state <> 'active' then raise sqlstate 'PT410' using message = 'This event is closed.'; end if;

  select * into session_config from public.event_schedule where event_id = p_event and id = p_session;
  if not found then raise sqlstate 'PT404' using message = 'Session not found for this event.'; end if;
  check_time := clock_timestamp();
  if check_time < session_config.checkin_opens_at or check_time >= session_config.ends_at then
    raise sqlstate 'PT410' using message = 'Session check-in is closed.';
  end if;

  select p.email into participant_email
    from public.event_participants p
    join public.event_roles r on r.event_id = p.event_id and r.id = p.role_id
    where p.event_id = p_event and p.source = 'pre-reg' and lower(btrim(r.name)) = 'student'
      and jsonb_typeof(p.metadata->'student_number') = 'string'
      and public.normalize_scheduled_student_number(p.metadata->>'student_number') = student_number;
  if not found then
    raise sqlstate 'PT404' using message = 'Unable to check in with that student number. Ask the event desk for help.';
  end if;

  -- Keep the same admission rules and check-in record for both identity paths.
  if p_data ? 'answers' then
    receipt := public.submit_scheduled_attendance(p_event, p_session,
      jsonb_build_object('email', participant_email, 'answers', p_data->'answers'));
  else
    receipt := public.submit_scheduled_event(p_event, 'attendance', p_session,
      jsonb_build_object('email', participant_email));
  end if;
  return receipt - 'display_name';
end $$;

revoke execute on function public.normalize_scheduled_student_number(text),
  public.submit_scheduled_student_attendance(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.normalize_scheduled_student_number(text),
  public.submit_scheduled_student_attendance(uuid, uuid, jsonb) to service_role;

commit;
