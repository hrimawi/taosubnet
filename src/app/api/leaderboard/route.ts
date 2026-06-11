import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { handleRoute } from "@/lib/api";
import { applyFilters, parseFilters, LIST_COLUMNS } from "@/lib/filters";

export const dynamic = "force-dynamic";

/**
 * GET /api/leaderboard — top 100 highest-value prospects, ranked by expected
 * monthly value (contract value × close probability), tie-broken by lead score.
 */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const filters = parseFilters(req.nextUrl.searchParams);
    let query = getDb().from("businesses").select(LIST_COLUMNS);
    query = applyFilters(query, filters);

    const { data, error } = await query
      .order("expected_monthly_value", { ascending: false, nullsFirst: false })
      .order("lead_score", { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return NextResponse.json({ rows: data ?? [] });
  });
}
