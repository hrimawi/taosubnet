-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 3 — AI content cache. Claude output is generated once per business per
-- content type and cached here; regeneration only happens on explicit request.
-- Run after 002_phase2_crm.sql.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists ai_content (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  content_type text not null check (content_type in (
    'summary', 'cold_email', 'call_script', 'linkedin_message', 'follow_up_email'
  )),
  content text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  generated_at timestamptz not null default now(),
  unique (business_id, content_type)
);

create index if not exists idx_ai_content_business on ai_content (business_id);

alter table ai_content enable row level security;

-- Extend the admin usage stats with the AI cache count.
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
                                where fetched_at > now() - interval '30 days'),
      'ai_content_cached', (select count(*) from ai_content)
    )
  );
$$;
