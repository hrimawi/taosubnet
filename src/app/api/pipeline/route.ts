import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { handleRoute } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/pipeline — per-stage count + contract-value rollup for the board. */
export async function GET() {
  return handleRoute(async () => {
    const { data, error } = await getDb().rpc("pipeline_stats");
    if (error) {
      throw new Error(
        `${error.message} (is supabase/migrations/002_phase2_crm.sql applied?)`,
      );
    }
    return NextResponse.json({ stages: data ?? {} });
  });
}
