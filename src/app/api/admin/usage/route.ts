import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { handleRoute } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/usage — API budget dashboard: call counts + estimated spend
 * per provider, cache freshness, and recent collection runs.
 */
export async function GET() {
  return handleRoute(async () => {
    const db = getDb();
    const [{ data: usage, error: usageErr }, { data: runs, error: runsErr }] =
      await Promise.all([
        db.rpc("api_usage_stats"),
        db
          .from("collection_runs")
          .select("id,status,params,stats,error,started_at,finished_at")
          .order("started_at", { ascending: false })
          .limit(20),
      ]);
    if (usageErr) throw new Error(usageErr.message);
    if (runsErr) throw new Error(runsErr.message);
    return NextResponse.json({ usage, runs: runs ?? [] });
  });
}
