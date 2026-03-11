import { useEffect, useRef, useState } from "react";
import { ACCENT, BG, BORDER, CARD, MUTED, TEXT } from "../lib/constants";

const TOOLS = [
  { cmd: "bold",          icon: "B",   title: "Bold",           style: { fontWeight: 800 } },
  { cmd: "italic",        icon: "I",   title: "Italic",         style: { fontStyle: "italic" } },
  { cmd: "underline",     icon: "U",   title: "Underline",      style: { textDecoration: "underline" } },
  { cmd: "separator" },
  { cmd: "formatBlock",   arg: "h2",   icon: "H2",  title: "Heading 2",    style: { fontWeight: 700, fontSize: 13 } },
  { cmd: "formatBlock",   arg: "h3",   icon: "H3",  title: "Heading 3",    style: { fontWeight: 700, fontSize: 13 } },
  { cmd: "separator" },
  { cmd: "insertUnorderedList", icon: "•—", title: "Bullet list",   style: { fontSize: 14 } },
  { cmd: "insertOrderedList",   icon: "1.", title: "Numbered list", style: { fontWeight: 700, fontSize: 12 } },
  { cmd: "separator" },
  { cmd: "removeFormat",  icon: "✕",   title: "Clear formatting", style: { fontSize: 11, color: MUTED } },
];

export default function FindingsEditor({ value, onChange }) {
  const editorRef = useRef(null);
  const [activeFormats, setActiveFormats] = useState({});
  const savedSelection = useRef(null);

  // Initialise content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== (value || "")) {
      editorRef.current.innerHTML = value || "";
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedSelection.current = sel.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    if (savedSelection.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedSelection.current);
    }
  };

  const checkFormats = () => {
    setActiveFormats({
      bold:      document.queryCommandState("bold"),
      italic:    document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
    });
  };

  const execCmd = (cmd, arg) => {
    restoreSelection();
    document.execCommand(cmd, false, arg ?? null);
    editorRef.current?.focus();
    if (onChange) onChange(editorRef.current.innerHTML);
    checkFormats();
  };

  const handleInput = () => {
    if (onChange) onChange(editorRef.current.innerHTML);
    checkFormats();
  };

  const isActive = (cmd) => activeFormats[cmd] || false;

  return (
    <div style={{ border: `1.5px solid ${BORDER}`, borderRadius: 8, overflow: "hidden", background: CARD }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "8px 10px", borderBottom: `1px solid ${BORDER}`, background: BG, flexWrap: "wrap" }}>
        {TOOLS.map((t, i) => {
          if (t.cmd === "separator") {
            return <div key={i} style={{ width: 1, height: 18, background: BORDER, margin: "0 4px" }} />;
          }
          const active = isActive(t.cmd);
          return (
            <button
              key={i}
              title={t.title}
              onMouseDown={(e) => { e.preventDefault(); saveSelection(); execCmd(t.cmd, t.arg); }}
              style={{
                ...t.style,
                background: active ? "#EEF2FF" : "none",
                border: active ? `1.5px solid #C7D2FE` : "1.5px solid transparent",
                color: active ? ACCENT : TEXT,
                borderRadius: 5,
                padding: "3px 8px",
                fontSize: t.style?.fontSize ?? 13,
                cursor: "pointer",
                fontFamily: "'Inter',sans-serif",
                lineHeight: 1.4,
                minWidth: 28,
                textAlign: "center",
                transition: "background .1s, border-color .1s",
              }}>
              {t.icon}
            </button>
          );
        })}
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyUp={checkFormats}
        onMouseUp={checkFormats}
        onSelect={checkFormats}
        onBlur={saveSelection}
        style={{
          minHeight: 200,
          padding: "16px 18px",
          fontSize: 14,
          color: TEXT,
          lineHeight: 1.8,
          outline: "none",
          fontFamily: "'Inter',sans-serif",
          overflowY: "auto",
        }}
      />

      <style>{`
        [contenteditable] h2 { font-size: 17px; font-weight: 800; margin: 12px 0 6px; color: ${TEXT}; }
        [contenteditable] h3 { font-size: 15px; font-weight: 700; margin: 10px 0 4px; color: ${TEXT}; }
        [contenteditable] ul { padding-left: 22px; margin: 6px 0; }
        [contenteditable] ol { padding-left: 22px; margin: 6px 0; }
        [contenteditable] li { margin: 3px 0; }
        [contenteditable] p  { margin: 4px 0; }
      `}</style>
    </div>
  );
}
