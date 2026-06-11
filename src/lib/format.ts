/** Client-safe formatting helpers (no env / db imports). */

export function formatMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function formatRevenue(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Spec color bands: Green 80–100, Yellow 60–79, Red 0–59. */
export type ScoreBand = "green" | "yellow" | "red" | "none";

export function scoreBand(score: number | null | undefined): ScoreBand {
  if (score == null) return "none";
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  return "red";
}

export const SCORE_HEX: Record<ScoreBand, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
  none: "#64748b",
};

export const SCORE_TEXT_CLASS: Record<ScoreBand, string> = {
  green: "text-green-400",
  yellow: "text-yellow-400",
  red: "text-red-400",
  none: "text-slate-400",
};

export const SCORE_BG_CLASS: Record<ScoreBand, string> = {
  green: "bg-green-500/15 text-green-400 border-green-500/30",
  yellow: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  red: "bg-red-500/15 text-red-400 border-red-500/30",
  none: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};
