import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppConfig } from "../lib/config";
import { useOnline } from "../hooks/useOnline";
import { useAuth } from "../hooks/useAuth";
import { useSync } from "../hooks/useSync";
import { usePresentation } from "../hooks/usePresentation";
import {
  resolveCycle,
  type ResolvedPage,
  type TimelineItem,
} from "../lib/timeline";
import SettingsOverlay from "../components/SettingsOverlay";
import Stage from "../components/Stage";

interface Props {
  config: AppConfig;
  onConfigChange: (config: AppConfig) => void;
}

/** How long the gear stays visible after the last mouse movement (ms). */
const IDLE_TIMEOUT = 3500;

export default function Player({ config, onConfigChange }: Props) {
  const online = useOnline();
  const auth = useAuth(config.googleClientId);
  const sync = useSync(config);
  const presentation = usePresentation(
    config,
    sync.lastReport?.finishedAt ?? null,
  );
  const [gearVisible, setGearVisible] = useState(false);
  // First run (no widgets yet): open the settings straight away instead of
  // showing an empty stage and hoping the user finds the secret gear.
  const [settingsOpen, setSettingsOpen] = useState(
    () => !config.widgets.some((w) => w.enabled),
  );
  const idleTimer = useRef<number | undefined>(undefined);

  // A page candidate is playable only with local content behind it
  // (or the network, for iframe embeds).
  const isAvailable = useCallback(
    (item: TimelineItem): boolean => {
      if (item.kind === "widget") {
        return (presentation.renderData.get(item.widgetId)?.length ?? 0) > 0;
      }
      if (
        item.mimeType.startsWith("image/") ||
        item.mimeType.startsWith("video/")
      ) {
        return presentation.mediaUrls.has(item.fileId);
      }
      // Google Slides/Docs iframes only work online (PRD §6.4).
      return online && Boolean(item.webViewLink);
    },
    [presentation.renderData, presentation.mediaUrls, online],
  );

  // Autoplay cycle: resolve -> advance page by page -> reshuffle at the end
  // of every full cycle (PRD §7.3-7.4).
  const [cycle, setCycle] = useState<ResolvedPage[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const cycleKey = useMemo(
    () =>
      resolveCycle(
        presentation.timeline,
        config.defaultPageDurationSeconds,
        isAvailable,
      ),
    [presentation.timeline, config.defaultPageDurationSeconds, isAvailable],
  );

  useEffect(() => {
    setCycle(cycleKey);
    setPageIndex(0);
  }, [cycleKey]);

  const advance = useCallback(() => {
    if (pageIndex + 1 < cycle.length) {
      setPageIndex(pageIndex + 1);
    } else {
      setCycle(
        resolveCycle(
          presentation.timeline,
          config.defaultPageDurationSeconds,
          isAvailable,
        ),
      );
      setPageIndex(0);
    }
  }, [
    cycle,
    pageIndex,
    presentation.timeline,
    config.defaultPageDurationSeconds,
    isAvailable,
  ]);

  // Operator shortcuts: arrows skip pages manually (useful when checking
  // the content on the actual screen). The autoplay timer then restarts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (settingsOpen || cycle.length === 0) return;
      if (e.key === "ArrowRight") advance();
      if (e.key === "ArrowLeft") {
        setPageIndex((i) => (i - 1 + cycle.length) % cycle.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, cycle.length, settingsOpen]);

  useEffect(() => {
    const current = cycle[pageIndex];
    if (!current) return;
    // These drive their own advance via Stage's onMediaEnd/onDone callback:
    // auto-duration videos (on 'ended') and widget pages (after the last
    // sub-page, so a multi-page calendar lasts duration × sub-pages). The
    // timeout here is only a safety net if that callback never fires.
    const isAutoVideo =
      current.item.kind === "file" &&
      current.item.mimeType.startsWith("video/") &&
      current.item.options?.autoDuration === true;
    const selfPaced = isAutoVideo || current.item.kind === "widget";
    const ms = selfPaced ? 15 * 60_000 : current.durationSeconds * 1000;
    const timer = window.setTimeout(advance, ms);
    return () => window.clearTimeout(timer);
  }, [cycle, pageIndex, advance]);

  const currentPage = cycle[pageIndex] ?? null;

  // Secret menu: the gear only appears while the mouse is moving.
  const handleMouseMove = useCallback(() => {
    setGearVisible(true);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(
      () => setGearVisible(false),
      IDLE_TIMEOUT,
    );
  }, []);

  useEffect(() => () => window.clearTimeout(idleTimer.current), []);

  // Fullscreen needs a user gesture in every browser; first click anywhere
  // enters fullscreen without disturbing playback.
  const enterFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        /* denied or unsupported: playback continues in window */
      });
    }
  }, []);

  const hasContent = config.widgets.some((w) => w.enabled);

  return (
    <div
      className={`relative h-full overflow-hidden bg-slate-950 ${gearVisible ? "" : "cursor-hidden"}`}
      onMouseMove={handleMouseMove}
      onClick={enterFullscreen}
    >
      {/* --- Stage (PRD §7): one timeline page at a time --- */}
      {currentPage ? (
        <div
          key={`${currentPage.page}-${pageIndex}`}
          className="h-full animate-[fadein_0.6s_ease]"
        >
          <Stage
            page={currentPage}
            renderData={presentation.renderData}
            mediaUrls={presentation.mediaUrls}
            backgroundUrls={presentation.backgroundUrls}
            backgroundSizes={presentation.backgroundSizes}
            onMediaEnd={advance}
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <div className="text-center text-slate-400">
            {hasContent ? (
              <p className="text-2xl">
                {presentation.ready
                  ? "Nessun contenuto da mostrare ora: in attesa della prima sincronizzazione o di eventi imminenti."
                  : "Caricamento contenuti…"}
              </p>
            ) : (
              <>
                <p className="text-3xl">Nessun contenuto configurato</p>
                <p className="mt-3 text-lg">
                  Muovi il mouse e apri le impostazioni ⚙️ per aggiungere
                  widget.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Expired Google session AND sync actually blocked (no API-key
          fallback possible): data keeps playing from cache, but the next
          sync needs a new sign-in. */}
      {auth.status === "expired" && sync.lastReport?.blocked && (
        <div
          title="Sessione Google scaduta: accedi di nuovo dalle impostazioni"
          className="absolute top-4 left-4 text-3xl opacity-40 select-none"
          aria-label="sessione scaduta"
        >
          🔑
        </div>
      )}

      {/* Last sync had failures: data on screen may be stale. Details are
          in the settings overlay; playback continues from cache. */}
      {online &&
        sync.lastReport &&
        (sync.lastReport.blocked ||
          sync.lastReport.results.some((r) => !r.ok)) && (
          <div
            title="Ultima sincronizzazione con errori: apri le impostazioni per i dettagli"
            className="absolute bottom-4 left-4 text-3xl opacity-40 select-none"
            aria-label="errore sincronizzazione"
          >
            ⚠️
          </div>
        )}

      {/* Offline indicator (PRD §4.2): playback never stops. */}
      {!online && (
        <div
          title="Offline: contenuti dalla cache locale"
          className="absolute top-4 right-4 text-3xl opacity-40 select-none"
          aria-label="offline"
        >
          ☁️⃠
        </div>
      )}

      {/* Secret gear (PRD §4.2). */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setSettingsOpen(true);
        }}
        aria-label="Impostazioni"
        className={`absolute right-6 bottom-6 rounded-full bg-slate-800/80 p-4 text-3xl transition-opacity duration-500 ${
          gearVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        ⚙️
      </button>

      {settingsOpen && (
        <SettingsOverlay
          config={config}
          auth={auth}
          sync={sync}
          onConfigChange={onConfigChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
