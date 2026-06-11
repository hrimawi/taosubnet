"use client";

import { useCallback, useEffect, useState } from "react";
import CrmSection from "./CrmSection";
import { fetchJson } from "@/lib/fetcher";
import { industryLabel } from "@/lib/config/industries";
import {
  formatMoney,
  formatRevenue,
  SCORE_TEXT_CLASS,
  scoreBand,
} from "@/lib/format";
import type { Activity, Business, Note, Reminder, ScoreFactor } from "@/lib/types";

/**
 * Slide-over detail panel. Opens when a map pin / leaderboard row / table row
 * is clicked and lazy-loads the full record for that one business.
 */

interface Props {
  businessId: string | null;
  onClose: () => void;
  /** Called after a CRM change (stage move etc.) so list views can refresh. */
  onChanged?: () => void;
}

interface Detail {
  business: Business;
  notes: Note[];
  activities: Activity[];
  reminders: Reminder[];
}

const WEBSITE_QUALITY_LABEL: Record<string, string> = {
  none: "No website",
  broken: "Website broken",
  social_only: "Social page only",
  basic: "Basic template site",
  good: "Healthy website",
  sophisticated: "Sophisticated stack",
};

export default function BusinessPanel({ businessId, onClose, onChanged }: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);

  // Re-fetch after CRM mutations and notify the parent so lists stay in sync.
  const reload = useCallback(() => {
    setVersion((v) => v + 1);
    onChanged?.();
  }, [onChanged]);

  useEffect(() => {
    if (!businessId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchJson<Detail>(`/api/businesses/${businessId}`)
      .then((d) => !cancelled && setDetail(d))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [businessId, version]);

  if (!businessId) return null;
  const b = detail?.business ?? null;

  return (
    <aside className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-[440px] flex-col border-l border-slate-800 bg-slate-950 shadow-2xl">
      {/* header */}
      <div className="flex items-start gap-3 border-b border-slate-800 px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-slate-100">
            {b?.name ?? (loading ? "Loading…" : "Business")}
          </h2>
          {b && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
              <span className="rounded bg-slate-800 px-1.5 py-0.5">{industryLabel(b.industry)}</span>
              {b.city && <span>{b.city}, {b.state ?? "LA"}</span>}
              {b.is_multi_location && (
                <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-indigo-300">
                  multi-location ×{b.location_count}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {error}
          </div>
        )}
        {loading && !b && <div className="text-xs text-slate-500">Loading…</div>}

        {b && (
          <div className="space-y-5">
            {/* scores */}
            <div className="grid grid-cols-3 gap-2">
              <ScoreBox
                label="Lead Score"
                value={b.lead_score != null ? String(b.lead_score) : "—"}
                accent={SCORE_TEXT_CLASS[scoreBand(b.lead_score)]}
              />
              <ScoreBox
                label="Close Prob."
                value={b.close_probability != null ? `${b.close_probability}%` : "—"}
                accent="text-slate-100"
              />
              <ScoreBox
                label="Est. Value"
                value={b.estimated_contract_value != null ? `${formatMoney(b.estimated_contract_value)}/mo` : "—"}
                accent="text-slate-100"
              />
            </div>
            {b.expected_monthly_value != null && (
              <div className="-mt-3 text-center text-[11px] text-slate-500">
                Expected value:{" "}
                <span className="font-semibold text-indigo-300">
                  {formatMoney(b.expected_monthly_value)}/mo
                </span>{" "}
                (value × close probability)
              </div>
            )}

            {/* CRM: stage, notes, reminders, status history */}
            {detail && b.pipeline_stage && (
              <CrmSection
                businessId={b.id}
                stage={b.pipeline_stage}
                notes={detail.notes}
                reminders={detail.reminders}
                activities={detail.activities}
                reload={reload}
              />
            )}

            {/* decision maker */}
            <Section title="Decision Maker">
              {b.owner_name ? (
                <div className="space-y-1 text-xs">
                  <div className="font-medium text-slate-200">
                    {b.owner_name}
                    {b.owner_title && <span className="text-slate-400"> · {b.owner_title}</span>}
                  </div>
                  {b.owner_email && (
                    <a href={`mailto:${b.owner_email}`} className="block text-indigo-400 hover:underline">
                      {b.owner_email}
                    </a>
                  )}
                  {b.owner_linkedin_url && (
                    <ExtLink href={b.owner_linkedin_url}>LinkedIn profile</ExtLink>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  No verified decision-maker found{b.apollo_attempted_at ? " (Apollo: no match)" : " yet — run enrichment"}.
                  Fields stay empty rather than guessed.
                </p>
              )}
            </Section>

            {/* company */}
            <Section title="Company">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <Datum label="Employees" value={b.employee_count?.toLocaleString() ?? "—"} />
                <Datum label="Est. revenue" value={formatRevenue(b.revenue_estimate)} />
                <Datum label="Founded" value={b.founded_year?.toString() ?? "—"} />
                <Datum
                  label="Web presence"
                  value={WEBSITE_QUALITY_LABEL[b.website_quality ?? ""] ?? (b.website ? "Unprobed" : "No website")}
                />
              </dl>
              {b.company_linkedin_url && (
                <ExtLink href={b.company_linkedin_url} className="mt-1.5 block">
                  Company LinkedIn
                </ExtLink>
              )}
              {b.company_description && (
                <p className="mt-2 line-clamp-4 text-[11px] leading-relaxed text-slate-400">
                  {b.company_description}
                </p>
              )}
            </Section>

            {/* contact & location */}
            <Section title="Contact & Location">
              <div className="space-y-1 text-xs">
                {b.phone && (
                  <a href={`tel:${b.phone}`} className="block text-slate-200 hover:text-indigo-300">
                    📞 {b.phone}
                  </a>
                )}
                {b.website && <ExtLink href={b.website}>🌐 {b.website_domain ?? b.website}</ExtLink>}
                {b.formatted_address && <div className="text-slate-400">📍 {b.formatted_address}</div>}
                <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400">
                  <span>
                    ⭐ {b.google_rating ?? "—"} ({b.review_count?.toLocaleString() ?? 0} reviews)
                  </span>
                  {b.google_maps_url && <ExtLink href={b.google_maps_url}>Google Maps ↗</ExtLink>}
                </div>
              </div>
            </Section>

            {/* automation opportunities — always drawn from the catalog */}
            <Section title="Automation Opportunities">
              {b.automation_opportunities?.length ? (
                <ul className="space-y-2">
                  {b.automation_opportunities.map((a) => (
                    <li key={a.id} className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                      <div className="text-xs font-medium text-slate-200">{a.name}</div>
                      <div className="mt-0.5 text-[11px] leading-snug text-slate-500">{a.description}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">Not scored yet — run the collector.</p>
              )}
            </Section>

            {/* score explanation */}
            {b.score_breakdown && (
              <Section title="Why This Score">
                <FactorGroup title={`Lead Score · ${b.lead_score}`} factors={b.score_breakdown.leadScore} />
                <FactorGroup
                  title={`Close Probability · ${b.close_probability}%`}
                  factors={b.score_breakdown.closeProbability}
                  className="mt-3"
                />
                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-400">
                  <span className="font-medium text-slate-300">Contract value math:</span>{" "}
                  ${b.score_breakdown.contractValue.base} base ×{" "}
                  {b.score_breakdown.contractValue.employeeMultiplier} headcount ×{" "}
                  {b.score_breakdown.contractValue.revenueMultiplier} revenue ×{" "}
                  {b.score_breakdown.contractValue.multiLocationMultiplier} multi-location
                  {b.score_breakdown.contractValue.capApplied && (
                    <> → capped by {b.score_breakdown.contractValue.capApplied}</>
                  )}
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function ScoreBox({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${accent}`}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Datum({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-200">{value}</dd>
    </>
  );
}

function ExtLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-indigo-400 hover:underline ${className}`}
    >
      {children}
    </a>
  );
}

function FactorGroup({
  title,
  factors,
  className = "",
}: {
  title: string;
  factors: ScoreFactor[];
  className?: string;
}) {
  return (
    <details className={`group rounded-lg border border-slate-800 bg-slate-900/60 ${className}`}>
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-slate-300 group-open:border-b group-open:border-slate-800">
        {title}
      </summary>
      <ul className="space-y-2 px-3 py-2">
        {factors.map((f) => (
          <li key={f.key}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="text-slate-300">{f.label}</span>
              <span className="tabular-nums text-slate-500">
                {f.points}/{f.max}
              </span>
            </div>
            <div className="mt-0.5 h-1 overflow-hidden rounded bg-slate-800">
              <div
                className="h-full rounded bg-indigo-500"
                style={{ width: `${Math.min(100, (f.points / f.max) * 100)}%` }}
              />
            </div>
            <div className="mt-0.5 text-[10px] text-slate-500">{f.detail}</div>
          </li>
        ))}
      </ul>
    </details>
  );
}
