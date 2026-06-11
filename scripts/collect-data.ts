/**
 * On-demand background data-collection job. NEVER runs on page load.
 *
 *   npm run collect -- [options]
 *
 * Options:
 *   --cities=Metairie,Kenner      restrict to specific coverage cities
 *   --industries=hvac,dental      restrict to specific industry slugs
 *   --max-pages=N                 Places pages per query (default 3 ≈ 60 results)
 *   --limit=N                     cap Apollo enrichments this run
 *   --skip-apollo                 Google collection + scoring only
 *   --skip-probe                  skip the free website-quality probe
 *   --force                       ignore the 30-day search cache (re-spends budget!)
 *   --dry-run                     print the query plan + worst-case cost, no API calls
 *
 * Budget guards (this is real money):
 *   - every (industry × city) text search is cached 30 days (search_cache)
 *   - a business's Google data is not re-fetched within 30 days
 *   - Apollo is never re-queried for a business attempted within 30 days,
 *     including confirmed no-matches
 *   - every billable call is logged to api_call_logs with an estimated cost
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { getDb, fetchAllPages } from "../src/lib/db";
import { requireEnv } from "../src/lib/env";
import { COVERAGE_CITIES, isInsideMetro } from "../src/lib/config/cities";
import {
  INDUSTRIES,
  classifyIndustry,
  type IndustryDef,
} from "../src/lib/config/industries";
import { GOOGLE_TEXT_SEARCH_COST } from "../src/lib/config/pricing";
import {
  searchTextAll,
  parseAddressComponents,
  type GooglePlace,
} from "../src/lib/google/places";
import {
  ApolloQuotaError,
  enrichOrganization,
  extractEnrichableDomain,
  findDecisionMaker,
  sanitizeEmail,
} from "../src/lib/apollo/client";
import { probeWebsite } from "../src/lib/website/probe";
import { scoreBusiness } from "../src/lib/scoring/engine";
import { normalizeBrandKey } from "../src/lib/brand";
import { mapWithConcurrency } from "../src/lib/queue";

const STALE_MS = 30 * 24 * 60 * 60 * 1000;
const isFresh = (iso: string | null | undefined) =>
  !!iso && Date.now() - new Date(iso).getTime() < STALE_MS;

// ── CLI args ─────────────────────────────────────────────────────────────────

interface Args {
  cities: string[];
  industries: IndustryDef[];
  maxPages: number;
  limit: number | null;
  skipApollo: boolean;
  skipProbe: boolean;
  force: boolean;
  dryRun: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.split("=").slice(1).join("=") : null;
  };
  const has = (name: string) => argv.includes(`--${name}`);

  const cityArg = get("cities");
  const cities = cityArg
    ? cityArg.split(",").map((c) => c.trim()).filter(Boolean)
    : [...COVERAGE_CITIES];
  const unknownCity = cities.find(
    (c) => !COVERAGE_CITIES.some((cc) => cc.toLowerCase() === c.toLowerCase()),
  );
  if (unknownCity) {
    console.warn(`⚠ "${unknownCity}" is not in the coverage list — searching it anyway.`);
  }

  const indArg = get("industries");
  let industries = INDUSTRIES;
  if (indArg) {
    const slugs = indArg.split(",").map((s) => s.trim());
    industries = INDUSTRIES.filter((i) => slugs.includes(i.slug));
    const missing = slugs.filter((s) => !industries.some((i) => i.slug === s));
    if (missing.length) {
      console.error(`Unknown industry slug(s): ${missing.join(", ")}`);
      console.error(`Valid slugs: ${INDUSTRIES.map((i) => i.slug).join(", ")}`);
      process.exit(1);
    }
  }

  return {
    cities,
    industries,
    maxPages: Math.max(1, Math.min(3, Number(get("max-pages")) || 3)),
    limit: get("limit") ? Math.max(0, Number(get("limit"))) : null,
    skipApollo: has("skip-apollo"),
    skipProbe: has("skip-probe"),
    force: has("force"),
    dryRun: has("dry-run"),
  };
}

// ── Google place → businesses row ────────────────────────────────────────────

function buildGoogleRow(place: GooglePlace, industry: string, searchCity: string) {
  const name = place.displayName?.text?.trim() ?? "";
  const addr = parseAddressComponents(place);
  const website = place.websiteUri ?? null;
  return {
    place_id: place.id,
    name,
    brand_key: normalizeBrandKey(name),
    formatted_address: place.formattedAddress ?? null,
    street_address: addr.streetAddress,
    city: addr.city,
    state: addr.state ?? "LA",
    postal_code: addr.postalCode,
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
    website,
    website_domain: extractEnrichableDomain(website),
    google_maps_url: place.googleMapsUri ?? null,
    google_rating: place.rating ?? null,
    review_count: place.userRatingCount ?? null,
    google_primary_type: place.primaryType ?? null,
    google_types: place.types ?? null,
    business_status: place.businessStatus ?? null,
    industry,
    search_city: searchCity,
    google_fetched_at: new Date().toISOString(),
    google_raw: place as unknown as Record<string, unknown>,
  };
}

type GoogleRow = ReturnType<typeof buildGoogleRow>;

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  const queries = args.cities.flatMap((city) =>
    args.industries.map((industry) => ({
      city,
      industry,
      cacheKey: `${industry.slug}|${city}`,
      query: `${industry.searchQuery} in ${city}, Louisiana`,
    })),
  );

  if (args.dryRun) {
    const worstCaseCalls = queries.length * args.maxPages;
    console.log(`DRY RUN — no API calls will be made.\n`);
    console.log(`Planned text searches : ${queries.length} (cities=${args.cities.length} × industries=${args.industries.length})`);
    console.log(`Worst-case Google calls: ${worstCaseCalls} pages ≈ $${(worstCaseCalls * GOOGLE_TEXT_SEARCH_COST).toFixed(2)}`);
    console.log(`(30-day search cache will skip any query already run recently — actual spend is usually lower.)`);
    console.log(`Apollo: up to 2 calls per business with a website${args.limit != null ? `, capped at ${args.limit} businesses` : ""}.`);
    return;
  }

  // Validate config up front so we fail before spending anything.
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  requireEnv("GOOGLE_MAPS_API_KEY");
  if (!args.skipApollo) requireEnv("APOLLO_API_KEY");

  const db = getDb();
  const runStart = new Date().toISOString();
  const { data: runRow, error: runErr } = await db
    .from("collection_runs")
    .insert({
      params: {
        cities: args.cities,
        industries: args.industries.map((i) => i.slug),
        maxPages: args.maxPages,
        limit: args.limit,
        skipApollo: args.skipApollo,
        skipProbe: args.skipProbe,
        force: args.force,
      },
    })
    .select("id")
    .single();
  if (runErr) throw new Error(`Cannot create collection run (is the schema applied?): ${runErr.message}`);
  const runId = runRow.id as string;

  const stats = {
    queries_planned: queries.length,
    queries_run: 0,
    queries_cached: 0,
    places_returned: 0,
    places_outside_metro: 0,
    businesses_new: 0,
    businesses_refreshed: 0,
    businesses_fresh_skipped: 0,
    multi_location_brands: 0,
    probes_run: 0,
    apollo_attempted: 0,
    apollo_matched: 0,
    apollo_no_match: 0,
    apollo_errors: 0,
    scored: 0,
  };

  try {
    // ── 1. Google Places collection ──────────────────────────────────────────
    console.log(`\n━━ Step 1/5 · Google Places (New) text search ━━`);

    const cached = await fetchAllPages<{ cache_key: string; fetched_at: string }>(
      (from, to) => db.from("search_cache").select("cache_key,fetched_at").range(from, to),
    );
    const cacheMap = new Map(cached.map((c) => [c.cache_key, c.fetched_at]));

    const existing = await fetchAllPages<{
      place_id: string;
      industry: string;
      also_matched_industries: string[];
      google_fetched_at: string | null;
    }>((from, to) =>
      db
        .from("businesses")
        .select("place_id,industry,also_matched_industries,google_fetched_at")
        .range(from, to),
    );
    const existingMap = new Map(existing.map((b) => [b.place_id, b]));

    const inserts = new Map<string, GoogleRow>();
    const refreshes = new Map<string, GoogleRow & { industry: string }>();
    const alsoMatched = new Map<string, Set<string>>();

    for (const [qi, item] of queries.entries()) {
      if (!args.force && isFresh(cacheMap.get(item.cacheKey))) {
        stats.queries_cached++;
        continue;
      }
      process.stdout.write(
        `  [${qi + 1}/${queries.length}] ${item.query} … `,
      );
      const { places, pagesFetched } = await searchTextAll(item.query, args.maxPages);
      console.log(`${places.length} results (${pagesFetched} page${pagesFetched === 1 ? "" : "s"})`);
      stats.queries_run++;
      stats.places_returned += places.length;

      for (const place of places) {
        if (!place.id || !place.displayName?.text) continue;
        if (place.businessStatus === "CLOSED_PERMANENTLY") continue;
        const lat = place.location?.latitude ?? null;
        const lng = place.location?.longitude ?? null;
        if (!isInsideMetro(lat, lng)) {
          stats.places_outside_metro++;
          continue;
        }

        const industry = classifyIndustry(place.primaryType, item.industry.slug);
        const prior = existingMap.get(place.id);
        const pending = inserts.get(place.id) ?? refreshes.get(place.id);
        const assignedIndustry = prior?.industry ?? pending?.industry;

        if (assignedIndustry && assignedIndustry !== industry) {
          // De-dup: counted once under its first industry; remember the others.
          if (!alsoMatched.has(place.id)) alsoMatched.set(place.id, new Set());
          alsoMatched.get(place.id)!.add(industry);
        }

        if (pending) continue; // already queued this run
        if (prior) {
          if (isFresh(prior.google_fetched_at)) {
            stats.businesses_fresh_skipped++;
            continue;
          }
          // Refresh Google fields but keep the original industry assignment.
          refreshes.set(place.id, {
            ...buildGoogleRow(place, prior.industry, item.city),
            industry: prior.industry,
          });
        } else {
          inserts.set(place.id, buildGoogleRow(place, industry, item.city));
        }
      }

      await db.from("search_cache").upsert(
        {
          cache_key: item.cacheKey,
          industry: item.industry.slug,
          city: item.city,
          query_text: item.query,
          result_count: places.length,
          pages_fetched: pagesFetched,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "cache_key" },
      );
    }

    for (const batch of chunk([...inserts.values()], 100)) {
      const { error } = await db.from("businesses").insert(batch);
      if (error) throw new Error(`insert businesses: ${error.message}`);
      stats.businesses_new += batch.length;
    }
    // Upsert refreshes: payload includes every NOT NULL column (place_id, name,
    // industry) so the INSERT branch is valid; conflicting rows just update the
    // Google fields and keep their Apollo/CRM data untouched.
    for (const batch of chunk([...refreshes.values()], 100)) {
      const { error } = await db
        .from("businesses")
        .upsert(batch, { onConflict: "place_id" });
      if (error) throw new Error(`refresh businesses: ${error.message}`);
      stats.businesses_refreshed += batch.length;
    }
    for (const [placeId, industries] of alsoMatched) {
      // Rows inserted this run aren't in existingMap — they start from [].
      const prior = existingMap.get(placeId)?.also_matched_industries ?? [];
      const merged = [...new Set([...prior, ...industries])];
      await db
        .from("businesses")
        .update({ also_matched_industries: merged })
        .eq("place_id", placeId);
    }
    console.log(
      `  → ${stats.businesses_new} new, ${stats.businesses_refreshed} refreshed, ` +
        `${stats.businesses_fresh_skipped} fresh (cache), ${stats.queries_cached} queries skipped (30-day cache)`,
    );

    // ── 2. Multi-location detection ──────────────────────────────────────────
    console.log(`\n━━ Step 2/5 · Multi-location detection ━━`);
    const brandRows = await fetchAllPages<{
      id: string;
      place_id: string;
      name: string;
      industry: string;
      brand_key: string | null;
      is_multi_location: boolean;
      location_count: number;
    }>((from, to) =>
      db
        .from("businesses")
        .select("id,place_id,name,industry,brand_key,is_multi_location,location_count")
        .range(from, to),
    );
    const brandCounts = new Map<string, number>();
    for (const r of brandRows) {
      if (!r.brand_key) continue;
      brandCounts.set(r.brand_key, (brandCounts.get(r.brand_key) ?? 0) + 1);
    }
    const brandUpdates = brandRows
      .map((r) => {
        const count = r.brand_key ? brandCounts.get(r.brand_key) ?? 1 : 1;
        const multi = count > 1;
        if (multi === r.is_multi_location && count === r.location_count) return null;
        return {
          place_id: r.place_id,
          name: r.name,
          industry: r.industry,
          is_multi_location: multi,
          location_count: count,
        };
      })
      .filter((u): u is NonNullable<typeof u> => u !== null);
    for (const batch of chunk(brandUpdates, 100)) {
      const { error } = await db.from("businesses").upsert(batch, { onConflict: "place_id" });
      if (error) throw new Error(`multi-location update: ${error.message}`);
    }
    stats.multi_location_brands = [...brandCounts.values()].filter((c) => c > 1).length;
    console.log(`  → ${stats.multi_location_brands} multi-location brands flagged`);

    // ── 3. Website probes (free, feeds scoring) ──────────────────────────────
    console.log(`\n━━ Step 3/5 · Website quality probe ━━`);
    if (args.skipProbe) {
      console.log("  skipped (--skip-probe)");
    } else {
      const probeRows = await fetchAllPages<{
        id: string;
        website: string;
        website_probe: { checkedAt?: string } | null;
      }>((from, to) =>
        db
          .from("businesses")
          .select("id,website,website_probe")
          .not("website", "is", null)
          .range(from, to),
      );
      const toProbe = probeRows.filter((r) => !isFresh(r.website_probe?.checkedAt));
      console.log(`  probing ${toProbe.length} websites (concurrency 5)…`);
      await mapWithConcurrency(toProbe, 5, async (row) => {
        const probe = await probeWebsite(row.website);
        await db
          .from("businesses")
          .update({ website_quality: probe.quality, website_probe: probe })
          .eq("id", row.id);
        stats.probes_run++;
      });
      console.log(`  → ${stats.probes_run} probed`);
    }

    // ── 4. Apollo enrichment ─────────────────────────────────────────────────
    console.log(`\n━━ Step 4/5 · Apollo enrichment ━━`);
    if (args.skipApollo) {
      console.log("  skipped (--skip-apollo)");
    } else {
      let candidates = await fetchAllPages<{
        id: string;
        name: string;
        website_domain: string;
        review_count: number | null;
        apollo_attempted_at: string | null;
      }>((from, to) =>
        db
          .from("businesses")
          .select("id,name,website_domain,review_count,apollo_attempted_at")
          .not("website_domain", "is", null)
          .order("review_count", { ascending: false, nullsFirst: false })
          .range(from, to),
      );
      candidates = candidates.filter((c) => !isFresh(c.apollo_attempted_at));
      if (args.limit != null) candidates = candidates.slice(0, args.limit);
      console.log(`  enriching ${candidates.length} businesses (rate-limited queue)…`);

      let consecutiveFailures = 0;
      for (const [i, c] of candidates.entries()) {
        try {
          stats.apollo_attempted++;
          const org = await enrichOrganization(c.website_domain);
          const person = await findDecisionMaker(c.website_domain);
          const matched = !!org || !!person;

          await db
            .from("businesses")
            .update({
              apollo_org_id: org?.id ?? null,
              company_linkedin_url: org?.linkedin_url ?? null,
              employee_count: org?.estimated_num_employees ?? null,
              revenue_estimate: org?.annual_revenue ?? org?.organization_revenue ?? null,
              apollo_industry: org?.industry ?? null,
              company_description: org?.short_description ?? null,
              founded_year: org?.founded_year ?? null,
              owner_name:
                person?.name ??
                ([person?.first_name, person?.last_name].filter(Boolean).join(" ") || null),
              owner_title: person?.title ?? null,
              owner_email: sanitizeEmail(person?.email),
              owner_linkedin_url: person?.linkedin_url ?? null,
              apollo_matched: matched,
              apollo_attempted_at: new Date().toISOString(),
              apollo_org_raw: (org as unknown as Record<string, unknown>) ?? null,
              apollo_person_raw: (person as unknown as Record<string, unknown>) ?? null,
            })
            .eq("id", c.id);

          matched ? stats.apollo_matched++ : stats.apollo_no_match++;
          consecutiveFailures = 0;
          if ((i + 1) % 25 === 0) {
            console.log(`  … ${i + 1}/${candidates.length} (${stats.apollo_matched} matched)`);
          }
        } catch (err) {
          if (err instanceof ApolloQuotaError) {
            console.error(`  ✗ Apollo quota exhausted — stopping enrichment: ${err.message}`);
            break;
          }
          // Transient failure after retries: leave apollo_attempted_at NULL so
          // the next run retries this business. Never fabricate anything.
          stats.apollo_errors++;
          consecutiveFailures++;
          console.warn(`  ✗ ${c.name} (${c.website_domain}): ${err instanceof Error ? err.message : err}`);
          if (consecutiveFailures >= 3) {
            console.error("  ✗ 3 consecutive Apollo failures — aborting enrichment for this run.");
            break;
          }
        }
      }
      console.log(
        `  → attempted ${stats.apollo_attempted}, matched ${stats.apollo_matched}, ` +
          `no-match ${stats.apollo_no_match}, errors ${stats.apollo_errors}`,
      );
    }

    // ── 5. Deterministic scoring ─────────────────────────────────────────────
    console.log(`\n━━ Step 5/5 · Rule-based scoring ━━`);
    const scoreRows = await fetchAllPages<Record<string, unknown>>((from, to) =>
      db
        .from("businesses")
        .select(
          "id,place_id,name,industry,google_rating,review_count,website,website_quality," +
            "employee_count,revenue_estimate,is_multi_location,location_count," +
            "owner_name,owner_email,owner_linkedin_url,company_linkedin_url,phone",
        )
        .range(from, to),
    );
    const now = new Date().toISOString();
    const scoreUpdates = scoreRows.map((r) => {
      const result = scoreBusiness({
        industry: r.industry as string,
        google_rating: r.google_rating as number | null,
        review_count: r.review_count as number | null,
        website: r.website as string | null,
        website_quality: r.website_quality as never,
        employee_count: r.employee_count as number | null,
        revenue_estimate: r.revenue_estimate as number | null,
        is_multi_location: r.is_multi_location as boolean,
        location_count: r.location_count as number,
        owner_name: r.owner_name as string | null,
        owner_email: r.owner_email as string | null,
        owner_linkedin_url: r.owner_linkedin_url as string | null,
        company_linkedin_url: r.company_linkedin_url as string | null,
        phone: r.phone as string | null,
      });
      return {
        place_id: r.place_id as string,
        name: r.name as string,
        industry: r.industry as string,
        ...result,
        scored_at: now,
      };
    });
    for (const batch of chunk(scoreUpdates, 100)) {
      const { error } = await db.from("businesses").upsert(batch, { onConflict: "place_id" });
      if (error) throw new Error(`scoring update: ${error.message}`);
      stats.scored += batch.length;
    }
    console.log(`  → ${stats.scored} businesses scored`);

    // ── Run summary ──────────────────────────────────────────────────────────
    const logs = await fetchAllPages<{ provider: string; estimated_cost: number }>(
      (from, to) =>
        db
          .from("api_call_logs")
          .select("provider,estimated_cost")
          .gte("created_at", runStart)
          .range(from, to),
    );
    const byProvider = new Map<string, { calls: number; cost: number }>();
    for (const l of logs) {
      const agg = byProvider.get(l.provider) ?? { calls: 0, cost: 0 };
      agg.calls++;
      agg.cost += Number(l.estimated_cost) || 0;
      byProvider.set(l.provider, agg);
    }

    await db
      .from("collection_runs")
      .update({ status: "completed", stats, finished_at: new Date().toISOString() })
      .eq("id", runId);

    console.log(`\n━━ Run complete ━━`);
    console.table(stats);
    console.log("API spend this run (estimated):");
    for (const [provider, agg] of byProvider) {
      console.log(`  ${provider.padEnd(10)} ${String(agg.calls).padStart(5)} calls   ~$${agg.cost.toFixed(2)}`);
    }
    if (byProvider.size === 0) console.log("  (no billable calls — everything served from cache)");
  } catch (err) {
    await db
      .from("collection_runs")
      .update({
        status: "failed",
        stats,
        error: err instanceof Error ? err.message : String(err),
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    throw err;
  }
}

main().catch((err) => {
  console.error("\nCollection run failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
