import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { badRequest, handleRoute } from "@/lib/api";

export const dynamic = "force-dynamic";

/** POST /api/businesses/:id/notes — add a note to a lead. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { content?: string };
    const content = body.content?.trim();
    if (!content) return badRequest("content is required");

    const { data, error } = await getDb()
      .from("notes")
      .insert({ business_id: id, content })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ note: data }, { status: 201 });
  });
}
