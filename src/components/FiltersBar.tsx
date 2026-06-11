"use client";

import { useEffect, useRef, useState } from "react";
import { COVERAGE_CITIES } from "@/lib/config/cities";
import { INDUSTRIES } from "@/lib/config/industries";
import type { BusinessFilters } from "@/lib/types";

interface Props {
  value: BusinessFilters;
  onChange: (f: BusinessFilters) => void;
  /** Optional extra controls rendered on the right (e.g. export button). */
  children?: React.ReactNode;
}

const selectClass =
  "rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 " +
  "focus:border-indigo-500 focus:outline-none";

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-500">
      {label}
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function FiltersBar({ value, onChange, children }: Props) {
  // Debounced search box (350 ms) so typing doesn't hammer the API.
  const [qDraft, setQDraft] = useState(value.q ?? "");
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      if ((value.q ?? "") !== qDraft) onChange({ ...value, q: qDraft || undefined });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDraft]);

  const set = (patch: Partial<BusinessFilters>) => onChange({ ...value, ...patch });
  const num = (v: string) => (v === "" ? undefined : Number(v));

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5">
      <input
        type="search"
        placeholder="Search business, owner, industry…"
        value={qDraft}
        onChange={(e) => setQDraft(e.target.value)}
        className="w-60 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
      />
      <Select
        label="City"
        value={value.city ?? ""}
        onChange={(v) => set({ city: v || undefined })}
        options={COVERAGE_CITIES.map((c) => ({ value: c, label: c }))}
      />
      <Select
        label="Industry"
        value={value.industry ?? ""}
        onChange={(v) => set({ industry: v || undefined })}
        options={INDUSTRIES.map((i) => ({ value: i.slug, label: i.label }))}
      />
      <Select
        label="Score"
        value={value.minScore?.toString() ?? ""}
        onChange={(v) => set({ minScore: num(v) })}
        options={[
          { value: "80", label: "80+ (hot)" },
          { value: "60", label: "60+ (warm)" },
          { value: "40", label: "40+" },
        ]}
      />
      <Select
        label="Close %"
        value={value.minCloseProb?.toString() ?? ""}
        onChange={(v) => set({ minCloseProb: num(v) })}
        options={[
          { value: "70", label: "70%+" },
          { value: "50", label: "50%+" },
          { value: "30", label: "30%+" },
        ]}
      />
      <Select
        label="Value/mo"
        value={value.minValue?.toString() ?? ""}
        onChange={(v) => set({ minValue: num(v) })}
        options={[
          { value: "1500", label: "$1,500+" },
          { value: "1000", label: "$1,000+" },
          { value: "500", label: "$500+" },
        ]}
      />
      <Select
        label="Employees"
        value={value.minEmployees?.toString() ?? ""}
        onChange={(v) => set({ minEmployees: num(v) })}
        options={[
          { value: "25", label: "25+" },
          { value: "10", label: "10+" },
          { value: "5", label: "5+" },
        ]}
      />
      <Select
        label="Reviews"
        value={value.minReviews?.toString() ?? ""}
        onChange={(v) => set({ minReviews: num(v) })}
        options={[
          { value: "100", label: "100+" },
          { value: "50", label: "50+" },
          { value: "10", label: "10+" },
        ]}
      />
      <Select
        label="Revenue"
        value={value.minRevenue?.toString() ?? ""}
        onChange={(v) => set({ minRevenue: num(v) })}
        options={[
          { value: "5000000", label: "$5M+" },
          { value: "1000000", label: "$1M+" },
          { value: "250000", label: "$250K+" },
        ]}
      />
      <button
        onClick={() => {
          setQDraft("");
          onChange({});
        }}
        className="rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300"
      >
        Reset
      </button>
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}
