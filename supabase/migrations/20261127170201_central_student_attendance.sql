begin;

-- Keep the choices, their labels for older registrations, and the schedule IDs together.
create function public.ccs_summit_session_choices()
returns table (day_number integer, sort_order integer, session_id uuid, label text, names text[])
language sql immutable set search_path = '' as $$
  select * from (values
    (1, 1, 'bde8d1a2-b528-483b-9542-d15fabff3cd5'::uuid,
      'CCS Summit Opening Morning Session (8:30 AM–12 NN, Auditorium)', array['ccs summit opening morning session']),
    (1, 2, '9754bb37-ac85-46ab-8261-3ce97e6c488f',
      'CCS Summit Opening Afternoon Session (1:00–5:15 PM, Auditorium)', array['ccs summit opening afternoon session']),
    (1, 3, 'b3f7362b-4d89-4c5c-af50-22de08101db1',
      'CCS Summit Quiz Bee (10:15 AM–5:00 PM, Gymnasium)', array['ccs summit quiz bee']),
    (1, 4, 'dc855a41-613b-485e-80db-3934bfab6bb2',
      'CCS Summit Technical Competition (10:15 AM–5:00 PM, Computer Laboratory)', array['ccs summit technical competition']),
    (2, 1, 'f1723961-1aeb-4f1b-acca-27ef582a1cc8',
      'CCS Summit Hackathon / Innovation Challenge (8:00 AM–3:00 PM, Computer Laboratory)', array['ccs summit hackathon innovation challenge']),
    (2, 2, '042663dd-87a7-4adf-91a3-21e2b4752a37',
      'CCS Summit Final Presentation, Day 1 & 2 Recognition and Announcements, and Day 2 Synthesis (3:00–5:00 PM, Auditorium)',
      array['ccs summit final presentation day 1 2 recognition and announcements and day 2 synthesis']),
    (2, 3, '695d4ab8-13bf-4b69-a98f-c71546cbc8ab',
      'CCS Summit Esport (8:00–10:30 AM, Student Resource Center, New Academic Bldg Lobby)', array['ccs summit esport']),
    (3, 1, 'c289789d-2cbf-47f9-9b03-b9594f6e9f74',
      'SYVSIS – Seminar focusing on Emerging Trends in Information Systems', array['syvsis']),
    (3, 2, 'a7a9c8fa-1f40-4ffa-baab-fffbe259d408',
      'JPCS CyberSecureU 2026: Break. Defend. Secure.', array['jpcs cybersecureu 2026', 'cybersecureu']),
    (3, 3, 'c7a935ee-5282-4e0a-b28b-4b7b4cbf73ca',
      'LESIT – Seminar focusing on Artificial Intelligence (AI)', array['lesit'])
  ) as choices(day_number, sort_order, session_id, label, names);
$$;

create function public.ccs_summit_session_selections(p_metadata jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(choice.day_number, choice.session_id), '{}'::jsonb)
  from public.ccs_summit_session_choices() choice
  cross join lateral (
    select btrim(regexp_replace(lower(coalesce(
      p_metadata->>format('day_%s_session_preference', choice.day_number), ''
    )), '[^a-z0-9]+', ' ', 'g')) as label
  ) selected
  where exists (
    select 1 from unnest(choice.names) as alias(name)
    where selected.label = alias.name or starts_with(selected.label, alias.name || ' ')
  ) or (selected.label = ''
    and lower(p_metadata->>format('day_%s_session_id', choice.day_number)) = choice.session_id::text);
$$;

create function public.save_ccs_summit_session_selections()
returns trigger language plpgsql set search_path = '' as $$
declare
  selections jsonb := public.ccs_summit_session_selections(new.metadata);
begin
  if not (selections ?& array['1', '2'])
     or (nullif(btrim(new.metadata->>'day_3_session_preference'), '') is not null and not (selections ? '3')) then
    raise sqlstate 'PT400' using message = 'Choose a listed session for Day 1 and Day 2, and for Day 3 if attending.';
  end if;
  new.metadata := new.metadata || jsonb_build_object('session_selections', selections);
  return new;
end;
$$;

create trigger save_ccs_summit_session_selections
  before insert on public.event_participants for each row
  when (new.event_id = 'dd191aad-6220-4683-96e0-c82e051acb9c' and new.source = 'pre-reg')
  execute function public.save_ccs_summit_session_selections();

create function public.submit_central_student_attendance(p_event uuid, p_student_number text)
returns jsonb language plpgsql set search_path = '' as $$
declare
  summit public.events%rowtype;
  student public.event_participants%rowtype;
  session_row public.event_schedule%rowtype;
  selected uuid;
  venue_name text;
  check_time timestamptz;
  day_number text;
  receipt jsonb;
