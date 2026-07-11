import { useCallback, useEffect, useRef, useState } from "react";
import type { AppConfig } from "../lib/config";
import { useOnline } from "../hooks/useOnline";
import { useAuth } from "../hooks/useAuth";
import SettingsOverlay from "../components/SettingsOverlay";

interface Props {
  config: AppConfig;
  onConfigChange: (config: AppConfig) => void;
}

/** How long the gear stays visible after the last mouse movement (ms). */
const IDLE_TIMEOUT = 3500;

export default function Player({ config, onConfigChange }: Props) {
  const online = useOnline();
  const auth = useAuth(config.googleClientId);
  const [gearVisible, setGearVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const idleTimer = useRef<number | undefined>(undefined);

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
      {/* --- Stage: pagination engine mounts here (PRD §7) --- */}
      <div className="flex h-full items-center justify-center">
        {hasContent ? (
          <p className="text-2xl text-slate-400">
            Motore di presentazione in costruzione…
          </p>
        ) : (
          <div className="text-center text-slate-400">
            <p className="text-3xl">Nessun contenuto configurato</p>
            <p className="mt-3 text-lg">
              Muovi il mouse e apri le impostazioni ⚙️ per aggiungere widget.
            </p>
          </div>
        )}
      </div>

      {/* Expired Google session: data keeps playing from cache, but the next
          sync needs a new sign-in. */}
      {auth.status === "expired" && (
        <div
          title="Sessione Google scaduta: accedi di nuovo dalle impostazioni"
          className="absolute top-4 left-4 text-3xl opacity-40 select-none"
          aria-label="sessione scaduta"
        >
          🔑
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
          onConfigChange={onConfigChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
