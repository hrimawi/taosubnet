"use client";

import { useEffect, useState } from "react";
import BusinessPanel from "@/components/BusinessPanel";
import FiltersBar from "@/components/FiltersBar";
import ScoreBadge from "@/components/ScoreBadge";
import { StageBadge } from "@/components/StageBadge";
import { fetchJson } from "@/lib/fetcher";
import { filtersToQuery } from "@/lib/filterParams";
import { industryLabel } from "@/lib/config/industries";
import { formatMoney, formatRevenue } from "@/lib/format";
import type { Business, BusinessFilters } from "@/lib/types";

const PAGE_SIZE = 50;

const COLUMNS: { key: string; label: string; sort?: string; align?: "right" }[] = [
  { key: "name", label: "Business", sort: "name" },
  { key: "industry", label: "Industry" },
  { key: "city", label: "City", sort: "city" },
  { key: "score", label: "Score", sort: "score", align: "right" },
  { key: "close", label: "Close %", sort: "close", align: "right" },
  { key: "value", label: "$/mo", sort: "value", align: "right" },
  { key: "expected", label: "Expected $/mo", sort: "expected", align: "right" },
  { key: "reviews", label: "Reviews", sort: "reviews", align: "right" },
  { key: "rating", label: "Rating", sort: "rating", align: "right" },
  { key: "employees", label: "Emp.", sort: "employees", align: "right" },
  { key: "revenue", label: "Revenue", sort: "revenue", align: "right" },
  { key: "owner", label: "Decision Maker" },
  { key: "stage", label: "Stage" },
];

export default function LeadsPage() {
  const [filters, setFilters] = useState<BusinessFilters>({});
  const [rows, setRows] = useState<Business[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ col: string; dir: "asc" | "desc" }>({
    col: "expected",
    dir: "desc",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setPage(0), [filters, sort]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = filtersToQuery(filters);
    fetchJson<{ rows: Business[]; total: number }>(
      `/api/businesses?${qs}&sort=${sort.col}&dir=${sort.dir}&page=${page}&pageSize=${PAGE_SIZE}`,
    )
      .then((d) => {
        if (cancelled) return;
        setRows(d.rows);
        setTotal(d.total);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters, sort, page]);

  const toggleSort = (col?: string) => {
    if (!col) return;
    setSort((s) =>
      s.col === col ? { col, dir: s.dir === "desc" ? "asc" : "desc" } : { col, dir: "desc" },
    );
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-slate-100">All Leads</h1>
        <span className="text-xs text-slate-500">{total.toLocaleString()} businesses match</span>
      </div>
      <FiltersBar value={filters} onChange={setFilters} showStage>
        <a
          href={`/api/export?${filtersToQuery(filters)}`}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
        >
          ⬇ Export CSV
        </a>
      </FiltersBar>
      {error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[1100px] text-left text-xs">
          <thead className="bg-slate-900 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.sort)}
                  className={`px-3 py-2.5 font-medium ${c.align === "right" ? "text-right" : ""} ${
                    c.sort ? "cursor-pointer select-none hover:text-slate-300" : ""
                  }`}
                >
                  {c.label}
                  {sort.col === c.sort && (sort.dir === "desc" ? " ↓" : " ↑")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 bg-slate-950">
            {rows.map((b) => (
              <tr
                key={b.id}
                onClick={() => setSelectedId(b.id)}
                className="cursor-pointer transition-colors hover:bg-slate-900/70"
              >
                <td className="max-w-[240px] truncate px-3 py-2 font-medium text-slate-200">
                  {b.name}
                  {b.is_multi_location && (
                    <span className="ml-1.5 rounded bg-indigo-500/20 px-1 text-[10px] text-indigo-300">
                      ×{b.location_count}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-400">{industryLabel(b.industry)}</td>
                <td className="px-3 py-2 text-slate-400">{b.city ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <ScoreBadge score={b.lead_score} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                  {b.close_probability != null ? `${b.close_probability}%` : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                  {formatMoney(b.estimated_contract_value)}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-indigo-300">
                  {formatMoney(b.expected_monthly_value)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-400">
                  {b.review_count?.toLocaleString() ?? "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-400">
                  {b.google_rating ?? "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-400">
                  {b.employee_count ?? "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-400">
                  {formatRevenue(b.revenue_estimate)}
                </td>
                <td className="max-w-[170px] truncate px-3 py-2 text-slate-400">
                  {b.owner_name ?? <span className="text-slate-600">not found</span>}
                </td>
                <td className="px-3 py-2">
                  <StageBadge stage={b.pipeline_stage} />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-slate-500">
                  No businesses match. Run <code>npm run collect</code> or loosen the filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Page {page + 1} of {pages}
          {loading && " · loading…"}
        </span>
        <div className="flex gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-slate-700 px-3 py-1.5 hover:bg-slate-800 disabled:opacity-40"
          >
            ← Prev
          </button>
          <button
            disabled={page + 1 >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-slate-700 px-3 py-1.5 hover:bg-slate-800 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>

      <BusinessPanel businessId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
