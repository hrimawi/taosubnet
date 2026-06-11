import { INDUSTRY_BY_SLUG, type IndustryProfile } from "../config/industries";
import { automationsForIndustry } from "../config/automations";
import type {
  AutomationOpportunity,
  ScoreBreakdown,
  ScoreFactor,
  WebsiteQuality,
} from "../types";

/**
 * Deterministic rule-based scoring engine.
 *
 * All three numbers (Lead Score, Close Probability, Estimated Monthly Contract
 * Value) are computed in code — fast, free, reproducible, and explainable.
 * The LLM is never involved in numeric scoring; it only ever writes prose.
 *
 * Inputs are whatever we actually know. Missing data (no Apollo match, no
 * website probe) scores conservatively rather than optimistically — null is
 * never treated as a positive signal.
 */

export interface ScoringInput {
  industry: string;
  google_rating: number | null;
  review_count: number | null;
  website: string | null;
  website_quality: WebsiteQuality | null;
  employee_count: number | null;
  revenue_estimate: number | null;
  is_multi_location: boolean;
  location_count: number;
  owner_name: string | null;
  owner_email: string | null;
  owner_linkedin_url: string | null;
  company_linkedin_url: string | null;
  phone: string | null;
}

export interface ScoringResult {
  lead_score: number;
  close_probability: number;
  estimated_contract_value: number;
  expected_monthly_value: number;
  score_breakdown: ScoreBreakdown;
  automation_opportunities: AutomationOpportunity[];
}

