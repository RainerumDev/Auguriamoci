/** Google Sheets API v4 connector (read-only). */
import { googleGet } from "./api";

export interface SheetPayload {
  /** First row of the sheet, used for column mapping. */
  header: string[];
  /** Data rows (header excluded), aligned with `header` by index. */
  rows: string[][];
}

/**
 * Accepts a full Sheets URL or a bare spreadsheet ID.
 * https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0 -> <ID>
 */
export function extractSheetId(input: string): string | null {
  const trimmed = input.trim();
  const fromUrl = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(trimmed);
  if (fromUrl) return fromUrl[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(trimmed) ? trimmed : null;
}

/**
 * Download the whole used range of one sheet tab.
 * @param range Tab name (e.g. "Foglio1"); empty = first visible tab.
 */
export async function fetchSheet(
  sheetId: string,
  range: string,
  accessToken: string,
): Promise<SheetPayload> {
  const effectiveRange = range.trim() ? `${quoteTab(range.trim())}!A:ZZ` : "A:ZZ";
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}` +
    `/values/${encodeURIComponent(effectiveRange)}?majorDimension=ROWS`;
  const data = await googleGet<{ values?: string[][] }>(url, accessToken);
  const values = data.values ?? [];
  const [header = [], ...rows] = values;
  return { header: header.map((h) => h.trim()), rows };
}

function quoteTab(tab: string): string {
  // Tab names with spaces or quotes must be single-quoted in A1 notation.
  return /^[A-Za-z0-9_]+$/.test(tab) ? tab : `'${tab.replaceAll("'", "''")}'`;
}

/** Turn rows into objects keyed by header name (empty cells = ""). */
export function rowsToObjects(payload: SheetPayload): Record<string, string>[] {
  return payload.rows.map((row) => {
    const obj: Record<string, string> = {};
    payload.header.forEach((name, i) => {
      if (name) obj[name] = row[i] ?? "";
    });
    return obj;
  });
}
