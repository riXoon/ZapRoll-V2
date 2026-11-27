-- Run after applying the event workspace migrations.
begin;

do $$
declare
  admin_id uuid := gen_random_uuid();
  event_id uuid := gen_random_uuid();
  student_id uuid := gen_random_uuid();
  venue_id uuid := gen_random_uuid();
  first_session uuid := '680ba2b2-59ca-4a98-aee6-000000000001';
  later_session uuid := '680ba2b2-59ca-4a98-aee6-000000000002';
  old_caps jsonb := jsonb_build_object(student_id::text, 249);
  new_caps jsonb := jsonb_build_object(student_id::text, 100);
  venue_before jsonb := jsonb_build_object('name', 'Seminar Room', 'capacity', 500, 'role_caps', old_caps);
  session_before jsonb := jsonb_build_object('capacity', 500, 'role_caps', old_caps);
  venue_change jsonb := jsonb_build_object(
    'id', venue_id, 'name', 'Seminar Room', 'capacity', 100, 'role_caps', new_caps,
    'expected_venue', venue_before,
    'affected_sessions', jsonb_build_object(first_session::text, session_before, later_session::text, session_before));
  session_config jsonb;
begin
  insert into auth.users(id,raw_user_meta_data) values (admin_id,'{"full_name":"Test Admin"}')
    on conflict (id) do nothing;
  insert into public.admin_profiles(id,full_name) values (admin_id, 'Test Admin') on conflict (id) do nothing;
  perform public.manage_scheduled_event(event_id,admin_id,'create',
    jsonb_build_object('name','Capacity Test','event_date',current_date,'timezone','Asia/Manila'));
  update public.events e set student_pre_registration_only = true, shared_venue_capacity = false where e.id = event_id;
  perform public.manage_scheduled_event(event_id,admin_id,'role',jsonb_build_object(
    'id',student_id,'name','Student','student_priority',true,'registration_capacity',249,'required_fields','[]'::jsonb));
  perform public.manage_scheduled_event(event_id,admin_id,'venue',venue_before || jsonb_build_object('id',venue_id));
  session_config := session_before || jsonb_build_object(
    'id',first_session,'venue_id',venue_id,'title','Workshop',
    'starts_at',now()+interval '1 day','ends_at',now()+interval '1 day 1 hour',
    'checkin_opens_at',now()+interval '1 day','walkins_open_at',now()+interval '1 day 1 hour',
    'reserved_students',0,'attendance_url','https://example.org/checkin');
  perform public.manage_scheduled_event(event_id,admin_id,'session',session_config);
  perform public.manage_scheduled_event(event_id,admin_id,'session',session_config || jsonb_build_object(
    'id',later_session,'title','Later workshop','reserved_students',110,
    'starts_at',now()+interval '2 days','ends_at',now()+interval '2 days 1 hour',
    'checkin_opens_at',now()+interval '2 days','walkins_open_at',now()+interval '2 days 1 hour'));

  begin
    perform public.resize_student_event_venue(event_id,admin_id,venue_change - 'affected_sessions');
    raise exception 'Accepted a resize without reviewing the affected sessions';
  exception when sqlstate 'PT409' then null;
  end;
  begin
    perform public.resize_student_event_venue(event_id,admin_id,venue_change);
    raise exception 'Lowered capacity below the protected seats';
  exception when sqlstate 'PT409' then null;
  end;
  assert (select capacity from public.event_venues where id = venue_id) = 500;
  assert (select capacity from public.event_schedule where id = first_session) = 500;
  assert (select capacity from public.event_schedule where id = later_session) = 500;

  update public.event_schedule set reserved_students = 50 where id = later_session;
  perform public.resize_student_event_venue(event_id,admin_id,venue_change);
  perform public.resize_student_event_venue(event_id,admin_id,venue_change);
  assert exists (select 1 from public.event_venues where id = venue_id and capacity = 100 and role_caps = new_caps);
  assert exists (select 1 from public.event_schedule where id = first_session and capacity = 100
    and role_caps = new_caps and attendance_url = 'https://example.org/checkin');
  assert exists (select 1 from public.event_schedule where id = later_session and capacity = 100
    and role_caps = new_caps and reserved_students = 50);
  assert not has_function_privilege('authenticated','public.resize_student_event_venue(uuid,uuid,jsonb)','execute');
end;
$$;

