/**
 * Brand-key normalization for multi-location detection.
 *
 * Two businesses sharing a brand_key are flagged as locations of the same
 * brand. Heuristic by design: strips legal suffixes, parentheticals, and
 * trailing " - <location>" segments, then squashes to alphanumerics.
 */
export function normalizeBrandKey(name: string): string {
  let n = name.toLowerCase().trim();
  // "Brand - Metairie", "Brand | Westbank", "Brand – Uptown" → "Brand"
  const split = n.split(/\s+[-|–—]\s+/)[0];
  if (split.length >= 4) n = split;
  n = n.replace(/\(.*?\)/g, " ");
  n = n.replace(
    /\b(llc|l\.l\.c\.|inc|inc\.|incorporated|corp|corporation|co\.|company|pllc|llp|l\.l\.p\.|p\.?c\.?|apc|ltd)\b/g,
    " ",
  );
  n = n.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  return n || name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
