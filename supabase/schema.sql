-- ZAPROLL DATABASE SCHEMA
-- Highly Normalized, Scalable, and Idempotent
-- Built for Supabase (PostgreSQL)

-- ==========================================
-- 0. EXTENSIONS & SETUP
-- ==========================================
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. ADMIN INFRASTRUCTURE
-- ==========================================

-- Admin Profiles (linked to auth.users)
create table if not exists public.admin_profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    organization_name text,
    created_at timestamptz default now()
);

-- Enable RLS on admin_profiles
alter table public.admin_profiles enable row level security;

-- Trigger function for new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.admin_profiles (id, full_name, organization_name)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'organization')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Revoke execute from public to prevent API calls, only allow service_role and internal triggers
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

-- Recreate trigger safely
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==========================================
-- 2. STEP 1: PRE-REGISTRATION
-- ==========================================

-- Events Table
create table if not exists public.events (
    id uuid primary key default gen_random_uuid(),
    created_by uuid references public.admin_profiles(id) not null,
    name text not null,
    venue text,
    event_date date not null,
    total_capacity integer check (total_capacity > 0),
    is_locked boolean default false,
    evaluation_base_url text,
    registration_url text,
    pre_reg_open boolean default true,
    pre_reg_deadline timestamptz,
    created_at timestamptz default now()
);

-- Event Quotas (Roles)
create table if not exists public.event_quotas (
    id uuid primary key default gen_random_uuid(),
    event_id uuid references public.events(id) on delete cascade not null,
    name text not null, -- e.g. "Student", "Guest"
    capacity integer not null check (capacity >= 0),
    is_open boolean default true,
    created_at timestamptz default now()
);

-- Update event_quotas with required_fields if missing
alter table public.event_quotas add column if not exists required_fields jsonb default '[]'::jsonb;

-- Registrations (Pre-registered list)
create table if not exists public.registrations (
    id uuid primary key default gen_random_uuid(),
    event_id uuid references public.events(id) on delete cascade not null,
    quota_id uuid references public.event_quotas(id) on delete set null,
    email text,
    full_name text not null,
    status text default 'registered' check (status in ('registered', 'attended', 'cancelled')),
    created_at timestamptz default now()
);

-- Update registrations with scalable columns if missing
alter table public.registrations add column if not exists external_id text;
alter table public.registrations add column if not exists reg_type text default 'pre-reg';
alter table public.registrations add column if not exists metadata jsonb default '{}'::jsonb;

-- Handle Registration Constraint Migration
do $$
begin
    -- Drop old email-based constraint if it exists
    if exists (select 1 from pg_constraint where conname = 'registrations_event_id_email_key') then
        alter table public.registrations drop constraint registrations_event_id_email_key;
    end if;
    
    -- Add new ID-based constraint if it doesn't exist
    if not exists (select 1 from pg_constraint where conname = 'registrations_event_id_external_id_key') then
        alter table public.registrations add constraint registrations_event_id_external_id_key unique(event_id, external_id);
    end if;
end $$;

-- ==========================================
-- 3. STEP 2: EVENT DAY REGISTRATION
-- ==========================================

-- Sessions (AM, PM, etc.)
create table if not exists public.sessions (
    id uuid primary key default gen_random_uuid(),
    event_id uuid references public.events(id) on delete cascade not null,
    name text not null, -- "AM Session", "PM Session"
    start_time timestamptz,
    created_at timestamptz default now()
);

-- FIX: Added qr_access_token for security (Time Restrictions)
alter table public.sessions add column if not exists qr_access_token text;

-- Attendance Logs
create table if not exists public.attendance (
    id uuid primary key default gen_random_uuid(),
    registration_id uuid references public.registrations(id) on delete cascade not null,
    session_id uuid references public.sessions(id) on delete cascade not null,
    scanned_at timestamptz default now(),
    unique(registration_id, session_id)
);

-- ==========================================
-- 4. STEP 3: POST-EVENT (EVALUATIONS)
-- ==========================================

-- Evaluation Templates
create table if not exists public.evaluation_templates (
    id uuid primary key default gen_random_uuid(),
    event_id uuid references public.events(id) on delete cascade not null unique,
    title text not null,
    questions jsonb not null, 
    is_active boolean default false,
    created_at timestamptz default now()
);

-- Evaluation Responses
create table if not exists public.evaluation_responses (
    id uuid primary key default gen_random_uuid(),
    template_id uuid references public.evaluation_templates(id) on delete cascade not null,
    registration_id uuid references public.registrations(id) on delete cascade not null,
    session_id uuid references public.sessions(id) on delete set null,
    responses jsonb not null, 
    submitted_at timestamptz default now()
);

-- FIX: Unique constraint on (registration_id, template_id, session_id)
do $$
begin
    -- Drop old simpler unique constraint if it exists
    if exists (select 1 from pg_constraint where conname = 'evaluation_responses_template_id_registration_id_key') then
        alter table public.evaluation_responses drop constraint evaluation_responses_template_id_registration_id_key;
    end if;
    
    -- Add the robust constraint
    if not exists (select 1 from pg_constraint where conname = 'evaluation_responses_reg_temp_session_key') then
        alter table public.evaluation_responses add constraint evaluation_responses_reg_temp_session_key unique(registration_id, template_id, session_id);
    end if;
