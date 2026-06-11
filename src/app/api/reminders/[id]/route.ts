import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { handleRoute } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/reminders/:id — body { completed: boolean } */
export async function PATCH(req: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { completed?: boolean };
    const { data, error } = await getDb()
      .from("reminders")
      .update({ completed_at: body.completed ? new Date().toISOString() : null })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ reminder: data });
  });
}

/** DELETE /api/reminders/:id */
export async function DELETE(_req: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const { id } = await params;
    const { error } = await getDb().from("reminders").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  });
}
