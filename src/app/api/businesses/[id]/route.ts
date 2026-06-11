import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { badRequest, handleRoute, notFound } from "@/lib/api";
import { isValidStage } from "@/lib/config/pipeline";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/businesses/:id — full detail + CRM data for the side panel. */
export async function GET(_req: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const { id } = await params;
    const db = getDb();

    const { data: business, error } = await db
      .from("businesses")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!business) return notFound("Business not found");

    // Raw API payloads are cache artifacts — not for the UI.
    delete (business as Record<string, unknown>).google_raw;
    delete (business as Record<string, unknown>).apollo_org_raw;
    delete (business as Record<string, unknown>).apollo_person_raw;

    const [notes, activities, reminders] = await Promise.all([
      db
        .from("notes")
        .select("*")
        .eq("business_id", id)
        .order("created_at", { ascending: false }),
      db
        .from("activities")
        .select("*")
        .eq("business_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      db
        .from("reminders")
        .select("*")
        .eq("business_id", id)
        .order("due_at", { ascending: true }),
    ]);
    if (notes.error) throw new Error(notes.error.message);
    if (activities.error) throw new Error(activities.error.message);
    if (reminders.error) throw new Error(reminders.error.message);

    return NextResponse.json({
      business,
      notes: notes.data ?? [],
      activities: activities.data ?? [],
      reminders: reminders.data ?? [],
    });
  });
}

/**
 * PATCH /api/businesses/:id — move a lead through the pipeline.
 * Body: { pipeline_stage: string, note?: string }
 * Every move is recorded in the activities table (the status-update history).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      pipeline_stage?: string;
      note?: string;
    };
    if (!body.pipeline_stage || !isValidStage(body.pipeline_stage)) {
      return badRequest("pipeline_stage must be one of the defined stages");
    }
    const db = getDb();

    const { data: current, error: curErr } = await db
      .from("businesses")
      .select("id,pipeline_stage")
      .eq("id", id)
      .maybeSingle();
    if (curErr) throw new Error(curErr.message);
    if (!current) return notFound("Business not found");

    const { error: updErr } = await db
      .from("businesses")
      .update({ pipeline_stage: body.pipeline_stage })
      .eq("id", id);
    if (updErr) throw new Error(updErr.message);

    if (current.pipeline_stage !== body.pipeline_stage) {
      const { error: actErr } = await db.from("activities").insert({
        business_id: id,
        type: "stage_change",
        from_stage: current.pipeline_stage,
        to_stage: body.pipeline_stage,
        detail: body.note?.trim() || null,
      });
      if (actErr) throw new Error(actErr.message);
    }

    return NextResponse.json({ ok: true, pipeline_stage: body.pipeline_stage });
  });
}
