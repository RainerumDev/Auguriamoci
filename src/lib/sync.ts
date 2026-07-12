/**
 * Background sync engine (PRD §8).
 *
 * Pulls fresh data from the Google APIs and writes everything the player
 * needs into IndexedDB. The player NEVER talks to the network directly:
 * when offline this module simply does not run and playback continues on
 * the last cached data.
 */
import { db } from "./db";
import type { AppConfig, WidgetConfig } from "./config";
import { getStoredToken, isTokenValid, trySilentRefresh } from "./google/auth";
import { GoogleApiError } from "./google/api";
import { fetchSheet } from "./google/sheets";
import { fetchEvents } from "./google/calendar";
import {
  downloadFileBlob,
  isDownloadableMedia,
  listFolderFiles,
} from "./google/drive";

export interface WidgetSyncResult {
  widgetId: string;
  title: string;
  ok: boolean;
  error?: string;
}

export interface SyncReport {
  startedAt: number;
  finishedAt: number;
  /** null = sync ran; string = it could not run at all (auth/offline). */
  blocked: string | null;
  results: WidgetSyncResult[];
}

export const LAST_SYNC_KEY = "last-sync-report";

/** Sync every enabled widget. Never throws: errors end up in the report. */
export async function syncAll(config: AppConfig): Promise<SyncReport> {
  const startedAt = Date.now();
  const report: SyncReport = {
    startedAt,
    finishedAt: startedAt,
    blocked: null,
    results: [],
  };

  if (!navigator.onLine) {
    report.blocked = "Offline: sincronizzazione rimandata.";
    return finish(report);
  }

  let token = getStoredToken();
  if (!isTokenValid(token)) {
    token = config.googleClientId
      ? await trySilentRefresh(config.googleClientId)
      : null;
  }
  if (!isTokenValid(token)) {
    report.blocked = "Sessione Google scaduta: accedi dalle impostazioni.";
    return finish(report);
  }
  const accessToken = token.accessToken;

  for (const widget of config.widgets.filter((w) => w.enabled)) {
    try {
      await syncWidget(widget, accessToken);
      report.results.push({ widgetId: widget.id, title: widget.title, ok: true });
    } catch (e) {
      report.results.push({
        widgetId: widget.id,
        title: widget.title,
        ok: false,
        error: userMessage(e),
      });
    }
  }

  await pruneMedia(config);
  return finish(report);
}

async function syncWidget(
  widget: WidgetConfig,
  accessToken: string,
): Promise<void> {
  await syncBackground(widget, accessToken);
  switch (widget.type) {
    case "birthdays": {
      const payload = await fetchSheet(
        widget.sheetId,
        widget.sheetRange,
        accessToken,
      );
      await db.datasets.put({
        widgetId: widget.id,
        kind: "sheet",
        updatedAt: Date.now(),
        payload,
      });
      return;
    }
    case "namedays": {
      // Both sources read names from a sheet; "builtin" resolves dates
      // locally against the bundled dictionary at render time.
      if (!widget.sheetId) return;
      const payload = await fetchSheet(
        widget.sheetId,
        widget.sheetRange,
        accessToken,
      );
      await db.datasets.put({
        widgetId: widget.id,
        kind: "sheet",
        updatedAt: Date.now(),
        payload,
      });
      return;
    }
    case "calendar": {
      const payload = await fetchEvents(
        widget.calendarId,
        widget.lookAheadDays,
        accessToken,
      );
      await db.datasets.put({
        widgetId: widget.id,
        kind: "calendar",
        updatedAt: Date.now(),
        payload,
      });
      return;
    }
    case "drive": {
      const payload = await listFolderFiles(widget.folderId, accessToken);
      for (const file of payload.files) {
        if (widget.fileOptions?.[file.id]?.skip) continue;
        if (!isDownloadableMedia(file)) {
          if (
            (file.mimeType.startsWith("image/") ||
              file.mimeType.startsWith("video/")) &&
            file.size
          ) {
            file.tooLarge = true;
          }
          continue;
        }
        const cached = await db.media.get(file.id);
        if (cached && cached.updatedAt >= Date.parse(file.modifiedTime)) {
          continue; // Blob already fresh.
        }
        const blob = await downloadFileBlob(file.id, accessToken);
        await db.media.put({
          fileId: file.id,
          name: file.name,
          mimeType: file.mimeType,
          updatedAt: Date.parse(file.modifiedTime) || Date.now(),
          blob,
        });
      }
      await db.datasets.put({
        widgetId: widget.id,
        kind: "drive",
        updatedAt: Date.now(),
        payload,
      });
      return;
    }
  }
}

/** Cache the page-background Drive file, once (no modifiedTime tracking). */
async function syncBackground(
  widget: WidgetConfig,
  accessToken: string,
): Promise<void> {
  const bg = widget.background;
  if (bg?.source !== "drive" || !bg.fileId) return;
  if (await db.media.get(bg.fileId)) return;
  const blob = await downloadFileBlob(bg.fileId, accessToken);
  await db.media.put({
    fileId: bg.fileId,
    name: "background",
    mimeType: blob.type || "image/jpeg",
    updatedAt: Date.now(),
    blob,
  });
}

/**
 * Drop cached blobs that no longer belong to any configured Drive widget
 * or widget background.
 */
async function pruneMedia(config: AppConfig): Promise<void> {
  const wanted = new Set<string>();
  for (const widget of config.widgets) {
    if (widget.background?.source === "drive" && widget.background.fileId) {
      wanted.add(widget.background.fileId);
    }
    if (widget.type !== "drive") continue;
    const row = await db.datasets.get(widget.id);
    if (row?.kind === "drive") {
      const payload = row.payload as { files?: { id: string }[] };
      for (const f of payload.files ?? []) {
        if (widget.fileOptions?.[f.id]?.skip) continue;
        wanted.add(f.id);
      }
    }
  }
  const allKeys = (await db.media.toCollection().primaryKeys()) as string[];
  const stale = allKeys.filter((k) => !wanted.has(k));
  if (stale.length > 0) await db.media.bulkDelete(stale);
}

async function finish(report: SyncReport): Promise<SyncReport> {
  report.finishedAt = Date.now();
  await db.kv.put({ key: LAST_SYNC_KEY, value: report });
  return report;
}

function userMessage(e: unknown): string {
  if (e instanceof GoogleApiError && e.isAuthError) {
    return "Permessi Google insufficienti o sessione scaduta.";
  }
  return e instanceof Error ? e.message : "Errore sconosciuto.";
}

export async function loadLastReport(): Promise<SyncReport | null> {
  const row = await db.kv.get(LAST_SYNC_KEY);
  return (row?.value as SyncReport) ?? null;
}
