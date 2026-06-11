import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { handleRoute } from "@/lib/api";
import { COVERAGE_CITIES } from "@/lib/config/cities";
import { INDUSTRIES } from "@/lib/config/industries";

export const dynamic = "force-dynamic";

/** GET /api/meta — filter options + dashboard stat-card numbers. */
export async function GET() {
  return handleRoute(async () => {
    const { data: stats, error } = await getDb().rpc("dashboard_stats");
    if (error) throw new Error(`${error.message} (is supabase/migrations applied?)`);
    return NextResponse.json({
      cities: COVERAGE_CITIES,
      industries: INDUSTRIES.map((i) => ({ slug: i.slug, label: i.label })),
      stats,
    });
  });
}
