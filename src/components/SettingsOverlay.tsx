import { useRef, useState } from "react";
import {
  exportConfigJson,
  parseConfigJson,
  type AppConfig,
} from "../lib/config";
import { clearAllData } from "../lib/db";
import type { AuthState } from "../hooks/useAuth";
import type { SyncState } from "../hooks/useSync";

interface Props {
  config: AppConfig;
  auth: AuthState;
  sync: SyncState;
  onConfigChange: (config: AppConfig) => void;
  onClose: () => void;
}

export default function SettingsOverlay({
  config,
  auth,
  sync,
  onConfigChange,
  onClose,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [clientIdDraft, setClientIdDraft] = useState(config.googleClientId);

  const saveClientId = () => {
    const trimmed = clientIdDraft.trim();
    if (trimmed !== config.googleClientId) {
      onConfigChange({ ...config, googleClientId: trimmed });
    }
  };

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
          <label className="block text-sm">
            <span className="mb-1 block text-slate-300">
              Client ID OAuth (Google Cloud Console → credenziali → app Web)
            </span>
            <input
              type="text"
              value={clientIdDraft}
              onChange={(e) => setClientIdDraft(e.target.value)}
              onBlur={saveClientId}
              placeholder="1234567890-xxxxxxxx.apps.googleusercontent.com"
              spellCheck={false}
              className="w-full rounded-lg bg-slate-800 px-3 py-2 font-mono text-xs"
            />
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Origini JavaScript autorizzate da inserire nella console:{" "}
            <code>{window.location.origin}</code>
          </p>

          <div className="mt-4 flex items-center gap-4">
            {auth.status === "signed-in" ? (
              <>
                <span className="text-sm text-emerald-400">
                  ✓ Connesso{auth.email ? ` come ${auth.email}` : ""}
                </span>
                <button
                  onClick={() => void auth.signOut()}
                  disabled={auth.busy}
                  className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-600 disabled:opacity-50"
                >
                  Esci
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => void auth.signIn()}
                  disabled={auth.busy || !config.googleClientId}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
                >
                  {auth.busy ? "Accesso in corso…" : "Accedi con Google"}
                </button>
                {auth.status === "expired" && (
                  <span className="text-sm text-amber-300">
                    Sessione scaduta: accedi di nuovo.
                  </span>
                )}
                {auth.status === "no-client-id" && (
                  <span className="text-sm text-slate-400">
                    Inserisci prima il Client ID.
                  </span>
                )}
              </>
            )}
          </div>
          {auth.error && (
            <p className="mt-2 text-sm text-red-400">{auth.error}</p>
          )}
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
          <div className="mt-3 flex items-center gap-3 text-sm">
            <button
              onClick={() => void sync.syncNow()}
              disabled={sync.syncing || auth.status !== "signed-in"}
              className="rounded-lg bg-slate-700 px-4 py-2 font-medium hover:bg-slate-600 disabled:opacity-50"
            >
              {sync.syncing ? "Sincronizzazione…" : "Sincronizza ora"}
            </button>
            {sync.lastReport && (
              <span className="text-xs text-slate-400">
                Ultima:{" "}
                {new Date(sync.lastReport.finishedAt).toLocaleTimeString(
                  "it-IT",
                )}
                {sync.lastReport.blocked
                  ? ` — ${sync.lastReport.blocked}`
                  : ` — ${sync.lastReport.results.filter((r) => r.ok).length}/${sync.lastReport.results.length} widget ok`}
              </span>
            )}
          </div>
          {sync.lastReport?.results.some((r) => !r.ok) && (
            <ul className="mt-2 space-y-1 text-xs text-red-400">
              {sync.lastReport.results
                .filter((r) => !r.ok)
                .map((r) => (
                  <li key={r.widgetId}>
                    {r.title}: {r.error}
                  </li>
                ))}
            </ul>
          )}
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
