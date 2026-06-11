import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { badRequest, handleRoute, notFound } from "@/lib/api";
import { generateForBusiness, getCachedContent } from "@/lib/ai/generate";
import { AI_CONTENT_TYPES } from "@/lib/ai/prompts";
import type { AiContentType, Business } from "@/lib/types";

export const dynamic = "force-dynamic";
// Generating up to five pieces in parallel needs more than the default budget.
// (60s is the ceiling on Vercel's free tier; raise on Pro if you see timeouts.)
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** GET /api/businesses/:id/ai — cached AI content only (no generation). */
export async function GET(_req: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const { id } = await params;
    return NextResponse.json({ contents: await getCachedContent(id) });
  });
}

/**
 * POST /api/businesses/:id/ai — generate (cache-first) AI content.
 * Body: { types?: AiContentType[], regenerate?: boolean }
 * Without `regenerate`, cached pieces are returned as-is and only missing ones
 * are generated — content is created once, not on every view.
 */
export async function POST(req: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      types?: string[];
      regenerate?: boolean;
    };

    let types = AI_CONTENT_TYPES;
    if (body.types?.length) {
      const invalid = body.types.filter(
        (t) => !AI_CONTENT_TYPES.includes(t as AiContentType),
      );
      if (invalid.length) return badRequest(`Unknown content types: ${invalid.join(", ")}`);
      types = body.types as AiContentType[];
    }

    const { data: business, error } = await getDb()
      .from("businesses")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!business) return notFound("Business not found");

    const contents = await generateForBusiness(
      business as Business,
      types,
      body.regenerate === true,
    );
    return NextResponse.json({ contents });
  });
}
