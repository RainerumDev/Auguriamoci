import { useRef, useState } from "react";
import {
  exportConfigJson,
  parseConfigJson,
  type AppConfig,
} from "../lib/config";
import { clearAllData } from "../lib/db";

interface Props {
  config: AppConfig;
  onConfigChange: (config: AppConfig) => void;
  onClose: () => void;
}

export default function SettingsOverlay({
  config,
  onConfigChange,
  onClose,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const download = () => {
    const blob = new Blob([exportConfigJson(config)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "auguriamoci-config.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (file: File) => {
    try {
      const next = parseConfigJson(await file.text());
      onConfigChange(next);
      setMessage("Configurazione importata.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Importazione fallita.");
    }
  };

  const resetAll = async () => {
    if (
      window.confirm(
        "Cancellare configurazione e dati locali? L'operazione non è reversibile.",
      )
    ) {
      await clearAllData();
      window.location.reload();
    }
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl bg-slate-900 p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Impostazioni</h2>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="rounded-lg px-3 py-1 text-xl text-slate-400 hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <section className="mb-8">
          <h3 className="mb-2 text-lg font-semibold text-amber-400">
            Account Google
          </h3>
          <p className="text-sm text-slate-400">
            Login Google in arrivo (necessario per Fogli, Calendario e Drive).
          </p>
        </section>

        <section className="mb-8">
          <h3 className="mb-2 text-lg font-semibold text-amber-400">
            Aggiornamento dati
          </h3>
          <label className="flex items-center gap-3 text-sm">
            Intervallo di sincronizzazione
            <select
              value={config.updateIntervalMinutes}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  updateIntervalMinutes: Number(e.target.value),
                })
              }
              className="rounded-lg bg-slate-800 px-3 py-2"
            >
              {[15, 30, 60].map((m) => (
                <option key={m} value={m}>
                  ogni {m} minuti
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 flex items-center gap-3 text-sm">
            Durata pagina predefinita
            <input
              type="number"
              min={3}
              max={600}
              value={config.defaultPageDurationSeconds}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  defaultPageDurationSeconds: Math.max(
                    3,
                    Number(e.target.value) || 3,
                  ),
                })
              }
              className="w-24 rounded-lg bg-slate-800 px-3 py-2"
            />
            secondi
          </label>
        </section>

        <section className="mb-8">
          <h3 className="mb-2 text-lg font-semibold text-amber-400">
            Widget e pagine
          </h3>
          {config.widgets.length === 0 ? (
            <p className="text-sm text-slate-400">
              Nessun widget configurato. L'editor dei widget arriva con il
              login Google.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {config.widgets.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between rounded-lg bg-slate-800 px-4 py-2"
                >
                  <span>
                    {w.title}{" "}
                    <span className="text-slate-500">({w.type})</span>
                  </span>
                  <span className="text-slate-400">
                    {w.page != null ? `pagina ${w.page}` : "auto"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-8">
          <h3 className="mb-2 text-lg font-semibold text-amber-400">
            Configurazione
          </h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={download}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-600"
            >
              Esporta (.json)
            </button>
            <button
              onClick={() => fileInput.current?.click()}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-600"
            >
              Importa (.json)
            </button>
            <button
              onClick={resetAll}
              className="rounded-lg bg-red-900/60 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-900"
            >
              Reset dati locali
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            L'export contiene layout e ID dei file Google, mai i token di
            accesso.
          </p>
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
          {message && (
            <p className="mt-3 text-sm text-amber-300">{message}</p>
          )}
        </section>
      </div>
    </div>
  );
}
