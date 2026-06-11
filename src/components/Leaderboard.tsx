"use client";

import ScoreBadge from "./ScoreBadge";
import { formatMoney } from "@/lib/format";
import { industryLabel } from "@/lib/config/industries";
import type { Business } from "@/lib/types";

interface Props {
  rows: Business[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
}

/** Top-100 highest-value prospects, ranked by expected monthly value. */
export default function Leaderboard({ rows, selectedId, onSelect, loading }: Props) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex items-baseline justify-between border-b border-slate-800 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-200">Top Prospects</h2>
        <span className="text-[11px] text-slate-500">
          ranked by expected $/mo (value × close&nbsp;%)
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && rows.length === 0 && (
          <div className="p-4 text-xs text-slate-500">Loading leaderboard…</div>
        )}
        {!loading && rows.length === 0 && (
          <div className="p-4 text-xs leading-relaxed text-slate-500">
            No scored businesses yet. Run <code className="text-slate-300">npm run collect</code>{" "}
            to pull Google + Apollo data, then refresh.
          </div>
        )}
        <ol>
          {rows.map((b, i) => (
            <li key={b.id}>
              <button
                onClick={() => onSelect(b.id)}
                className={`flex w-full items-center gap-3 border-b border-slate-800/60 px-3 py-2 text-left transition-colors hover:bg-slate-800/50 ${
                  selectedId === b.id ? "bg-slate-800/80" : ""
                }`}
              >
                <span className="w-6 shrink-0 text-right text-[11px] tabular-nums text-slate-600">
                  {i + 1}
                </span>
                <ScoreBadge score={b.lead_score} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-slate-200">
                    {b.name}
                    {b.is_multi_location && (
                      <span className="ml-1.5 rounded bg-indigo-500/20 px-1 text-[10px] text-indigo-300">
                        ×{b.location_count}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {industryLabel(b.industry)} · {b.city ?? "—"}
                    {b.owner_name ? ` · ${b.owner_name}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-xs font-semibold tabular-nums text-slate-200">
                    {formatMoney(b.expected_monthly_value)}/mo
                  </span>
                  <span className="block text-[10px] tabular-nums text-slate-500">
                    {formatMoney(b.estimated_contract_value)} × {b.close_probability ?? "—"}%
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
