import type { BusinessFilters } from "./types";

/** Client-side helper: serialize the filter state into a query string. */
export function filtersToQuery(f: BusinessFilters): string {
  const sp = new URLSearchParams();
  const set = (k: string, v: string | number | undefined) => {
    if (v !== undefined && v !== "" && v !== null) sp.set(k, String(v));
  };
  set("city", f.city);
  set("industry", f.industry);
  set("minScore", f.minScore);
  set("minCloseProb", f.minCloseProb);
  set("minValue", f.minValue);
  set("minEmployees", f.minEmployees);
  set("minReviews", f.minReviews);
  set("minRevenue", f.minRevenue);
  set("stage", f.stage);
  set("q", f.q);
  return sp.toString();
}
