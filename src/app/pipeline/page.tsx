"use client";

import { useCallback, useEffect, useState } from "react";
import BusinessPanel from "@/components/BusinessPanel";
import ScoreBadge from "@/components/ScoreBadge";
import { StageSelect } from "@/components/StageBadge";
import { fetchJson } from "@/lib/fetcher";
import { PIPELINE_STAGES } from "@/lib/config/pipeline";
import { industryLabel } from "@/lib/config/industries";
import { formatMoney } from "@/lib/format";
import type { Business, PipelineStage } from "@/lib/types";

/**
 * Kanban pipeline across the 7 CRM stages. Each column shows its top 50 leads
 * by expected value plus count/value rollups; cards move via the stage select
 * or through the side panel.
 */

interface StageData {
  rows: Business[];
  count: number;
  value: number;
}

export default function PipelinePage() {
  const [columns, setColumns] = useState<Record<string, StageData>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [{ stages }, ...lists] = await Promise.all([
        fetchJson<{ stages: Record<string, { count: number; value: number }> }>("/api/pipeline"),
        ...PIPELINE_STAGES.map((s) =>
          fetchJson<{ rows: Business[]; total: number }>(
            `/api/businesses?stage=${s.slug}&sort=expected&dir=desc&pageSize=50`,
          ),
        ),
      ]);
      const next: Record<string, StageData> = {};
      PIPELINE_STAGES.forEach((s, i) => {
        next[s.slug] = {
          rows: lists[i].rows,
          count: stages[s.slug]?.count ?? lists[i].total,
          value: stages[s.slug]?.value ?? 0,
        };
      });
      setColumns(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const moveStage = async (id: string, stage: PipelineStage) => {
    try {
      await fetchJson(`/api/businesses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_stage: stage }),
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Move failed");
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Pipeline</h1>
          <p className="text-xs text-slate-500">
            {loading ? "Loading…" : "Drag-free kanban — move leads with the stage selector on each card."}
          </p>
        </div>
        <a
          href="/api/export?view=pipeline"
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
        >
          ⬇ Export pipeline CSV
        </a>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          {error}
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {PIPELINE_STAGES.map((s) => {
          const col = columns[s.slug];
          return (
            <div
              key={s.slug}
              className="flex h-[calc(100vh-220px)] min-h-[420px] w-[280px] shrink-0 flex-col rounded-xl border border-slate-800 bg-slate-900/50"
            >
              <div className="border-b border-slate-800 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${s.dotClass}`} />
                  <span className="text-xs font-semibold text-slate-200">{s.label}</span>
                  <span className="ml-auto text-[11px] tabular-nums text-slate-500">
                    {col?.count ?? 0}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                  {formatMoney(col?.value ?? 0)}/mo potential
                </div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {(col?.rows ?? []).map((b) => (
                  <div
                    key={b.id}
                    onClick={() => setSelectedId(b.id)}
                    className="cursor-pointer rounded-lg border border-slate-800 bg-slate-950 p-2.5 transition-colors hover:border-slate-600"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate text-xs font-medium text-slate-200">
                        {b.name}
                      </span>
                      <ScoreBadge score={b.lead_score} />
                    </div>
                    <div className="mt-1 truncate text-[11px] text-slate-500">
                      {industryLabel(b.industry)} · {b.city ?? "—"}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold tabular-nums text-indigo-300">
                        {formatMoney(b.expected_monthly_value)}/mo
                      </span>
                      <StageSelect
                        value={s.slug}
                        onChange={(next) => moveStage(b.id, next)}
                        className="!px-1 !py-0.5 text-[10px]"
                      />
                    </div>
                  </div>
                ))}
                {col && col.count > col.rows.length && (
                  <div className="px-1 py-1 text-center text-[10px] text-slate-600">
                    +{col.count - col.rows.length} more — use Leads to see all
                  </div>
                )}
                {col && col.rows.length === 0 && (
                  <div className="px-1 py-4 text-center text-[11px] text-slate-600">Empty</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <BusinessPanel
        businessId={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={load}
      />
    </div>
  );
}
