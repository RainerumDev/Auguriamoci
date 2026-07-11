/**
 * Built-in nameday dictionary (PRD §6.2, option B).
 *
 * Lookup is a best match ignoring case and accents. Compound names fall back
 * to their first token ("Maria Grazia" -> "maria"). Dates are indicative:
 * users needing exact parish calendars should use the external-sheet source.
 */
import dictionary from "../data/nomi_onomastici.json";
import type { DayMonth } from "./dates";

// JSON imports type tuples as number[]; entries are always [day, month].
const DICT: Record<string, number[]> = dictionary;

/** lowercase + strip diacritics + collapse whitespace. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Best-match nameday for a first name; null when unknown. */
export function findNameday(name: string): DayMonth | null {
  const normalized = normalizeName(name);
  if (!normalized) return null;

  const exact = DICT[normalized] ?? DICT[normalized.replaceAll(" ", "")];
  if (exact) return { day: exact[0], month: exact[1] };

  // Compound name: try the first token ("maria grazia" -> "maria").
  const first = normalized.split(" ")[0];
  const byFirst = DICT[first];
  if (byFirst) return { day: byFirst[0], month: byFirst[1] };

  return null;
}

export function dictionarySize(): number {
  return Object.keys(DICT).length;
}
