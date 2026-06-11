import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "../db";
import { requireEnv } from "../env";
import { logApiCall } from "../apiLog";
import { anthropicCost } from "../config/pricing";
import { AI_CONTENT_TYPES, SYSTEM_PROMPT, buildUserPrompt } from "./prompts";
import type { AiContent, AiContentType, Business } from "../types";

/**
 * Claude generation for qualitative outputs ONLY (prospect summary + outreach
 * copy). Numeric scoring never touches this module.
 *
 * Caching contract: each (business, content_type) generates once and is stored
 * in ai_content; later requests are served from the cache. Regeneration happens
 * only when explicitly requested. Every call is logged with token-based cost.
 */

const DEFAULT_MODEL = "claude-opus-4-8";

export function aiModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  // The SDK auto-retries 429s and 5xx with exponential backoff (maxRetries).
  client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY"), maxRetries: 3 });
  return client;
}

export async function getCachedContent(businessId: string): Promise<AiContent[]> {
  const { data, error } = await getDb()
    .from("ai_content")
    .select("*")
    .eq("business_id", businessId);
  if (error) {
    throw new Error(`${error.message} (is supabase/migrations/003_phase3_ai.sql applied?)`);
  }
  return (data ?? []) as AiContent[];
}

async function generateOne(business: Business, type: AiContentType): Promise<AiContent> {
  const model = aiModel();
  let response: Anthropic.Message;
  try {
    response = await getClient().messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(business, type) }],
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new Error(`Anthropic API error (${err.status ?? "?"}): ${err.message}`);
    }
    throw err;
  }

  await logApiCall({
    provider: "anthropic",
    endpoint: "messages",
    estimatedCost: anthropicCost(
      model,
      response.usage.input_tokens,
      response.usage.output_tokens,
    ),
    meta: { business_id: business.id, content_type: type, model },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined to generate this content.");
  }
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  if (!text) throw new Error("Claude returned an empty response.");
  if (response.stop_reason === "max_tokens") {
    console.warn(`[ai] ${type} for ${business.name} hit max_tokens — content may be truncated`);
  }

  const { data, error } = await getDb()
    .from("ai_content")
    .upsert(
      {
        business_id: business.id,
        content_type: type,
        content: text,
        model,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,content_type" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as AiContent;
}

/**
 * Return the requested content types for a business, generating only what
 * isn't cached (or everything requested, when `regenerate` is set).
 */
export async function generateForBusiness(
  business: Business,
  types: AiContentType[] = AI_CONTENT_TYPES,
  regenerate = false,
): Promise<AiContent[]> {
  const cached = await getCachedContent(business.id);
  const cachedByType = new Map(cached.map((c) => [c.content_type, c]));

  const toGenerate = types.filter((t) => regenerate || !cachedByType.has(t));
  // The pieces are independent — generate in parallel (well within rate limits).
  const generated = await Promise.all(toGenerate.map((t) => generateOne(business, t)));
  for (const g of generated) cachedByType.set(g.content_type, g);

  return AI_CONTENT_TYPES.filter((t) => cachedByType.has(t)).map(
    (t) => cachedByType.get(t)!,
  );
}
