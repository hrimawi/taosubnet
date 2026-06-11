"use client";

import { SCORE_BG_CLASS, scoreBand } from "@/lib/format";

export default function ScoreBadge({
  score,
  className = "",
}: {
  score: number | null | undefined;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-md border px-1.5 py-0.5 text-xs font-semibold tabular-nums ${SCORE_BG_CLASS[scoreBand(score)]} ${className}`}
      title="Lead Score (0–100)"
    >
      {score ?? "—"}
    </span>
  );
}
