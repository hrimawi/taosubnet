import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { handleRoute } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/reminders — all reminders with their business names.
 * ?status=open (default) | completed | all
 */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const status = req.nextUrl.searchParams.get("status") ?? "open";
    let query = getDb()
      .from("reminders")
      .select("*, businesses(name)")
      .order("due_at", { ascending: true })
      .limit(500);
    if (status === "open") query = query.is("completed_at", null);
    if (status === "completed") query = query.not("completed_at", "is", null);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ reminders: data ?? [] });
  });
}
