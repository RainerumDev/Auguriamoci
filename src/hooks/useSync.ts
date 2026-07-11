import { useCallback, useEffect, useRef, useState } from "react";
import type { AppConfig } from "../lib/config";
import { loadLastReport, syncAll, type SyncReport } from "../lib/sync";

export interface SyncState {
  syncing: boolean;
  lastReport: SyncReport | null;
  syncNow: () => Promise<void>;
}

/**
 * In-app background sync loop (PRD §8): one run at startup, then every
 * `updateIntervalMinutes`. Also fires when the browser comes back online.
 */
export function useSync(config: AppConfig): SyncState {
  const [syncing, setSyncing] = useState(false);
  const [lastReport, setLastReport] = useState<SyncReport | null>(null);
  const running = useRef(false);
  const configRef = useRef(config);
  configRef.current = config;

  const syncNow = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setSyncing(true);
    try {
      setLastReport(await syncAll(configRef.current));
    } finally {
      running.current = false;
      setSyncing(false);
    }
  }, []);

  // Restore the previous report so settings can show "last sync" after reload.
  useEffect(() => {
    void loadLastReport().then((r) => {
      setLastReport((current) => current ?? r);
    });
  }, []);

  useEffect(() => {
    if (config.widgets.length === 0) return;
    void syncNow();
    const interval = window.setInterval(
      () => void syncNow(),
      Math.max(1, config.updateIntervalMinutes) * 60_000,
    );
    const onOnline = () => void syncNow();
    window.addEventListener("online", onOnline);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", onOnline);
    };
  }, [config.updateIntervalMinutes, config.widgets.length, syncNow]);

  return { syncing, lastReport, syncNow };
}
