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
  { cmd: "link",          icon: "🔗",  title: "Insert link",    style: { fontSize: 13 } },
  { cmd: "image",         icon: "🖼",  title: "Insert image",   style: { fontSize: 13 } },
  { cmd: "separator" },
  { cmd: "removeFormat",  icon: "✕",   title: "Clear formatting", style: { fontSize: 11, color: MUTED } },
];

export default function FindingsEditor({ value, onChange }) {
  const editorRef  = useRef(null);
  const imgRef     = useRef(null);
  const [activeFormats, setActiveFormats] = useState({});
  const [linkPrompt, setLinkPrompt]       = useState(false);
  const [linkUrl, setLinkUrl]             = useState("");
  const [linkText, setLinkText]           = useState("");
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

  // ── Link ──────────────────────────────────────────────────────────────────
  const openLinkPrompt = () => {
    saveSelection();
    const sel = window.getSelection();
    const selectedText = sel && sel.rangeCount > 0 ? sel.toString() : "";
    setLinkText(selectedText);
    setLinkUrl("");
    setLinkPrompt(true);
  };

  const insertLink = () => {
    if (!linkUrl) { setLinkPrompt(false); return; }
    restoreSelection();
    const href = linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`;
    const sel = window.getSelection();
    const hasSelection = sel && sel.rangeCount > 0 && !sel.isCollapsed;
    if (hasSelection) {
      document.execCommand("createLink", false, href);
      // Make it open in new tab
      const links = editorRef.current.querySelectorAll(`a[href="${href}"]`);
      links.forEach(a => a.setAttribute("target", "_blank"));
    } else {
      const display = linkText || href;
      restoreSelection();
      const range = savedSelection.current;
      if (range) {
        const a = document.createElement("a");
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = display;
        range.deleteContents();
        range.insertNode(a);
        // Move cursor after the link
        range.setStartAfter(a);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    editorRef.current?.focus();
    if (onChange) onChange(editorRef.current.innerHTML);
    setLinkPrompt(false);
  };

  // ── Image ─────────────────────────────────────────────────────────────────
  const openImagePicker = () => {
    saveSelection();
    imgRef.current?.click();
  };

  const handleImageFile = (file) => {
    if (!file) return;
    const maxW = 900;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > maxW) {
        height = Math.round(height * maxW / width);
        width = maxW;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      const dataUrl = file.type === "image/png"
        ? canvas.toDataURL("image/png")
        : canvas.toDataURL("image/jpeg", 0.85);
      restoreSelection();
      document.execCommand("insertImage", false, dataUrl);
      editorRef.current?.focus();
      if (onChange) onChange(editorRef.current.innerHTML);
    };
    img.src = url;
  };

  const handleToolClick = (t) => {
    if (t.cmd === "link")  { openLinkPrompt(); return; }
    if (t.cmd === "image") { openImagePicker(); return; }
    saveSelection();
    execCmd(t.cmd, t.arg);
  };

  return (
    <div style={{ border: `1.5px solid ${BORDER}`, borderRadius: 8, overflow: "hidden", background: CARD, position: "relative" }}>
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
              onMouseDown={(e) => { e.preventDefault(); handleToolClick(t); }}
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

      {/* Link prompt popover */}
      {linkPrompt && (
        <div style={{ position: "absolute", top: 44, left: 10, zIndex: 50, background: "#0D1520", border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px", width: 320, boxShadow: "0 8px 24px rgba(0,0,0,.5)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 10 }}>Insert Link</div>
          {!linkText && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>Link text</div>
              <input
                autoFocus
                value={linkText}
                onChange={e => setLinkText(e.target.value)}
                placeholder="Display text"
                style={{ width: "100%", background: "#0D1520", border: `1.5px solid ${BORDER}`, borderRadius: 5, padding: "7px 10px", color: TEXT, fontSize: 13, fontFamily: "'Inter',sans-serif", boxSizing: "border-box" }}
              />
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>URL</div>
            <input
              autoFocus={!!linkText}
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") insertLink(); if (e.key === "Escape") setLinkPrompt(false); }}
              placeholder="https://example.com"
              style={{ width: "100%", background: "#0D1520", border: `1.5px solid ${BORDER}`, borderRadius: 5, padding: "7px 10px", color: TEXT, fontSize: 13, fontFamily: "'Inter',sans-serif", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={insertLink} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 5, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Insert</button>
            <button onClick={() => setLinkPrompt(false)} style={{ background: "none", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 5, padding: "7px 14px", fontSize: 13, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Hidden image file input */}
      <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageFile(e.target.files[0])} />

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
        [contenteditable] a  { color: #60a5fa; text-decoration: underline; cursor: pointer; }
        [contenteditable] img { max-width: 100%; border-radius: 6px; margin: 8px 0; display: block; }
      `}</style>
    </div>
  );
}
