begin;

alter table public.event_schedule
  add column attendance_template jsonb
    check (jsonb_typeof(attendance_template) = 'object'),
  alter column attendance_url drop not null;

alter table public.event_checkins
  add column answers jsonb check (jsonb_typeof(answers) = 'object');

create function public.submit_scheduled_attendance(p_event uuid, p_session uuid, p_data jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  receipt jsonb;
begin
  if jsonb_typeof(p_data->'answers') is distinct from 'object' then
    raise sqlstate 'PT400' using message = 'Provide attendance answers as an object.';
  end if;

  receipt := public.submit_scheduled_event(p_event, 'attendance', p_session, p_data);
  if (receipt->>'created')::boolean then
    update public.event_checkins set answers = p_data->'answers'
      where event_id = p_event and session_id = p_session and id = (receipt->>'checkin_id')::uuid;
  end if;
  return receipt;
end $$;

revoke execute on function public.submit_scheduled_attendance(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.submit_scheduled_attendance(uuid, uuid, jsonb) to service_role;

commit;