end $$;

-- Certificates / Whitelist
create table if not exists public.certificates (
    id uuid primary key default gen_random_uuid(),
    registration_id uuid references public.registrations(id) on delete cascade not null,
    event_id uuid references public.events(id) on delete cascade not null,
    is_claimed boolean default false,
    issued_at timestamptz,
    created_at timestamptz default now(),
    unique(registration_id, event_id)
);

-- FIX: Certificate Logic (Claim only if attendance exists)
create or replace function public.validate_certificate_claim()
returns trigger as $$
begin
  if new.is_claimed = true and old.is_claimed = false then
    if not exists (
      select 1 from public.attendance 
      where registration_id = new.registration_id
    ) then
      raise exception 'Participant must have at least one attendance record to claim a certificate.';
    end if;
    new.issued_at = now();
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists tr_validate_certificate_claim on public.certificates;
create trigger tr_validate_certificate_claim
  before update on public.certificates
  for each row execute procedure public.validate_certificate_claim();

-- ==========================================
-- 5. PERFORMANCE & SCALABILITY (INDEXES)
-- ==========================================

create index if not exists idx_attendance_registration_id on public.attendance(registration_id);
create index if not exists idx_attendance_session_id on public.attendance(session_id);
create index if not exists idx_registrations_external_id_event on public.registrations(external_id, event_id);
create index if not exists idx_eval_questions_jsonb on public.evaluation_templates using gin (questions);
create index if not exists idx_eval_responses_jsonb on public.evaluation_responses using gin (responses);

-- ==========================================
-- 6. REPORTING VIEWS (Always Replaced)
-- ==========================================

drop view if exists public.v_event_stats;
create or replace view public.v_event_stats 
with (security_invoker = true)
as
select 
    e.id as event_id,
    e.name as event_name,
    (select count(*) from public.registrations where event_id = e.id) as total_registered,
    (select coalesce(sum(
        greatest(
            (case when am_scanned_at is not null then 1 else 0 end) +
            (case when pm_scanned_at is not null then 1 else 0 end) +
            (case when employee_scanned_at is not null then 1 else 0 end),
            (case when session_id is not null then 1 else 0 end)
        )
     ), 0) from public.attendance where event_id = e.id) as total_attendance_scans,
    (select count(*) from public.evaluation_responses er 
     join public.registrations r on er.registration_id = r.id 
     where r.event_id = e.id) as total_evaluations
from public.events e;

drop view if exists public.v_certificate_eligibility;
create or replace view public.v_certificate_eligibility 
with (security_invoker = true)
as
select 
    r.id as registration_id,
    r.full_name,
    r.email,
    r.external_id,
    r.metadata,
    -- Timestamps
    a.am_scanned_at,
    a.pm_scanned_at,
    er.am_eval_submitted_at,
    er.pm_eval_submitted_at,
    -- Combined Eligibility
    (
        a.am_scanned_at is not null and 
        a.pm_scanned_at is not null and
        er.am_eval_submitted_at is not null and
        er.pm_eval_submitted_at is not null
    ) as is_eligible
from public.registrations r
left join public.attendance a on a.registration_id = r.id
left join public.evaluation_responses er on er.registration_id = r.id;

-- ==========================================
-- 7. SECURITY (Policies Recreated Safely)
-- ==========================================

-- Enable RLS on all tables
alter table public.events enable row level security;
alter table public.event_quotas enable row level security;
alter table public.registrations enable row level security;
alter table public.sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.evaluation_templates enable row level security;
alter table public.evaluation_responses enable row level security;
alter table public.certificates enable row level security;

-- Helper to safely recreate policies
do $$
begin
    -- Events
    drop policy if exists admin_all_on_events on public.events;
    create policy admin_all_on_events on public.events for all using (auth.uid() = created_by);

    -- Quotas
    drop policy if exists admin_all_on_quotas on public.event_quotas;
    create policy admin_all_on_quotas on public.event_quotas for all using (
        exists (select 1 from public.events where id = event_id and created_by = auth.uid())
    );

    -- Registrations
    drop policy if exists admin_all_on_registrations on public.registrations;
    create policy admin_all_on_registrations on public.registrations for all using (
        exists (select 1 from public.events where id = event_id and created_by = auth.uid())
    );

    -- Sessions
    drop policy if exists admin_all_on_sessions on public.sessions;
    create policy admin_all_on_sessions on public.sessions for all using (
        exists (select 1 from public.events where id = event_id and created_by = auth.uid())
    );

    -- Attendance
    drop policy if exists admin_all_on_attendance on public.attendance;
    create policy admin_all_on_attendance on public.attendance for all using (
        exists (
            select 1 from public.registrations r 
            join public.events e on r.event_id = e.id 
            where r.id = registration_id and e.created_by = auth.uid()
        )
    );

    -- Evaluations
    drop policy if exists public_insert_responses on public.evaluation_responses;
    create policy public_insert_responses on public.evaluation_responses for insert with check (
        exists (select 1 from public.registrations where id = registration_id)
    );

    drop policy if exists public_select_templates on public.evaluation_templates;
    create policy public_select_templates on public.evaluation_templates for select using (is_active = true);
end $$;
