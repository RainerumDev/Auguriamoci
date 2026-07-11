import { useRef, useState } from "react";
import { initConfig, saveConfig } from "../lib/db";
import { parseConfigJson, type AppConfig } from "../lib/config";

interface Props {
  onConfigReady: (config: AppConfig) => void;
}

export default function Onboarding({ onConfigReady }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const startFresh = async () => {
    const config = await initConfig();
    onConfigReady(config);
  };

  const importFile = async (file: File) => {
    setError(null);
    try {
      const config = parseConfigJson(await file.text());
      await saveConfig(config);
      onConfigReady(config);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Importazione fallita.");
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 p-8 text-center">
      <div>
        <h1 className="text-5xl font-bold tracking-tight">
          Augur<span className="text-amber-400">iamoci</span> 🎉
        </h1>
        <p className="mt-4 max-w-xl text-lg text-slate-300">
          Digital signage per compleanni, onomastici, eventi da calendario e
          contenuti da Google Drive. Tutto resta nel tuo browser: nessun
          server, funziona anche offline.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <button
          onClick={startFresh}
          className="rounded-xl bg-amber-500 px-8 py-4 text-lg font-semibold text-slate-900 transition hover:bg-amber-400"
        >
          Configura la tua Digital Signage
        </button>
        <button
          onClick={() => fileInput.current?.click()}
          className="rounded-xl border border-slate-600 px-8 py-4 text-lg font-semibold text-slate-200 transition hover:border-slate-400 hover:bg-slate-800"
        >
          Importa una configurazione
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-900/50 px-4 py-2 text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
