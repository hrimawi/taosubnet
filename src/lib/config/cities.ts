/**
 * Geographic coverage for the Greater New Orleans metro.
 * Each city gets one Places text search per industry (cached for 30 days).
 */
export const COVERAGE_CITIES = [
  "New Orleans",
  "Harvey",
  "Gretna",
  "Marrero",
  "Westwego",
  "Terrytown",
  "Belle Chasse",
  "Chalmette",
  "Arabi",
  "Meraux",
  "Metairie",
  "Kenner",
  "River Ridge",
  "Harahan",
  "Jefferson",
  "Elmwood",
  "Avondale",
  "Waggaman",
  "Laplace",
  "Destrehan",
  "Luling",
  "Slidell",
  "Mandeville",
  "Covington",
  "Madisonville",
  "Abita Springs",
] as const;

export type CoverageCity = (typeof COVERAGE_CITIES)[number];

/**
 * Loose bounding box around the metro. Text search can return results from
 * neighboring regions; anything outside this box is discarded so the map and
 * scores stay focused on the territory we actually sell into.
 */
export const METRO_BOUNDS = {
  minLat: 29.5,
  maxLat: 30.7,
  minLng: -90.95,
  maxLng: -89.4,
};

/** Default map viewport (roughly centered between the river parishes and the Northshore). */
export const MAP_CENTER = { lat: 30.0, lng: -90.1 };
export const MAP_DEFAULT_ZOOM = 10;

export function isInsideMetro(lat: number | null, lng: number | null): boolean {
  if (lat == null || lng == null) return false;
  return (
    lat >= METRO_BOUNDS.minLat &&
    lat <= METRO_BOUNDS.maxLat &&
    lng >= METRO_BOUNDS.minLng &&
    lng <= METRO_BOUNDS.maxLng
  );
}
