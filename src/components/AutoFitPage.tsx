import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RenderItem } from "../lib/widgetData";

interface Props {
  items: RenderItem[];
  /** CSS margin around the content (widget config), e.g. "2rem". */
  margin?: string;
  /** Duration of EACH sub-page (seconds): total = duration × sub-pages. */
  durationSeconds: number;
  /** Called after the last sub-page has shown for its full duration. */
  onDone?: () => void;
}

/** Below this scale the text becomes unreadable: switch to sub-pages. */
const MIN_SCALE = 0.6;
/** Vertical gap between items (px); must match the gap-10 class. */
const ITEM_GAP = 40;

type Layout =
  | { phase: "measuring" }
  | { phase: "fit"; scale: number }
  | { phase: "paged"; chunks: number[][] };

/**
 * Smart widget-page layout (user request):
 * 1. measure the rendered items inside the available (margin-inset) box;
 * 2. everything fits -> show as-is; slightly too tall -> scale down to fit;
 * 3. would need scale < MIN_SCALE -> split the items into sub-pages that
 *    rotate one after another (many birthdays / events case).
 *
 * Each sub-page is shown for the FULL page duration, so a calendar that
 * spills onto N sub-pages stays on screen N × duration and drives the
 * player's advance via onDone (like an auto-duration video).
 */
export default function AutoFitPage({
  items,
  margin,
  durationSeconds,
  onDone,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>({ phase: "measuring" });
  const [subPage, setSubPage] = useState(0);

  // Keep the latest onDone without restarting the sub-page timer.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // New content or a resize invalidates the measurement.
  useLayoutEffect(() => {
    setLayout({ phase: "measuring" });
    setSubPage(0);
  }, [items]);

  useEffect(() => {
    const onResize = () => setLayout({ phase: "measuring" });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useLayoutEffect(() => {
    if (layout.phase !== "measuring") return;
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const availHeight = container.clientHeight;
    const totalHeight = measure.scrollHeight;
    if (totalHeight <= availHeight || availHeight === 0) {
      setLayout({ phase: "fit", scale: 1 });
      return;
    }
    const scale = availHeight / totalHeight;
    if (scale >= MIN_SCALE) {
      setLayout({ phase: "fit", scale });
      return;
    }

    // Greedy chunking: fill each sub-page up to the available height.
    const heights = [...measure.children].map(
      (c) => (c as HTMLElement).offsetHeight,
    );
    const chunks: number[][] = [];
    let current: number[] = [];
    let currentHeight = 0;
    heights.forEach((h, i) => {
      const needed = h + (current.length > 0 ? ITEM_GAP : 0);
      if (current.length > 0 && currentHeight + needed > availHeight) {
        chunks.push(current);
        current = [];
        currentHeight = 0;
      }
      current.push(i);
      currentHeight += h + (current.length > 1 ? ITEM_GAP : 0);
    });
    if (current.length > 0) chunks.push(current);
    setLayout({ phase: "paged", chunks });
  }, [layout]);

  // Each sub-page shows for the full duration; after the last one, hand the
  // advance back to the player (onDone). A single page still calls onDone,
  // so the player can rely on it uniformly for widget pages.
  useEffect(() => {
    if (layout.phase === "measuring") return;
    const subPages = layout.phase === "paged" ? layout.chunks.length : 1;
    const timer = window.setTimeout(() => {
      if (subPage + 1 < subPages) {
        setSubPage(subPage + 1);
      } else {
        onDoneRef.current?.();
      }
    }, durationSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [layout, subPage, durationSeconds]);

  const itemDivs = (indices: number[]) =>
    indices.map((i) => (
      // Template HTML comes from the local config (trusted); data values
      // inside it are escaped by interpolate().
      <div key={i} dangerouslySetInnerHTML={{ __html: items[i].html }} />
    ));

  const column = "flex w-full flex-col items-center gap-10 text-center";

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      style={{ padding: margin ?? "3rem" }}
    >
      {layout.phase === "measuring" && (
        <div
          ref={measureRef}
          className={`absolute w-full ${column}`}
          style={{ visibility: "hidden" }}
        >
          {itemDivs(items.map((_, i) => i))}
        </div>
      )}

      {layout.phase === "fit" && (
        <div
          className={column}
          style={
            layout.scale < 1
              ? { transform: `scale(${layout.scale})`, transformOrigin: "center" }
              : undefined
          }
        >
          {itemDivs(items.map((_, i) => i))}
        </div>
      )}

      {layout.phase === "paged" && (
        <>
          <div key={subPage} className={`${column} animate-[fadein_0.4s_ease]`}>
            {itemDivs(layout.chunks[subPage] ?? [])}
          </div>
          {/* Sub-page dots */}
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
            {layout.chunks.map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${
                  i === subPage ? "bg-slate-300" : "bg-slate-600/60"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
