/**
 * Free website-quality probe: one HTTP GET per business, no API cost.
 * Feeds the "website quality" and "digital sophistication" scoring factors.
 * Best-effort by design — any failure degrades to a classification, never an exception.
 */
import type { WebsiteQuality } from "../types";

export interface ProbeResult {
  quality: WebsiteQuality;
  status: number | null;
  https: boolean;
  markers: string[];
  checkedAt: string;
}

/** Booking/ops platforms — finding one means real automation already in place. */
const SOPHISTICATED_MARKERS = [
  "calendly",
  "acuityscheduling",
  "housecallpro",
  "servicetitan",
  "getjobber",
  "mindbody",
  "janeapp",
  "getweave",
  "podium",
  "nexhealth",
  "zocdoc",
  "localmed",
  "schedulicity",
  "booksy",
  "intercom",
  "hubspot",
  "drift.com",
  "book online",
  "schedule online",
];

/** Site-builder hosts that usually mean a thin template site. */
const BASIC_MARKERS = ["wixsite", "wix.com", "godaddysites", "weebly", "site123", "duda"];

const SOCIAL_HOSTS = ["facebook.com", "instagram.com", "linktr.ee", "yelp.com"];

export async function probeWebsite(website: string | null): Promise<ProbeResult> {
  const checkedAt = new Date().toISOString();
  if (!website) return { quality: "none", status: null, https: false, markers: [], checkedAt };

  let url: URL;
  try {
    url = new URL(website);
  } catch {
    return { quality: "broken", status: null, https: false, markers: ["invalid-url"], checkedAt };
  }

  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (SOCIAL_HOSTS.some((s) => host === s || host.endsWith(`.${s}`))) {
    return { quality: "social_only", status: null, https: url.protocol === "https:", markers: ["social-host"], checkedAt };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; NolaLeadIntel/1.0; website quality check)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const https = res.url.startsWith("https:");

    if (res.status >= 400) {
      return { quality: "broken", status: res.status, https, markers: [], checkedAt };
    }

    // Final destination may itself be a social page.
    const finalHost = new URL(res.url).hostname.replace(/^www\./i, "").toLowerCase();
    if (SOCIAL_HOSTS.some((s) => finalHost === s || finalHost.endsWith(`.${s}`))) {
      return { quality: "social_only", status: res.status, https, markers: ["redirects-to-social"], checkedAt };
    }

    const html = (await res.text()).slice(0, 250_000).toLowerCase();
    const markers: string[] = [];
    for (const m of SOPHISTICATED_MARKERS) if (html.includes(m)) markers.push(m);
    if (markers.length > 0) {
      return { quality: "sophisticated", status: res.status, https, markers, checkedAt };
    }
    for (const m of BASIC_MARKERS) {
      if (html.includes(m) || finalHost.includes(m)) markers.push(m);
    }
    if (markers.length > 0 || !https) {
      return { quality: "basic", status: res.status, https, markers, checkedAt };
    }
    return { quality: "good", status: res.status, https, markers, checkedAt };
  } catch {
    return { quality: "broken", status: null, https: false, markers: ["unreachable"], checkedAt };
  } finally {
    clearTimeout(timer);
  }
}
