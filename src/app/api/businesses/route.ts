import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { handleRoute } from "@/lib/api";
import { applyFilters, parseFilters, LIST_COLUMNS } from "@/lib/filters";

export const dynamic = "force-dynamic";

const SORT_COLUMNS: Record<string, string> = {
  score: "lead_score",
  close: "close_probability",
  value: "estimated_contract_value",
  expected: "expected_monthly_value",
  reviews: "review_count",
  rating: "google_rating",
  employees: "employee_count",
  revenue: "revenue_estimate",
  name: "name",
  city: "city",
};

/** GET /api/businesses — filtered, sorted, paginated lead list. */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const sp = req.nextUrl.searchParams;
    const filters = parseFilters(sp);
    const page = Math.max(0, Number(sp.get("page")) || 0);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize")) || 50));
    const sortCol = SORT_COLUMNS[sp.get("sort") ?? ""] ?? "expected_monthly_value";
    const ascending = sp.get("dir") === "asc";

    let query = getDb().from("businesses").select(LIST_COLUMNS, { count: "exact" });
    query = applyFilters(query, filters);

    const { data, error, count } = await query
      .order(sortCol, { ascending, nullsFirst: false })
      .order("id", { ascending: true }) // stable pagination tiebreaker
      .range(page * pageSize, page * pageSize + pageSize - 1);

    if (error) throw new Error(error.message);
    return NextResponse.json({ rows: data ?? [], total: count ?? 0, page, pageSize });
  });
}
