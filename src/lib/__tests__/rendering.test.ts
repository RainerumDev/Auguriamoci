import { describe, expect, it } from "vitest";
import { escapeHtml, extractPlaceholders, interpolate } from "../template";
import {
  daysUntilNext,
  occursInWindow,
  parseDayMonth,
  suggestDateColumn,
} from "../dates";
import { dictionarySize, findNameday, normalizeName } from "../namedays";
import {
  buildBirthdayItems,
  buildCalendarItems,
  buildNamedayItems,
} from "../widgetData";

describe("interpolate", () => {
  it("replaces placeholders with escaped values", () => {
    expect(
      interpolate("<h1>{nome} {cognome}</h1>", {
        nome: "Anna & Co",
        cognome: "<b>Rossi</b>",
      }),
    ).toBe("<h1>Anna &amp; Co &lt;b&gt;Rossi&lt;/b&gt;</h1>");
  });

  it("resolves missing keys to empty string and keeps template HTML", () => {
    expect(interpolate("<p>{manca}</p>", {})).toBe("<p></p>");
  });

  it("supports accented and spaced keys", () => {
    expect(interpolate("{ città }", { città: "Trento" })).toBe("Trento");
  });

  it("extractPlaceholders dedupes in order", () => {
    expect(extractPlaceholders("{a} {b} {a}")).toEqual(["a", "b"]);
  });

  it("escapeHtml covers the four critical chars", () => {
    expect(escapeHtml(`<a href="x">&`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;",
    );
  });
});

describe("parseDayMonth", () => {
  it.each([
    ["12/03/2010", 12, 3],
    ["1-9-99", 1, 9],
    ["05.10.1980", 5, 10],
    ["12/3", 12, 3],
    ["2010-03-12", 12, 3],
    ["2010-03-12T00:00:00Z", 12, 3],
  ])("parses %s", (input, day, month) => {
    expect(parseDayMonth(input)).toEqual({ day, month });
  });

  it("rejects invalid values", () => {
    expect(parseDayMonth("")).toBeNull();
    expect(parseDayMonth("ciao")).toBeNull();
    expect(parseDayMonth("32/01/2000")).toBeNull();
    expect(parseDayMonth("10/13/2000")).toBeNull();
  });
});

describe("recurrence window", () => {
  const today = new Date(2026, 6, 11); // 11 luglio 2026

  it("counts days to the next occurrence", () => {
    expect(daysUntilNext({ day: 11, month: 7 }, today)).toBe(0);
    expect(daysUntilNext({ day: 14, month: 7 }, today)).toBe(3);
  });

  it("wraps around the year end", () => {
    expect(daysUntilNext({ day: 1, month: 1 }, new Date(2026, 11, 30))).toBe(2);
  });

  it("filters by look-ahead window", () => {
    expect(occursInWindow({ day: 14, month: 7 }, today, 3)).toBe(true);
    expect(occursInWindow({ day: 15, month: 7 }, today, 3)).toBe(false);
  });

  it("suggests the date column via PRD regex", () => {
    expect(suggestDateColumn(["Nome", "Data di nascita"])).toBe(
      "Data di nascita",
    );
    expect(suggestDateColumn(["Name", "Birthdate"])).toBe("Birthdate");
    expect(suggestDateColumn(["Nome", "Classe"])).toBeNull();
  });
});

describe("namedays dictionary", () => {
  it("has a usable size", () => {
    expect(dictionarySize()).toBeGreaterThan(200);
  });

  it("normalizes case and accents", () => {
    expect(normalizeName("  NICOLÒ ")).toBe("nicolo");
    expect(findNameday("NICOLÒ")).toEqual({ day: 6, month: 12 });
  });

  it("matches compound names by first token", () => {
    expect(findNameday("Maria Grazia")).toEqual(findNameday("maria"));
  });

  it("returns null for unknown names", () => {
    expect(findNameday("Xyzabc")).toBeNull();
  });
});

describe("buildBirthdayItems", () => {
  const today = new Date(2026, 6, 11);
  const payload = {
    header: ["Nome", "Data di nascita", "Classe"],
    rows: [
      ["Anna", "13/07/2010", "2A"],
      ["Luca", "11/07/2011", "1B"],
      ["Sara", "01/01/2012", "3C"],
      ["Rotto", "boh", "3C"],
    ],
  };

  it("filters the window, sorts soonest first, interpolates", () => {
    const items = buildBirthdayItems(
      {
        dateColumn: "Data di nascita",
        lookAheadDays: 3,
        template: "<h1>{Nome}</h1><h3>{Classe} — {data_festa}</h3>",
      },
      payload,
      today,
    );
    expect(items.map((i) => i.daysUntil)).toEqual([0, 2]);
    expect(items[0].html).toBe("<h1>Luca</h1><h3>1B — 11 luglio</h3>");
    expect(items[1].html).toContain("Anna");
  });
});

describe("buildNamedayItems (builtin source)", () => {
  it("resolves dates from the dictionary", () => {
    // Giovanni = 24/6.
    const items = buildNamedayItems(
      {
        source: "builtin",
        dateColumn: "",
        nameColumn: "Nome",
        lookAheadDays: 5,
        template: "{Nome}: {data_festa}",
      },
      { header: ["Nome"], rows: [["GIOVANNI"], ["Xyzabc"]] },
      new Date(2026, 5, 20), // 20 giugno
    );
    expect(items).toHaveLength(1);
    expect(items[0].html).toBe("GIOVANNI: 24 giugno");
    expect(items[0].daysUntil).toBe(4);
  });
});

describe("buildCalendarItems", () => {
  const now = new Date(2026, 6, 11, 10, 0);

  it("interpolates the fixed fields and drops ended events", () => {
    const items = buildCalendarItems(
      { lookAheadDays: 1, template: "{titolo} {ora_inizio} @{luogo}" },
      {
        events: [
          {
            id: "1",
            title: "Torneo",
            description: "",
            location: "Palestra",
            start: new Date(2026, 6, 11, 15, 0).toISOString(),
            end: new Date(2026, 6, 11, 17, 0).toISOString(),
            allDay: false,
          },
          {
            id: "2",
            title: "Finita",
            description: "",
            location: "",
            start: new Date(2026, 6, 11, 7, 0).toISOString(),
            end: new Date(2026, 6, 11, 8, 0).toISOString(),
            allDay: false,
          },
          {
            id: "3",
            title: "Troppo lontano",
            description: "",
            location: "",
            start: new Date(2026, 6, 20).toISOString(),
            end: new Date(2026, 6, 21).toISOString(),
            allDay: true,
          },
        ],
      },
      now,
    );
    expect(items).toHaveLength(1);
    expect(items[0].html).toBe("Torneo 15:00 @Palestra");
    expect(items[0].daysUntil).toBe(0);
  });

  it("renders all-day events without time", () => {
    const items = buildCalendarItems(
      { lookAheadDays: 0, template: "{titolo}[{ora_inizio}]" },
      {
        events: [
          {
            id: "1",
            title: "Festa",
            description: "",
            location: "",
            start: "2026-07-11",
            end: "2026-07-12",
            allDay: true,
          },
        ],
      },
      now,
    );
    expect(items).toHaveLength(1);
    expect(items[0].html).toBe("Festa[]");
  });
});
