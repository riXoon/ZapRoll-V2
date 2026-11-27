begin;

alter table public.events
  add column event_mode text not null default 'legacy' check (event_mode in ('legacy', 'scheduled')),
  add column lifecycle text not null default 'active' check (lifecycle in ('draft', 'active', 'archived')),
  add column timezone text not null default 'Asia/Manila',
  add column registration_opens_at timestamptz,
  add column archived_at timestamptz,
  add column archived_by uuid;

create table public.event_roles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  name text not null check (length(btrim(name)) between 1 and 120),
  student_priority boolean not null default false,
  registration_capacity integer not null check (registration_capacity >= 0),
  registration_url text,
  required_fields jsonb not null default '[]' check (jsonb_typeof(required_fields) = 'array'),
  unique (event_id, id)
);
create unique index event_roles_name_idx on public.event_roles(event_id, lower(btrim(name)));
create unique index event_roles_priority_idx on public.event_roles(event_id) where student_priority;

create table public.event_venues (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  name text not null check (length(btrim(name)) between 1 and 120),
  capacity integer not null check (capacity > 0),
  role_caps jsonb not null check (jsonb_typeof(role_caps) = 'object'),
  unique (event_id, id)
);
create unique index event_venues_name_idx on public.event_venues(event_id, lower(btrim(name)));

create table public.event_schedule (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  venue_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  checkin_opens_at timestamptz not null,
  walkins_open_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  role_caps jsonb not null check (jsonb_typeof(role_caps) = 'object'),
  reserved_students integer not null check (reserved_students >= 0),
  attendance_url text not null,
  feedback_url text,
  unique (event_id, id),
  foreign key (event_id, venue_id) references public.event_venues(event_id, id),
  check (checkin_opens_at <= starts_at and checkin_opens_at <= walkins_open_at
         and starts_at < ends_at and walkins_open_at <= ends_at)
);
create index event_schedule_venue_idx on public.event_schedule(event_id, venue_id, starts_at);

create table public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  role_id uuid not null,
  email text not null check (email = lower(btrim(email)) and length(email) <= 254),
  full_name text not null check (length(btrim(full_name)) between 1 and 200),
  source text not null check (source in ('pre-reg', 'walk-in')),
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (event_id, role_id) references public.event_roles(event_id, id),
  unique (event_id, id),
  unique (event_id, email)
);
create index event_participants_role_idx on public.event_participants(event_id, role_id, source);

create table public.event_checkins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  session_id uuid not null,
  participant_id uuid not null,
  checked_in_at timestamptz not null default now(),
  foreign key (event_id, session_id) references public.event_schedule(event_id, id),
  foreign key (event_id, participant_id) references public.event_participants(event_id, id),
  unique (session_id, participant_id),
  unique (session_id, participant_id, event_id)
);
create index event_checkins_participant_idx on public.event_checkins(event_id, participant_id);

create table public.event_session_feedback (
  id uuid not null unique default gen_random_uuid(),
  event_id uuid not null,
  session_id uuid not null,
  participant_id uuid not null,
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  submitted_at timestamptz not null default now(),
  primary key (session_id, participant_id),
  foreign key (session_id, participant_id, event_id)
    references public.event_checkins(session_id, participant_id, event_id)
);

-- Keep public forms on the backend contract. These tables contain private records.
do $$
declare relation text;
begin
  foreach relation in array array['event_roles','event_venues','event_schedule',
    'event_participants','event_checkins','event_session_feedback'] loop
    execute format('alter table public.%I enable row level security', relation);
    execute format('revoke all on public.%I from public, anon, authenticated', relation);
    execute format('grant select, insert, update, delete on public.%I to service_role', relation);
  end loop;
end $$;

