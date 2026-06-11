/**
 * Target industries. Each definition carries:
 *  - the Places (New) text-search query template,
 *  - Google primary types that map back to the industry (used to re-classify
 *    results that surface in a neighboring industry's search),
 *  - a business-model profile consumed by the deterministic scoring engine.
 *
 * Profile fields are 0–1 weights describing the operating model:
 *  appointmentHeavy  – revenue depends on a booked calendar (no-shows hurt)
 *  leadGenDependent  – revenue depends on inbound lead flow (speed-to-lead wins)
 *  serviceBusiness   – field/home-service operating model (trucks, jobs, quotes)
 *  invoicing         – bills customers after work is performed
 *  closeRateFactor   – relative receptivity to a $300–$2,500/mo automation pitch
 *  baseContractValue – realistic monthly retainer anchor for a small shop ($)
 *  digitallySavvy    – industry baseline sophistication (savvy ⇒ slightly lower need)
 */
export interface IndustryProfile {
  appointmentHeavy: number;
  leadGenDependent: number;
  serviceBusiness: number;
  invoicing: boolean;
  closeRateFactor: number;
  baseContractValue: number;
  digitallySavvy: boolean;
}

export interface IndustryDef {
  slug: string;
  label: string;
  searchQuery: string; // becomes `${searchQuery} in ${city}, Louisiana`
  googleTypes: string[];
  profile: IndustryProfile;
}

