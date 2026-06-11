import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { badRequest, handleRoute } from "@/lib/api";

export const dynamic = "force-dynamic";

/** POST /api/businesses/:id/reminders — set a follow-up reminder. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      note?: string;
      due_at?: string;
    };
    const note = body.note?.trim();
    const due = body.due_at ? new Date(body.due_at) : null;
    if (!note) return badRequest("note is required");
    if (!due || isNaN(due.getTime())) return badRequest("due_at must be a valid date");

    const { data, error } = await getDb()
      .from("reminders")
      .insert({ business_id: id, note, due_at: due.toISOString() })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ reminder: data }, { status: 201 });
  });
}