create function public.guard_event_lifecycle() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.lifecycle = 'archived') then
    raise sqlstate 'PT409' using message = 'Archived events are read-only. Use the archive action to close an event.';
  end if;
  if tg_op = 'UPDATE' and old.event_mode <> new.event_mode then
    raise sqlstate 'PT409' using message = 'An event cannot change its data model.';
  end if;
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if new.event_mode = 'scheduled' or (tg_op = 'UPDATE' and old.lifecycle <> new.lifecycle)
       or new.lifecycle <> 'active' or new.archived_by is not null or new.archived_at is not null then
      raise sqlstate 'PT403' using message = 'Use the event management API.';
    end if;
  end if;
  return new;
end $$;

create trigger protect_event_lifecycle before insert or update or delete on public.events
for each row execute function public.guard_event_lifecycle();

create function public.guard_scheduled_event_write() returns trigger
language plpgsql set search_path = '' as $$
declare
  parent_id uuid;
  state text;
begin
  if tg_op = 'UPDATE' and new.event_id <> old.event_id then
    raise sqlstate 'PT409' using message = 'A record cannot move between events.';
  end if;
  parent_id := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  select lifecycle into state from public.events where id = parent_id and event_mode = 'scheduled' for share;
  if not found or state = 'archived' then
    raise sqlstate 'PT409' using message = 'This event is closed.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

do $$
declare relation text;
begin
  foreach relation in array array['event_roles','event_venues','event_schedule',
    'event_participants','event_checkins','event_session_feedback'] loop
    execute format('create trigger protect_scheduled_event before insert or update or delete on public.%I for each row execute function public.guard_scheduled_event_write()', relation);
  end loop;
end $$;

create function public.guard_legacy_event_write() returns trigger
language plpgsql set search_path = '' as $$
declare
  row_data jsonb;
  event_id_found uuid;
  related_id uuid;
  state text;
  mode text;
begin
  for row_data in select value from jsonb_array_elements(
    case tg_op when 'INSERT' then jsonb_build_array(to_jsonb(new))
      when 'DELETE' then jsonb_build_array(to_jsonb(old))
      else jsonb_build_array(to_jsonb(old), to_jsonb(new)) end
  ) loop
    event_id_found := (row_data->>'event_id')::uuid;
    if event_id_found is null then
      related_id := (row_data->>'template_id')::uuid;
      select event_id into event_id_found from public.evaluation_templates where id = related_id;
      if event_id_found is null then
        related_id := (row_data->>'registration_id')::uuid;
        select event_id into event_id_found from public.registrations where id = related_id;
      end if;
    end if;
    select lifecycle, event_mode into state, mode from public.events where id = event_id_found for share;
    if state = 'archived' or mode = 'scheduled' then
      raise sqlstate 'PT409' using message = 'This event is closed or uses the new event workflow.';
    end if;
    -- Legacy callers can specify linked rows separately from the event. Protect both.
    if row_data ? 'registration_id' and not exists (
      select 1 from public.registrations where id = (row_data->>'registration_id')::uuid
        and event_id = event_id_found
    ) and row_data->>'registration_id' is not null and tg_op <> 'DELETE' then
      raise sqlstate 'PT409' using message = 'Registration belongs to another event.';
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

do $$
declare relation text;
begin
  foreach relation in array array['event_quotas','registrations','sessions','attendance',
    'evaluation_templates','evaluation_responses','certificates','post_event_settings'] loop
    if to_regclass(format('public.%I', relation)) is not null then
      execute format('create trigger protect_legacy_event before insert or update or delete on public.%I for each row execute function public.guard_legacy_event_write()', relation);
    end if;
  end loop;
end $$;

