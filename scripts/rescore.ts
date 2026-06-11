/**
 * Recompute the deterministic scores for every business — zero API cost.
 * Run after tuning weights in src/lib/scoring/engine.ts or the industry
 * profiles/automation catalog:
 *
 *   npm run rescore
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { getDb, fetchAllPages } from "../src/lib/db";
import { scoreBusiness } from "../src/lib/scoring/engine";

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

async function main() {
  const db = getDb();
  const rows = await fetchAllPages<Record<string, unknown>>((from, to) =>
    db
      .from("businesses")
      .select(
        "id,place_id,name,industry,google_rating,review_count,website,website_quality," +
          "employee_count,revenue_estimate,is_multi_location,location_count," +
          "owner_name,owner_email,owner_linkedin_url,company_linkedin_url,phone",
      )
      .range(from, to),
  );
  console.log(`Rescoring ${rows.length} businesses…`);

  const now = new Date().toISOString();
  const updates = rows.map((r) => ({
    place_id: r.place_id as string,
    name: r.name as string,
    industry: r.industry as string,
    ...scoreBusiness({
      industry: r.industry as string,
      google_rating: r.google_rating as number | null,
      review_count: r.review_count as number | null,
      website: r.website as string | null,
      website_quality: r.website_quality as never,
      employee_count: r.employee_count as number | null,
      revenue_estimate: r.revenue_estimate as number | null,
      is_multi_location: r.is_multi_location as boolean,
      location_count: r.location_count as number,
      owner_name: r.owner_name as string | null,
      owner_email: r.owner_email as string | null,
      owner_linkedin_url: r.owner_linkedin_url as string | null,
      company_linkedin_url: r.company_linkedin_url as string | null,
      phone: r.phone as string | null,
    }),
    scored_at: now,
  }));

  let done = 0;
  for (const batch of chunk(updates, 100)) {
    const { error } = await db.from("businesses").upsert(batch, { onConflict: "place_id" });
    if (error) throw new Error(error.message);
    done += batch.length;
  }
  console.log(`Done — ${done} businesses rescored.`);
}

main().catch((err) => {
  console.error("Rescore failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
