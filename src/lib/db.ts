/**
 * IndexedDB layer (Dexie).
 *
 * Everything the player needs at runtime is readable from here, so playback
 * keeps working with zero network (offline-first requirement).
 *
 * Tables:
 * - kv:       small singletons (config, sync timestamps).
 * - datasets: one row per widget = the latest parsed API payload
 *             (sheet rows / calendar events / drive file listing).
 * - media:    binary blobs downloaded from Drive (images, videos).
 */
import Dexie, { type EntityTable } from "dexie";
import {
  createDefaultConfig,
  parseConfigJson,
  type AppConfig,
} from "./config";

export interface KvRow {
  key: string;
  value: unknown;
}

export interface DatasetRow {
  /** Widget ID this dataset belongs to. */
  widgetId: string;
  kind: "sheet" | "calendar" | "drive";
  updatedAt: number;
  /** Parsed, widget-specific payload (rows, events or file metadata). */
  payload: unknown;
}

export interface MediaRow {
  /** Google Drive file ID. */
  fileId: string;
  name: string;
  mimeType: string;
  updatedAt: number;
  blob: Blob;
}

const db = new Dexie("auguriamoci") as Dexie & {
  kv: EntityTable<KvRow, "key">;
  datasets: EntityTable<DatasetRow, "widgetId">;
  media: EntityTable<MediaRow, "fileId">;
};

db.version(1).stores({
  kv: "key",
  datasets: "widgetId, kind",
  media: "fileId, updatedAt",
});

export { db };

const CONFIG_KEY = "app-config";

export async function loadConfig(): Promise<AppConfig | null> {
  const row = await db.kv.get(CONFIG_KEY);
  if (!row) return null;
  try {
    // Re-validate on every load so a corrupted record can't brick the app.
    return parseConfigJson(JSON.stringify(row.value));
  } catch {
    return null;
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await db.kv.put({ key: CONFIG_KEY, value: config });
}

export async function initConfig(): Promise<AppConfig> {
  const config = createDefaultConfig();
  await saveConfig(config);
  return config;
}

/** Full local reset: config, cached datasets and media. */
export async function clearAllData(): Promise<void> {
  await Promise.all([db.kv.clear(), db.datasets.clear(), db.media.clear()]);
}
