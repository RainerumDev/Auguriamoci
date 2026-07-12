import { useRef, useState } from "react";
import type { WidgetMargins } from "../lib/config";

interface Props {
  /** Legacy single-value margin (all sides). */
  margin?: string;
  margins?: WidgetMargins;
  onChange: (margins: WidgetMargins) => void;
}

const EMPTY: WidgetMargins = { top: "", right: "", bottom: "", left: "" };
const SIDE_LABELS: Record<keyof WidgetMargins, string> = {
  top: "Sopra",
  right: "Destra",
  bottom: "Sotto",
  left: "Sinistra",
};

/** "12%" -> 12; "" -> 0; any other unit -> null (not drawable). */
function pctOrZero(v: string): number | null {
  const trimmed = v.trim();
  if (trimmed === "") return 0;
  const m = /^(-?\d+(?:\.\d+)?)%$/.exec(trimmed);
  return m ? Number(m[1]) : null;
}

/**
 * Per-side content margins with a visual rectangle selector: drag on a 16:9
 * preview of the screen to define where the widget text appears.
 */
export default function MarginsField({ margin, margins, onChange }: Props) {
  const value =
    margins ??
    (margin
      ? { top: margin, right: margin, bottom: margin, left: margin }
      : EMPTY);
  const [showSelector, setShowSelector] = useState(false);

  return (
    <div className="space-y-3 rounded-xl bg-slate-800/50 p-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-slate-300">
          Margini contenuto (px, rem o % — vuoto = 0)
        </span>
        <button
          type="button"
          onClick={() => setShowSelector((s) => !s)}
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-600"
        >
          {showSelector ? "Chiudi selezione" : "🎯 Seleziona area"}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {(Object.keys(SIDE_LABELS) as (keyof WidgetMargins)[]).map((side) => (
          <label key={side} className="block">
            <span className="mb-1 block text-xs text-slate-400">
              {SIDE_LABELS[side]}
            </span>
            <input
              type="text"
              value={value[side]}
              placeholder="0"
              spellCheck={false}
              onChange={(e) => onChange({ ...value, [side]: e.target.value })}
              className="w-full rounded-lg bg-slate-800 px-2 py-1.5 text-xs"
            />
          </label>
        ))}
      </div>

      {showSelector && <RectSelector value={value} onChange={onChange} />}
    </div>
  );
}

function RectSelector({
  value,
  onChange,
}: {
  value: WidgetMargins;
  onChange: (margins: WidgetMargins) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);

  const toPct = (e: React.PointerEvent) => {
    const r = boxRef.current!.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)),
    };
  };

  const commit = () => {
    if (!drag) return;
    const left = Math.min(drag.x0, drag.x1);
    const right = Math.max(drag.x0, drag.x1);
    const top = Math.min(drag.y0, drag.y1);
    const bottom = Math.max(drag.y0, drag.y1);
    // Ignore accidental clicks: require a rectangle of at least 5% x 5%.
    if (right - left >= 5 && bottom - top >= 5) {
      onChange({
        top: `${top.toFixed(1)}%`,
        right: `${(100 - right).toFixed(1)}%`,
        bottom: `${(100 - bottom).toFixed(1)}%`,
        left: `${left.toFixed(1)}%`,
      });
    }
    setDrag(null);
  };

  // Rectangle to draw: the drag in progress, or the saved %-margins.
  let rect: { top: number; left: number; w: number; h: number } | null = null;
  if (drag) {
    rect = {
      left: Math.min(drag.x0, drag.x1),
      top: Math.min(drag.y0, drag.y1),
      w: Math.abs(drag.x1 - drag.x0),
      h: Math.abs(drag.y1 - drag.y0),
    };
  } else {
    const top = pctOrZero(value.top);
    const right = pctOrZero(value.right);
    const bottom = pctOrZero(value.bottom);
    const left = pctOrZero(value.left);
    if (top !== null && right !== null && bottom !== null && left !== null) {
      rect = {
        top,
        left,
        w: Math.max(0, 100 - left - right),
        h: Math.max(0, 100 - top - bottom),
      };
    }
  }

  return (
    <div className="space-y-1">
      <div
        ref={boxRef}
        onPointerDown={(e) => {
          boxRef.current?.setPointerCapture(e.pointerId);
          const p = toPct(e);
          setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
        }}
        onPointerMove={(e) => {
          if (!drag) return;
          const p = toPct(e);
          setDrag({ ...drag, x1: p.x, y1: p.y });
        }}
        onPointerUp={commit}
        onPointerCancel={() => setDrag(null)}
        className="relative aspect-video w-full cursor-crosshair touch-none rounded-lg border border-slate-600 bg-slate-950 select-none"
      >
        {rect && rect.w > 0 && rect.h > 0 && (
          <div
            className="pointer-events-none absolute flex items-center justify-center rounded border-2 border-amber-400 bg-amber-400/10 text-xs text-amber-300"
            style={{
              top: `${rect.top}%`,
              left: `${rect.left}%`,
              width: `${rect.w}%`,
              height: `${rect.h}%`,
            }}
          >
            testo qui
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Trascina sul riquadro (schermo 16:9) per disegnare il rettangolo dove
        apparirà il contenuto: i margini si compilano in %.
      </p>
    </div>
  );
}
