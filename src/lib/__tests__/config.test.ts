import { describe, expect, it } from "vitest";
import {
  createDefaultConfig,
  createWidget,
  exportConfigJson,
  parseConfigJson,
  resolveDriveFileOptions,
  type DriveWidgetConfig,
} from "../config";

describe("resolveDriveFileOptions", () => {
  const widget = (over: Partial<DriveWidgetConfig>) =>
    ({ ...createWidget("drive"), ...over }) as DriveWidgetConfig;

  it("applies the widget default fit to files without their own", () => {
    const w = widget({ defaultObjectFit: "fill" });
    expect(resolveDriveFileOptions(w, "f1")).toEqual({ objectFit: "fill" });
  });

  it("lets the per-file fit win over the default", () => {
    const w = widget({
      defaultObjectFit: "fill",
      fileOptions: { f1: { objectFit: "contain", skip: true } },
    });
    expect(resolveDriveFileOptions(w, "f1")).toEqual({
      objectFit: "contain",
      skip: true,
    });
  });

  it("returns bare per-file options when no default is set", () => {
    const w = widget({ fileOptions: { f1: { audioEnabled: true } } });
    expect(resolveDriveFileOptions(w, "f1")).toEqual({ audioEnabled: true });
    expect(resolveDriveFileOptions(w, "unknown")).toEqual({});
  });
});

describe("config export/import roundtrip", () => {
  it("preserves every field, including the newer ones", () => {
    const config = createDefaultConfig();
    config.googleClientId = "123-abc.apps.googleusercontent.com";
    config.googleApiKey = "AIzaSyTest";
    config.updateIntervalMinutes = 15;
    config.defaultPageDurationSeconds = 20;

    const birthdays = createWidget("birthdays");
    birthdays.page = 5;
    birthdays.margins = {
      top: "10%",
      right: "5%",
      bottom: "10%",
      left: "5%",
    };
    birthdays.background = {
      source: "embedded",
      dataUrl: "data:image/png;base64,AAAA",
    };

    const drive = createWidget("drive") as DriveWidgetConfig;
    drive.folderId = "folder123";
    drive.fileOptions = {
      file1: { skip: true },
      file2: { audioEnabled: true, autoDuration: true, objectFit: "contain" },
    };

    config.widgets = [birthdays, drive];

    const restored = parseConfigJson(exportConfigJson(config));
    expect(restored).toEqual(config);
  });

  it("rejects a config from a newer app version", () => {
    expect(() => parseConfigJson(JSON.stringify({ version: 999, widgets: [] })))
      .toThrow(/versione/);
  });

  it("drops malformed widgets but keeps the valid ones", () => {
    const config = createDefaultConfig();
    config.widgets = [createWidget("calendar")];
    const raw = JSON.parse(exportConfigJson(config));
    raw.widgets.push({ garbage: true }, null, { id: "x", type: "unknown" });
    const restored = parseConfigJson(JSON.stringify(raw));
    expect(restored.widgets).toHaveLength(1);
    expect(restored.widgets[0].type).toBe("calendar");
  });

  it("never contains OAuth tokens in the export", () => {
    // The token lives in localStorage under auguriamoci:oauth-token and the
    // export serializes only the AppConfig object.
    const json = exportConfigJson(createDefaultConfig());
    expect(json).not.toMatch(/token/i);
    expect(json).not.toMatch(/access/i);
  });
});
