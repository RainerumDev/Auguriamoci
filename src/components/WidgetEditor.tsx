import { useRef, useState } from "react";
import type {
  AppConfig,
  CalendarWidgetConfig,
  DriveFileOptions,
  DriveWidgetConfig,
  NamedaysWidgetConfig,
  WidgetBackground,
  WidgetConfig,
} from "../lib/config";
import { WIDGET_TYPE_LABELS } from "../lib/config";
import { getStoredToken, isTokenValid, loadPicker } from "../lib/google/auth";
import { extractSheetId, fetchSheet } from "../lib/google/sheets";
import {
  extractDriveFileId,
  extractFolderId,
  listFolderFiles,
  type DriveFileMeta,
} from "../lib/google/drive";
import { listCalendars, type CalendarListEntry } from "../lib/google/calendar";
import { suggestDateColumn } from "../lib/dates";
import RichTemplateEditor from "./RichTemplateEditor";
import MarginsField from "./MarginsField";

interface Props {
  config: AppConfig;
  initial: WidgetConfig;
  onSave: (widget: WidgetConfig) => void;
  onCancel: () => void;
}

/** Returns a valid token or throws with a user-facing message. */
function requireToken(): string {
  const token = getStoredToken();
  if (!isTokenValid(token)) {
    throw new Error("Accedi con Google prima (sezione Account).");
  }
  return token.accessToken;
}

/**
 * Google Picker restricted to one document view ("spreadsheets", "images").
 * Resolves null when the user cancels.
 */
async function pickDriveDoc(
  apiKey: string,
  view: "spreadsheets" | "images",
  title: string,
): Promise<{ id: string; name: string } | null> {
  const token = requireToken();
  await loadPicker();
  const google = window.google!;
  const viewId =
    view === "spreadsheets"
      ? google.picker.ViewId.SPREADSHEETS
      : google.picker.ViewId.DOCS_IMAGES;
  return new Promise((resolve) => {
    const picker = new google.picker.PickerBuilder()
      .addView(new google.picker.DocsView(viewId))
      .setOAuthToken(token)
      .setDeveloperKey(apiKey)
      .setTitle(title)
      .setCallback(
        (data: { action: string; docs?: { id: string; name: string }[] }) => {
          if (data.action === "picked") resolve(data.docs?.[0] ?? null);
          else if (data.action === "cancel") resolve(null);
        },
      )
      .build();
    picker.setVisible(true);
  });
}

/** Picker limited to spreadsheets. */
function pickSpreadsheet(apiKey: string) {
  return pickDriveDoc(apiKey, "spreadsheets", "Seleziona un foglio Google");
}

