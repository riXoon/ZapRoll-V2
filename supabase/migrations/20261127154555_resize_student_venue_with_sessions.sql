begin;

create function public.resize_student_event_venue(p_event uuid, p_admin uuid, p_data jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  event_row public.events%rowtype;
  venue_row public.event_venues%rowtype;
  session_row public.event_schedule%rowtype;
  venue_id uuid := (p_data->>'id')::uuid;
  desired_capacity integer := (p_data->>'capacity')::integer;
  caps jsonb := p_data->'role_caps';
  student_id text;
  affected jsonb;
begin
  if not exists (select 1 from public.admin_profiles where id = p_admin) then
    raise sqlstate 'PT403' using message = 'An admin profile is required.';
  end if;
  select * into event_row from public.events where id = p_event for update;
  if not found then raise sqlstate 'PT404' using message = 'Event not found.'; end if;
  if event_row.event_mode <> 'scheduled' or event_row.lifecycle = 'archived'
    or not event_row.student_pre_registration_only then
    raise sqlstate 'PT409' using message = 'This event does not support adjusting student sessions together.';
  end if;

  select * into venue_row from public.event_venues v where v.event_id = p_event and v.id = venue_id;
  if not found then raise sqlstate 'PT404' using message = 'Venue not found for this event.'; end if;
  select r.id::text into student_id from public.event_roles r
    where r.event_id = p_event and lower(btrim(r.name)) = 'student';
  perform public.check_event_caps(p_event, desired_capacity, caps);
  if student_id is null or caps - student_id <> '{}'::jsonb or not (caps ? student_id) then
    raise sqlstate 'PT409' using message = 'Only venues allocated entirely to students can be adjusted together.';
  end if;

  select coalesce(jsonb_object_agg(s.id, jsonb_build_object('capacity', s.capacity, 'role_caps', s.role_caps)), '{}'::jsonb)
    into affected from public.event_schedule s
    where s.event_id = p_event and s.venue_id = venue_row.id and s.capacity > desired_capacity;
  if affected = '{}'::jsonb and venue_row.capacity = desired_capacity and venue_row.role_caps = caps
    and venue_row.name = p_data->>'name' then
    return to_jsonb(venue_row);
  end if;
  if affected is distinct from p_data->'affected_sessions'
    or jsonb_build_object('name', venue_row.name, 'capacity', venue_row.capacity, 'role_caps', venue_row.role_caps)
      is distinct from p_data->'expected_venue' then
    raise sqlstate 'PT409' using message = 'The venue or session limits changed. Refresh Setup and review the venue before saving.';
  end if;

  for session_row in select s.* from public.event_schedule s
    where s.event_id = p_event and s.venue_id = venue_row.id and affected ? s.id::text
    order by s.id
  loop
    if session_row.role_caps - student_id <> '{}'::jsonb or not (session_row.role_caps ? student_id) then
      raise sqlstate 'PT409' using message = 'Adjust sessions with other role allocations individually in Setup.';
    end if;
    perform public.manage_scheduled_event(p_event, p_admin, 'session',
      to_jsonb(session_row) || jsonb_build_object(
        'capacity', desired_capacity,
        'role_caps', jsonb_build_object(student_id,
          least((session_row.role_caps->>student_id)::integer, (caps->>student_id)::integer))
      ));
  end loop;

  return public.manage_scheduled_event(p_event, p_admin, 'venue', p_data);
end;
$$;

revoke execute on function public.resize_student_event_venue(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.resize_student_event_venue(uuid,uuid,jsonb) to service_role;

commit;
