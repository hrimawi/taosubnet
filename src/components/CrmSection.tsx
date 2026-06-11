"use client";

import { useState } from "react";
import { StageSelect } from "./StageBadge";
import { fetchJson } from "@/lib/fetcher";
import { STAGE_BY_SLUG } from "@/lib/config/pipeline";
import { formatDateTime } from "@/lib/format";
import type { Activity, Note, PipelineStage, Reminder } from "@/lib/types";

/**
 * CRM block inside the business side panel: pipeline stage, notes,
 * follow-up reminders, and the status-update (activity) history.
 * Every action round-trips through the API and then asks the panel to reload.
 */

interface Props {
  businessId: string;
  stage: PipelineStage;
  notes: Note[];
  reminders: Reminder[];
  activities: Activity[];
  reload: () => void;
}

export default function CrmSection({
  businessId,
  stage,
  notes,
  reminders,
  activities,
  reload,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [remNote, setRemNote] = useState("");
  const [remDue, setRemDue] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const changeStage = (next: PipelineStage) =>
    act(() =>
      fetchJson(`/api/businesses/${businessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_stage: next }),
      }),
    );

  const addNote = () => {
    if (!noteDraft.trim()) return;
    act(() =>
      fetchJson(`/api/businesses/${businessId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteDraft.trim() }),
      }),
    ).then(() => setNoteDraft(""));
  };

  const addReminder = () => {
    if (!remNote.trim() || !remDue) return;
    act(() =>
      fetchJson(`/api/businesses/${businessId}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: remNote.trim(), due_at: remDue }),
      }),
    ).then(() => {
      setRemNote("");
      setRemDue("");
    });
  };

  const openReminders = reminders.filter((r) => !r.completed_at);

  return (
    <section className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
        Pipeline & CRM
      </h3>
      {err && <div className="mb-2 text-[11px] text-red-400">{err}</div>}

      <label className="mb-3 block text-[11px] text-slate-400">
        Stage
        <StageSelect
          value={stage}
          onChange={changeStage}
          disabled={busy}
          className="mt-1 w-full"
        />
      </label>

      {/* follow-up reminders */}
      <div className="mb-3">
        <div className="mb-1 text-[11px] font-medium text-slate-400">
          Follow-up reminders {openReminders.length > 0 && `(${openReminders.length} open)`}
        </div>
        <ul className="space-y-1">
          {openReminders.map((r) => {
            const overdue = new Date(r.due_at).getTime() < Date.now();
            return (
              <li
                key={r.id}
                className="flex items-center gap-2 rounded-md bg-slate-900/70 px-2 py-1.5 text-[11px]"
              >
                <button
                  onClick={() =>
                    act(() =>
                      fetchJson(`/api/reminders/${r.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ completed: true }),
                      }),
                    )
                  }
                  disabled={busy}
                  title="Mark done"
                  className="h-4 w-4 shrink-0 rounded border border-slate-600 hover:border-green-400 hover:bg-green-500/20"
                />
                <span className="min-w-0 flex-1 truncate text-slate-300">{r.note}</span>
                <span className={`shrink-0 tabular-nums ${overdue ? "text-red-400" : "text-slate-500"}`}>
                  {formatDateTime(r.due_at)}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-1.5 flex gap-1.5">
          <input
            value={remNote}
            onChange={(e) => setRemNote(e.target.value)}
            placeholder="Follow up about…"
            className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
          />
          <input
            type="datetime-local"
            value={remDue}
            onChange={(e) => setRemDue(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={addReminder}
            disabled={busy || !remNote.trim() || !remDue}
            className="rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            Set
          </button>
        </div>
      </div>

      {/* notes */}
      <div className="mb-3">
        <div className="mb-1 text-[11px] font-medium text-slate-400">Notes</div>
        <div className="flex gap-1.5">
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Add a note…"
            rows={2}
            className="min-w-0 flex-1 resize-none rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={addNote}
            disabled={busy || !noteDraft.trim()}
            className="self-end rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            Add
          </button>
        </div>
        <ul className="mt-1.5 space-y-1">
          {notes.map((n) => (
            <li key={n.id} className="group rounded-md bg-slate-900/70 px-2 py-1.5 text-[11px]">
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-pre-wrap text-slate-300">{n.content}</p>
                <button
                  onClick={() => act(() => fetchJson(`/api/notes/${n.id}`, { method: "DELETE" }))}
                  disabled={busy}
                  title="Delete note"
                  className="invisible shrink-0 text-slate-600 hover:text-red-400 group-hover:visible"
                >
                  ✕
                </button>
              </div>
              <div className="mt-0.5 text-[10px] text-slate-600">{formatDateTime(n.created_at)}</div>
            </li>
          ))}
          {notes.length === 0 && <li className="text-[11px] text-slate-600">No notes yet.</li>}
        </ul>
      </div>

      {/* status-update history */}
      <details className="rounded-md bg-slate-900/70">
        <summary className="cursor-pointer select-none px-2 py-1.5 text-[11px] font-medium text-slate-400">
          Status history ({activities.length})
        </summary>
        <ul className="space-y-1 px-2 pb-2">
          {activities.map((a) => (
            <li key={a.id} className="text-[11px] text-slate-400">
              <span className="tabular-nums text-slate-600">{formatDateTime(a.created_at)}</span>{" "}
              {a.type === "stage_change" ? (
                <>
                  moved {a.from_stage ? STAGE_BY_SLUG[a.from_stage as PipelineStage]?.label : "?"} →{" "}
                  <span className="text-slate-300">
                    {a.to_stage ? STAGE_BY_SLUG[a.to_stage as PipelineStage]?.label : "?"}
                  </span>
                  {a.detail && <span className="text-slate-500"> · {a.detail}</span>}
                </>
              ) : (
                <span>{a.detail ?? a.type}</span>
              )}
            </li>
          ))}
          {activities.length === 0 && (
            <li className="text-[11px] text-slate-600">No status changes yet.</li>
          )}
        </ul>
      </details>
    </section>
  );
}
