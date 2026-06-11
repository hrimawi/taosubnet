import type { BusinessFilters } from "./types";

/**
 * Server-side filter parsing + application, shared by the list, map,
 * leaderboard, and CSV-export endpoints so every surface filters identically.
 */

export function parseFilters(sp: URLSearchParams): BusinessFilters {
  const num = (k: string) => {
    const v = sp.get(k);
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const str = (k: string) => {
    const v = sp.get(k);
    return v && v.trim() !== "" ? v.trim() : undefined;
  };
  return {
    city: str("city"),
    industry: str("industry"),
    minScore: num("minScore"),
    minCloseProb: num("minCloseProb"),
    minValue: num("minValue"),
    minEmployees: num("minEmployees"),
    minReviews: num("minReviews"),
    minRevenue: num("minRevenue"),
    stage: str("stage"),
    q: str("q"),
  };
}

/**
 * Minimal view of the PostgREST filter methods we use. applyFilters casts
 * through this interface instead of constraining the generic — supabase-js
 * builder generics are deep enough that a structural constraint blows up
 * TypeScript's instantiation depth.
 */
interface Filterable {
  eq(column: string, value: unknown): Filterable;
  neq(column: string, value: unknown): Filterable;
  gte(column: string, value: unknown): Filterable;
  or(filters: string): Filterable;
}

export function applyFilters<T>(query: T, f: BusinessFilters): T {
  let q = query as unknown as Filterable;
  if (f.city) q = q.eq("city", f.city);
  if (f.industry) q = q.eq("industry", f.industry);
  if (f.minScore != null) q = q.gte("lead_score", f.minScore);
  if (f.minCloseProb != null) q = q.gte("close_probability", f.minCloseProb);
  if (f.minValue != null) q = q.gte("estimated_contract_value", f.minValue);
  if (f.minEmployees != null) q = q.gte("employee_count", f.minEmployees);
  if (f.minReviews != null) q = q.gte("review_count", f.minReviews);
  if (f.minRevenue != null) q = q.gte("revenue_estimate", f.minRevenue);
  if (f.stage) {
    if (f.stage === "active") {
      // In the pipeline and not yet closed either way.
      q = q
        .neq("pipeline_stage", "not_contacted")
        .neq("pipeline_stage", "closed_won")
        .neq("pipeline_stage", "closed_lost");
    } else if (f.stage === "pipeline") {
      // Everything that has ever been worked (the pipeline export view).
      q = q.neq("pipeline_stage", "not_contacted");
    } else {
      q = q.eq("pipeline_stage", f.stage);
    }
  }
  if (f.q) {
    // Strip PostgREST syntax characters so user input can't break the or() expression.
    const safe = f.q.replace(/[,()%\\]/g, " ").trim();
    if (safe) {
      q = q.or(
        `name.ilike.%${safe}%,owner_name.ilike.%${safe}%,industry.ilike.%${safe}%`,
      );
    }
  }
  return q as unknown as T;
}

/** Columns served to list views — excludes raw API payloads and bulky JSON. */
export const LIST_COLUMNS = [
  "id",
  "name",
  "industry",
  "city",
  "formatted_address",
  "phone",
  "website",
  "google_rating",
  "review_count",
  "google_maps_url",
  "owner_name",
  "owner_title",
  "owner_email",
  "owner_linkedin_url",
  "employee_count",
  "revenue_estimate",
  "is_multi_location",
  "location_count",
  "lead_score",
  "close_probability",
  "estimated_contract_value",
  "expected_monthly_value",
  "website_quality",
  "pipeline_stage",
].join(",");
