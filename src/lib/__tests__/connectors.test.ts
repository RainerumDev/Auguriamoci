import { afterEach, describe, expect, it, vi } from "vitest";
import { extractSheetId, rowsToObjects } from "../google/sheets";
import { extractFolderId, isDownloadableMedia } from "../google/drive";
import { fetchEvents } from "../google/calendar";
import { parseConfigJson, exportConfigJson, DEFAULT_CONFIG } from "../config";

describe("extractSheetId", () => {
  it("extracts the ID from a full Sheets URL", () => {
    expect(
      extractSheetId(
        "https://docs.google.com/spreadsheets/d/1AbC_dEf-123456789012345/edit#gid=0",
      ),
    ).toBe("1AbC_dEf-123456789012345");
  });

  it("accepts a bare ID", () => {
    expect(extractSheetId("1AbC_dEf-123456789012345")).toBe(
      "1AbC_dEf-123456789012345",
    );
  });

  it("rejects garbage", () => {
    expect(extractSheetId("ciao mondo")).toBeNull();
    expect(extractSheetId("")).toBeNull();
  });
});

describe("extractFolderId", () => {
  it("extracts the ID from a folder URL", () => {
    expect(
      extractFolderId(
        "https://drive.google.com/drive/folders/1XyZ-abc_DEF123?usp=sharing",
      ),
    ).toBe("1XyZ-abc_DEF123");
  });

  it("extracts from open?id= URLs", () => {
    expect(
      extractFolderId("https://drive.google.com/open?id=1XyZ-abc_DEF123"),
    ).toBe("1XyZ-abc_DEF123");
  });

  it("accepts a bare ID", () => {
    expect(extractFolderId("1XyZ-abc_DEF123")).toBe("1XyZ-abc_DEF123");
  });
});

describe("rowsToObjects", () => {
  it("maps rows onto header names, padding missing cells", () => {
    const objs = rowsToObjects({
      header: ["Nome", "Cognome", "Data"],
      rows: [
        ["Anna", "Rossi", "12/03/2010"],
        ["Luca", "Bianchi"],
      ],
    });
    expect(objs).toEqual([
      { Nome: "Anna", Cognome: "Rossi", Data: "12/03/2010" },
      { Nome: "Luca", Cognome: "Bianchi", Data: "" },
    ]);
  });

  it("skips empty header cells", () => {
    const objs = rowsToObjects({
      header: ["Nome", ""],
      rows: [["Anna", "scarta"]],
    });
    expect(objs).toEqual([{ Nome: "Anna" }]);
  });
});

describe("isDownloadableMedia", () => {
  const base = { id: "x", name: "f", modifiedTime: "2026-01-01T00:00:00Z" };
  it("accepts images and videos within the size cap", () => {
    expect(
      isDownloadableMedia({ ...base, mimeType: "image/jpeg", size: 1000 }),
    ).toBe(true);
    expect(
      isDownloadableMedia({ ...base, mimeType: "video/mp4", size: 1000 }),
    ).toBe(true);
  });
  it("rejects oversized files and non-media types", () => {
    expect(
      isDownloadableMedia({
        ...base,
        mimeType: "video/mp4",
        size: 500 * 1024 * 1024,
      }),
    ).toBe(false);
    expect(
      isDownloadableMedia({ ...base, mimeType: "application/pdf", size: 10 }),
    ).toBe(false);
  });
});

describe("fetchEvents with API-key auth (expired session, public calendar)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the key in the URL (no Bearer header) and parses events", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "e1",
              summary: "Messa",
              start: { dateTime: "2026-07-12T10:00:00Z" },
              end: { dateTime: "2026-07-12T11:00:00Z" },
              status: "confirmed",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const payload = await fetchEvents("public@group.calendar.google.com", 7, {
      apiKey: "AIza-K",
    });

    expect(payload.events).toHaveLength(1);
    expect(payload.events[0].title).toBe("Messa");
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain("key=AIza-K");
    expect(init.headers).toEqual({});
  });
});

describe("config export/import round-trip", () => {
  it("round-trips the default config", () => {
    const json = exportConfigJson(DEFAULT_CONFIG);
    expect(parseConfigJson(json)).toEqual(DEFAULT_CONFIG);
  });

  it("rejects invalid JSON with an Italian message", () => {
    expect(() => parseConfigJson("not json")).toThrow(/JSON valido/);
  });

  it("drops malformed widgets and keeps valid ones", () => {
    const cfg = parseConfigJson(
      JSON.stringify({
        version: 1,
        widgets: [
          { id: "a", type: "drive", enabled: true, title: "Drive" },
          { id: "b", type: "unknown", enabled: true },
          "junk",
        ],
      }),
    );
    expect(cfg.widgets).toHaveLength(1);
    expect(cfg.widgets[0].id).toBe("a");
  });
});
