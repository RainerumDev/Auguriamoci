import { describe, expect, it } from "vitest";
import {
  buildTimeline,
  parsePagePrefix,
  resolveCycle,
  type DriveFileForTimeline,
  type TimelineItem,
} from "../timeline";
import { createWidget, type WidgetConfig } from "../config";

function widget(
  type: WidgetConfig["type"],
  page?: number,
  enabled = true,
): WidgetConfig {
  const w = createWidget(type);
  w.page = page;
  w.enabled = enabled;
  return w;
}

function file(name: string, id = name): DriveFileForTimeline {
  return {
    widgetId: "drive-w",
    fileId: id,
    name,
    mimeType: "image/jpeg",
  };
}

describe("parsePagePrefix", () => {
  it.each([
    ["5_sfondo.jpg", 5],
    ["15-promo.mp4", 15],
    ["3 avviso.png", 3],
    ["007_bond.jpg", 7],
  ])("parses %s -> %d", (name, page) => {
    expect(parsePagePrefix(name)).toBe(page);
  });

  it("returns null without the numeric prefix", () => {
    expect(parsePagePrefix("sfondo.jpg")).toBeNull();
    expect(parsePagePrefix("5sfondo.jpg")).toBeNull();
    expect(parsePagePrefix("v2_finale.jpg")).toBeNull();
  });
});

describe("buildTimeline", () => {
  it("pins widgets and prefixed files, fills gaps with the rest (PRD example)", () => {
    // Compleanni = pagina 5; Calendario = pagina 10; 15_promo pinned;
    // 3 unprefixed files fill pages 1, 2, 3.
    const birthdays = widget("birthdays", 5);
    const calendar = widget("calendar", 10);
    const timeline = buildTimeline(
      [birthdays, calendar],
      [file("a.jpg"), file("15_promo.mp4"), file("b.jpg"), file("c.jpg")],
    );

    expect(timeline.map((e) => e.page)).toEqual([1, 2, 3, 5, 10, 15]);
    expect(timeline.find((e) => e.page === 5)!.candidates[0]).toMatchObject({
      kind: "widget",
      widgetId: birthdays.id,
    });
    expect(timeline.find((e) => e.page === 15)!.candidates[0]).toMatchObject({
      kind: "file",
      name: "15_promo.mp4",
    });
    expect(timeline.find((e) => e.page === 1)!.candidates[0]).toMatchObject({
      name: "a.jpg",
    });
  });

  it("groups collisions on the same page", () => {
    const birthdays = widget("birthdays", 5);
    const timeline = buildTimeline(
      [birthdays],
      [file("5_festa.jpg"), file("5_avviso.png")],
    );
    expect(timeline).toHaveLength(1);
    expect(timeline[0].page).toBe(5);
    expect(timeline[0].candidates).toHaveLength(3);
  });

  it("skips disabled widgets and fills around pinned fillers", () => {
    const timeline = buildTimeline(
      [widget("birthdays", 1, false), widget("calendar", 2)],
      [file("x.jpg"), file("y.jpg")],
    );
    // calendar pinned at 2; fillers x -> 1, y -> 3.
    expect(timeline.map((e) => e.page)).toEqual([1, 2, 3]);
    expect(timeline[0].candidates[0]).toMatchObject({ name: "x.jpg" });
    expect(timeline[2].candidates[0]).toMatchObject({ name: "y.jpg" });
  });

  it("unpaged widgets act as fillers too", () => {
    const b = widget("birthdays");
    const timeline = buildTimeline([b], [file("z.jpg")]);
    expect(timeline.map((e) => e.page)).toEqual([1, 2]);
    expect(timeline[0].candidates[0]).toMatchObject({ widgetId: b.id });
  });
});

describe("resolveCycle", () => {
  const available = () => true;

  it("applies per-widget duration override and global default", () => {
    const b = widget("birthdays", 1);
    b.durationSeconds = 42;
    const timeline = buildTimeline([b], [file("a.jpg")]);
    const pages = resolveCycle(timeline, 15, available, () => 0);
    expect(pages).toEqual([
      expect.objectContaining({ page: 1, durationSeconds: 42 }),
      expect.objectContaining({ page: 2, durationSeconds: 15 }),
    ]);
  });

  it("drops pages whose candidates are unavailable", () => {
    const b = widget("birthdays", 1);
    const timeline = buildTimeline([b], [file("a.jpg")]);
    const noWidgets = (i: TimelineItem) => i.kind !== "widget";
    const pages = resolveCycle(timeline, 15, noWidgets);
    expect(pages).toHaveLength(1);
    expect(pages[0].item.kind).toBe("file");
  });

  it("carries per-file options onto timeline items", () => {
    const timeline = buildTimeline(
      [],
      [
        {
          ...file("v.mp4"),
          options: { audioEnabled: true, autoDuration: true },
        },
      ],
    );
    const item = timeline[0].candidates[0];
    expect(item.kind).toBe("file");
    expect((item as { options?: object }).options).toEqual({
      audioEnabled: true,
      autoDuration: true,
    });
  });

  it("shuffles collisions using the provided rng", () => {
    const timeline = buildTimeline([], [file("5_a.jpg"), file("5_b.jpg")]);
    const first = resolveCycle(timeline, 15, available, () => 0);
    const second = resolveCycle(timeline, 15, available, () => 0.99);
    expect((first[0].item as { name?: string }).name).toBe("5_a.jpg");
    expect((second[0].item as { name?: string }).name).toBe("5_b.jpg");
  });
});
