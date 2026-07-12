import { useEffect, useRef, useState } from "react";
import {
  createWidget,
  exportConfigJson,
  parseConfigJson,
  WIDGET_TYPE_LABELS,
  type AppConfig,
  type WidgetConfig,
  type WidgetType,
} from "../lib/config";
import { clearAllData } from "../lib/db";
import type { AuthState } from "../hooks/useAuth";
import type { SyncState } from "../hooks/useSync";
import WidgetEditor from "./WidgetEditor";

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
  const [apiKeyDraft, setApiKeyDraft] = useState(config.googleApiKey);
  const [editing, setEditing] = useState<WidgetConfig | null>(null);

  const saveWidget = (widget: WidgetConfig) => {
    const exists = config.widgets.some((w) => w.id === widget.id);
    onConfigChange({
      ...config,
      widgets: exists
        ? config.widgets.map((w) => (w.id === widget.id ? widget : w))
        : [...config.widgets, widget],
    });
    setEditing(null);
  };

  const deleteWidget = (id: string) => {
    if (window.confirm("Eliminare questo widget?")) {
      onConfigChange({
        ...config,
        widgets: config.widgets.filter((w) => w.id !== id),
      });
    }
  };

  /** Config order drives page filling: swap the widget with its neighbour. */
  const moveWidget = (id: string, direction: -1 | 1) => {
    const index = config.widgets.findIndex((w) => w.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= config.widgets.length) return;
    const widgets = [...config.widgets];
    [widgets[index], widgets[target]] = [widgets[target], widgets[index]];
    onConfigChange({ ...config, widgets });
  };

  const toggleWidget = (id: string) => {
    onConfigChange({
      ...config,
      widgets: config.widgets.map((w) =>
        w.id === id ? { ...w, enabled: !w.enabled } : w,
      ),
    });
  };

  const saveClientId = () => {
    const trimmed = clientIdDraft.trim();
    if (trimmed !== config.googleClientId) {
      onConfigChange({ ...config, googleClientId: trimmed });
    }
  };

  const saveApiKey = () => {
    const trimmed = apiKeyDraft.trim();
    if (trimmed !== config.googleApiKey) {
      onConfigChange({ ...config, googleApiKey: trimmed });
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
        {editing ? (
          <WidgetEditor
            config={config}
            initial={editing}
            onSave={saveWidget}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <>
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
              className="w-full rounded-lg bg-slate-800 px-3 py-2 font-mono text-xs mb-3"
            />
            <span className="mb-1 block text-slate-300">
              Google API Key (Richiesta per Google Picker per Drive)
            </span>
            <input
              type="text"
              value={apiKeyDraft}
              onChange={(e) => setApiKeyDraft(e.target.value)}
              onBlur={saveApiKey}
              placeholder="AIzaSy..."
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
          {config.widgets.length === 0 && (
            <p className="mb-3 text-sm text-slate-400">
              Nessun widget configurato: aggiungine uno qui sotto.
            </p>
          )}
          {config.widgets.length > 0 && (
            <ul className="mb-3 space-y-2 text-sm">
              {config.widgets.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center gap-3 rounded-lg bg-slate-800 px-4 py-2"
                >
                  <input
                    type="checkbox"
                    checked={w.enabled}
                    onChange={() => toggleWidget(w.id)}
                    title="Abilitato"
                  />
                  <span className={w.enabled ? "" : "line-through opacity-50"}>
                    {w.title}{" "}
                    <span className="text-slate-500">
                      ({WIDGET_TYPE_LABELS[w.type]})
                    </span>
                  </span>
                  <span className="ml-auto text-slate-400">
                    {w.page != null ? `pagina ${w.page}` : "auto"}
                  </span>
                  <span className="flex flex-col">
                    <button
                      onClick={() => moveWidget(w.id, -1)}
                      disabled={config.widgets[0].id === w.id}
                      title="Sposta su (ordine di riempimento pagine)"
                      className="rounded px-1 text-xs leading-3 text-slate-400 hover:bg-slate-700 disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveWidget(w.id, 1)}
                      disabled={
                        config.widgets[config.widgets.length - 1].id === w.id
                      }
                      title="Sposta giù (ordine di riempimento pagine)"
                      className="rounded px-1 text-xs leading-3 text-slate-400 hover:bg-slate-700 disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </span>
                  <button
                    onClick={() => setEditing(w)}
                    className="rounded-lg bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
                  >
                    Modifica
                  </button>
                  <button
                    onClick={() => deleteWidget(w.id)}
                    className="rounded-lg bg-red-900/60 px-3 py-1 text-xs text-red-200 hover:bg-red-900"
                  >
                    Elimina
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(WIDGET_TYPE_LABELS) as WidgetType[]).map((type) => (
              <button
                key={type}
                onClick={() => setEditing(createWidget(type))}
                className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium hover:border-slate-400 hover:bg-slate-800"
              >
                + {WIDGET_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
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
          <StorageInfo />
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
          </>
        )}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/** IndexedDB usage/quota + persistence state (blob-heavy signage cache). */
function StorageInfo() {
  const [info, setInfo] = useState<{
    usage: number;
    quota: number;
    persisted: boolean;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const estimate = (await navigator.storage?.estimate?.()) ?? {};
        const persisted = (await navigator.storage?.persisted?.()) ?? false;
        setInfo({
          usage: estimate.usage ?? 0,
          quota: estimate.quota ?? 0,
          persisted,
        });
      } catch {
        setInfo(null);
      }
    })();
  }, []);

  if (!info) return null;
  const pct =
    info.quota > 0 ? Math.round((info.usage / info.quota) * 100) : null;
  return (
    <p className="mt-2 text-xs text-slate-500">
      Spazio locale: {formatBytes(info.usage)}
      {info.quota > 0 && ` su ${formatBytes(info.quota)}`}
      {pct !== null && ` (${pct}%)`} —{" "}
      {info.persisted
        ? "archiviazione persistente attiva"
        : "archiviazione non persistente (il browser può liberarla)"}
    </p>
  );
}
