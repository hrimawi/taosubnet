"use client";

import { formatMoney } from "@/lib/format";

export interface DashboardStats {
  total_businesses: number;
  hot_leads: number;
  warm_leads: number;
  enriched: number;
  with_website: number;
  hot_monthly_value: number;
  expected_value_top100: number;
}

function Card({
  label,
  value,
  accent = "text-slate-100",
  sub,
}: {
  label: string;
  value: string;
  accent?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${accent}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

export default function StatCards({ stats }: { stats: DashboardStats | null }) {
  const n = (v: number | undefined) => (v ?? 0).toLocaleString("en-US");
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Card label="Businesses mapped" value={stats ? n(stats.total_businesses) : "—"} />
      <Card
        label="Hot leads (80+)"
        value={stats ? n(stats.hot_leads) : "—"}
        accent="text-green-400"
      />
      <Card
        label="Warm leads (60–79)"
        value={stats ? n(stats.warm_leads) : "—"}
        accent="text-yellow-400"
      />
      <Card
        label="Decision makers found"
        value={stats ? n(stats.enriched) : "—"}
        sub="via Apollo enrichment"
      />
      <Card
        label="Hot-lead value / mo"
        value={stats ? formatMoney(stats.hot_monthly_value) : "—"}
        accent="text-green-400"
        sub="sum of est. contracts, score ≥ 80"
      />
      <Card
        label="Top-100 expected / mo"
        value={stats ? formatMoney(stats.expected_value_top100) : "—"}
        accent="text-indigo-400"
        sub="contract value × close probability"
      />
    </div>
  );
}