create function public.check_event_caps(p_event uuid, p_capacity integer, p_caps jsonb)
returns void language plpgsql set search_path = '' as $$
begin
  if p_capacity is null or p_capacity < 1 or jsonb_typeof(p_caps) is distinct from 'object' then
    raise sqlstate 'PT400' using message = 'Enter a positive capacity and role limits.';
  end if;
  if exists (
    select 1 from jsonb_each_text(p_caps) c
    left join public.event_roles r on r.event_id = p_event and r.id::text = c.key
    where r.id is null or c.value is null or c.value !~ '^[0-9]{1,9}$'
  ) then
    raise sqlstate 'PT400' using message = 'Role limits must use this event’s roles and non-negative whole counts.';
  end if;
  if coalesce((select sum(value::bigint) from jsonb_each_text(p_caps)), 0) > p_capacity
     or not exists (select 1 from jsonb_each_text(p_caps) where value::bigint > 0) then
    raise sqlstate 'PT400' using message = 'Role limits must allocate places within the capacity.';
  end if;
end $$;

-- Every configuration or submission locks the parent event before operating.
-- This also makes archive, capacity edits, and admission mutually consistent.
create function public.manage_scheduled_event(p_event uuid, p_admin uuid, p_action text, p_data jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  e public.events%rowtype;
  v public.event_venues%rowtype;
  s public.event_schedule%rowtype;
  r public.event_roles%rowtype;
  target uuid := (p_data->>'id')::uuid;
  caps jsonb := p_data->'role_caps';
  desired_capacity integer := (p_data->>'capacity')::integer;
  reserved integer := coalesce((p_data->>'reserved_students')::integer, 0);
  priority_cap integer;
  priority_present integer;
  checked_in integer;
begin
  if not exists (select 1 from public.admin_profiles where id = p_admin) then
    raise sqlstate 'PT403' using message = 'An admin profile is required.';
  end if;
  if p_action = 'create' then
    if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_data->>'timezone') then
      raise sqlstate 'PT400' using message = 'Choose a valid timezone.';
    end if;
    insert into public.events(id, created_by, name, event_date, timezone, event_mode, lifecycle, pre_reg_open)
    values (p_event, p_admin, p_data->>'name', (p_data->>'event_date')::date, p_data->>'timezone', 'scheduled', 'draft', false)
    on conflict (id) do nothing;
    select * into e from public.events where id = p_event and event_mode = 'scheduled' and created_by = p_admin;
    if not found then raise sqlstate 'PT409' using message = 'Event ID already in use.'; end if;
    return to_jsonb(e);
  end if;
  select * into e from public.events where id = p_event for update;
  if not found then raise sqlstate 'PT404' using message = 'Event not found.'; end if;
  if p_action = 'archive' then
    if e.lifecycle <> 'archived' then
      update public.events set lifecycle = 'archived', archived_at = now(), archived_by = p_admin, pre_reg_open = false
      where id = p_event returning * into e;
    end if;
    return to_jsonb(e);
  end if;
  if e.event_mode <> 'scheduled' or e.lifecycle = 'archived' then
    raise sqlstate 'PT409' using message = 'This event cannot be edited here.';
  end if;
  if p_action = 'settings' then
    if (p_data->>'registration_opens_at')::timestamptz >= (p_data->>'pre_reg_deadline')::timestamptz then
      raise sqlstate 'PT400' using message = 'Registration opening must be before the deadline.';
    end if;
    if exists (select 1 from public.event_schedule where event_id = p_event
      and checkin_opens_at < (p_data->>'pre_reg_deadline')::timestamptz) then
      raise sqlstate 'PT409' using message = 'Pre-registration must end before the first check-in opens.';
    end if;
    update public.events set name = p_data->>'name', event_date = (p_data->>'event_date')::date,
      registration_opens_at = (p_data->>'registration_opens_at')::timestamptz,
      pre_reg_deadline = (p_data->>'pre_reg_deadline')::timestamptz
    where id = p_event returning * into e;
    return to_jsonb(e);
  elsif p_action = 'publish' then
    if e.registration_opens_at is null or e.pre_reg_deadline is null
       or not exists (select 1 from public.event_roles where event_id = p_event and registration_url is not null)
       or not exists (select 1 from public.event_schedule where event_id = p_event) then
      raise sqlstate 'PT409' using message = 'Set registration dates, a role with a registration link, and at least one session.';
    end if;
    if e.pre_reg_deadline > (select min(checkin_opens_at) from public.event_schedule where event_id = p_event) then
      raise sqlstate 'PT409' using message = 'Pre-registration must end before the first check-in opens.';
    end if;
    update public.events set lifecycle = 'active' where id = p_event returning * into e;
    return to_jsonb(e);
  elsif p_action = 'role' then
    if (p_data->>'registration_capacity')::integer < (
      select count(*) from public.event_participants where role_id = target and event_id = p_event and source = 'pre-reg'
    ) then
      raise sqlstate 'PT409' using message = 'Registration capacity is below existing registrations.';
    end if;
    insert into public.event_roles(id,event_id,name,student_priority,registration_capacity,registration_url,required_fields)
    values (coalesce(target, gen_random_uuid()),p_event,p_data->>'name',coalesce((p_data->>'student_priority')::boolean,false),
      (p_data->>'registration_capacity')::integer,p_data->>'registration_url',coalesce(p_data->'required_fields','[]'::jsonb))
    on conflict (id) do update set name = excluded.name, registration_capacity = excluded.registration_capacity,
      registration_url = excluded.registration_url, required_fields = excluded.required_fields
      where event_roles.event_id = p_event and event_roles.student_priority = excluded.student_priority
    returning * into r;
    if not found then raise sqlstate 'PT409' using message = 'The role belongs to another event or its student classification changed.'; end if;
    return to_jsonb(r);
  elsif p_action = 'venue' then
    perform public.check_event_caps(p_event, desired_capacity, caps);
    if exists (
      select 1 from public.event_schedule existing
      where existing.event_id = p_event and existing.venue_id = target
        and (existing.capacity > desired_capacity or exists (
          select 1 from jsonb_each_text(existing.role_caps) c where c.value::integer > 0 and coalesce((caps->>c.key)::integer,0) = 0
        ))
    ) then
      raise sqlstate 'PT409' using message = 'Adjust sessions before lowering the venue limit or removing a role.';
    end if;
    insert into public.event_venues(id,event_id,name,capacity,role_caps)
    values (coalesce(target,gen_random_uuid()),p_event,p_data->>'name',desired_capacity,caps)
    on conflict (id) do update set name = excluded.name, capacity = excluded.capacity, role_caps = excluded.role_caps
      where event_venues.event_id = p_event returning * into v;
    if not found then raise sqlstate 'PT409' using message = 'Venue belongs to another event.'; end if;
    return to_jsonb(v);
  elsif p_action = 'session' then
    select * into v from public.event_venues where event_id = p_event and id = (p_data->>'venue_id')::uuid;
    if not found then raise sqlstate 'PT400' using message = 'Select a venue belonging to this event.'; end if;
    if (p_data->>'checkin_opens_at')::timestamptz < e.pre_reg_deadline then
      raise sqlstate 'PT409' using message = 'Session check-in must open after pre-registration closes.';
    end if;
    perform public.check_event_caps(p_event, desired_capacity, caps);
    if desired_capacity > v.capacity or exists (
      select 1 from jsonb_each_text(caps) c where c.value::integer > 0 and coalesce((v.role_caps->>c.key)::integer,0) = 0
    ) then raise sqlstate 'PT400' using message = 'Session capacity and roles must fit the venue.'; end if;
    if exists (
      select 1 from public.event_schedule where event_id = p_event and venue_id = v.id
        and id is distinct from target and starts_at < (p_data->>'ends_at')::timestamptz
        and (p_data->>'starts_at')::timestamptz < ends_at
    ) then raise sqlstate 'PT409' using message = 'Another session overlaps at this venue.'; end if;
    select coalesce((caps->>id::text)::integer, 0) into priority_cap
      from public.event_roles where event_id = p_event and student_priority;
    select count(*), count(*) filter (where r2.student_priority and p.source = 'pre-reg') into checked_in, priority_present
      from public.event_checkins c join public.event_participants p on p.id = c.participant_id
      join public.event_roles r2 on r2.id = p.role_id where c.session_id = target and c.event_id = p_event;
    if reserved < 0 or reserved > coalesce(priority_cap,0)
      or checked_in + greatest(reserved - priority_present,0) > desired_capacity
      or exists (
        select 1 from public.event_checkins c join public.event_participants p on p.id = c.participant_id
        join public.event_roles r2 on r2.id = p.role_id where c.session_id = target and c.event_id = p_event
        group by p.role_id, r2.student_priority
        having count(*) + case when r2.student_priority then greatest(reserved - priority_present,0) else 0 end
          > coalesce((caps->>p.role_id::text)::integer,0)
      ) then raise sqlstate 'PT409' using message = 'The limits would exceed available space or invalidate existing check-ins.'; end if;
    if checked_in > 0 and exists (
      select 1 from public.event_schedule existing where existing.id = target and
        (existing.venue_id <> v.id or existing.starts_at <> (p_data->>'starts_at')::timestamptz)
    ) then raise sqlstate 'PT409' using message = 'The venue and starting time are fixed after check-in begins.'; end if;
    insert into public.event_schedule(id,event_id,venue_id,title,starts_at,ends_at,checkin_opens_at,walkins_open_at,capacity,role_caps,reserved_students,attendance_url,feedback_url)
    values (coalesce(target,gen_random_uuid()),p_event,v.id,p_data->>'title',(p_data->>'starts_at')::timestamptz,
      (p_data->>'ends_at')::timestamptz,(p_data->>'checkin_opens_at')::timestamptz,(p_data->>'walkins_open_at')::timestamptz,
      desired_capacity,caps,reserved,p_data->>'attendance_url',p_data->>'feedback_url')
    on conflict (id) do update set venue_id = excluded.venue_id, title = excluded.title, starts_at = excluded.starts_at,
      ends_at = excluded.ends_at, checkin_opens_at = excluded.checkin_opens_at, walkins_open_at = excluded.walkins_open_at,
      capacity = excluded.capacity, role_caps = excluded.role_caps, reserved_students = excluded.reserved_students,
      attendance_url = excluded.attendance_url, feedback_url = excluded.feedback_url
      where event_schedule.event_id = p_event returning * into s;
    if not found then raise sqlstate 'PT409' using message = 'Session belongs to another event.'; end if;
    return to_jsonb(s);
  end if;
  raise sqlstate 'PT400' using message = 'Unknown event action.';