do $$
declare
  admin_id uuid := gen_random_uuid();
  event_id uuid := gen_random_uuid();
  guest_role uuid := gen_random_uuid();
  hall uuid := gen_random_uuid();
  room uuid := gen_random_uuid();
  morning uuid := gen_random_uuid();
  afternoon uuid := gen_random_uuid();
  hall_data jsonb := jsonb_build_object('id',hall,'name','Hall','capacity',100,
    'role_caps',jsonb_build_object(guest_role::text,100));
  session_config jsonb;
  guest_id uuid;
begin
  insert into auth.users(id,raw_user_meta_data) values (admin_id,'{"full_name":"Test Admin"}')
    on conflict (id) do nothing;
  insert into public.admin_profiles(id,full_name) values (admin_id, 'Test Admin') on conflict (id) do nothing;
  assert (public.manage_scheduled_event(event_id,admin_id,'create',
    jsonb_build_object('name','Future event','event_date',current_date,'timezone','Asia/Manila'))->>'shared_venue_capacity')::boolean;
  perform public.manage_scheduled_event(event_id,admin_id,'role',jsonb_build_object(
    'id',guest_role,'name','Guest','registration_capacity',100,'required_fields','[]'::jsonb));
  perform public.manage_scheduled_event(event_id,admin_id,'venue',hall_data);
  perform public.manage_scheduled_event(event_id,admin_id,'venue',jsonb_build_object(
    'id',room,'name','Second room','capacity',50,'role_caps',jsonb_build_object(guest_role::text,40)));
  session_config := jsonb_build_object('id',morning,'venue_id',hall,'title','Morning',
    'starts_at',now()+interval '1 day','ends_at',now()+interval '1 day 1 hour',
    'checkin_opens_at',now()+interval '1 day','walkins_open_at',now()+interval '1 day 1 hour',
    'reserved_students',0,'attendance_url','https://example.org/morning');
  perform public.manage_scheduled_event(event_id,admin_id,'session',session_config);
  perform public.manage_scheduled_event(event_id,admin_id,'session',session_config || jsonb_build_object(
    'id',afternoon,'title','Afternoon','capacity',250,'role_caps',jsonb_build_object(guest_role::text,250),
    'starts_at',now()+interval '1 day 2 hours','ends_at',now()+interval '1 day 3 hours',
    'checkin_opens_at',now()+interval '1 day 2 hours','walkins_open_at',now()+interval '1 day 3 hours'));
  assert (select count(*) from public.event_schedule where venue_id = hall and capacity = 100) = 2;

  perform public.manage_scheduled_event(event_id,admin_id,'venue',hall_data || jsonb_build_object(
    'capacity',125,'role_caps',jsonb_build_object(guest_role::text,105)));
  assert (select count(*) from public.event_schedule where venue_id = hall and capacity = 125
    and role_caps = jsonb_build_object(guest_role::text,105)) = 2;
  perform public.manage_scheduled_event(event_id,admin_id,'venue',hall_data);
  assert (select count(*) from public.event_schedule where venue_id = hall and capacity = 100) = 2;

  perform public.manage_scheduled_event(event_id,admin_id,'session',session_config || jsonb_build_object('venue_id',room));
  assert exists (select 1 from public.event_schedule where id = morning and venue_id = room
    and capacity = 50 and role_caps = jsonb_build_object(guest_role::text,40)
    and attendance_url = 'https://example.org/morning');
  assert exists (select 1 from public.event_schedule where id = afternoon and venue_id = hall and capacity = 100);

  for number in 1..2 loop
    insert into public.event_participants(event_id,role_id,email,full_name,source)
      values (event_id,guest_role,format('guest%s@example.org',number),'Guest','walk-in')
      returning id into guest_id;
    insert into public.event_checkins(event_id,session_id,participant_id,checked_in_at)
      values (event_id,afternoon,guest_id,now());
  end loop;
  begin
    perform public.manage_scheduled_event(event_id,admin_id,'venue',hall_data || jsonb_build_object(
      'capacity',1,'role_caps',jsonb_build_object(guest_role::text,1)));
    raise exception 'Accepted a shared room limit below existing check-ins';
  exception when sqlstate 'PT409' then null;
  end;
  assert (select capacity from public.event_venues where id = hall) = 100;
  assert (select capacity from public.event_schedule where id = afternoon) = 100;
end;
$$;

rollback;
