import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { handleRoute } from "@/lib/api";

export const dynamic = "force-dynamic";

/** DELETE /api/notes/:id */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(async () => {
    const { id } = await params;
    const { error } = await getDb().from("notes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  });
}
