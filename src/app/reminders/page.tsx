"use client";

import { useCallback, useEffect, useState } from "react";
import BusinessPanel from "@/components/BusinessPanel";
import { fetchJson } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/format";
import type { Reminder } from "@/lib/types";

/** Follow-up reminders grouped by urgency: overdue → today → upcoming → done. */
export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetchJson<{ reminders: Reminder[] }>("/api/reminders?status=all")
      .then((d) => {
        setReminders(d.reminders);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (r: Reminder, completed: boolean) => {
    try {
      await fetchJson(`/api/reminders/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const remove = async (r: Reminder) => {
    try {
      await fetchJson(`/api/reminders/${r.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const now = Date.now();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const open = reminders.filter((r) => !r.completed_at);
  const groups: { title: string; accent: string; rows: Reminder[] }[] = [
    {
      title: "Overdue",
      accent: "text-red-400",
      rows: open.filter((r) => new Date(r.due_at).getTime() < now),
    },
    {
      title: "Due today",
      accent: "text-amber-400",
      rows: open.filter((r) => {
        const t = new Date(r.due_at).getTime();
        return t >= now && t <= endOfToday.getTime();
      }),
    },
    {
      title: "Upcoming",
      accent: "text-slate-300",
      rows: open.filter((r) => new Date(r.due_at).getTime() > endOfToday.getTime()),
    },
    {
      title: "Completed",
      accent: "text-slate-500",
      rows: reminders.filter((r) => r.completed_at).slice(0, 25),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Follow-up Reminders</h1>
        <p className="text-xs text-slate-500">
          Set reminders from any lead’s side panel. {loading && "Loading…"}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          {error}
        </div>
      )}

      {groups.map((g) => (
        <section key={g.title}>
          <h2 className={`mb-2 text-xs font-semibold uppercase tracking-wider ${g.accent}`}>
            {g.title} ({g.rows.length})
          </h2>
          <ul className="space-y-1.5">
            {g.rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
              >
                <button
                  onClick={() => toggle(r, !r.completed_at)}
                  title={r.completed_at ? "Reopen" : "Mark done"}
                  className={`h-4 w-4 shrink-0 rounded border ${
                    r.completed_at
                      ? "border-green-500 bg-green-500/30"
                      : "border-slate-600 hover:border-green-400 hover:bg-green-500/20"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => setSelectedId(r.business_id)}
                    className="block max-w-full truncate text-xs font-medium text-indigo-300 hover:underline"
                  >
                    {r.businesses?.name ?? "View lead"}
                  </button>
                  <div className={`truncate text-[11px] ${r.completed_at ? "text-slate-600 line-through" : "text-slate-400"}`}>
                    {r.note}
                  </div>
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                  {formatDateTime(r.due_at)}
                </span>
                <button
                  onClick={() => remove(r)}
                  title="Delete reminder"
                  className="shrink-0 text-slate-600 hover:text-red-400"
                >
                  ✕
                </button>
              </li>
            ))}
            {g.rows.length === 0 && (
              <li className="rounded-lg border border-dashed border-slate-800 px-3 py-3 text-center text-[11px] text-slate-600">
                Nothing here.
              </li>
            )}
          </ul>
        </section>
      ))}

      <BusinessPanel businessId={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />
    </div>
  );
}
