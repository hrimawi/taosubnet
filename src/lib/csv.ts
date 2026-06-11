/** Minimal CSV serializer (RFC 4180 quoting + UTF-8 BOM so Excel opens it cleanly). */

type Cell = string | number | boolean | null | undefined;

function escapeCell(v: Cell): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) lines.push(row.map(escapeCell).join(","));
  return "\uFEFF" + lines.join("\r\n");
}
