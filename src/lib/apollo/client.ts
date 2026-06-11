import { requireEnv } from "../env";
import { logApiCall } from "../apiLog";
import { APOLLO_CALL_COST } from "../config/pricing";
import { RateLimiter, RetryableError, withRetries } from "../queue";

/**
 * Apollo.io enrichment client.
 *
 * Hard rules:
 *  - Enrichment is keyed on the business's website DOMAIN. No domain → no
 *    Apollo call: name-based matching risks attaching the wrong company's
 *    data to a lead, which is worse than a null.
 *  - Locked/placeholder emails ("email_not_unlocked@domain.com") are treated
 *    as null. We never store anything that isn't a real value from Apollo.
 *  - 429s honor Retry-After with exponential backoff; calls are serialized
 *    through a rate limiter so a long run can't trip plan limits.
 */

const APOLLO_BASE = "https://api.apollo.io/api/v1";

// ~1 request/600ms keeps us under typical Apollo per-minute limits with margin.
const apolloLimiter = new RateLimiter(600);

/** Apollo plan exhausted / forbidden — callers should stop the enrichment loop. */
export class ApolloQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApolloQuotaError";
  }
}

async function apolloFetch<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
  logMeta: Record<string, unknown>,
): Promise<T> {
  const apiKey = requireEnv("APOLLO_API_KEY");

  return apolloLimiter.run(() =>
    withRetries(
      async () => {
        const res = await fetch(`${APOLLO_BASE}${path}`, {
          method: init.method,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "x-api-key": apiKey,
          },
          body: init.body ? JSON.stringify(init.body) : undefined,
        }).catch((err) => {
          throw new RetryableError(`network error: ${err?.message ?? err}`);
        });

        await logApiCall({
          provider: "apollo",
          endpoint: path,
          estimatedCost: APOLLO_CALL_COST,
          meta: { ...logMeta, status: res.status },
        });

        if (res.status === 429) {
          const retryAfter = Number(res.headers.get("retry-after")) * 1000 || undefined;
          throw new RetryableError("Apollo rate limit (429)", retryAfter);
        }
        if (res.status >= 500) {
          throw new RetryableError(`Apollo server error ${res.status}`);
        }
        if (res.status === 403 || res.status === 402) {
          throw new ApolloQuotaError(`Apollo quota/permission error ${res.status}: ${await res.text()}`);
        }
        if (!res.ok) {
          throw new Error(`Apollo error ${res.status}: ${await res.text()}`);
        }
        return (await res.json()) as T;
      },
      { label: `apollo ${path}` },
    ),
  );
}

// ── Organization enrichment ──────────────────────────────────────────────────

export interface ApolloOrganization {
  id?: string;
  name?: string;
  website_url?: string;
  linkedin_url?: string;
  estimated_num_employees?: number;
  annual_revenue?: number;
  organization_revenue?: number;
  industry?: string;
  short_description?: string;
  founded_year?: number;
  primary_domain?: string;
}

export async function enrichOrganization(domain: string): Promise<ApolloOrganization | null> {
  const data = await apolloFetch<{ organization?: ApolloOrganization | null }>(
    `/organizations/enrich?domain=${encodeURIComponent(domain)}`,
    { method: "GET" },
    { domain },
  );
  return data.organization ?? null;
}

// ── Decision-maker search ────────────────────────────────────────────────────

/** Title priority — first match wins when ranking candidates. */
const TITLE_PRIORITY = [
  "owner",
  "founder",
  "co-founder",
  "ceo",
  "chief executive",
  "president",
  "managing partner",
  "partner",
  "principal",
  "managing member",
  "office manager",
  "practice manager",
  "general manager",
];

export interface ApolloPerson {
  id?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string | null;
  email_status?: string | null;
  linkedin_url?: string | null;
}

function titleRank(title: string | undefined): number {
  if (!title) return TITLE_PRIORITY.length;
  const t = title.toLowerCase();
  const idx = TITLE_PRIORITY.findIndex((p) => t.includes(p));
  return idx === -1 ? TITLE_PRIORITY.length : idx;
}

/** Strip Apollo's locked-email placeholders — better null than a fake address. */
export function sanitizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  if (!e.includes("@")) return null;
  if (e.includes("email_not_unlocked") || e.endsWith("@domain.com")) return null;
  return e;
}

export async function findDecisionMaker(domain: string): Promise<ApolloPerson | null> {
  const data = await apolloFetch<{ people?: ApolloPerson[]; contacts?: ApolloPerson[] }>(
    "/mixed_people/search",
    {
      method: "POST",
      body: {
        q_organization_domains_list: [domain],
        person_titles: TITLE_PRIORITY,
        page: 1,
        per_page: 10,
      },
    },
    { domain },
  );

  const candidates = [...(data.people ?? []), ...(data.contacts ?? [])].filter(
    (p) => p?.name || (p?.first_name && p?.last_name),
  );
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => titleRank(a.title) - titleRank(b.title));
  return candidates[0];
}

// ── Domain extraction ────────────────────────────────────────────────────────

/** Hosts that aren't a company's own domain — useless for Apollo matching. */
const NON_COMPANY_HOSTS = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "yelp.com",
  "google.com",
  "linktr.ee",
  "business.site",
  "wixsite.com",
  "squarespace.com",
  "godaddysites.com",
];

export function extractEnrichableDomain(website: string | null): string | null {
  if (!website) return null;
  try {
    const host = new URL(website).hostname.replace(/^www\./i, "").toLowerCase();
    if (!host.includes(".")) return null;
    if (NON_COMPANY_HOSTS.some((bad) => host === bad || host.endsWith(`.${bad}`))) return null;
    return host;
  } catch {
    return null;
  }
}
