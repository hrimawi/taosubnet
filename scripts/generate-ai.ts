/**
 * Batch pre-generation of AI outreach content for the top prospects, so the
 * side panel is instant for the leads you'll actually work.
 *
 *   npm run generate-ai -- [options]
 *
 * Options:
 *   --limit=N            how many businesses, ranked by expected $/mo (default 25)
 *   --min-score=N        only businesses with lead_score >= N (default 60)
 *   --types=a,b          subset of: summary,cold_email,call_script,linkedin_message,follow_up_email
 *   --regenerate         regenerate even if cached (spends tokens!)
 *
 * Cache-first: already-generated pieces are skipped unless --regenerate.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { getDb, fetchAllPages } from "../src/lib/db";
import { requireEnv } from "../src/lib/env";
import { generateForBusiness, aiModel } from "../src/lib/ai/generate";
import { AI_CONTENT_TYPES } from "../src/lib/ai/prompts";
import type { AiContentType, Business } from "../src/lib/types";

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
}

async function main() {
  requireEnv("ANTHROPIC_API_KEY");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const limit = Math.max(1, Number(arg("limit")) || 25);
  const minScore = Number(arg("min-score")) || 60;
  const regenerate = process.argv.includes("--regenerate");

  let types = AI_CONTENT_TYPES;
  const typesArg = arg("types");
  if (typesArg) {
    const requested = typesArg.split(",").map((t) => t.trim());
    const invalid = requested.filter((t) => !AI_CONTENT_TYPES.includes(t as AiContentType));
    if (invalid.length) {
      console.error(`Unknown types: ${invalid.join(", ")}. Valid: ${AI_CONTENT_TYPES.join(", ")}`);
      process.exit(1);
    }
    types = requested as AiContentType[];
  }

  const db = getDb();
  const { data, error } = await db
    .from("businesses")
    .select("*")
    .gte("lead_score", minScore)
    .order("expected_monthly_value", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const businesses = (data ?? []) as Business[];

  console.log(
    `Generating ${types.length} piece(s) for ${businesses.length} businesses ` +
      `(model ${aiModel()}, min score ${minScore}${regenerate ? ", REGENERATE" : ", cache-first"})…\n`,
  );

  const runStart = new Date().toISOString();
  let generatedTotal = 0;
  for (const [i, b] of businesses.entries()) {
    try {
      const before = regenerate
        ? 0
        : (await db.from("ai_content").select("id").eq("business_id", b.id)).data?.length ?? 0;
      const results = await generateForBusiness(b, types, regenerate);
      const made = regenerate ? types.length : Math.max(0, results.length - before);
      generatedTotal += made;
      console.log(
        `  [${i + 1}/${businesses.length}] ${b.name} — ${made > 0 ? `${made} generated` : "fully cached"}`,
      );
    } catch (err) {
      console.warn(`  ✗ ${b.name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  const logs = await fetchAllPages<{ estimated_cost: number }>((from, to) =>
    db
      .from("api_call_logs")
      .select("estimated_cost")
      .eq("provider", "anthropic")
      .gte("created_at", runStart)
      .range(from, to),
  );
  const cost = logs.reduce((s, l) => s + (Number(l.estimated_cost) || 0), 0);
  console.log(`\nDone — ${generatedTotal} pieces generated, est. cost ~$${cost.toFixed(2)}.`);
}

main().catch((err) => {
  console.error("Batch generation failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
