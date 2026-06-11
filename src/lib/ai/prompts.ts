import { industryLabel } from "../config/industries";
import { formatRevenue } from "../format";
import type { AiContentType, Business } from "../types";

/**
 * Prompt construction for the qualitative AI outputs. The fact sheet is built
 * ONLY from data we actually hold — anything unknown is stated as unknown so
 * the model has nothing to hallucinate around, and the system prompt forbids
 * inventing details outright.
 */

export const AI_CONTENT_TYPES: AiContentType[] = [
  "summary",
  "cold_email",
  "call_script",
  "linkedin_message",
  "follow_up_email",
];

export const AI_CONTENT_LABEL: Record<AiContentType, string> = {
  summary: "Prospect Summary",
  cold_email: "Cold Email",
  call_script: "Cold-Call Script",
  linkedin_message: "LinkedIn Message",
  follow_up_email: "Follow-up Email",
};

const WEBSITE_FACT: Record<string, string> = {
  none: "No website at all — they run on phone calls and word of mouth.",
  broken: "Their website is broken or unreachable.",
  social_only: "No real website — just a social media page.",
  basic: "Only a thin template website with no automation behind it.",
  good: "A healthy standard website.",
  sophisticated: "A modern website with online booking/automation tooling already in place.",
};

export function buildFactSheet(b: Business): string {
  const lines: string[] = [];
  const fact = (label: string, value: string | null | undefined) => {
    if (value) lines.push(`- ${label}: ${value}`);
  };

  fact("Business", b.name);
  fact("Industry", industryLabel(b.industry));
  fact("Location", [b.city, b.state ?? "LA"].filter(Boolean).join(", "));
  fact(
    "Google reputation",
    b.review_count != null
      ? `${b.google_rating ?? "unrated"}★ across ${b.review_count} reviews`
      : null,
  );
  fact("Web presence", b.website_quality ? WEBSITE_FACT[b.website_quality] : b.website ? "Has a website (not assessed)." : WEBSITE_FACT.none);
  fact(
    "Decision maker",
    b.owner_name ? `${b.owner_name}${b.owner_title ? ` (${b.owner_title})` : ""}` : "UNKNOWN — do not invent a name; address the business itself",
  );
  fact("Employees", b.employee_count != null ? String(b.employee_count) : null);
  fact("Estimated revenue", b.revenue_estimate != null ? formatRevenue(b.revenue_estimate) : null);
  fact("Founded", b.founded_year != null ? String(b.founded_year) : null);
  if (b.is_multi_location) fact("Locations", `${b.location_count} locations under the same brand`);
  if (b.company_description) {
    fact("Company description", b.company_description.slice(0, 400));
  }

  if (b.automation_opportunities?.length) {
    lines.push("- Catalog automations that fit this business (recommend ONLY from this list):");
    for (const a of b.automation_opportunities) {
      lines.push(`    • ${a.name} — ${a.description}`);
    }
  }

  if (b.score_breakdown?.leadScore?.length) {
    const top = [...b.score_breakdown.leadScore]
      .sort((x, y) => y.points / y.max - x.points / x.max)
      .slice(0, 4)
      .map((f) => f.detail);
    lines.push(`- Why our scoring engine rates them (Lead Score ${b.lead_score}/100): ${top.join("; ")}`);
  }
  if (b.estimated_contract_value != null) {
    fact("Our realistic monthly retainer for them", `$${b.estimated_contract_value}/month`);
  }

  return lines.join("\n");
}

export const SYSTEM_PROMPT = `You write sales materials for a small New Orleans-based consultancy that sells AI automation services to local service businesses, on retainers between $300 and $2,500 per month.

Non-negotiable rules:
- Use ONLY the facts in the fact sheet. NEVER invent names, numbers, tools, results, case studies, or details of any kind.
- If the decision maker is unknown, address the business itself (e.g. "Hi there," or "to the team at <business>"). Never guess a person's name.
- Recommend only automations listed in the fact sheet — they come from our actual service catalog.
- Sound like a local operator talking to another operator: plain, direct, specific. No hype words (revolutionize, unlock, supercharge, game-changer), no exclamation marks.
- Plain text only — no markdown formatting. The only placeholders allowed are [Your Name] and [Your Phone].
- A light New Orleans-area touch is welcome when natural, never forced.`;

const TYPE_PROMPTS: Record<AiContentType, string> = {
  summary: `Write an internal prospect summary for our sales team in three short paragraphs:
1) What this business is and how it likely operates day to day.
2) Why they are (or aren't) a strong automation prospect, grounded in the fact sheet.
3) The opening angle to use and the two or three catalog automations to lead with, and why those.
Keep it around 150 words. No greeting, no sign-off.`,

  cold_email: `Write a cold email to this business.
- First line: "Subject: " followed by a specific, non-clickbait subject.
- Under 140 words of body.
- Open with something specific to THEM from the fact sheet (their reviews, missing website, multiple locations, etc.).
- Pitch the single most relevant catalog automation with the concrete operational outcome it buys them.
- Close with a one-sentence ask for a 15-minute call.
- Sign off with [Your Name] and [Your Phone].`,

  call_script: `Write a cold-call script with these labeled sections, giving the exact words to say:
OPENER (10 seconds, name the business, why you're calling them specifically)
REASON FOR CALL (tie to a fact about them)
DISCOVERY QUESTION (one question about the pain the best-fit automation solves)
PITCH (the most relevant catalog automation, outcome-first)
IF "WE'RE TOO BUSY" (response)
IF "WE ALREADY HANDLE THAT" (response)
CLOSE (ask for a 15-minute meeting, offer two time options)`,

  linkedin_message: `Write two pieces, labeled exactly:
CONNECTION REQUEST: a LinkedIn connection note under 280 characters referencing something specific about their business. No links.
FOLLOW-UP DM: a message under 80 words to send after they accept, raising the most relevant catalog automation and a soft ask to compare notes. No links.`,

  follow_up_email: `Write a follow-up email assuming the first cold email got no reply four days ago.
- First line: "Subject: " followed by the subject (a fresh angle, not "following up").
- Under 90 words of body.
- Lead with a DIFFERENT catalog automation or angle than the most obvious one.
- No guilt-tripping. End with an easy out ("if this isn't a priority, tell me and I'll close the file").
- Sign off with [Your Name].`,
};

export function buildUserPrompt(b: Business, type: AiContentType): string {
  return `FACT SHEET
${buildFactSheet(b)}

TASK
${TYPE_PROMPTS[type]}`;
}
