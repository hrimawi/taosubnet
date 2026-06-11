"use client";

import { useEffect, useState } from "react";
import BusinessPanel from "@/components/BusinessPanel";
import FiltersBar from "@/components/FiltersBar";
import Leaderboard from "@/components/Leaderboard";
import MapView from "@/components/MapView";
import StatCards, { type DashboardStats } from "@/components/StatCards";
import { fetchJson } from "@/lib/fetcher";
import { filtersToQuery } from "@/lib/filterParams";
import type { Business, BusinessFilters, MapPoint } from "@/lib/types";

/**
 * Dashboard: on open you immediately see (1) the highest-value prospects,
 * (2) where they are on the map, (3) who to contact, (4) why they're a strong
 * automation prospect, (5) what winning them is worth — one click deep.
 */
export default function DashboardPage() {
  const [filters, setFilters] = useState<BusinessFilters>({});
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [leaders, setLeaders] = useState<Business[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [boardLoading, setBoardLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stat cards (unfiltered snapshot).
  useEffect(() => {
    fetchJson<{ stats: DashboardStats }>("/api/meta")
      .then((d) => setStats(d.stats))
      .catch((e) => setError(e.message));
  }, []);

  // Map pins: lazily stream paginated batches — never the whole table at once.
  useEffect(() => {
    let cancelled = false;
    const qs = filtersToQuery(filters);
    setPinsLoading(true);
    setPoints([]);
    (async () => {
      const acc: MapPoint[] = [];
      for (let page = 0; page < 20; page++) {
        const d = await fetchJson<{ points: MapPoint[]; hasMore: boolean }>(
          `/api/businesses/map?${qs}&page=${page}&pageSize=1000`,
        );
        if (cancelled) return;
        acc.push(...d.points);
        setPoints([...acc]);
        if (!d.hasMore) break;
      }
    })()
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setPinsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  // Leaderboard follows the same filters.
  useEffect(() => {
    let cancelled = false;
    setBoardLoading(true);
    fetchJson<{ rows: Business[] }>(`/api/leaderboard?${filtersToQuery(filters)}`)
      .then((d) => !cancelled && setLeaders(d.rows))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setBoardLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  return (
    <div className="space-y-4 p-4">
      <StatCards stats={stats} />
      <FiltersBar value={filters} onChange={setFilters} />
      {error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-200">
          <span className="font-semibold">Heads up:</span> {error}
          <span className="block pt-1 text-amber-200/70">
            First run? Copy .env.example → .env.local, apply supabase/migrations in the Supabase
            SQL editor, then run <code>npm run collect</code>.
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="h-[calc(100vh-310px)] min-h-[480px] overflow-hidden rounded-xl border border-slate-800 xl:col-span-2">
          <MapView points={points} onSelect={setSelectedId} loading={pinsLoading} />
        </div>
        <div className="h-[calc(100vh-310px)] min-h-[480px]">
          <Leaderboard
            rows={leaders}
            selectedId={selectedId}
            onSelect={setSelectedId}
            loading={boardLoading}
          />
        </div>
      </div>
      <BusinessPanel businessId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
