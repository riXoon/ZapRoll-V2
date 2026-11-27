begin;

alter table public.event_schedule add column attendance_open_override boolean;

create function public.set_scheduled_attendance_override(p_event uuid, p_session uuid, p_open boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare
  event_state text;
begin
  -- Serialize changes with the check-in and archive transactions.
  select lifecycle into event_state from public.events
    where id = p_event and event_mode = 'scheduled' for update;
  if not found then raise sqlstate 'PT404' using message = 'Event not found.'; end if;
  if event_state = 'archived' then raise sqlstate 'PT410' using message = 'This event is closed.'; end if;

  update public.event_schedule set attendance_open_override = p_open
    where event_id = p_event and id = p_session;
  if not found then raise sqlstate 'PT404' using message = 'Session not found for this event.'; end if;
  return jsonb_build_object('id', p_session, 'attendance_open_override', p_open);
end $$;

revoke execute on function public.set_scheduled_attendance_override(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_scheduled_attendance_override(uuid, uuid, boolean) to service_role;

create or replace function public.submit_scheduled_event(p_event uuid,p_action text,p_session uuid,p_data jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  e public.events%rowtype;
  s public.event_schedule%rowtype;
  r public.event_roles%rowtype;
  p public.event_participants%rowtype;
  c public.event_checkins%rowtype;
  verified_email text := lower(btrim(p_data->>'email'));
  check_time timestamptz;
  total integer;
  role_total integer;
  priority_total integer;
  reserve_remaining integer;
  priority_eligible boolean;
begin
  select * into e from public.events where id = p_event and event_mode = 'scheduled' for update;
  if not found then raise sqlstate 'PT404' using message = 'Event not found.'; end if;
  if e.lifecycle <> 'active' and not (e.lifecycle = 'draft' and p_action = 'pre-registration' and e.pre_reg_manual) then raise sqlstate 'PT410' using message = 'This event is closed.'; end if;
  check_time := clock_timestamp();
  if verified_email is null or verified_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise sqlstate 'PT400' using message = 'Enter a valid verified email.';
  end if;
  select * into p from public.event_participants where event_id = p_event and email = verified_email;
  if p_action = 'pre-registration' then
    if e.pre_reg_manual then
      if not coalesce(e.pre_reg_open, false) then raise sqlstate 'PT410' using message = 'Pre-registration is closed.'; end if;
    end if;
    if p.id is not null then return jsonb_build_object('registration_id',p.id,'created',false,'source',p.source); end if;
    if not e.pre_reg_manual and (e.registration_opens_at is null or e.pre_reg_deadline is null or check_time < e.registration_opens_at or check_time >= e.pre_reg_deadline) then
      raise sqlstate 'PT410' using message = 'Pre-registration is closed.';
    end if;
    select * into r from public.event_roles where event_id = p_event and id = (p_data->>'role_id')::uuid;
    if not found then raise sqlstate 'PT400' using message = 'Choose a role for this event.'; end if;
    if (select count(*) from public.event_participants where event_id = p_event and role_id = r.id and source = 'pre-reg') >= r.registration_capacity then
      raise sqlstate 'PT409' using message = 'Pre-registration for this role is full.';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(r.required_fields) f
      where nullif(btrim(p_data->'metadata'->>f), '') is null
    ) then raise sqlstate 'PT400' using message = 'Complete the required registration fields.'; end if;
    insert into public.event_participants(event_id,role_id,email,full_name,source,metadata)
    values (p_event,r.id,verified_email,p_data->>'full_name','pre-reg',coalesce(p_data->'metadata','{}'::jsonb)) returning * into p;
    return jsonb_build_object('registration_id',p.id,'created',true,'source',p.source);
  end if;
  select * into s from public.event_schedule where event_id = p_event and id = p_session;
  if not found then raise sqlstate 'PT404' using message = 'Session not found for this event.'; end if;
  if p.id is not null then
    select * into c from public.event_checkins where session_id = s.id and participant_id = p.id;
  end if;
  if p_action = 'feedback' then
    if c.id is null or s.feedback_url is null then raise sqlstate 'PT409' using message = 'Feedback is unavailable.'; end if;
    insert into public.event_session_feedback(event_id,session_id,participant_id,answers)
    values (p_event,s.id,p.id,p_data->'answers') on conflict (session_id,participant_id) do nothing;
    return jsonb_build_object('checkin_id',c.id);
  end if;
  if p_action <> 'attendance' then raise sqlstate 'PT400' using message = 'Unknown submission type.'; end if;
  if s.attendance_open_override is false then
    raise sqlstate 'PT410' using message = 'Session check-in is closed.';
  end if;
  if c.id is not null then
    return jsonb_build_object('checkin_id',c.id,'checked_in_at',c.checked_in_at,'display_name',p.full_name,'created',false);
  end if;
  if s.attendance_open_override is null and (check_time < s.checkin_opens_at or check_time >= s.ends_at) then
    raise sqlstate 'PT410' using message = 'Session check-in is closed.';
  end if;
  if p.source is distinct from 'pre-reg' and check_time < s.walkins_open_at then
    raise sqlstate 'PT409' using message = 'Walk-ins are not open for this session.';
  end if;
  select * into r from public.event_roles where event_id = p_event and
    id = coalesce(p.role_id,(p_data->>'role_id')::uuid);
  if not found then raise sqlstate 'PT400' using message = 'Choose a role for this event.'; end if;
  select count(*), count(*) filter (where p2.role_id = r.id),
    count(*) filter (where r2.student_priority and p2.source = 'pre-reg')
    into total, role_total, priority_total
    from public.event_checkins c2 join public.event_participants p2 on p2.id = c2.participant_id
    join public.event_roles r2 on r2.id = p2.role_id where c2.session_id = s.id;
  reserve_remaining := greatest(s.reserved_students - priority_total,0);
  priority_eligible := r.student_priority and coalesce(p.source = 'pre-reg',false);
  if total >= s.capacity or role_total >= coalesce((s.role_caps->>r.id::text)::integer,0)
    or (not priority_eligible and (total + reserve_remaining >= s.capacity
      or (r.student_priority and role_total + reserve_remaining >= (s.role_caps->>r.id::text)::integer))) then
    raise sqlstate 'PT409' using message = 'No places are available for this role.';
  end if;
  if p.id is null then
    if exists (
      select 1 from jsonb_array_elements_text(r.required_fields) f
      where nullif(btrim(p_data->'metadata'->>f), '') is null
    ) then raise sqlstate 'PT400' using message = 'Complete the required registration fields.'; end if;
    insert into public.event_participants(event_id,role_id,email,full_name,source,metadata)
    values (p_event,r.id,verified_email,p_data->>'full_name','walk-in',coalesce(p_data->'metadata','{}'::jsonb)) returning * into p;
  end if;
  insert into public.event_checkins(event_id,session_id,participant_id,checked_in_at)
  values (p_event,s.id,p.id,check_time) returning * into c;
  return jsonb_build_object('checkin_id',c.id,'checked_in_at',c.checked_in_at,'display_name',p.full_name,'created',true);
end $$;

create or replace function public.submit_scheduled_student_attendance(p_event uuid, p_session uuid, p_data jsonb)
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
  if not coalesce(session_config.attendance_open_override,
    check_time >= session_config.checkin_opens_at and check_time < session_config.ends_at) then
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

commit;
