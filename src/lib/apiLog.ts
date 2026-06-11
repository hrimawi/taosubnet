import { getDb } from "./db";

/**
 * Record one billable external API call. Logging must never take down the
 * caller — failures are reported to stderr and swallowed.
 */
export async function logApiCall(entry: {
  provider: "google" | "apollo" | "anthropic";
  endpoint: string;
  units?: number;
  estimatedCost: number;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await getDb().from("api_call_logs").insert({
      provider: entry.provider,
      endpoint: entry.endpoint,
      units: entry.units ?? 1,
      estimated_cost: entry.estimatedCost,
      meta: entry.meta ?? null,
    });
    if (error) console.error(`[apiLog] failed to log ${entry.provider} call:`, error.message);
  } catch (err) {
    console.error(`[apiLog] failed to log ${entry.provider} call:`, err);
  }
}
