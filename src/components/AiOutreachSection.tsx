"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetcher";
import { AI_CONTENT_LABEL, AI_CONTENT_TYPES } from "@/lib/ai/prompts";
import { formatDateTime } from "@/lib/format";
import type { AiContent, AiContentType } from "@/lib/types";

/**
 * AI outreach block in the side panel: prospect summary + cold email +
 * call script + LinkedIn message + follow-up email.
 *
 * Cache-first by design: cached pieces render instantly; "Generate" only
 * creates what's missing, and per-piece "Regenerate" is the explicit opt-in
 * to spend tokens again.
 */
export default function AiOutreachSection({ businessId }: { businessId: string }) {
  const [contents, setContents] = useState<AiContent[]>([]);
  const [busyTypes, setBusyTypes] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setContents([]);
    setError(null);
    fetchJson<{ contents: AiContent[] }>(`/api/businesses/${businessId}/ai`)
      .then((d) => !cancelled && setContents(d.contents))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const byType = new Map(contents.map((c) => [c.content_type, c]));
  const missing = AI_CONTENT_TYPES.filter((t) => !byType.has(t));

  const generate = async (types: AiContentType[], regenerate: boolean) => {
    setBusyTypes(new Set(types));
    setError(null);
    try {
      const d = await fetchJson<{ contents: AiContent[] }>(
        `/api/businesses/${businessId}/ai`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ types, regenerate }),
        },
      );
      setContents(d.contents);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusyTypes(new Set());
    }
  };

  const copy = async (c: AiContent) => {
    try {
      await navigator.clipboard.writeText(c.content);
      setCopied(c.content_type);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Clipboard unavailable — select and copy manually.");
    }
  };

  return (
    <section className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fuchsia-300">
          AI Outreach
        </h3>
        {missing.length > 0 && (
          <button
            onClick={() => generate(missing, false)}
            disabled={busyTypes.size > 0}
            className="rounded-md bg-fuchsia-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-fuchsia-500 disabled:opacity-50"
          >
            {busyTypes.size > 0
              ? "Generating…"
              : missing.length === AI_CONTENT_TYPES.length
                ? "✨ Generate all"
                : `✨ Generate missing (${missing.length})`}
          </button>
        )}
      </div>
      <p className="mb-2 text-[10px] text-slate-500">
        Grounded in this business’s real data + catalog automations. Generated once and cached —
        regenerate per piece only when you want to spend tokens again.
      </p>
      {error && <div className="mb-2 text-[11px] text-red-400">{error}</div>}

      <div className="space-y-1.5">
        {AI_CONTENT_TYPES.map((t) => {
          const c = byType.get(t);
          const busy = busyTypes.has(t);
          return (
            <details key={t} className="group rounded-lg border border-slate-800 bg-slate-950">
              <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-xs">
                <span className={c ? "text-slate-200" : "text-slate-500"}>
                  {AI_CONTENT_LABEL[t]}
                </span>
                {busy && <span className="text-[10px] text-fuchsia-300">generating…</span>}
                {c && !busy && (
                  <span className="ml-auto text-[10px] text-slate-600">
                    {formatDateTime(c.generated_at)}
                  </span>
                )}
                {!c && !busy && <span className="ml-auto text-[10px] text-slate-600">not generated</span>}
              </summary>
              <div className="border-t border-slate-800 px-3 py-2">
                {c ? (
                  <>
                    <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-slate-300">
                      {c.content}
                    </pre>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => copy(c)}
                        className="rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
                      >
                        {copied === t ? "✓ Copied" : "Copy"}
                      </button>
                      <button
                        onClick={() => generate([t], true)}
                        disabled={busyTypes.size > 0}
                        className="rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-800 disabled:opacity-50"
                      >
                        ↻ Regenerate
                      </button>
                      <span className="ml-auto text-[10px] text-slate-600">{c.model}</span>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => generate([t], false)}
                    disabled={busyTypes.size > 0}
                    className="rounded-md border border-fuchsia-500/40 px-2 py-1 text-[10px] text-fuchsia-300 hover:bg-fuchsia-500/10 disabled:opacity-50"
                  >
                    {busy ? "Generating…" : `Generate ${AI_CONTENT_LABEL[t].toLowerCase()}`}
                  </button>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
