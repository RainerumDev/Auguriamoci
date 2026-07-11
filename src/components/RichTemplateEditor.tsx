import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  /** Placeholder names shown as clickable chips ({nome}, {data_festa}, …). */
  placeholders: string[];
  onChange: (html: string) => void;
}

/**
 * Word-like template editor: rich text via contenteditable + execCommand,
 * with an HTML source toggle. Placeholder chips insert at the caret.
 */
export default function RichTemplateEditor({
  value,
  placeholders,
  onChange,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const [showSource, setShowSource] = useState(false);

  // Load content into the contenteditable only when (re)entering rich mode:
  // rewriting innerHTML on every keystroke would reset the caret.
  useEffect(() => {
    if (!showSource && editorRef.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSource]);

  const emit = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const exec = (command: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  const insertPlaceholder = (name: string) => {
    const text = `{${name}}`;
    if (showSource) {
      const ta = sourceRef.current;
      if (!ta) return;
      const start = ta.selectionStart ?? ta.value.length;
      const end = ta.selectionEnd ?? start;
      const next = ta.value.slice(0, start) + text + ta.value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        ta.focus();
        ta.selectionStart = ta.selectionEnd = start + text.length;
      });
    } else {
      editorRef.current?.focus();
      document.execCommand("insertText", false, text);
      emit();
    }
  };

  // mousedown preventDefault: keep the caret/selection in the editor while
  // clicking toolbar buttons and chips.
  const keepSelection = (e: React.MouseEvent) => e.preventDefault();

  const btn =
    "rounded px-2 py-1 text-xs font-semibold hover:bg-slate-600 bg-slate-700";

  return (
    <div className="text-sm">
      <span className="mb-1 block text-slate-300">
        Template (usa i placeholder per i dati)
      </span>

      <div className="flex flex-wrap items-center gap-1 rounded-t-lg bg-slate-800 p-2">
        <button type="button" className={btn} onMouseDown={keepSelection}
          onClick={() => exec("bold")} title="Grassetto">
          <b>G</b>
        </button>
        <button type="button" className={btn} onMouseDown={keepSelection}
          onClick={() => exec("italic")} title="Corsivo">
          <i>C</i>
        </button>
        <button type="button" className={btn} onMouseDown={keepSelection}
          onClick={() => exec("underline")} title="Sottolineato">
          <u>S</u>
        </button>
        <select
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            if (e.target.value) exec("fontSize", e.target.value);
            e.target.value = "";
          }}
          defaultValue=""
          className="rounded bg-slate-700 px-1 py-1 text-xs"
          title="Dimensione testo"
        >
          <option value="" disabled>
            Dimensione
          </option>
          <option value="2">Piccolo</option>
          <option value="3">Normale</option>
          <option value="5">Grande</option>
          <option value="6">Molto grande</option>
          <option value="7">Enorme</option>
        </select>
        <input
          type="color"
          defaultValue="#f8fafc"
          onMouseDown={keepSelection}
          onChange={(e) => exec("foreColor", e.target.value)}
          className="h-6 w-8 cursor-pointer rounded bg-slate-700"
          title="Colore testo"
        />
        <button type="button" className={btn} onMouseDown={keepSelection}
          onClick={() => exec("justifyLeft")} title="Allinea a sinistra">
          ⬅
        </button>
        <button type="button" className={btn} onMouseDown={keepSelection}
          onClick={() => exec("justifyCenter")} title="Centra">
          ↔
        </button>
        <button type="button" className={btn} onMouseDown={keepSelection}
          onClick={() => exec("justifyRight")} title="Allinea a destra">
          ➡
        </button>
        <button type="button" className={btn} onMouseDown={keepSelection}
          onClick={() => exec("removeFormat")} title="Pulisci formattazione">
          ✕F
        </button>
        <button
          type="button"
          className={`${btn} ml-auto ${showSource ? "bg-amber-600" : ""}`}
          onClick={() => setShowSource((s) => !s)}
          title="Mostra/Nascondi HTML"
        >
          {"</>"}
        </button>
      </div>

      {showSource ? (
        <textarea
          ref={sourceRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          spellCheck={false}
          className="w-full rounded-b-lg bg-slate-950 px-3 py-2 font-mono text-xs"
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          className="min-h-28 w-full rounded-b-lg bg-slate-950 px-3 py-2 outline-none focus:ring-1 focus:ring-amber-500"
        />
      )}

      {placeholders.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {placeholders.map((p) => (
            <button
              key={p}
              type="button"
              onMouseDown={keepSelection}
              onClick={() => insertPlaceholder(p)}
              title="Inserisci alla posizione del cursore"
              className="rounded-full bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
            >
              {"{" + p + "}"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