export const INDUSTRIES: IndustryDef[] = [
  {
    slug: "law_firm",
    label: "Law Firm",
    searchQuery: "law firm",
    googleTypes: ["lawyer", "legal_services"],
    profile: {
      appointmentHeavy: 0.6,
      leadGenDependent: 0.9,
      serviceBusiness: 0.2,
      invoicing: true,
      closeRateFactor: 0.5,
      baseContractValue: 600,
      digitallySavvy: false,
    },
  },
  {
    slug: "hvac",
    label: "HVAC",
    searchQuery: "HVAC contractor",
    googleTypes: ["hvac_contractor", "air_conditioning_contractor"],
    profile: {
      appointmentHeavy: 0.8,
      leadGenDependent: 0.9,
      serviceBusiness: 1,
      invoicing: true,
      closeRateFactor: 0.65,
      baseContractValue: 550,
      digitallySavvy: false,
    },
  },
  {
    slug: "plumbing",
    label: "Plumbing",
    searchQuery: "plumber",
    googleTypes: ["plumber"],
    profile: {
      appointmentHeavy: 0.8,
      leadGenDependent: 0.9,
      serviceBusiness: 1,
      invoicing: true,
      closeRateFactor: 0.65,
      baseContractValue: 500,
      digitallySavvy: false,
    },
  },
  {
    slug: "electrical",
    label: "Electrical Contractor",
    searchQuery: "electrician",
    googleTypes: ["electrician"],
    profile: {
      appointmentHeavy: 0.7,
      leadGenDependent: 0.85,
      serviceBusiness: 1,
      invoicing: true,
      closeRateFactor: 0.6,
      baseContractValue: 450,
      digitallySavvy: false,
    },
  },
  {
    slug: "roofing",
    label: "Roofing",
    searchQuery: "roofing contractor",
    googleTypes: ["roofing_contractor"],
    profile: {
      appointmentHeavy: 0.6,
      leadGenDependent: 0.95,
      serviceBusiness: 1,
      invoicing: true,
      closeRateFactor: 0.6,
      baseContractValue: 550,
      digitallySavvy: false,
    },
  },
  {
    slug: "construction",
    label: "Construction",
    searchQuery: "construction company",
    googleTypes: ["general_contractor", "construction_company"],
    profile: {
      appointmentHeavy: 0.4,
      leadGenDependent: 0.8,
      serviceBusiness: 0.9,
      invoicing: true,
      closeRateFactor: 0.5,
      baseContractValue: 500,
      digitallySavvy: false,
    },
  },
  {
    slug: "real_estate",
    label: "Real Estate Brokerage",
    searchQuery: "real estate brokerage",
    googleTypes: ["real_estate_agency"],
    profile: {
      appointmentHeavy: 0.5,
      leadGenDependent: 0.95,
      serviceBusiness: 0.3,
      invoicing: false,
      closeRateFactor: 0.5,
      baseContractValue: 450,
      digitallySavvy: true,
    },
  },
  {
    slug: "property_management",
    label: "Property Management",
    searchQuery: "property management company",
    googleTypes: ["property_management_company"],
    profile: {
      appointmentHeavy: 0.3,
      leadGenDependent: 0.6,
      serviceBusiness: 0.8,
      invoicing: true,
      closeRateFactor: 0.55,
      baseContractValue: 550,
      digitallySavvy: false,
    },
  },
  {
    slug: "insurance",
    label: "Insurance Agency",
    searchQuery: "insurance agency",
    googleTypes: ["insurance_agency"],
    profile: {
      appointmentHeavy: 0.4,
      leadGenDependent: 0.85,
      serviceBusiness: 0.3,
      invoicing: false,
      closeRateFactor: 0.5,
      baseContractValue: 400,
      digitallySavvy: false,
    },
  },
  {
    slug: "medical",
    label: "Medical Practice",
    searchQuery: "medical clinic",
    googleTypes: ["doctor", "medical_clinic", "medical_office"],
    profile: {
      appointmentHeavy: 0.95,
      leadGenDependent: 0.6,
      serviceBusiness: 0.2,
      invoicing: true,
      closeRateFactor: 0.45,
      baseContractValue: 650,
      digitallySavvy: false,
    },
  },
  {
    slug: "dental",
    label: "Dental Office",
    searchQuery: "dental office",
    googleTypes: ["dentist", "dental_clinic"],
    profile: {
      appointmentHeavy: 0.95,
      leadGenDependent: 0.7,
      serviceBusiness: 0.2,
      invoicing: true,
      closeRateFactor: 0.55,
      baseContractValue: 650,
      digitallySavvy: false,
    },
  },
  {
    slug: "orthodontist",
    label: "Orthodontist",
    searchQuery: "orthodontist",
    googleTypes: ["orthodontist"],
    profile: {
      appointmentHeavy: 0.95,
      leadGenDependent: 0.8,
      serviceBusiness: 0.2,
      invoicing: true,
      closeRateFactor: 0.55,
      baseContractValue: 750,
      digitallySavvy: false,
    },
  },
  {
    slug: "med_spa",
    label: "Med Spa",
    searchQuery: "med spa",
    googleTypes: ["medical_spa", "spa"],
    profile: {
      appointmentHeavy: 0.95,
      leadGenDependent: 0.85,
      serviceBusiness: 0.2,
      invoicing: false,
      closeRateFactor: 0.6,
      baseContractValue: 650,
      digitallySavvy: false,
    },
  },
  {
    slug: "auto_repair",
    label: "Auto Repair",
    searchQuery: "auto repair shop",
    googleTypes: ["car_repair", "auto_body_shop"],
    profile: {
      appointmentHeavy: 0.7,
      leadGenDependent: 0.7,
      serviceBusiness: 0.9,
      invoicing: true,
      closeRateFactor: 0.6,
      baseContractValue: 400,
      digitallySavvy: false,
    },
  },
  {
    slug: "fitness",
    label: "Fitness Center",
    searchQuery: "gym",
    googleTypes: ["gym", "fitness_center"],
    profile: {
      appointmentHeavy: 0.8,
      leadGenDependent: 0.8,
      serviceBusiness: 0.2,
      invoicing: false,
      closeRateFactor: 0.5,
      baseContractValue: 350,
      digitallySavvy: false,
    },
  },
  {
    slug: "marketing_agency",
    label: "Marketing Agency",
    searchQuery: "marketing agency",
    googleTypes: ["marketing_agency", "advertising_agency"],
    profile: {
      appointmentHeavy: 0.2,
      leadGenDependent: 0.7,
      serviceBusiness: 0.2,
      invoicing: true,
      closeRateFactor: 0.45,
      baseContractValue: 450,
      digitallySavvy: true,
    },
  },
  {
    slug: "accounting",
    label: "Accounting Firm",
    searchQuery: "accounting firm",
    googleTypes: ["accounting", "accountant"],
    profile: {
      appointmentHeavy: 0.5,
      leadGenDependent: 0.6,
      serviceBusiness: 0.2,
      invoicing: true,
      closeRateFactor: 0.5,
      baseContractValue: 450,
      digitallySavvy: false,
    },
  },
  {
    slug: "home_services",
    label: "Home Services",
    searchQuery: "handyman",
    googleTypes: ["handyman"],
    profile: {
      appointmentHeavy: 0.6,
      leadGenDependent: 0.8,
      serviceBusiness: 1,
      invoicing: true,
      closeRateFactor: 0.6,
      baseContractValue: 400,
      digitallySavvy: false,
    },
  },
];

export const INDUSTRY_BY_SLUG: Record<string, IndustryDef> = Object.fromEntries(
  INDUSTRIES.map((i) => [i.slug, i]),
);

/** Reverse lookup: Google primary type → our industry slug. */
const TYPE_TO_INDUSTRY: Record<string, string> = {};
for (const def of INDUSTRIES) {
  for (const t of def.googleTypes) TYPE_TO_INDUSTRY[t] = def.slug;
}

/**
 * Classify a place. Prefer the Google primary type when it unambiguously maps
 * to one of our industries (an "orthodontist" search returns plain dentists;
 * this puts them in the right bucket), otherwise trust the query's industry.
 */
export function classifyIndustry(
  primaryType: string | null | undefined,
  queryIndustrySlug: string,
): string {
  if (primaryType && TYPE_TO_INDUSTRY[primaryType]) return TYPE_TO_INDUSTRY[primaryType];
  return queryIndustrySlug;
}

export function industryLabel(slug: string | null | undefined): string {
  if (!slug) return "Unknown";
  return INDUSTRY_BY_SLUG[slug]?.label ?? slug;
}
