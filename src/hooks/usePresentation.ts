import { useEffect, useState } from "react";
import { db } from "../lib/db";
import type { AppConfig } from "../lib/config";
import type { SheetPayload } from "../lib/google/sheets";
import type { CalendarPayload } from "../lib/google/calendar";
import type { DrivePayload } from "../lib/google/drive";
import {
  buildBirthdayItems,
  buildCalendarItems,
  buildNamedayItems,
  type RenderItem,
} from "../lib/widgetData";
import {
  buildTimeline,
  type DriveFileForTimeline,
  type TimelineEntry,
} from "../lib/timeline";

export interface PresentationData {
  ready: boolean;
  timeline: TimelineEntry[];
  /** widgetId -> rendered items (empty = nothing to show today). */
  renderData: Map<string, RenderItem[]>;
  /** Drive fileId -> object URL for the cached blob. */
  mediaUrls: Map<string, string>;
  /** widgetId -> background image URL (object URL or data URL). */
  backgroundUrls: Map<string, string>;
}

const EMPTY: PresentationData = {
  ready: false,
  timeline: [],
  renderData: new Map(),
  mediaUrls: new Map(),
  backgroundUrls: new Map(),
};

/**
 * Assembles everything the player shows, exclusively from IndexedDB
 * (PRD §8: playback never touches the network). Recomputed after every
 * sync (`syncStamp`) and every hour so date-based filters roll over.
 */
export function usePresentation(
  config: AppConfig,
  syncStamp: number | null,
): PresentationData {
  const [data, setData] = useState<PresentationData>(EMPTY);
  const [hourTick, setHourTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setHourTick((t) => t + 1),
      60 * 60_000,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];

    (async () => {
      const now = new Date();
      const renderData = new Map<string, RenderItem[]>();
      const driveFiles: DriveFileForTimeline[] = [];
      const mediaUrls = new Map<string, string>();

      for (const widget of config.widgets.filter((w) => w.enabled)) {
        const dataset = await db.datasets.get(widget.id);
        if (!dataset) continue;
        switch (widget.type) {
          case "birthdays":
            if (dataset.kind === "sheet") {
              renderData.set(
                widget.id,
                buildBirthdayItems(
                  widget,
                  dataset.payload as SheetPayload,
                  now,
                ),
              );
            }
            break;
          case "namedays":
            if (dataset.kind === "sheet") {
              renderData.set(
                widget.id,
                buildNamedayItems(widget, dataset.payload as SheetPayload, now),
              );
            }
            break;
          case "calendar":
            if (dataset.kind === "calendar") {
              renderData.set(
                widget.id,
                buildCalendarItems(
                  widget,
                  dataset.payload as CalendarPayload,
                  now,
                ),
              );
            }
            break;
          case "drive":
            if (dataset.kind === "drive") {
              for (const f of (dataset.payload as DrivePayload).files) {
                driveFiles.push({
                  widgetId: widget.id,
                  fileId: f.id,
                  name: f.name,
                  mimeType: f.mimeType,
                  webViewLink: f.webViewLink,
                });
              }
            }
            break;
        }
      }

      for (const f of driveFiles) {
        if (
          f.mimeType.startsWith("image/") ||
          f.mimeType.startsWith("video/")
        ) {
          const row = await db.media.get(f.fileId);
          if (row) {
            const url = URL.createObjectURL(row.blob);
            urls.push(url);
            mediaUrls.set(f.fileId, url);
          }
        }
      }

      // Page backgrounds: embedded data URLs or cached Drive blobs.
      const backgroundUrls = new Map<string, string>();
      for (const widget of config.widgets.filter((w) => w.enabled)) {
        const bg = widget.background;
        if (!bg) continue;
        if (bg.source === "embedded" && bg.dataUrl) {
          backgroundUrls.set(widget.id, bg.dataUrl);
        } else if (bg.source === "drive" && bg.fileId) {
          const row = await db.media.get(bg.fileId);
          if (row) {
            const url = URL.createObjectURL(row.blob);
            urls.push(url);
            backgroundUrls.set(widget.id, url);
          }
        }
      }

      const timeline = buildTimeline(config.widgets, driveFiles);

      if (cancelled) {
        urls.forEach((u) => URL.revokeObjectURL(u));
      } else {
        setData({ ready: true, timeline, renderData, mediaUrls, backgroundUrls });
      }
    })();

    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [config, syncStamp, hourTick]);

  return data;
}
