"use client";

import { PIPELINE_STAGES, STAGE_BY_SLUG, isValidStage } from "@/lib/config/pipeline";
import type { PipelineStage } from "@/lib/types";

export function StageBadge({ stage }: { stage: PipelineStage | string | null | undefined }) {
  const def = stage && isValidStage(stage) ? STAGE_BY_SLUG[stage] : null;
  if (!def) return <span className="text-xs text-slate-600">—</span>;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${def.badgeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${def.dotClass}`} />
      {def.label}
    </span>
  );
}

export function StageSelect({
  value,
  onChange,
  disabled,
  className = "",
}: {
  value: PipelineStage | string;
  onChange: (stage: PipelineStage) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => isValidStage(e.target.value) && onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={`rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none disabled:opacity-50 ${className}`}
    >
      {PIPELINE_STAGES.map((s) => (
        <option key={s.slug} value={s.slug}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
