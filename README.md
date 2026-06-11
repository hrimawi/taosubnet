# NOLA Lead Intelligence Dashboard

Identify, rank, and visualize businesses in the Greater New Orleans metro that are
likely to purchase AI-automation services.

- **Coverage:** 26 metro cities (Orleans, Jefferson, St. Bernard, Plaquemines,
  St. Charles, St. John, St. Tammany parishes)
- **Industries:** 18 service-business verticals (law, trades, medical/dental,
  real estate, insurance, fitness, agencies, …)
- **Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · Supabase
  (PostgreSQL) · Google Maps Platform · Apollo.io · Anthropic Claude

## How it works

```
npm run collect   (on-demand background job — never runs on page load)
  1. Google Places API (New) places:searchText  → business profiles
  2. De-duplication on place_id + multi-location brand detection
  3. Free website-quality probe                 → digital-sophistication signal
  4. Apollo enrichment (domain-keyed)           → owner / employees / revenue
  5. Deterministic rule-based scoring           → Lead Score, Close %, $/mo
        ↓
Supabase (PostgreSQL)  ←  every Google/Apollo/Claude response cached ≥30 days
        ↓
Next.js dashboard  →  clustered map · top-100 leaderboard · filters/search ·
                      detail side panel · CRM pipeline · CSV export · AI outreach
```

**Hard rules baked into the code**

- Numeric scoring is **rule-based in code** — fast, free, reproducible. Claude is
  used *only* for qualitative copy (prospect summary + outreach), cached per
  business so it generates once.
- **Never fabricate data.** If Apollo finds no decision-maker, fields stay null.
  Locked-email placeholders are discarded. Null is always better than a guess.
- **Budget protection.** Every (industry × city) search and every business's
  Google/Apollo data is cached 30 days and never re-fetched inside that window.
  Every billable call is logged with an estimated cost (see `/admin`).
- All automation recommendations come from the fixed catalog in
  `src/lib/config/automations.ts`, mapped by industry — nothing invented.

## Local setup

### 0. Prerequisites

- Node.js 20+ (22 recommended)
- A [Supabase](https://supabase.com) project (free tier works)
- API keys: Google Maps Platform, Apollo.io, Anthropic

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Create the database schema

In the Supabase dashboard → **SQL editor**, run the migration files **in order**:

1. `supabase/migrations/001_phase1_core.sql`
2. `supabase/migrations/002_phase2_crm.sql`
3. `supabase/migrations/003_phase3_ai.sql`

(RLS is enabled with no policies — the browser never talks to Supabase directly;
everything goes through Next.js API routes using the service-role key.)

### 3. Configure `.env.local`

| Variable | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (service_role — server-side only) |
| `GOOGLE_MAPS_API_KEY` | Google Cloud console — **server** key, restrict to *Places API (New)* + *Geocoding API* |
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | Google Cloud console — **browser** key, restrict to *Maps JavaScript API* + HTTP referrers |
| `APOLLO_API_KEY` | Apollo → Settings → Integrations → API |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `ANTHROPIC_MODEL` | optional, defaults to `claude-opus-4-8` |

Using two Google keys keeps the expensive server key out of the browser entirely.

### 4. Collect data (this spends real money — start small)

```bash
# See exactly what a run would do and the worst-case Google cost — zero API calls:
npm run collect -- --dry-run

# Recommended first run: one city × two industries (~$0.40 worst case):
npm run collect -- --cities=Metairie --industries=hvac,dental --limit=25

# Full metro sweep (26 cities × 18 industries ≈ $35–50 of Google spend first time;
# subsequent runs inside 30 days cost ~$0 thanks to the cache):
npm run collect
```

Useful flags: `--skip-apollo`, `--skip-probe`, `--limit=N` (cap Apollo
enrichments), `--max-pages=N` (1–3 Places pages per query), `--force`
(ignore the 30-day cache — re-spends budget).

After tuning scoring weights (`src/lib/scoring/engine.ts`), re-score for free:

```bash
npm run rescore
```

### 5. Run the dashboard

```bash
npm run dev      # http://localhost:3000
```

## Using the dashboard

| Page | What it does |
| --- | --- |
| **Dashboard** (`/`) | Stat cards, clustered score-colored map, top-100 leaderboard, filters + search. Click any pin or row for the full side panel. |
| **Leads** (`/leads`) | Sortable, filterable table of every business with pagination and CSV export. |
| **Pipeline** (`/pipeline`) | Kanban board across the 7 CRM stages with per-stage value totals. |
| **Reminders** (`/reminders`) | Follow-up reminders grouped by overdue / today / upcoming. |
| **Admin** (`/admin`) | API call counts + estimated spend per provider, cache freshness, collection-run history. |

**Side panel** — Lead Score / Close Probability / Estimated $/mo, decision-maker
contact info, company facts, automation opportunities (from the catalog), a
factor-by-factor "why this score" breakdown, CRM stage + notes + reminders, and
AI-generated outreach (Phase 3).

**Scores** — Green 80–100 · Yellow 60–79 · Red 0–59. Contract values are
deliberately realistic: $300–$1,000/mo for most small shops, capped at $1,200
for small single-location businesses and $4,000 absolute; only multi-location /
high-headcount operations scale toward $2,500+.

## AI outreach (Phase 3)

For any business, the panel's **AI Outreach** tab generates and caches a prospect
summary, cold email, cold-call script, LinkedIn message, and follow-up email —
grounded in that business's real data and its catalog automations. Content
generates once and is cached; regenerate only on explicit request. Batch
pre-generation for your top prospects:

```bash
npm run generate-ai -- --limit=25          # top 25 by expected value
npm run generate-ai -- --limit=25 --types=summary,cold_email
```

## Deployment (Vercel + Supabase)

1. Push this repo to GitHub and import it in [Vercel](https://vercel.com)
   (framework auto-detects Next.js).
2. Add all variables from `.env.example` in Vercel → Project → Settings →
   Environment Variables.
3. Add your Vercel domain to the **browser** Google key's HTTP-referrer
   allowlist.
4. Deploy. The collection job stays an on-demand script — run it from your
   machine (`npm run collect`) or any scheduled worker (GitHub Actions cron,
   Railway, etc.) with the same env vars. It is intentionally **not** an HTTP
   endpoint, so it can never be triggered by page traffic.

## Project layout

```
supabase/migrations/      schema, applied in order (phase 1 → 3)
scripts/                  collect-data.ts · rescore.ts · generate-ai.ts
src/lib/config/           cities · industries · automation catalog · pricing
src/lib/scoring/          deterministic scoring engine
src/lib/google|apollo|website|ai/   integration clients
src/app/api/              REST endpoints consumed by the UI
src/app/ + src/components/  dashboard UI
```

## Troubleshooting

- **“Missing environment variable …” banner** — copy `.env.example` →
  `.env.local` and fill it in; restart the dev server.
- **Map shows “key missing” / gray tiles** — `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`
  unset, Maps JavaScript API not enabled, or referrer restriction blocks
  `localhost:3000`.
- **`dashboard_stats` errors** — the SQL migrations haven't been applied (or not
  all three).
- **Apollo enrichment stops early** — the run aborts on quota/permission errors
  (402/403) or 3 consecutive failures; check your Apollo plan limits and re-run.
  Already-attempted businesses are cached and won't be re-billed.
