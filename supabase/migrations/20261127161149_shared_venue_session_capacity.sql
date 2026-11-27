begin;

alter table public.events add column shared_venue_capacity boolean not null default false;
alter table public.events alter column shared_venue_capacity set default true;

alter function public.manage_scheduled_event(uuid,uuid,text,jsonb)
  rename to manage_scheduled_event_with_session_limits;

create function public.manage_scheduled_event(p_event uuid, p_admin uuid, p_action text, p_data jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  event_row public.events%rowtype;
  venue_row public.event_venues%rowtype;
  session_row public.event_schedule%rowtype;
  selected_venue uuid;
begin
  if p_action not in ('venue', 'session') then
    return public.manage_scheduled_event_with_session_limits(p_event, p_admin, p_action, p_data);
  end if;
  if not exists (select 1 from public.admin_profiles where id = p_admin) then
    raise sqlstate 'PT403' using message = 'An admin profile is required.';
  end if;
  select * into event_row from public.events where id = p_event for update;
  if not found then raise sqlstate 'PT404' using message = 'Event not found.'; end if;
  if not event_row.shared_venue_capacity then
    return public.manage_scheduled_event_with_session_limits(p_event, p_admin, p_action, p_data);
  end if;
  if event_row.event_mode <> 'scheduled' or event_row.lifecycle = 'archived' then
    raise sqlstate 'PT409' using message = 'This event cannot be edited here.';
  end if;

  if p_action = 'session' then
    selected_venue := (p_data->>'venue_id')::uuid;
    select * into venue_row from public.event_venues v where v.event_id = p_event and v.id = selected_venue;
    if not found then raise sqlstate 'PT400' using message = 'Select a venue belonging to this event.'; end if;
    return public.manage_scheduled_event_with_session_limits(p_event, p_admin, p_action,
      p_data || jsonb_build_object('capacity', venue_row.capacity, 'role_caps', venue_row.role_caps));
  end if;

  selected_venue := (p_data->>'id')::uuid;
  select * into venue_row from public.event_venues v where v.event_id = p_event and v.id = selected_venue;
  if not found then
    return public.manage_scheduled_event_with_session_limits(p_event, p_admin, p_action, p_data);
  end if;
  perform public.check_event_caps(p_event, (p_data->>'capacity')::integer, p_data->'role_caps');
  update public.event_venues v
    set name = p_data->>'name', capacity = (p_data->>'capacity')::integer, role_caps = p_data->'role_caps'
    where v.event_id = p_event and v.id = selected_venue
    returning * into venue_row;

  -- Each session uses the saved room limits. Reuse the check-in and protected-seat
  -- validation for each change and let any failure roll back the whole venue save.
  for session_row in select s.* from public.event_schedule s
    where s.event_id = p_event and s.venue_id = selected_venue
      and (s.capacity <> venue_row.capacity or s.role_caps <> venue_row.role_caps)
    order by s.id
  loop
    perform public.manage_scheduled_event_with_session_limits(p_event, p_admin, 'session',
      to_jsonb(session_row) || jsonb_build_object('capacity', venue_row.capacity, 'role_caps', venue_row.role_caps));
  end loop;
  return to_jsonb(venue_row);
end;
$$;

revoke execute on function public.manage_scheduled_event(uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.manage_scheduled_event(uuid,uuid,text,jsonb) to service_role;

-- Adopt shared capacity for the existing summit using its saved venue limits.
do $$
declare
  summit public.events%rowtype;
  venue_row public.event_venues%rowtype;
begin
  update public.events set shared_venue_capacity = true
    where id = 'dd191aad-6220-4683-96e0-c82e051acb9c' and event_mode = 'scheduled' and lifecycle <> 'archived'
    returning * into summit;
  if not found then return; end if;
  for venue_row in select v.* from public.event_venues v where v.event_id = summit.id order by v.id loop
    perform public.manage_scheduled_event(summit.id, summit.created_by, 'venue', to_jsonb(venue_row));
  end loop;
end $$;

commit;