end $$;

create function public.submit_scheduled_event(p_event uuid,p_action text,p_session uuid,p_data jsonb)
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
  if e.lifecycle <> 'active' then raise sqlstate 'PT410' using message = 'This event is closed.'; end if;
  check_time := clock_timestamp();
  if verified_email is null or verified_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise sqlstate 'PT400' using message = 'Enter a valid verified email.';
  end if;
  select * into p from public.event_participants where event_id = p_event and email = verified_email;
  if p_action = 'pre-registration' then
    if p.id is not null then return jsonb_build_object('registration_id',p.id,'created',false,'source',p.source); end if;
    if e.registration_opens_at is null or check_time < e.registration_opens_at or check_time >= e.pre_reg_deadline then
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
  if c.id is not null then
    return jsonb_build_object('checkin_id',c.id,'checked_in_at',c.checked_in_at,'display_name',p.full_name,'created',false);
  end if;
  if check_time < s.checkin_opens_at or check_time >= s.ends_at then
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

revoke execute on function public.guard_event_lifecycle(), public.guard_legacy_event_write(), public.guard_scheduled_event_write(),
  public.check_event_caps(uuid,integer,jsonb), public.manage_scheduled_event(uuid,uuid,text,jsonb),
  public.submit_scheduled_event(uuid,text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.check_event_caps(uuid,integer,jsonb),
  public.manage_scheduled_event(uuid,uuid,text,jsonb), public.submit_scheduled_event(uuid,text,uuid,jsonb) to service_role;

commit;
