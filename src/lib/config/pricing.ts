/**
 * Estimated unit costs used by the admin spend tracker. These are ESTIMATES for
 * budgeting — verify against your current Google/Apollo/Anthropic pricing and
 * adjust. Call COUNTS logged in api_call_logs are exact regardless.
 */

/**
 * Places API (New) Text Search. Our field mask requests contact + atmosphere
 * fields (phone, website, rating), which bills at the top Text Search tier.
 * ~$35 per 1,000 requests → $0.035/request. Each pagination page is a request.
 */
export const GOOGLE_TEXT_SEARCH_COST = 0.035;

/**
 * Apollo bills in plan credits rather than dollars. This approximates the
 * dollar value of one API call so spend is visible alongside Google/Anthropic;
 * tune it to your plan (credits included ÷ plan price).
 */
export const APOLLO_CALL_COST = 0.015;

/** Anthropic per-million-token pricing by model (USD). */
export const ANTHROPIC_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  "claude-opus-4-8": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-sonnet-4-6": { inputPerMTok: 3, outputPerMTok: 15 },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5 },
};

export function anthropicCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = ANTHROPIC_PRICING[model] ?? ANTHROPIC_PRICING["claude-opus-4-8"];
  return (inputTokens * p.inputPerMTok + outputTokens * p.outputPerMTok) / 1_000_000;
}
