import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { handleRoute } from "@/lib/api";
import { applyFilters, parseFilters } from "@/lib/filters";

export const dynamic = "force-dynamic";

/**
 * GET /api/businesses/map — lightweight, paginated pin payload.
 * The client lazily pulls pages of up to 1,000 points and feeds them to the
 * marker clusterer; full business records are only fetched on pin click.
 */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const sp = req.nextUrl.searchParams;
    const filters = parseFilters(sp);
    const page = Math.max(0, Number(sp.get("page")) || 0);
    const pageSize = Math.min(1000, Math.max(1, Number(sp.get("pageSize")) || 1000));

    let query = getDb()
      .from("businesses")
      .select("id,name,latitude,longitude,lead_score,industry", { count: "exact" })
      .not("latitude", "is", null)
      .not("longitude", "is", null);
    query = applyFilters(query, filters);

    const { data, error, count } = await query
      .order("id", { ascending: true })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) throw new Error(error.message);

    const points = (data ?? []).map((b) => ({
      id: b.id as string,
      name: b.name as string,
      lat: b.latitude as number,
      lng: b.longitude as number,
      score: b.lead_score as number | null,
      industry: b.industry as string,
    }));
    const total = count ?? 0;
    return NextResponse.json({
      points,
      total,
      page,
      hasMore: (page + 1) * pageSize < total,
    });
  });
}
