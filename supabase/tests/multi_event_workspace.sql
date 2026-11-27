-- Run in a disposable test database after applying all five event-workspace
-- migrations, from 20261122064540_multi_event_workspace.sql through
-- 20261122152521_session_attendance_templates.sql.
begin;

do $$
declare
  admin_id uuid := gen_random_uuid();
  synergy uuid := gen_random_uuid();
  next_event uuid := gen_random_uuid();
  parallel_event uuid := gen_random_uuid();
  student_role uuid := gen_random_uuid();
  venue uuid := gen_random_uuid();
  session_id uuid := gen_random_uuid();
  later_session uuid := gen_random_uuid();
  former_registration uuid := gen_random_uuid();
  event_date_today date := (now() at time zone 'Asia/Manila')::date;
  session_config jsonb;
  submitted jsonb;
begin
  insert into auth.users(id,raw_user_meta_data) values (admin_id,'{"full_name":"Test Admin"}')
    on conflict (id) do nothing;
  insert into public.admin_profiles(id,full_name) values (admin_id, 'Test Admin') on conflict (id) do nothing;
  insert into public.events(id,created_by,name,event_date) values (synergy,admin_id,'Synergy legacy fixture',event_date_today);
  insert into public.registrations(id,event_id,full_name) values (former_registration,synergy,'Legacy participant');

  perform public.manage_scheduled_event(next_event,admin_id,'create',
    jsonb_build_object('name','Three-day event','event_date',event_date_today,'timezone','Asia/Manila'));
  perform public.manage_scheduled_event(next_event,admin_id,'create',
    jsonb_build_object('name','Retry must not overwrite','event_date',event_date_today,'timezone','Asia/Manila'));
  assert (select name from public.events where id = next_event) = 'Three-day event';
  assert (select name from public.events where id = synergy) = 'Synergy legacy fixture';
  assert exists (select 1 from public.registrations where id = former_registration and event_id = synergy);

  perform public.manage_scheduled_event(next_event,admin_id,'settings',jsonb_build_object(
    'name','Three-day event','event_date',event_date_today,'registration_opens_at',now()-interval '2 days',
    'pre_reg_deadline',now()+interval '5 minutes'));
  perform public.manage_scheduled_event(next_event,admin_id,'role',jsonb_build_object(
    'id',student_role,'name','Students','student_priority',true,'registration_capacity',4,
    'registration_url','https://example.org/register','required_fields','["course"]'::jsonb));
  perform public.manage_scheduled_event(next_event,admin_id,'venue',jsonb_build_object(
    'id',venue,'name','Hall','capacity',3,'role_caps',jsonb_build_object(student_role::text,3)));
  session_config := jsonb_build_object('id',session_id,'venue_id',venue,'title','Seminar',
    'starts_at',now()+interval '10 minutes','ends_at',now()+interval '1 hour',
    'checkin_opens_at',now()+interval '6 minutes','walkins_open_at',now()+interval '10 minutes',
    'capacity',3,'role_caps',jsonb_build_object(student_role::text,3),'reserved_students',2,
    'attendance_url','https://example.org/attendance','feedback_url','https://example.org/feedback');
  perform public.manage_scheduled_event(next_event,admin_id,'session',session_config);
  perform public.manage_scheduled_event(next_event,admin_id,'session',session_config || jsonb_build_object(
    'id',later_session,'title','Day Three Competition','starts_at',now()+interval '2 days',
    'ends_at',now()+interval '2 days 1 hour','checkin_opens_at',now()+interval '2 days',
    'walkins_open_at',now()+interval '2 days','attendance_url',null,'feedback_url',null));
  assert exists (select 1 from public.event_schedule where id = later_session and attendance_url is null);
  perform public.manage_scheduled_event(next_event,admin_id,'publish','{}');
  assert (select lifecycle from public.events where id = synergy) = 'active';

  perform public.manage_scheduled_event(parallel_event,admin_id,'create',
    jsonb_build_object('name','Another event','event_date',event_date_today,'timezone','Asia/Manila'));
  begin
    perform public.submit_scheduled_event(next_event,'attendance',later_session,
      jsonb_build_object('role_id',student_role,'email','future@example.org','full_name','Future participant'));
    raise exception 'Accepted attendance before check-in opens';
  exception when sqlstate 'PT410' then null;
  end;
  begin
    perform public.submit_scheduled_event(next_event,'pre-registration',null,
      jsonb_build_object('role_id',student_role,'email','missing@example.org','full_name','Missing fields'));
    raise exception 'Accepted pre-registration without a required field';
  exception when sqlstate 'PT400' then null;
  end;
  perform public.submit_scheduled_event(next_event,'pre-registration',null,
    jsonb_build_object('role_id',student_role,'email','Owner@Example.org','full_name','Registered student',
      'metadata',jsonb_build_object('course','Example')));
  submitted := public.submit_scheduled_event(next_event,'pre-registration',null,
    jsonb_build_object('email','owner@example.org'));
  assert (submitted->>'created')::boolean = false;

  perform public.manage_scheduled_event(next_event,admin_id,'settings',jsonb_build_object(
    'name','Three-day event','event_date',event_date_today,'registration_opens_at',now()-interval '2 days',
    'pre_reg_deadline',now()-interval '3 hours'));
  session_config := session_config || jsonb_build_object('checkin_opens_at',now()-interval '2 hours','starts_at',now()-interval '1 hour');
  perform public.manage_scheduled_event(next_event,admin_id,'session',session_config);
  begin
    perform public.submit_scheduled_event(next_event,'attendance',session_id,
      jsonb_build_object('role_id',student_role,'email','early@example.org','full_name','Early walk-in'));
    raise exception 'Accepted a walk-in during pre-registration priority';
  exception when sqlstate 'PT409' then null;
  end;
  session_config := session_config || jsonb_build_object('walkins_open_at', now()-interval '30 minutes');
  perform public.manage_scheduled_event(next_event,admin_id,'session',session_config);
  perform public.submit_scheduled_event(next_event,'attendance',session_id,
    jsonb_build_object('role_id',student_role,'email','walkin@example.org','full_name','Walk-in student',
      'metadata',jsonb_build_object('course','Example')));
  begin
    perform public.submit_scheduled_event(next_event,'attendance',session_id,
      jsonb_build_object('role_id',student_role,'email','extra@example.org','full_name','Another walk-in'));
    raise exception 'Walk-in used a protected place';
  exception when sqlstate 'PT409' then null;
  end;
  submitted := public.submit_scheduled_attendance(next_event,session_id,
    '{"email":"owner@example.org","answers":{"confirmation":"yes"}}');
  assert (submitted->>'created')::boolean = true;
  submitted := public.submit_scheduled_attendance(next_event,session_id,
    '{"email":"owner@example.org","answers":{"confirmation":"changed"}}');
  assert (submitted->>'created')::boolean = false;
  assert (select answers->>'confirmation' from public.event_checkins where id = (submitted->>'checkin_id')::uuid) = 'yes';
  perform public.submit_scheduled_event(next_event,'feedback',session_id,
    '{"email":"owner@example.org","answers":{"rating":"Good"}}');
  begin
    perform public.manage_scheduled_event(next_event,admin_id,'session',session_config || jsonb_build_object(
      'capacity',1,'role_caps',jsonb_build_object(student_role::text,1),'reserved_students',0));
    raise exception 'Accepted capacity below admitted participants';
  exception when sqlstate 'PT409' then null;
  end;
  -- The switch can open pre-registration before attendance setup or publication.
  perform public.manage_scheduled_event(parallel_event,admin_id,'role',jsonb_build_object(
    'id',gen_random_uuid(),'name','Staff','registration_capacity',3,'registration_url','https://example.org/staff'));
  perform public.manage_scheduled_event(parallel_event,admin_id,'pre-reg-status','{"open":true}');
  submitted := public.submit_scheduled_event(parallel_event,'pre-registration',null,jsonb_build_object(
    'email','manual@example.org','full_name','Manual registration','role_id',
    (select id from public.event_roles where event_id=parallel_event and name='Staff')));
  assert (submitted->>'created')::boolean;
  perform public.manage_scheduled_event(parallel_event,admin_id,'pre-reg-status','{"open":false}');
  begin
    perform public.submit_scheduled_event(parallel_event,'pre-registration',null,'{"email":"manual@example.org"}');
    raise exception 'Closed form accepted a stale submission';
  exception when sqlstate 'PT410' then null;
  end;
  assert exists(select 1 from public.event_participants where event_id=parallel_event and email='manual@example.org');
  perform public.manage_scheduled_event(synergy,admin_id,'archive','{}');
  begin
    update public.registrations set full_name = 'Changed' where id = former_registration;
    raise exception 'Accepted an archived legacy write';
  exception when sqlstate 'PT409' then null;
  end;
  assert (select full_name from public.registrations where id = former_registration) = 'Legacy participant';
  perform public.manage_scheduled_event(next_event,admin_id,'archive','{}');
  begin
    perform public.submit_scheduled_event(next_event,'attendance',session_id,'{"email":"owner@example.org"}');
    raise exception 'Accepted an archived session write';
  exception when sqlstate 'PT410' then null;
  end;
  assert (select count(*) from public.event_checkins where event_id = next_event) = 2;
  assert (select count(*) from public.event_session_feedback where event_id = next_event) = 1;
end $$;

rollback;