export default function WidgetEditor({ config, initial, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<WidgetConfig>(() =>
    structuredClone(initial),
  );
  const [error, setError] = useState<string | null>(null);

  const patch = (partial: Partial<WidgetConfig>) =>
    setDraft((d) => ({ ...d, ...partial }) as WidgetConfig);

  const save = () => {
    setError(null);
    try {
      validate(draft);
      onSave(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Configurazione non valida.");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {WIDGET_TYPE_LABELS[draft.type]}
        </h2>
        <button
          onClick={onCancel}
          className="rounded-lg px-3 py-1 text-sm text-slate-400 hover:bg-slate-800"
        >
          ← Annulla
        </button>
      </div>

      <div className="space-y-4">
        <Field label="Titolo">
          <input
            type="text"
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm"
          />
        </Field>

        <div className="flex gap-6">
          <Field label="Pagina fissa (vuoto = riempimento auto)">
            <input
              type="number"
              min={1}
              value={draft.page ?? ""}
              onChange={(e) =>
                patch({
                  page: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="w-28 rounded-lg bg-slate-800 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Durata (sec, vuoto = default)">
            <input
              type="number"
              min={3}
              value={draft.durationSeconds ?? ""}
              onChange={(e) =>
                patch({
                  durationSeconds: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
              className="w-28 rounded-lg bg-slate-800 px-3 py-2 text-sm"
            />
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => patch({ enabled: e.target.checked })}
            />
            Abilitato
          </label>
        </div>

        <MarginsField
          margin={draft.margin}
          margins={draft.margins}
          onChange={(margins) => patch({ margins, margin: undefined })}
        />

        {draft.type === "birthdays" && (
          <SheetSourceFields
            draft={draft}
            patch={patch}
            apiKey={config.googleApiKey}
            withDateColumn
            onError={setError}
          />
        )}
        {draft.type === "namedays" && (
          <NamedaysFields
            draft={draft}
            patch={patch}
            apiKey={config.googleApiKey}
            onError={setError}
          />
        )}
        {draft.type === "calendar" && (
          <CalendarFields draft={draft} patch={patch} onError={setError} />
        )}
        {draft.type === "drive" && (
          <DriveFields
            draft={draft}
            patch={patch}
            apiKey={config.googleApiKey}
          />
        )}

        {draft.type !== "drive" && (
          <RichTemplateEditor
            value={draft.template}
            placeholders={placeholdersFor(draft)}
            onChange={(template) => patch({ template })}
          />
        )}
        <BackgroundField
          background={draft.background}
          apiKey={config.googleApiKey}
          onChange={(background) => patch({ background })}
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            onClick={save}
            className="rounded-lg bg-amber-500 px-6 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
          >
            Salva widget
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg bg-slate-700 px-6 py-2 text-sm font-medium hover:bg-slate-600"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}

function validate(w: WidgetConfig): void {
  if (!w.title.trim()) throw new Error("Il titolo è obbligatorio.");
  switch (w.type) {
    case "birthdays":
      if (!w.sheetId) throw new Error("Indica il Google Sheet.");
      if (!w.dateColumn)
        throw new Error("Seleziona la colonna della data di nascita.");
      break;
    case "namedays":
      if (!w.sheetId) throw new Error("Indica il Google Sheet.");
      if (w.source === "sheet" && !w.dateColumn)
        throw new Error("Seleziona la colonna della data.");
      if (w.source === "builtin" && !w.nameColumn)
        throw new Error("Seleziona la colonna del nome.");
      break;
    case "calendar":
      if (!w.calendarId) throw new Error("Seleziona un calendario.");
      break;
    case "drive":
      if (!w.folderId) throw new Error("Indica la cartella di Drive.");
      break;
  }
}

function placeholdersFor(w: WidgetConfig): string[] {
  if (w.type === "calendar") {
    return ["titolo", "data_inizio", "ora_inizio", "data_fine", "ora_fine", "periodo", "descrizione", "luogo"];
  }
  if (w.type === "birthdays" || w.type === "namedays") {
    return [...Object.keys(w.columns), "data_festa"];
  }
  return [];
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-300">{label}</span>
      {children}
    </label>
  );
}

/* ---------- Sheet-based sources (birthdays + namedays) ---------- */

/** Structural subset shared by birthday and nameday widgets. */
interface SheetDraft {
  sheetId: string;
  sheetRange: string;
  columns: Record<string, string>;
  dateColumn: string;
  nameColumn?: string;
  lookAheadDays: number;
}

function SheetSourceFields({
  draft,
  patch,
  apiKey,
  withDateColumn,
  withNameColumn,
  onError,
}: {
  draft: SheetDraft;
  patch: (p: Partial<SheetDraft>) => void;
  apiKey: string;
  withDateColumn?: boolean;
  withNameColumn?: boolean;
  onError: (msg: string | null) => void;
}) {
  const [sheetInput, setSheetInput] = useState(draft.sheetId);
  const [loading, setLoading] = useState(false);
  const headers = Object.keys(draft.columns);

  const loadHeaders = async (idOverride?: string) => {
    onError(null);
    const id = extractSheetId(idOverride ?? sheetInput);
    if (!id) {
      onError("URL o ID del foglio non valido.");
      return;
    }
    setLoading(true);
    try {
      const token = requireToken();
      const payload = await fetchSheet(id, draft.sheetRange, { accessToken: token });
      if (payload.header.length === 0) {
        throw new Error("Il foglio è vuoto: nessuna intestazione trovata.");
      }
      const columns: Record<string, string> = {};
      for (const h of payload.header) if (h) columns[h] = h;
      const patchData: Partial<SheetDraft> = { sheetId: id, columns };
      // PRD §6.1: auto-suggest the birth date column from the headers.
      if (withDateColumn && !draft.dateColumn) {
        const suggested = suggestDateColumn(payload.header);
        if (suggested) patchData.dateColumn = suggested;
      }
      patch(patchData);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Caricamento fallito.");
    } finally {
      setLoading(false);
    }
  };

  const pickFromDrive = async () => {
    onError(null);
    try {
      const doc = await pickSpreadsheet(apiKey);
      if (!doc) return;
      setSheetInput(doc.id);
      await loadHeaders(doc.id);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Impossibile aprire il Picker.");
    }
  };

  return (
    <div className="space-y-4 rounded-xl bg-slate-800/50 p-4">
      <Field label="URL o ID del Google Sheet">
        <div className="flex gap-2">
          <input
            type="text"
            value={sheetInput}
            onChange={(e) => setSheetInput(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            spellCheck={false}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 font-mono text-xs"
          />
          <button
            onClick={() => void pickFromDrive()}
            disabled={loading || !apiKey}
            title={
              apiKey
                ? "Scegli il foglio da Google Drive"
                : "Inserisci la Google API Key nelle impostazioni"
            }
            className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-500 disabled:opacity-50"
          >
            📊 Da Drive
          </button>
          <button
            onClick={() => void loadHeaders()}
            disabled={loading}
            className="shrink-0 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-600 disabled:opacity-50"
          >
            {loading ? "Carico…" : "Carica colonne"}
          </button>
        </div>
      </Field>
      <Field label="Nome del tab (vuoto = primo foglio)">
        <input
          type="text"
          value={draft.sheetRange}
          onChange={(e) => patch({ sheetRange: e.target.value })}
          className="w-48 rounded-lg bg-slate-800 px-3 py-2 text-sm"
        />
      </Field>

      {headers.length > 0 && (
        <>
          {withDateColumn && (
            <Field label="Colonna della data">
              <ColumnSelect
                headers={headers}
                value={draft.dateColumn}
                onChange={(dateColumn) => patch({ dateColumn })}
              />
            </Field>
          )}
          {withNameColumn && (
            <Field label="Colonna del nome">
              <ColumnSelect
                headers={headers}
                value={draft.nameColumn ?? ""}
                onChange={(nameColumn) => patch({ nameColumn })}
              />
            </Field>
          )}
        </>
      )}

      <Field label="Mostra fino a N giorni nel futuro (0 = solo oggi)">
        <input
          type="number"
          min={0}
          max={60}
          value={draft.lookAheadDays}
          onChange={(e) =>
            patch({ lookAheadDays: Math.max(0, Number(e.target.value) || 0) })
          }
          className="w-28 rounded-lg bg-slate-800 px-3 py-2 text-sm"
        />
      </Field>
    </div>
  );
}

function ColumnSelect({
  headers,
  value,
  onChange,
}: {
  headers: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg bg-slate-800 px-3 py-2 text-sm"
    >
      <option value="">— scegli —</option>
      {headers.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  );
}

function NamedaysFields({
  draft,
  patch,
  apiKey,
  onError,
}: {
  draft: NamedaysWidgetConfig;
  patch: (p: Partial<NamedaysWidgetConfig>) => void;
  apiKey: string;
  onError: (msg: string | null) => void;
}) {
  return (
    <div className="space-y-4">
      <Field label="Sorgente della data">
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={draft.source === "builtin"}
              onChange={() => patch({ source: "builtin" })}
            />
            Dizionario interno (~230 nomi italiani)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={draft.source === "sheet"}
              onChange={() => patch({ source: "sheet" })}
            />
            Colonna data nel foglio
          </label>
        </div>
      </Field>
      <SheetSourceFields
        draft={draft}
        patch={patch}
        apiKey={apiKey}
        withDateColumn={draft.source === "sheet"}
        withNameColumn={draft.source === "builtin"}
        onError={onError}
      />
    </div>
  );
}

/* ---------- Calendar ---------- */

function CalendarFields({
  draft,
  patch,
  onError,
}: {
  draft: CalendarWidgetConfig;
  patch: (p: Partial<CalendarWidgetConfig>) => void;
  onError: (msg: string | null) => void;
}) {
  const [calendars, setCalendars] = useState<CalendarListEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    onError(null);
    setLoading(true);
    try {
      const token = requireToken();
      const list = await listCalendars(token);
      if (list.length === 0) throw new Error("Nessun calendario trovato.");
      setCalendars(list);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Caricamento fallito.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl bg-slate-800/50 p-4">
      <Field label="Calendario">
        <div className="flex items-center gap-2">
          {calendars.length > 0 ? (
            <select
              value={draft.calendarId}
              onChange={(e) => {
                const cal = calendars.find((c) => c.id === e.target.value);
                patch({
                  calendarId: e.target.value,
                  calendarLabel: cal?.summary ?? "",
                });
              }}
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="">— scegli —</option>
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.summary}
                  {c.primary ? " (principale)" : ""}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-slate-400">
              {draft.calendarLabel
                ? `Selezionato: ${draft.calendarLabel}`
                : "Nessun calendario caricato."}
            </span>
          )}
          <button
            onClick={() => void load()}
            disabled={loading}
            className="shrink-0 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-600 disabled:opacity-50"
          >
            {loading ? "Carico…" : "Carica calendari"}
          </button>
        </div>
      </Field>
      <Field label="Mostra eventi fino a N giorni nel futuro (0 = solo oggi)">
        <input
          type="number"
          min={0}
          max={60}
          value={draft.lookAheadDays}
          onChange={(e) =>
            patch({ lookAheadDays: Math.max(0, Number(e.target.value) || 0) })
          }
          className="w-28 rounded-lg bg-slate-800 px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Numero massimo di eventi (0 = nessun limite)">
        <input
          type="number"
          min={0}
          max={100}
          value={draft.maxEvents ?? 0}
          onChange={(e) => {
            const n = Math.max(0, Number(e.target.value) || 0);
            patch({ maxEvents: n === 0 ? undefined : n });
          }}
          className="w-28 rounded-lg bg-slate-800 px-3 py-2 text-sm"
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.includeOngoing ?? true}
          onChange={(e) => patch({ includeOngoing: e.target.checked })}
        />
        Includi gli eventi già iniziati (in corso)
      </label>
    </div>
  );
}

/* ---------- Drive ---------- */

function fileTypeIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "📷";
  if (mimeType.startsWith("video/")) return "🎬";
  return "📄";
}

function DriveFields({
  draft,
  patch,
  apiKey,
}: {
  draft: DriveWidgetConfig;
  patch: (p: Partial<DriveWidgetConfig>) => void;
  apiKey: string;
}) {
  const [input, setInput] = useState(draft.folderId);
  const [files, setFiles] = useState<DriveFileMeta[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingPicker, setLoadingPicker] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  const fileOptions = draft.fileOptions ?? {};

  const patchFileOption = (
    fileId: string,
    update: Partial<DriveFileOptions>,
  ) => {
    const current = fileOptions[fileId] ?? {};
    patch({
      fileOptions: {
        ...fileOptions,
        [fileId]: { ...current, ...update },
      },
    });
  };

  const openPicker = async () => {
    setDriveError(null);
    setLoadingPicker(true);
    try {
      const token = requireToken();
      await loadPicker();
      const google = window.google!;

      const folderView = new google.picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes("application/vnd.google-apps.folder");

      const filesView = new google.picker.DocsView()
        .setIncludeFolders(false);

      const picker = new google.picker.PickerBuilder()
        .addView(folderView)
        .addView(filesView)
        .setOAuthToken(token)
        .setDeveloperKey(apiKey)
        .setTitle("Seleziona cartella o file")
        .setCallback(
          (data: {
            action: string;
            docs?: { id: string; name: string; mimeType: string; parentId?: string }[];
          }) => {
            if (data.action !== "picked" || !data.docs?.length) return;
            const doc = data.docs[0];
            if (
              doc.mimeType === "application/vnd.google-apps.folder"
            ) {
              setInput(doc.id);
              patch({ folderId: doc.id, folderLabel: doc.name });
            } else {
              // File selected: adopt its parent folder when known.
              const parentId = doc.parentId;
              if (parentId) {
                setInput(parentId);
                patch({ folderId: parentId });
              } else {
                setDriveError(
                  "Seleziona una cartella (il file scelto non espone la cartella di origine).",
                );
              }
            }
          },
        )
        .build();
      picker.setVisible(true);
    } catch (e) {
      setDriveError(
        e instanceof Error ? e.message : "Impossibile aprire il Picker.",
      );
    } finally {
      setLoadingPicker(false);
    }
  };

  const loadFileList = async () => {
    setDriveError(null);
    const folderId = extractFolderId(input) ?? draft.folderId;
    if (!folderId) {
      setDriveError("Inserisci prima un URL o ID di cartella.");
      return;
    }
    setLoadingFiles(true);
    try {
      const token = requireToken();
      const payload = await listFolderFiles(folderId, { accessToken: token });
      setFiles(payload.files);
      if (payload.files.length === 0) {
        setDriveError("La cartella è vuota.");
      }
    } catch (e) {
      setDriveError(
        e instanceof Error ? e.message : "Caricamento elenco fallito.",
      );
    } finally {
      setLoadingFiles(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl bg-slate-800/50 p-4">
      <Field label="URL o ID della cartella Google Drive">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              const id = extractFolderId(e.target.value);
              if (id) patch({ folderId: id });
            }}
            placeholder="https://drive.google.com/drive/folders/…"
            spellCheck={false}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => void openPicker()}
            disabled={loadingPicker}
            className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-500 disabled:opacity-50"
          >
            {loadingPicker ? "Apro…" : "📂 Seleziona da Drive"}
          </button>
        </div>
      </Field>

      {draft.folderLabel && (
        <p className="text-xs text-slate-400">
          Cartella selezionata: <strong>{draft.folderLabel}</strong>
        </p>
      )}

      <Field label="Adattamento predefinito immagini (vale anche per i file aggiunti in futuro)">
        <select
          value={draft.defaultObjectFit ?? "cover"}
          onChange={(e) =>
            patch({
              defaultObjectFit: e.target.value as
                | "contain"
                | "cover"
                | "fill",
            })
          }
          className="rounded-lg bg-slate-800 px-3 py-2 text-sm"
        >
          <option value="cover">Cover (riempie, ritaglia)</option>
          <option value="contain">Contain (tutta visibile, bande)</option>
          <option value="fill">Fill (allunga a tutto schermo)</option>
        </select>
      </Field>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void loadFileList()}
          disabled={loadingFiles || !draft.folderId}
          className="shrink-0 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-600 disabled:opacity-50"
        >
          {loadingFiles ? "Carico…" : "📋 Carica elenco file"}
        </button>
        {files.length > 0 && (
          <span className="text-xs text-slate-400">
            {files.length} file trovati
          </span>
        )}
      </div>

      {driveError && (
        <p className="text-xs text-red-400">{driveError}</p>
      )}

      {files.length > 0 && (
        <div className="max-h-96 space-y-1 overflow-y-auto rounded-lg bg-slate-900/60 p-3">
          {files.map((file) => {
            const opts = fileOptions[file.id] ?? {};
            const isImage = file.mimeType.startsWith("image/");
            const isVideo = file.mimeType.startsWith("video/");
            return (
              <div
                key={file.id}
                className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-3 py-2 text-sm ${
                  opts.skip
                    ? "bg-slate-800/40 text-slate-500 line-through"
                    : "bg-slate-800/70 text-slate-200"
                }`}
              >
                {/* File name & icon */}
                <span className="min-w-0 flex-1 truncate font-mono text-xs">
                  {fileTypeIcon(file.mimeType)} {file.name}
                </span>

                {/* Skip toggle */}
                <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={opts.skip ?? false}
                    onChange={(e) =>
                      patchFileOption(file.id, { skip: e.target.checked })
                    }
                  />
                  Salta
                </label>

                {/* Video-specific options */}
                {isVideo && (
                  <>
                    <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={opts.audioEnabled ?? false}
                        onChange={(e) =>
                          patchFileOption(file.id, {
                            audioEnabled: e.target.checked,
                          })
                        }
                      />
                      🔊 Audio
                    </label>
                    <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={opts.autoDuration ?? false}
                        onChange={(e) =>
                          patchFileOption(file.id, {
                            autoDuration: e.target.checked,
                          })
                        }
                      />
                      ⏱ Durata auto
                    </label>
                  </>
                )}

                {/* Image-specific options */}
                {isImage && (
                  <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                    Fit:
                    <select
                      value={opts.objectFit ?? ""}
                      onChange={(e) =>
                        patchFileOption(file.id, {
                          objectFit: e.target.value
                            ? (e.target.value as "contain" | "cover" | "fill")
                            : undefined,
                        })
                      }
                      className="rounded bg-slate-700 px-2 py-0.5 text-xs"
                    >
                      <option value="">Predefinito</option>
                      <option value="cover">Cover</option>
                      <option value="contain">Contain</option>
                      <option value="fill">Fill</option>
                    </select>
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-500">
        File <code>5_nome.jpg</code> → forzati alla pagina 5; senza prefisso
        numerico → riempiono le pagine vuote. Immagini e video sono salvati
        offline; Presentazioni/Documenti Google usano un iframe (solo online).
      </p>
    </div>
  );
}

/* ---------- Background (Drive file or embedded base64) ---------- */

/** Embedded backgrounds live inside the exported JSON: keep them small. */
const MAX_EMBEDDED_BG_BYTES = 2 * 1024 * 1024;

function BackgroundField({
  background,
  apiKey,
  onChange,
}: {
  background?: WidgetBackground;
  apiKey: string;
  onChange: (bg: WidgetBackground | undefined) => void;
}) {
  const [driveInput, setDriveInput] = useState(
    background?.source === "drive" ? (background.fileId ?? "") : "",
  );
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const mode = background?.source ?? "none";

  const uploadFile = (file: File) => {
    setError(null);
    if (file.size > MAX_EMBEDDED_BG_BYTES) {
      setError(
        "Immagine troppo grande (max 2 MB): finirebbe nel file di configurazione. Usa un file Drive.",
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      onChange({ source: "embedded", dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3 rounded-xl bg-slate-800/50 p-4 text-sm">
      <span className="block text-slate-300">Sfondo pagina</span>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={mode === "none"}
            onChange={() => onChange(undefined)}
          />
          Nessuno
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={mode === "drive"}
            onChange={() => onChange({ source: "drive", fileId: "" })}
          />
          File Google Drive
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={mode === "embedded"}
            onChange={() => fileInput.current?.click()}
          />
          Immagine caricata (salvata nella configurazione)
        </label>
      </div>

      {mode === "drive" && (
        <div className="flex gap-2">
          <input
            type="text"
            value={driveInput}
            onChange={(e) => {
              setDriveInput(e.target.value);
              const id = extractDriveFileId(e.target.value);
              onChange({ source: "drive", fileId: id ?? "" });
            }}
            placeholder="https://drive.google.com/file/d/…"
            spellCheck={false}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 font-mono text-xs"
          />
          <button
            type="button"
            disabled={!apiKey}
            title={
              apiKey
                ? "Scegli l'immagine da Google Drive"
                : "Inserisci la Google API Key nelle impostazioni"
            }
            onClick={() => {
              setError(null);
              pickDriveDoc(apiKey, "images", "Seleziona un'immagine")
                .then((doc) => {
                  if (!doc) return;
                  setDriveInput(doc.id);
                  onChange({ source: "drive", fileId: doc.id });
                })
                .catch((e) =>
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Impossibile aprire il Picker.",
                  ),
                );
            }}
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-slate-900 hover:bg-amber-500 disabled:opacity-50"
          >
            🖼 Da Drive
          </button>
        </div>
      )}

      {mode === "embedded" && background?.dataUrl && (
        <div className="flex items-center gap-3">
          <img
            src={background.dataUrl}
            alt="anteprima sfondo"
            className="h-16 w-28 rounded object-cover"
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="rounded-lg bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
          >
            Cambia
          </button>
        </div>
      )}

      {mode !== "none" && background && (
        <label className="flex items-center gap-2 text-xs">
          Ridimensionamento:
          <select
            value={background.size ?? "fill"}
            onChange={(e) =>
              onChange({
                ...background,
                size: e.target.value as "fill" | "cover" | "contain",
              })
            }
            className="rounded bg-slate-700 px-2 py-1 text-xs"
          >
            <option value="fill">Fill (deforma per riempire)</option>
            <option value="cover">Cover (riempie, taglia)</option>
            <option value="contain">Contain (adatta, spazi vuoti)</option>
          </select>
        </label>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadFile(f);
          e.target.value = "";
        }}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
