import { useEffect, useState } from "react";
import { loadConfig, saveConfig } from "./lib/db";
import type { AppConfig } from "./lib/config";
import Onboarding from "./pages/Onboarding";
import Player from "./pages/Player";

type AppState =
  | { phase: "loading" }
  | { phase: "onboarding" }
  | { phase: "player"; config: AppConfig };

export default function App() {
  const [state, setState] = useState<AppState>({ phase: "loading" });

  useEffect(() => {
    // Signage runs unattended: ask the browser not to evict IndexedDB
    // (media blobs, cached datasets) under storage pressure.
    void navigator.storage?.persist?.();
    loadConfig().then((config) => {
      setState(config ? { phase: "player", config } : { phase: "onboarding" });
    });
  }, []);

  const handleConfigReady = (config: AppConfig) => {
    setState({ phase: "player", config });
  };

  const handleConfigChange = async (config: AppConfig) => {
    await saveConfig(config);
    setState({ phase: "player", config });
  };

  switch (state.phase) {
    case "loading":
      return (
        <div className="flex h-full items-center justify-center text-slate-400">
          Caricamento…
        </div>
      );
    case "onboarding":
      return <Onboarding onConfigReady={handleConfigReady} />;
    case "player":
      return (
        <Player config={state.config} onConfigChange={handleConfigChange} />
      );
  }
}
