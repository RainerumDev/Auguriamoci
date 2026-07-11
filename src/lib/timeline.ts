/**
 * Timeline Manager (PRD §7) — the core pagination logic.
 *
 * Rules:
 * 1. Non-drive widgets may declare a fixed page number.
 * 2. Drive files named "<N>_foo.jpg" / "<N>-foo" / "<N> foo" are pinned to
 *    page N.
 * 3. Widgets and Drive files without a page fill the empty page numbers in
 *    ascending order (1, 2, 3, 4, 6, ... one filler per page).
 * 4. When several items land on the same page, the player picks one at
 *    random on EVERY full cycle (shuffle on collision).
 * 5. Every page lasts N seconds: global default, overridable per widget.
 */
import type { WidgetConfig } from "./config";

export interface WidgetItem {
  kind: "widget";
  widgetId: string;
  durationSeconds?: number;
}

export interface FileItem {
  kind: "file";
  /** Drive widget the file belongs to. */
  widgetId: string;
  fileId: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

export type TimelineItem = WidgetItem | FileItem;

export interface TimelineEntry {
  page: number;
  /** length > 1 = collision: the player shuffles between these per cycle. */
  candidates: TimelineItem[];
}

export interface DriveFileForTimeline {
  widgetId: string;
  fileId: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

/** "5_sfondo.jpg" -> 5; "15-promo.mp4" -> 15; "3 avviso.png" -> 3; else null. */
export function parsePagePrefix(name: string): number | null {
  const match = /^(\d+)[_\- ]/.exec(name.trim());
  return match ? Number(match[1]) : null;
}

export function buildTimeline(
  widgets: WidgetConfig[],
  driveFiles: DriveFileForTimeline[],
): TimelineEntry[] {
  const byPage = new Map<number, TimelineItem[]>();
  const fillers: TimelineItem[] = [];

  const place = (item: TimelineItem, page: number | null | undefined) => {
    if (page == null) {
      fillers.push(item);
    } else {
      const list = byPage.get(page) ?? [];
      list.push(item);
      byPage.set(page, list);
    }
  };

  // Content widgets first (config order), then Drive files (listing order):
  // this makes gap-filling deterministic.
  for (const w of widgets) {
    if (!w.enabled || w.type === "drive") continue;
    place(
      { kind: "widget", widgetId: w.id, durationSeconds: w.durationSeconds },
      w.page,
    );
  }
  for (const f of driveFiles) {
    place(
      {
        kind: "file",
        widgetId: f.widgetId,
        fileId: f.fileId,
        name: f.name,
        mimeType: f.mimeType,
        webViewLink: f.webViewLink,
      },
      parsePagePrefix(f.name),
    );
  }

  // Fill & Pin: each filler takes the lowest free page number (PRD §7.2).
  let nextFree = 1;
  for (const filler of fillers) {
    while (byPage.has(nextFree)) nextFree++;
    byPage.set(nextFree, [filler]);
    nextFree++;
  }

  return [...byPage.entries()]
    .sort(([a], [b]) => a - b)
    .map(([page, candidates]) => ({ page, candidates }));
}

export interface ResolvedPage {
  page: number;
  item: TimelineItem;
  durationSeconds: number;
}

/**
 * Resolve one presentation cycle: pick a random candidate per page
 * (PRD §7.3) and drop pages with no available content — e.g. a birthday
 * widget with nobody to celebrate, an offline-only iframe, a missing blob.
 */
export function resolveCycle(
  entries: TimelineEntry[],
  defaultDurationSeconds: number,
  isAvailable: (item: TimelineItem) => boolean,
  rng: () => number = Math.random,
): ResolvedPage[] {
  const pages: ResolvedPage[] = [];
  for (const entry of entries) {
    const available = entry.candidates.filter(isAvailable);
    if (available.length === 0) continue;
    const item = available[Math.floor(rng() * available.length)];
    pages.push({
      page: entry.page,
      item,
      durationSeconds:
        (item.kind === "widget" ? item.durationSeconds : undefined) ??
        defaultDurationSeconds,
    });
  }
  return pages;
}
