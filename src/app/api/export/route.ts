import { NextRequest, NextResponse } from "next/server";
import { getDb, fetchAllPages } from "@/lib/db";
import { handleRoute } from "@/lib/api";
import { applyFilters, parseFilters } from "@/lib/filters";
import { toCsv } from "@/lib/csv";
import { industryLabel } from "@/lib/config/industries";
import { STAGE_BY_SLUG } from "@/lib/config/pipeline";
import type { AutomationOpportunity, Business } from "@/lib/types";

export const dynamic = "force-dynamic";

const EXPORT_COLUMNS =
  "name,industry,city,formatted_address,phone,website,owner_name,owner_title," +
  "owner_email,owner_linkedin_url,company_linkedin_url,employee_count,revenue_estimate," +
  "google_rating,review_count,is_multi_location,location_count,lead_score," +
  "close_probability,estimated_contract_value,expected_monthly_value,pipeline_stage," +
  "automation_opportunities,google_maps_url";

/**
 * GET /api/export — CSV download of any filtered view.
 * ?view=pipeline exports the active pipeline (everything past Not Contacted)
 * unless a specific stage filter is supplied. All other filter params match
 * /api/businesses, so the export always mirrors what's on screen.
 */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const sp = req.nextUrl.searchParams;
    const filters = parseFilters(sp);
    const view = sp.get("view") === "pipeline" ? "pipeline" : "leads";
    if (view === "pipeline" && !filters.stage) filters.stage = "pipeline";

    const db = getDb();
    const rows = await fetchAllPages<Business>((from, to) => {
      let q = db.from("businesses").select(EXPORT_COLUMNS);
      q = applyFilters(q, filters);
      return q
        .order("expected_monthly_value", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true })
        .range(from, to);
    });

    const csv = toCsv(
      [
        "Business",
        "Industry",
        "City",
        "Address",
        "Phone",
        "Website",
        "Decision Maker",
        "Title",
        "Email",
        "LinkedIn",
        "Company LinkedIn",
        "Employees",
        "Est. Revenue",
        "Google Rating",
        "Reviews",
        "Multi-Location",
        "Locations",
        "Lead Score",
        "Close Probability %",
        "Est. Contract $/mo",
        "Expected $/mo",
        "Pipeline Stage",
        "Automation Opportunities",
        "Google Maps URL",
      ],
      rows.map((b) => [
        b.name,
        industryLabel(b.industry),
        b.city,
        b.formatted_address,
        b.phone,
        b.website,
        b.owner_name,
        b.owner_title,
        b.owner_email,
        b.owner_linkedin_url,
        b.company_linkedin_url,
        b.employee_count,
        b.revenue_estimate,
        b.google_rating,
        b.review_count,
        b.is_multi_location ? "yes" : "no",
        b.location_count,
        b.lead_score,
        b.close_probability,
        b.estimated_contract_value,
        b.expected_monthly_value,
        b.pipeline_stage ? STAGE_BY_SLUG[b.pipeline_stage]?.label ?? b.pipeline_stage : "",
        (b.automation_opportunities ?? [])
          .map((a: AutomationOpportunity) => a.name)
          .join("; "),
        b.google_maps_url,
      ]),
    );

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${view}-export-${stamp}.csv"`,
      },
    });
  });
}