begin
  if public.normalize_scheduled_student_number(p_student_number) is null then
    raise sqlstate 'PT400' using message = 'Enter a valid student number.';
  end if;
  select * into summit from public.events
    where id = p_event and id = 'dd191aad-6220-4683-96e0-c82e051acb9c' and event_mode = 'scheduled'
    for update;
  if not found then raise sqlstate 'PT404' using message = 'Check-in page not found.'; end if;
  if summit.lifecycle <> 'active' then raise sqlstate 'PT410' using message = 'Event check-in is closed.'; end if;

  select p.* into student
    from public.event_participants p
    join public.event_roles r on r.event_id = p.event_id and r.id = p.role_id
    where p.event_id = p_event and p.source = 'pre-reg' and lower(btrim(r.name)) = 'student'
      and jsonb_typeof(p.metadata->'student_number') = 'string'
      and public.normalize_scheduled_student_number(p.metadata->>'student_number')
        = public.normalize_scheduled_student_number(p_student_number);
  if not found then
    raise sqlstate 'PT404' using message = 'Unable to match a student pre-registration. Ask the check-in desk for help.';
  end if;

  check_time := clock_timestamp();
  day_number := (((check_time at time zone summit.timezone)::date - summit.event_date) + 1)::text;
  selected := (coalesce(student.metadata->'session_selections',
    public.ccs_summit_session_selections(student.metadata))->>day_number)::uuid;

  select s.* into session_row from public.event_schedule s
    where s.event_id = p_event and s.id = selected
      and (s.starts_at at time zone summit.timezone)::date = (check_time at time zone summit.timezone)::date;
  if not found then
    raise sqlstate 'PT409' using message = 'No registered session is available for you today. Ask the check-in desk for help.';
  end if;

  receipt := public.submit_scheduled_student_attendance(p_event, session_row.id,
    jsonb_build_object('student_number', p_student_number));
  select name into venue_name from public.event_venues where id = session_row.venue_id and event_id = p_event;
  return receipt || jsonb_build_object('session_id', session_row.id,
    'session_title', session_row.title, 'venue_name', venue_name);
end;
$$;

revoke execute on function public.ccs_summit_session_choices(),
  public.ccs_summit_session_selections(jsonb), public.save_ccs_summit_session_selections(),
  public.submit_central_student_attendance(uuid,text) from public, anon, authenticated;
grant execute on function public.ccs_summit_session_choices(),
  public.ccs_summit_session_selections(jsonb), public.save_ccs_summit_session_selections(),
  public.submit_central_student_attendance(uuid,text) to service_role;

do $$
declare
  summit public.events%rowtype;
  student_role uuid;
  venue record;
  session record;
  limits jsonb;
begin
  select * into summit from public.events where id = 'dd191aad-6220-4683-96e0-c82e051acb9c'
    and event_mode = 'scheduled' and lifecycle <> 'archived' for update;
  if not found then return; end if;
  select id into strict student_role from public.event_roles
    where event_id = summit.id and lower(btrim(name)) = 'student';

  for venue in select * from (values
    ('e33bde79-1c38-42d4-a4d7-d24c00f84db4'::uuid, 'Gymnasium', 500),
    ('1ef4dba2-dacc-4b38-9e89-686325864865', 'Computer Laboratory', 100),
    ('9ad207b2-3018-43e5-b1d9-c34e8c79107f', 'Student Resource Center, New Academic Bldg Lobby', 100)
  ) as settings(id, name, capacity) loop
    perform public.manage_scheduled_event(summit.id, summit.created_by, 'venue', jsonb_build_object(
      'id', venue.id, 'name', venue.name, 'capacity', venue.capacity,
      'role_caps', jsonb_build_object(student_role, venue.capacity)));
  end loop;

  for session in select * from (values
    ('b3f7362b-4d89-4c5c-af50-22de08101db1'::uuid, 'e33bde79-1c38-42d4-a4d7-d24c00f84db4'::uuid,
      'CCS Summit Quiz Bee', 1, '10:15'::time, '17:00'::time),
    ('dc855a41-613b-485e-80db-3934bfab6bb2', '1ef4dba2-dacc-4b38-9e89-686325864865',
      'CCS Summit Technical Competition', 1, '10:15', '17:00'),
    ('f1723961-1aeb-4f1b-acca-27ef582a1cc8', '1ef4dba2-dacc-4b38-9e89-686325864865',
      'CCS Summit Hackathon / Innovation Challenge', 2, '08:00', '15:00'),
    ('695d4ab8-13bf-4b69-a98f-c71546cbc8ab', '9ad207b2-3018-43e5-b1d9-c34e8c79107f',
      'CCS Summit Esport', 2, '08:00', '10:30')
  ) as settings(id, venue_id, title, day_number, starts, ends) loop
    select jsonb_build_object('capacity', capacity, 'role_caps', role_caps) into strict limits
      from public.event_venues where id = session.venue_id and event_id = summit.id;
    perform public.manage_scheduled_event(summit.id, summit.created_by, 'session', limits || jsonb_build_object(
      'id', session.id, 'venue_id', session.venue_id, 'title', session.title, 'reserved_students', 0,
      'starts_at', (summit.event_date + (session.day_number - 1) + session.starts) at time zone summit.timezone,
      'ends_at', (summit.event_date + (session.day_number - 1) + session.ends) at time zone summit.timezone,
      'checkin_opens_at', (summit.event_date + (session.day_number - 1) + session.starts) at time zone summit.timezone,
      'walkins_open_at', (summit.event_date + (session.day_number - 1) + session.ends) at time zone summit.timezone));
  end loop;

  -- Rebuild the choice lists while preserving the rest of the student form.
  update public.event_roles r
    set registration_template = jsonb_set(r.registration_template, '{questions}', (
      select jsonb_agg(page.item || jsonb_build_object('questions', (
        select jsonb_agg(case when options.items is not null
          then question.item || jsonb_build_object('options', options.items)
          else question.item end order by question.ordinality)
        from jsonb_array_elements(page.item->'questions') with ordinality as question(item, ordinality)
        cross join lateral (
          select jsonb_agg(choice.label order by choice.sort_order) as items
          from public.ccs_summit_session_choices() choice
          where question.item->>'id' = format('day_%s_session_preference', choice.day_number)
        ) options
      )) order by page.ordinality)
      from jsonb_array_elements(r.registration_template->'questions') with ordinality as page(item, ordinality)
    ))
    where r.event_id = summit.id and r.id = student_role and r.registration_template is not null;
end;
$$;

commit;
