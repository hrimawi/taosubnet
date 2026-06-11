-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1 — core schema: businesses, API-budget tracking, collection runs.
-- Run this in the Supabase SQL editor (or `supabase db push`) before Phase 2/3.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_trgm;

-- ── businesses ───────────────────────────────────────────────────────────────
-- One row per Google place_id. A business found by multiple city/industry
-- searches is stored once (de-dup key = place_id).
create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  place_id text not null unique,

  -- Google Places (New) fields
  name text not null,
  brand_key text,                       -- normalized name used for multi-location detection
  formatted_address text,
  street_address text,
  city text,
  state text default 'LA',
  postal_code text,
  latitude double precision,
  longitude double precision,
  phone text,
  website text,
  website_domain text,                  -- bare hostname used for Apollo enrichment
  google_maps_url text,
  google_rating numeric(2,1),
  review_count integer,
  google_primary_type text,
  google_types text[],
  business_status text,

  -- classification
  industry text not null,               -- our industry slug (see src/lib/config/industries.ts)
  also_matched_industries text[] not null default '{}',
  search_city text,                     -- the coverage city whose query first found this place
  is_multi_location boolean not null default false,
  location_count integer not null default 1,

  -- website probe (free HTTP check, feeds the scoring engine)
  website_quality text,                 -- none | broken | social_only | basic | good | sophisticated
  website_probe jsonb,

  -- Apollo enrichment. All nullable — Apollo degrades gracefully and we NEVER
  -- fabricate a contact. attempted_at is set on definitive answers (match or
  -- confirmed no-match) so we respect the 30-day re-fetch budget either way.
  apollo_org_id text,
  owner_name text,
  owner_title text,
  owner_email text,
  owner_linkedin_url text,
  company_linkedin_url text,
  employee_count integer,
  revenue_estimate bigint,
  apollo_industry text,
  company_description text,
  founded_year integer,
  apollo_attempted_at timestamptz,
  apollo_matched boolean,

  -- deterministic rule-based scores (computed in code — never by an LLM)
  lead_score integer,
  close_probability integer,
  estimated_contract_value integer,     -- $/month
  expected_monthly_value integer,       -- contract value × close probability
  score_breakdown jsonb,                -- factor-by-factor explanation for the UI
  automation_opportunities jsonb,       -- catalog items mapped to this industry
  scored_at timestamptz,

  -- cache bookkeeping + raw payloads (so we never re-pay for the same data)
  google_fetched_at timestamptz,
  google_raw jsonb,
  apollo_org_raw jsonb,
  apollo_person_raw jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_businesses_lead_score on businesses (lead_score desc nulls last);
create index if not exists idx_businesses_expected_value on businesses (expected_monthly_value desc nulls last);
create index if not exists idx_businesses_industry on businesses (industry);
create index if not exists idx_businesses_city on businesses (city);
create index if not exists idx_businesses_brand_key on businesses (brand_key);
create index if not exists idx_businesses_name_trgm on businesses using gin (name gin_trgm_ops);
create index if not exists idx_businesses_owner_trgm on businesses using gin (owner_name gin_trgm_ops);

-- ── search_cache ─────────────────────────────────────────────────────────────
-- One row per (industry × city) text search. The collector skips any query run
-- in the last 30 days unless --force is passed: this is the Google budget guard.
create table if not exists search_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,       -- "<industry>|<city>"
  industry text not null,
  city text not null,
  query_text text not null,
  result_count integer not null default 0,
  pages_fetched integer not null default 0,
  fetched_at timestamptz not null default now()
);

-- ── api_call_logs ────────────────────────────────────────────────────────────
-- Every billable external call (Google / Apollo / Anthropic) is logged with an
-- estimated cost so the admin view can show real spend.
create table if not exists api_call_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,               -- google | apollo | anthropic
  endpoint text not null,
  units integer not null default 1,
  estimated_cost numeric(12, 6) not null default 0,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_call_logs_provider_created
  on api_call_logs (provider, created_at desc);

-- ── collection_runs ──────────────────────────────────────────────────────────
create table if not exists collection_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running',  -- running | completed | failed
  params jsonb,
  stats jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- ── updated_at trigger ───────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_businesses_updated_at on businesses;
create trigger trg_businesses_updated_at
  before update on businesses
  for each row execute function set_updated_at();

-- ── dashboard stats (single round trip for the stat cards) ──────────────────
create or replace function dashboard_stats() returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'total_businesses', (select count(*) from businesses),
    'hot_leads',        (select count(*) from businesses where lead_score >= 80),
    'warm_leads',       (select count(*) from businesses where lead_score between 60 and 79),
    'enriched',         (select count(*) from businesses where apollo_matched is true),
    'with_website',     (select count(*) from businesses where website is not null),
    'hot_monthly_value',(select coalesce(sum(estimated_contract_value), 0)
                           from businesses where lead_score >= 80),
    'expected_value_top100', (select coalesce(sum(expected_monthly_value), 0)
                                from (select expected_monthly_value from businesses
                                      order by expected_monthly_value desc nulls last
                                      limit 100) t)
  );
$$;

-- ── API usage stats for the admin view ───────────────────────────────────────
create or replace function api_usage_stats() returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'providers', coalesce((
      select jsonb_object_agg(provider, row_data) from (
        select provider, jsonb_build_object(
          'total_calls', count(*),
          'total_cost', coalesce(sum(estimated_cost), 0),
          'calls_30d', count(*) filter (where created_at > now() - interval '30 days'),
          'cost_30d', coalesce(sum(estimated_cost) filter (where created_at > now() - interval '30 days'), 0)
        ) as row_data
        from api_call_logs group by provider
      ) p
    ), '{}'::jsonb),
    'cache', jsonb_build_object(
      'businesses_total', (select count(*) from businesses),
      'google_fresh_30d', (select count(*) from businesses
                             where google_fetched_at > now() - interval '30 days'),
      'apollo_fresh_30d', (select count(*) from businesses
                             where apollo_attempted_at > now() - interval '30 days'),
      'searches_cached_30d', (select count(*) from search_cache
                                where fetched_at > now() - interval '30 days')
    )
  );
$$;

-- ── Row Level Security ───────────────────────────────────────────────────────
-- RLS is enabled with NO policies: the anon key can read nothing. The app only
-- talks to the database through Next.js API routes / scripts using the
-- service-role key, which bypasses RLS. Browsers never hold a Supabase key.
alter table businesses enable row level security;
alter table search_cache enable row level security;
alter table api_call_logs enable row level security;
alter table collection_runs enable row level security;
