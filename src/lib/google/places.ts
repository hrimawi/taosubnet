import { requireEnv } from "../env";
import { logApiCall } from "../apiLog";
import { GOOGLE_TEXT_SEARCH_COST } from "../config/pricing";
import { RateLimiter, RetryableError, withRetries, sleep } from "../queue";

/**
 * Places API (New) Text Search client — places.googleapis.com/v1/places:searchText.
 * This is the NEW API (field-mask based), not the legacy Places API.
 */

const PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

/**
 * Field mask — request exactly what we store, nothing more. Adding fields can
 * bump the request into a more expensive SKU; trim with care.
 */
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.types",
  "places.primaryType",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.businessStatus",
  "nextPageToken",
].join(",");

export interface GooglePlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  primaryType?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
}

interface SearchTextResponse {
  places?: GooglePlace[];
  nextPageToken?: string;
}

// Modest pacing so a 468-query collection run stays well inside Google QPS limits.
const googleLimiter = new RateLimiter(250);

async function searchTextPage(
  textQuery: string,
  pageToken?: string,
): Promise<SearchTextResponse> {
  const apiKey = requireEnv(
    "GOOGLE_MAPS_API_KEY",
    "Server-side key with Places API (New) enabled.",
  );

  return googleLimiter.run(() =>
    withRetries(
      async () => {
        const res = await fetch(PLACES_SEARCH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": FIELD_MASK,
          },
          body: JSON.stringify({
            textQuery,
            pageSize: 20,
            ...(pageToken ? { pageToken } : {}),
          }),
        }).catch((err) => {
          throw new RetryableError(`network error: ${err?.message ?? err}`);
        });

        // Each page request is a billable Text Search call.
        await logApiCall({
          provider: "google",
          endpoint: "places:searchText",
          estimatedCost: GOOGLE_TEXT_SEARCH_COST,
          meta: { query: textQuery, page: pageToken ? "next" : "first", status: res.status },
        });

        if (res.status === 429 || res.status >= 500) {
          const retryAfter = Number(res.headers.get("retry-after")) * 1000 || undefined;
          throw new RetryableError(`Google ${res.status}: ${await res.text()}`, retryAfter);
        }
        if (!res.ok) {
          throw new Error(`Google Places error ${res.status}: ${await res.text()}`);
        }
        return (await res.json()) as SearchTextResponse;
      },
      { label: `places:searchText "${textQuery}"` },
    ),
  );
}

/**
 * Run a text search and follow nextPageToken (max 3 pages ≈ 60 results, the
 * API ceiling). Returns places + the number of billable page requests made.
 */
export async function searchTextAll(
  textQuery: string,
  maxPages = 3,
): Promise<{ places: GooglePlace[]; pagesFetched: number }> {
  const places: GooglePlace[] = [];
  let pageToken: string | undefined;
  let pagesFetched = 0;

  for (let page = 0; page < maxPages; page++) {
    const data = await searchTextPage(textQuery, pageToken);
    pagesFetched++;
    if (data.places?.length) places.push(...data.places);
    pageToken = data.nextPageToken;
    if (!pageToken) break;
    // Give the token a moment to become active before requesting the next page.
    await sleep(1500);
  }
  return { places, pagesFetched };
}

/** Pull city / postal code / street out of addressComponents. */
export function parseAddressComponents(place: GooglePlace): {
  city: string | null;
  postalCode: string | null;
  streetAddress: string | null;
  state: string | null;
} {
  const comps = place.addressComponents ?? [];
  const byType = (t: string) => comps.find((c) => c.types?.includes(t));
  const city =
    byType("locality")?.longText ??
    byType("sublocality")?.longText ??
    byType("administrative_area_level_3")?.longText ??
    null;
  const postalCode = byType("postal_code")?.longText ?? null;
  const streetNumber = byType("street_number")?.longText ?? "";
  const route = byType("route")?.longText ?? "";
  const streetAddress = [streetNumber, route].filter(Boolean).join(" ") || null;
  const state = byType("administrative_area_level_1")?.shortText ?? null;
  return { city, postalCode, streetAddress, state };
}
