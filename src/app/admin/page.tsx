"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/format";

/**
 * Admin: API budget + cache health. Every billable Google/Apollo/Anthropic
 * call is logged with an estimated cost — this page is the spend dashboard.
 */

interface ProviderStats {
  total_calls: number;
  total_cost: number;
  calls_30d: number;
  cost_30d: number;
}

interface Usage {
  providers: Record<string, ProviderStats>;
  cache: {
    businesses_total: number;
    google_fresh_30d: number;
    apollo_fresh_30d: number;
    searches_cached_30d: number;
    ai_content_cached?: number;
  };
}

interface Run {
  id: string;
  status: string;
  params: Record<string, unknown> | null;
  stats: Record<string, number> | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google Places",
  apollo: "Apollo",
  anthropic: "Anthropic (Claude)",
};

export default function AdminPage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<{ usage: Usage; runs: Run[] }>("/api/admin/usage")
      .then((d) => {
        setUsage(d.usage);
        setRuns(d.runs);
      })
      .catch((e) => setError(e.message));
  }, []);

  const money = (v: number | undefined) => `$${(v ?? 0).toFixed(2)}`;
  const providers = ["google", "apollo", "anthropic"];

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Admin · API Budget & Cache</h1>
        <p className="mt-1 text-xs text-slate-500">
          Call counts are exact; costs are estimates from src/lib/config/pricing.ts — verify
          against current provider pricing.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {providers.map((p) => {
          const s = usage?.providers?.[p];
          return (
            <div key={p} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-xs font-semibold text-slate-300">{PROVIDER_LABEL[p]}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-slate-500">Calls (30d)</div>
                  <div className="text-lg font-semibold tabular-nums text-slate-100">
                    {(s?.calls_30d ?? 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Est. cost (30d)</div>
                  <div className="text-lg font-semibold tabular-nums text-slate-100">
                    {money(s?.cost_30d)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Calls (all time)</div>
                  <div className="tabular-nums text-slate-300">
                    {(s?.total_calls ?? 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Est. cost (all time)</div>
                  <div className="tabular-nums text-slate-300">{money(s?.total_cost)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Cache health (30-day re-fetch guard)
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
          <CacheStat label="Businesses stored" value={usage?.cache.businesses_total} />
          <CacheStat label="Google data fresh" value={usage?.cache.google_fresh_30d} />
          <CacheStat label="Apollo data fresh" value={usage?.cache.apollo_fresh_30d} />
          <CacheStat label="Searches cached" value={usage?.cache.searches_cached_30d} />
          {usage?.cache.ai_content_cached != null && (
            <CacheStat label="AI content cached" value={usage.cache.ai_content_cached} />
          )}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          “Fresh” records are never re-fetched by <code>npm run collect</code> — that’s the API
          budget protection. Use <code>--force</code> only when you intentionally want to re-spend.
        </p>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Collection runs
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-1.5 pr-3">Started</th>
                <th className="py-1.5 pr-3">Status</th>
                <th className="py-1.5 pr-3 text-right">Queries</th>
                <th className="py-1.5 pr-3 text-right">New</th>
                <th className="py-1.5 pr-3 text-right">Apollo matched</th>
                <th className="py-1.5 pr-3 text-right">Scored</th>
                <th className="py-1.5">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-3 text-slate-300">{formatDateTime(r.started_at)}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        r.status === "completed"
                          ? "bg-green-500/15 text-green-400"
                          : r.status === "failed"
                            ? "bg-red-500/15 text-red-400"
                            : "bg-yellow-500/15 text-yellow-400"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-400">
                    {r.stats?.queries_run ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-400">
                    {r.stats?.businesses_new ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-400">
                    {r.stats?.apollo_matched ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-400">
                    {r.stats?.scored ?? "—"}
                  </td>
                  <td className="max-w-[260px] truncate py-2 text-slate-500">{r.error ?? ""}</td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    No collection runs yet — kick one off with <code>npm run collect</code>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function CacheStat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div>
      <div className="text-slate-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-slate-100">
        {(value ?? 0).toLocaleString()}
      </div>
    </div>
  );
}
