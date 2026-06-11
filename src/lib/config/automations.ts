import { INDUSTRY_BY_SLUG, type IndustryDef } from "./industries";

/**
 * The Automation Catalog. Every automation recommendation anywhere in the app
 * (scoring fit factor, side-panel "Automation Opportunities", AI outreach copy)
 * is drawn from this list — nothing is invented outside of it.
 *
 * `fit` is either an explicit list of industry slugs or a rule evaluated
 * against the industry profile (used for catalog entries the spec defines
 * behaviorally, e.g. "every lead-gen business").
 */
export interface AutomationDef {
  id: string;
  name: string;
  description: string;
  fit: { industries: string[] } | { rule: "lead_gen" | "invoicing" | "all" };
}

export const AUTOMATION_CATALOG: AutomationDef[] = [
  {
    id: "speed_to_lead",
    name: "Speed-to-lead response",
    description: "Instant text/email reply to every new inbound lead before a competitor calls back.",
    fit: { rule: "lead_gen" },
  },
  {
    id: "missed_call_textback",
    name: "Missed-call text-back",
    description: "Automatic text when a call goes unanswered, so the caller doesn't dial the next shop.",
    fit: { industries: ["hvac", "plumbing", "electrical", "roofing", "auto_repair"] },
  },
  {
    id: "quote_follow_up",
    name: "Estimate / quote follow-up",
    description: "Timed follow-up sequence on every open quote until it's won or dead.",
    fit: { industries: ["hvac", "plumbing", "electrical", "roofing", "construction", "home_services", "auto_repair"] },
  },
  {
    id: "auto_invoicing",
    name: "Auto invoicing + payment reminders",
    description: "Invoice on job completion with escalating payment reminders.",
    fit: { rule: "invoicing" },
  },
  {
    id: "appointment_reminders",
    name: "Appointment reminders + no-show reduction",
    description: "Confirm / remind / day-of texts that cut no-shows on a booked calendar.",
    fit: { industries: ["dental", "medical", "orthodontist", "med_spa", "fitness", "auto_repair"] },
  },
  {
    id: "review_generation",
    name: "Review generation",
    description: "Automatic review request after every completed job or visit.",
    fit: { rule: "all" },
  },
  {
    id: "reactivation_recall",
    name: "Reactivation / recall",
    description: "Win-back campaigns for lapsed customers and overdue recalls.",
    fit: { industries: ["dental", "auto_repair", "med_spa", "fitness", "home_services"] },
  },
  {
    id: "client_intake",
    name: "Client intake automation",
    description: "Lead capture + conflict check + routing for new client intake.",
    fit: { industries: ["law_firm", "accounting"] },
  },
  {
    id: "online_booking_recovery",
    name: "Online booking + abandoned-booking recovery",
    description: "Self-serve booking with automatic recovery of abandoned booking sessions.",
    fit: { industries: ["med_spa", "fitness"] },
  },
  {
    id: "cancellation_backfill",
    name: "Cancellation backfill (waitlist)",
    description: "Instantly fill cancelled slots from a standing waitlist.",
    fit: { industries: ["med_spa", "dental", "orthodontist"] },
  },
  {
    id: "membership_renewal",
    name: "Membership / renewal sequences",
    description: "Automated membership, maintenance-contract, and renewal sequences.",
    fit: { industries: ["fitness", "insurance", "hvac", "plumbing"] },
  },
  {
    id: "transaction_coordination",
    name: "Transaction coordination",
    description: "Deadline tracking across every active transaction.",
    fit: { industries: ["real_estate"] },
  },
  {
    id: "maintenance_triage",
    name: "Maintenance triage + vendor dispatch",
    description: "Intake, triage, and vendor dispatch for maintenance requests.",
    fit: { industries: ["property_management"] },
  },
  {
    id: "policy_renewal",
    name: "Policy renewal pipeline",
    description: "Renewal pipeline that touches every policyholder before expiration.",
    fit: { industries: ["insurance"] },
  },
  {
    id: "document_collection",
    name: "Document collection",
    description: "Automated chasing and collection of client documents.",
    fit: { industries: ["accounting", "law_firm"] },
  },
  {
    id: "status_updates",
    name: "Status updates ('is it ready yet?')",
    description: "Proactive job-status texts that eliminate inbound 'is it ready' calls.",
    fit: { industries: ["auto_repair", "construction"] },
  },
];

function automationApplies(item: AutomationDef, def: IndustryDef): boolean {
  if ("industries" in item.fit) return item.fit.industries.includes(def.slug);
  switch (item.fit.rule) {
    case "all":
      return true;
    case "lead_gen":
      return def.profile.leadGenDependent >= 0.6;
    case "invoicing":
      return def.profile.invoicing;
  }
}

/** All catalog automations that apply to an industry slug. */
export function automationsForIndustry(slug: string): AutomationDef[] {
  const def = INDUSTRY_BY_SLUG[slug];
  if (!def) return AUTOMATION_CATALOG.filter((a) => "rule" in a.fit && a.fit.rule === "all");
  return AUTOMATION_CATALOG.filter((a) => automationApplies(a, def));
}
