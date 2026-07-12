/**
 * Configuration schema for Auguriamoci.
 *
 * The whole app state that survives a reinstall lives here: widget layout,
 * column mappings and Google file IDs. It is persisted in IndexedDB (kv table)
 * and can be exported/imported as a plain JSON file.
 *
 * SECURITY: OAuth tokens are NEVER part of this object, so exports are safe
 * to share between machines.
 */

export const CONFIG_VERSION = 1;

export type WidgetType = "birthdays" | "namedays" | "calendar" | "drive";

/** Optional page background for template widgets. */
export interface WidgetBackground {
  source: "drive" | "embedded";
  /** Google Drive file ID (source = "drive"); blob cached in IndexedDB. */
  fileId?: string;
  /** data: URL (source = "embedded"); travels inside config exports. */
  dataUrl?: string;
  /** How the background image fills the page. Default: "fill". */
  size?: "fill" | "cover" | "contain";
}

/** Per-side content margins (CSS values: "20px", "2rem", "12%"). */
export interface WidgetMargins {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

export interface BaseWidgetConfig {
  id: string;
  type: WidgetType;
  /** Human label shown in settings. */
  title: string;
  enabled: boolean;
  /** Fixed page number in the presentation. Undefined = not placed yet. */
  page?: number;
  /** Per-page duration override (seconds). Falls back to the global default. */
  durationSeconds?: number;
  /** Legacy single margin (all sides). Superseded by `margins`. */
  margin?: string;
  /** Per-side content margins; define the rectangle where content renders. */
  margins?: WidgetMargins;
  /** Page background image, rendered behind the widget/media content. */
  background?: WidgetBackground;
}

/** CSS padding shorthand for the content box (margins > legacy margin). */
export function widgetPadding(w: BaseWidgetConfig): string | undefined {
  if (w.margins) {
    const { top, right, bottom, left } = w.margins;
    // All sides untouched -> no override: the player default applies.
    if (!top.trim() && !right.trim() && !bottom.trim() && !left.trim()) {
      return w.margin;
    }
    return `${top || "0px"} ${right || "0px"} ${bottom || "0px"} ${left || "0px"}`;
  }
  return w.margin;
}

/** Column mapping: template field name -> sheet header (as written in row 1). */
export type ColumnMapping = Record<string, string>;

export interface BirthdaysWidgetConfig extends BaseWidgetConfig {
  type: "birthdays";
  /** Google Sheet ID (extracted from the pasted URL). */
  sheetId: string;
  /** Sheet tab name; empty = first tab. */
  sheetRange: string;
  columns: ColumnMapping;
  /** Header of the column that contains the birth date. */
  dateColumn: string;
  /** Show birthdays from today up to N days ahead. */
  lookAheadDays: number;
  /** HTML template with {placeholders} bound to mapped columns. */
  template: string;
}

export interface NamedaysWidgetConfig extends BaseWidgetConfig {
  type: "namedays";
  /** "sheet" = external sheet with its own date column; "builtin" = bundled dictionary. */
  source: "sheet" | "builtin";
  sheetId: string;
  sheetRange: string;
  columns: ColumnMapping;
  /** Only for source = "sheet". */
  dateColumn: string;
  /** Only for source = "builtin": header of the column holding first names. */
  nameColumn: string;
  lookAheadDays: number;
  template: string;
}

export interface CalendarWidgetConfig extends BaseWidgetConfig {
  type: "calendar";
  /** Google Calendar ID. */
  calendarId: string;
  calendarLabel: string;
  lookAheadDays: number;
  /** Template fields: {titolo} {data_inizio} {ora_inizio} {descrizione} {luogo}. */
  template: string;
}

export interface DriveFileOptions {
  skip?: boolean;
  audioEnabled?: boolean;
  objectFit?: "contain" | "cover" | "fill";
  autoDuration?: boolean;
}

export interface DriveWidgetConfig extends BaseWidgetConfig {
  type: "drive";
  /** Google Drive folder ID. */
  folderId: string;
  folderLabel: string;
  /** Opzioni specifiche per i singoli file. La chiave è l'ID del file. */
  fileOptions?: Record<string, DriveFileOptions>;
  /**
   * Adattamento predefinito per tutte le immagini della cartella (anche
   * quelle aggiunte in futuro); il per-file `objectFit` lo sovrascrive.
   */
  defaultObjectFit?: "contain" | "cover" | "fill";
}

/** Per-file options with the widget-wide default fit applied as fallback. */
export function resolveDriveFileOptions(
  widget: DriveWidgetConfig,
  fileId: string,
): DriveFileOptions {
  const options = { ...widget.fileOptions?.[fileId] };
  if (options.objectFit == null && widget.defaultObjectFit) {
    options.objectFit = widget.defaultObjectFit;
  }
  return options;
}

export type WidgetConfig =
  | BirthdaysWidgetConfig
  | NamedaysWidgetConfig
  | CalendarWidgetConfig
  | DriveWidgetConfig;

export interface AppConfig {
  version: number;
  /**
   * Google OAuth Client ID (public identifier, safe to export).
   * Created by the user in Google Cloud Console for a "Web application".
   */
  googleClientId: string;
  googleApiKey: string;
  /** Background data refresh interval, in minutes. */
  updateIntervalMinutes: number;
  /** Default page duration, in seconds. */
  defaultPageDurationSeconds: number;
  widgets: WidgetConfig[];
}

export const DEFAULT_CONFIG: AppConfig = {
  version: CONFIG_VERSION,
  googleClientId: "",
  googleApiKey: "",
  updateIntervalMinutes: 30,
  defaultPageDurationSeconds: 15,
  widgets: [],
};

export function createDefaultConfig(): AppConfig {
  return structuredClone(DEFAULT_CONFIG);
}

/** Serialize for the "Esporta configurazione" feature. */
export function exportConfigJson(config: AppConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Parse and validate an imported configuration file.
 * Throws Error with an Italian, user-facing message when invalid.
 */
export function parseConfigJson(raw: string): AppConfig {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Il file non è un JSON valido.");
  }
  if (typeof data !== "object" || data === null) {
    throw new Error("Il file non contiene una configurazione valida.");
  }
  const cfg = data as Partial<AppConfig>;
  if (typeof cfg.version !== "number" || cfg.version > CONFIG_VERSION) {
    throw new Error(
      "La configurazione proviene da una versione dell'app non supportata.",
    );
  }
  if (!Array.isArray(cfg.widgets)) {
    throw new Error("La configurazione non contiene la lista dei widget.");
  }
  return {
    version: CONFIG_VERSION,
    googleClientId:
      typeof cfg.googleClientId === "string" ? cfg.googleClientId : "",
    googleApiKey:
      typeof cfg.googleApiKey === "string" ? cfg.googleApiKey : "",
    updateIntervalMinutes:
      typeof cfg.updateIntervalMinutes === "number" &&
      cfg.updateIntervalMinutes >= 1
        ? cfg.updateIntervalMinutes
        : DEFAULT_CONFIG.updateIntervalMinutes,
    defaultPageDurationSeconds:
      typeof cfg.defaultPageDurationSeconds === "number" &&
      cfg.defaultPageDurationSeconds >= 3
        ? cfg.defaultPageDurationSeconds
        : DEFAULT_CONFIG.defaultPageDurationSeconds,
    widgets: cfg.widgets.filter(isWidgetConfig),
  };
}

function isWidgetConfig(w: unknown): w is WidgetConfig {
  if (typeof w !== "object" || w === null) return false;
  const base = w as Partial<BaseWidgetConfig>;
  return (
    typeof base.id === "string" &&
    typeof base.enabled === "boolean" &&
    (base.type === "birthdays" ||
      base.type === "namedays" ||
      base.type === "calendar" ||
      base.type === "drive")
  );
}

export function newWidgetId(): string {
  return crypto.randomUUID();
}

export const WIDGET_TYPE_LABELS: Record<WidgetType, string> = {
  birthdays: "Compleanni",
  namedays: "Onomastici",
  calendar: "Calendario",
  drive: "Media da Drive",
};

/** New widget with sensible defaults for the editor. */
export function createWidget(type: WidgetType): WidgetConfig {
  const base = {
    id: newWidgetId(),
    title: WIDGET_TYPE_LABELS[type],
    enabled: true,
  };
  switch (type) {
    case "birthdays":
      return {
        ...base,
        type,
        sheetId: "",
        sheetRange: "",
        columns: {},
        dateColumn: "",
        lookAheadDays: 0,
        template:
          '<h1 style="font-size:4em">🎂 {Nome}</h1>\n<h3 style="font-size:2em">{data_festa}</h3>',
      };
    case "namedays":
      return {
        ...base,
        type,
        source: "builtin",
        sheetId: "",
        sheetRange: "",
        columns: {},
        dateColumn: "",
        nameColumn: "",
        lookAheadDays: 0,
        template:
          '<h1 style="font-size:4em">🎉 {Nome}</h1>\n<h3 style="font-size:2em">{data_festa}</h3>',
      };
    case "calendar":
      return {
        ...base,
        type,
        calendarId: "",
        calendarLabel: "",
        lookAheadDays: 0,
        template:
          '<h2 style="font-size:3em">{titolo}</h2>\n<p style="font-size:1.5em">{data_inizio} {ora_inizio} — {luogo}</p>',
      };
    case "drive":
      return { ...base, type, folderId: "", folderLabel: "" };
  }
}
