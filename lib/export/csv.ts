/**
 * CSV writer for exports (RFC 4180 quoting + spreadsheet formula injection
 * protection).
 *
 * - Cells containing a comma, quote, CR or LF are wrapped in double quotes and
 *   inner quotes are doubled.
 * - Cells that start with `=`, `+`, `-`, `@` (or a tab / carriage return,
 *   which some spreadsheet apps strip before evaluating) are prefixed with a
 *   single quote so Excel, Numbers and Sheets show them as text instead of
 *   running them as formulas.
 */

const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"]);

export type CsvValue = string | number | boolean | null | undefined;

export function escapeCsvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (text.length > 0 && FORMULA_TRIGGERS.has(text[0])) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  // CRLF line endings per RFC 4180; a BOM so Excel detects UTF-8.
  return "﻿" + [header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n") + "\r\n";
}

/** Safe file name part: letters, numbers, dashes. */
export function fileSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "export";
}