const FALLBACK_PROFILE: IndustryProfile = {
  appointmentHeavy: 0.5,
  leadGenDependent: 0.6,
  serviceBusiness: 0.5,
  invoicing: true,
  closeRateFactor: 0.5,
  baseContractValue: 400,
  digitallySavvy: false,
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function factor(key: string, label: string, points: number, max: number, detail: string): ScoreFactor {
  return { key, label, points: Math.round(points), max, detail };
}

/** Effective website quality, treating an unprobed-but-present site neutrally. */
function effectiveWebsiteQuality(input: ScoringInput): WebsiteQuality | "unprobed" {
  if (!input.website) return "none";
  return input.website_quality && input.website_quality !== "none"
    ? input.website_quality
    : "unprobed";
}

// ── Lead Score (0–100) ───────────────────────────────────────────────────────

function leadScoreFactors(input: ScoringInput, profile: IndustryProfile): ScoreFactor[] {
  const factors: ScoreFactor[] = [];
  const reviews = input.review_count ?? 0;
  const rating = input.google_rating;

  // 1. Review volume (max 15) — proxy for customer/lead volume worth automating.
  let pts: number, detail: string;
  if (reviews >= 200) [pts, detail] = [15, `${reviews} reviews — high customer volume`];
  else if (reviews >= 75) [pts, detail] = [13, `${reviews} reviews — solid customer volume`];
  else if (reviews >= 25) [pts, detail] = [10, `${reviews} reviews — moderate volume`];
  else if (reviews >= 1) [pts, detail] = [6, `${reviews} reviews — light footprint`];
  else [pts, detail] = [2, "No reviews — volume unknown"];
  factors.push(factor("review_volume", "Review volume", pts, 15, detail));

  // 2. Reputation signal (max 8). A 3.x rating is a review-generation opportunity;
  //    a 4.0–4.7 shop is well-run and growth-minded.
  if (rating == null) [pts, detail] = [2, "No rating yet"];
  else if (rating < 3) [pts, detail] = [3, `${rating}★ — reputation repair needed first`];
  else if (rating < 4) [pts, detail] = [6, `${rating}★ — review-generation gap to close`];
  else if (rating < 4.8) [pts, detail] = [8, `${rating}★ — well-run, growth-minded`];
  else [pts, detail] = [7, `${rating}★ — already polished`];
  factors.push(factor("reputation", "Reputation signal", pts, 8, detail));

  // 3. Website / digital gap (max 12). No website = the strongest automation-need
  //    signal; an already-sophisticated stack means slightly lower need.
  const wq = effectiveWebsiteQuality(input);
  const wqMap: Record<string, [number, string]> = {
    none: [12, "No website — running on phone + word of mouth"],
    broken: [10, "Website down/broken — digital presence neglected"],
    social_only: [9, "Social page instead of a website"],
    basic: [7, "Basic template site — little automation behind it"],
    unprobed: [6, "Website present (not yet probed)"],
    good: [5, "Healthy website — room for automation on top"],
    sophisticated: [2, "Modern stack already in place — lower need"],
  };
  [pts, detail] = wqMap[wq];
  factors.push(factor("website_gap", "Website / digital gap", pts, 12, detail));

  // 4. Employee count fit (max 12) — sweet spot is 3–50 employees: enough volume
  //    to feel the pain, small enough to lack internal ops/IT.
  const emp = input.employee_count;
  if (emp == null) [pts, detail] = [4, "Headcount unknown"];
  else if (emp <= 2) [pts, detail] = [5, `${emp} employees — very small`];
  else if (emp <= 9) [pts, detail] = [9, `${emp} employees — owner-operated team`];
  else if (emp <= 24) [pts, detail] = [12, `${emp} employees — prime SMB size`];
  else if (emp <= 49) [pts, detail] = [10, `${emp} employees — established operation`];
  else if (emp <= 99) [pts, detail] = [7, `${emp} employees — mid-market`];
  else [pts, detail] = [4, `${emp} employees — likely has internal ops`];
  factors.push(factor("employee_fit", "Employee count fit", pts, 12, detail));

  // 5. Revenue fit (max 10) — $1M–$5M businesses feel the pain and have budget.
  const rev = input.revenue_estimate;
  if (rev == null) [pts, detail] = [3, "Revenue unknown"];
  else if (rev < 250_000) [pts, detail] = [4, "Revenue under $250K — tight budget"];
  else if (rev < 1_000_000) [pts, detail] = [7, "Revenue $250K–$1M — growing"];
  else if (rev < 5_000_000) [pts, detail] = [10, "Revenue $1M–$5M — budget sweet spot"];
  else if (rev < 20_000_000) [pts, detail] = [8, "Revenue $5M–$20M — strong budget"];
  else [pts, detail] = [5, "Revenue $20M+ — enterprise buying process"];
  factors.push(factor("revenue_fit", "Revenue fit", pts, 10, detail));

  // 6. Business-model fit (max 15) — appointment-heavy / lead-gen-dependent /
  //    service-business models are where the automation catalog bites hardest.
  pts =
    profile.appointmentHeavy * 5 +
    profile.leadGenDependent * 5 +
    profile.serviceBusiness * 5;
  const traits = [
    profile.appointmentHeavy >= 0.6 ? "appointment-heavy" : null,
    profile.leadGenDependent >= 0.6 ? "lead-gen dependent" : null,
    profile.serviceBusiness >= 0.6 ? "field-service model" : null,
  ].filter(Boolean);
  factors.push(
    factor(
      "model_fit",
      "Business-model fit",
      pts,
      15,
      traits.length ? `Model is ${traits.join(", ")}` : "Lower-touch business model",
    ),
  );

  // 7. Automation catalog breadth (max 8) — how many catalog plays apply.
  const autoCount = automationsForIndustry(input.industry).length;
  if (autoCount >= 6) [pts, detail] = [8, `${autoCount} catalog automations apply`];
  else if (autoCount >= 4) [pts, detail] = [6, `${autoCount} catalog automations apply`];
  else if (autoCount >= 2) [pts, detail] = [4, `${autoCount} catalog automations apply`];
  else [pts, detail] = [2, `${autoCount} catalog automation applies`];
  factors.push(factor("automation_breadth", "Automation-opportunity breadth", pts, 8, detail));

  // 8. Multi-location (max 6) — multiplies value of every automation.
  factors.push(
    factor(
      "multi_location",
      "Multi-location",
      input.is_multi_location ? 6 : 0,
      6,
      input.is_multi_location
        ? `${input.location_count} locations under one brand`
        : "Single location",
    ),
  );

  // 9. Decision-maker reachability (max 8).
  const hasOwner = !!input.owner_name;
  const hasDirect = !!input.owner_email || !!input.owner_linkedin_url;
  if (hasOwner && hasDirect) [pts, detail] = [8, `Decision maker identified with direct channel`];
  else if (hasOwner) [pts, detail] = [6, "Decision maker identified"];
  else if (input.company_linkedin_url) [pts, detail] = [3, "Company LinkedIn only"];
  else [pts, detail] = [0, "No decision-maker data"];
  factors.push(factor("reachability", "Decision-maker reachability", pts, 8, detail));

  // 10. Growth indicators (max 6).
  pts = 0;
  const growthSignals: string[] = [];
  if (reviews >= 100 && (rating ?? 0) >= 4.3) {
    pts += 4;
    growthSignals.push("strong review velocity");
  }
  if ((emp ?? 0) >= 10) {
    pts += 2;
    growthSignals.push("double-digit headcount");
  }
  factors.push(
    factor(
      "growth",
      "Growth indicators",
      pts,
      6,
      growthSignals.length ? growthSignals.join(", ") : "No clear growth signals",
    ),
  );

  return factors;
}

// ── Close Probability (0–100) ────────────────────────────────────────────────

function closeProbabilityFactors(input: ScoringInput, profile: IndustryProfile): ScoreFactor[] {
  const factors: ScoreFactor[] = [];
  const reviews = input.review_count ?? 0;
  const rating = input.google_rating;
  let pts: number, detail: string;

  // 1. Reachability (max 25) — you can't close who you can't reach.
  if (input.owner_name && input.owner_email)
    [pts, detail] = [25, "Owner + direct email on file"];
  else if (input.owner_name && input.owner_linkedin_url)
    [pts, detail] = [20, "Owner + LinkedIn on file"];
  else if (input.owner_name) [pts, detail] = [14, "Owner identified, no direct channel"];
  else if (input.company_linkedin_url) [pts, detail] = [8, "Company LinkedIn only"];
  else [pts, detail] = [4, "Cold front desk only"];
  factors.push(factor("reach", "Reachability", pts, 25, detail));

  // 2. Decision speed by size (max 20) — small shops decide fast.
  const emp = input.employee_count;
  if (emp == null) [pts, detail] = [10, "Headcount unknown"];
  else if (emp <= 2) [pts, detail] = [14, "Owner decides, but budget is thin"];
  else if (emp <= 9) [pts, detail] = [20, "Owner-led, fast decision cycle"];
  else if (emp <= 24) [pts, detail] = [16, "Short management chain"];
  else if (emp <= 49) [pts, detail] = [10, "Some process to navigate"];
  else [pts, detail] = [6, "Committee-style buying likely"];
  factors.push(factor("decision_speed", "Decision speed (size)", pts, 20, detail));

  // 3. Need intensity (max 25) — visible operational pain closes deals.
  pts = 0;
  const pains: string[] = [];
  const wq = effectiveWebsiteQuality(input);
  if (wq === "none" || wq === "broken") {
    pts += 10;
    pains.push("no working website");
  } else if (wq === "social_only" || wq === "basic") {
    pts += 6;
    pains.push("thin web presence");
  } else if (wq === "unprobed" || wq === "good") {
    pts += 3;
  }
  if (rating != null && rating < 4 && reviews > 0) {
    pts += 5;
    pains.push("reputation gap");
  }
  if (reviews < 30) {
    pts += 5;
    pains.push("under-reviewed vs competitors");
  }
  if (profile.leadGenDependent >= 0.8) {
    pts += 5;
    pains.push("lives on inbound leads");
  }
  factors.push(
    factor("need", "Need intensity", Math.min(pts, 25), 25, pains.length ? pains.join(", ") : "Pain not visible from outside"),
  );

  // 4. Industry receptivity (max 15).
  pts = profile.closeRateFactor * 15;
  factors.push(
    factor("receptivity", "Industry receptivity", pts, 15, "How this industry historically buys automation"),
  );

  // 5. Established local presence (max 10) — they answer the phone, they exist.
  pts = 0;
  if (input.phone) pts += 4;
  if ((rating ?? 0) >= 4) pts += 3;
  if (reviews >= 20) pts += 3;
  factors.push(
    factor("established", "Established local presence", pts, 10, input.phone ? "Reachable, established profile" : "No phone listed"),
  );

  return factors;
}

// ── Estimated Monthly Contract Value ─────────────────────────────────────────
// Realistic SMB pricing: $300–$1,000/mo for most small service businesses,
// scaling toward $2,500+ only for multi-location / high-headcount operations.
// Hard caps make five-figure outputs impossible.

function contractValue(
  input: ScoringInput,
  profile: IndustryProfile,
): { value: number; breakdown: ScoreBreakdown["contractValue"] } {
  const base = profile.baseContractValue;
  const emp = input.employee_count;

  let empMult = 1.0;
  if (emp != null) {
    if (emp <= 2) empMult = 0.8;
    else if (emp <= 9) empMult = 1.0;
    else if (emp <= 24) empMult = 1.3;
    else if (emp <= 49) empMult = 1.6;
    else if (emp <= 99) empMult = 2.0;
    else empMult = 2.4;
  }

  const rev = input.revenue_estimate;
  let revMult = 1.0;
  if (rev != null) {
    if (rev < 250_000) revMult = 0.8;
    else if (rev < 1_000_000) revMult = 1.0;
    else if (rev < 5_000_000) revMult = 1.25;
    else revMult = 1.5;
  }

  const multiMult = input.is_multi_location ? 1.5 : 1.0;

  let value = base * empMult * revMult * multiMult;
  let capApplied: string | null = null;

  // Caps: a small single-location shop never gets an inflated number.
  if (!input.is_multi_location && (emp ?? 0) < 10 && value > 1200) {
    value = 1200;
    capApplied = "small single-location cap ($1,200)";
  } else if (!input.is_multi_location && (emp ?? 0) < 25 && value > 1800) {
    value = 1800;
    capApplied = "single-location cap ($1,800)";
  } else if (value > 4000) {
    value = 4000;
    capApplied = "absolute cap ($4,000)";
  }
  value = Math.max(300, Math.round(value / 50) * 50);

  return {
    value,
    breakdown: {
      base,
      employeeMultiplier: empMult,
      revenueMultiplier: revMult,
      multiLocationMultiplier: multiMult,
      capApplied,
    },
  };
}

// ── Entry point ──────────────────────────────────────────────────────────────

export function scoreBusiness(input: ScoringInput): ScoringResult {
  const profile = INDUSTRY_BY_SLUG[input.industry]?.profile ?? FALLBACK_PROFILE;

  const leadFactors = leadScoreFactors(input, profile);
  let leadScore = leadFactors.reduce((s, f) => s + f.points, 0);
  // Already-sophisticated digital natives need us slightly less.
  if (profile.digitallySavvy && effectiveWebsiteQuality(input) === "sophisticated") {
    leadScore -= 3;
  }
  leadScore = clamp(Math.round(leadScore), 0, 100);

  const closeFactors = closeProbabilityFactors(input, profile);
  const closeProb = clamp(
    Math.round(closeFactors.reduce((s, f) => s + f.points, 0)),
    5,
    95,
  );

  const { value, breakdown: valueBreakdown } = contractValue(input, profile);

  const automations = automationsForIndustry(input.industry).map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
  }));

  return {
    lead_score: leadScore,
    close_probability: closeProb,
    estimated_contract_value: value,
    expected_monthly_value: Math.round((value * closeProb) / 100),
    score_breakdown: {
      leadScore: leadFactors,
      closeProbability: closeFactors,
      contractValue: valueBreakdown,
    },
    automation_opportunities: automations,
  };
}
