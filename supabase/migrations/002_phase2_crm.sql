-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2 — CRM: pipeline stages, notes, activity history, follow-up reminders.
-- Run after 001_phase1_core.sql.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── pipeline stage on businesses ─────────────────────────────────────────────
alter table businesses
  add column if not exists pipeline_stage text not null default 'not_contacted';

do $$ begin
  alter table businesses add constraint businesses_pipeline_stage_check
    check (pipeline_stage in (
      'not_contacted', 'contacted', 'follow_up', 'meeting_booked',
      'proposal_sent', 'closed_won', 'closed_lost'
    ));
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_businesses_stage on businesses (pipeline_stage);

-- ── notes ────────────────────────────────────────────────────────────────────
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_notes_business on notes (business_id, created_at desc);

-- ── activities — the status-update history (stage changes etc.) ─────────────
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  type text not null,            -- stage_change | reminder_completed | ...
  from_stage text,
  to_stage text,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists idx_activities_business on activities (business_id, created_at desc);

-- ── follow-up reminders ──────────────────────────────────────────────────────
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  note text not null,
  due_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_reminders_open_due on reminders (due_at) where completed_at is null;
create index if not exists idx_reminders_business on reminders (business_id);

-- ── per-stage rollup for the pipeline board ──────────────────────────────────
create or replace function pipeline_stats() returns jsonb
language sql stable as $$
  select coalesce(
    jsonb_object_agg(pipeline_stage, jsonb_build_object('count', cnt, 'value', val)),
    '{}'::jsonb
  )
  from (
    select pipeline_stage,
           count(*) as cnt,
           coalesce(sum(estimated_contract_value), 0) as val
    from businesses
    group by pipeline_stage
  ) s;
$$;

-- ── RLS (service-role only, same posture as phase 1) ─────────────────────────
alter table notes enable row level security;
alter table activities enable row level security;
alter table reminders enable row level security;
