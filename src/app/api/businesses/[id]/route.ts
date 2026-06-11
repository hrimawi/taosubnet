import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { handleRoute, notFound } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/businesses/:id — full detail for the side panel. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const { id } = await params;
    const db = getDb();

    const { data: business, error } = await db
      .from("businesses")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!business) return notFound("Business not found");

    // Raw API payloads are cache artifacts — not for the UI.
    delete (business as Record<string, unknown>).google_raw;
    delete (business as Record<string, unknown>).apollo_org_raw;
    delete (business as Record<string, unknown>).apollo_person_raw;

    return NextResponse.json({ business });
  });
}
