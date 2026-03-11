import { useState, useRef } from "react";
import { TEAL, MUTED, BORDER } from "../lib/constants";

export default function ScreenshotZone({ label, sub, value, onSet, onClear, light }) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => onSet(ev.target.result);
    reader.readAsDataURL(file);
  };

  const idleBorder = light ? BORDER    : "#2E3F5C";
  const idleText   = light ? MUTED     : "#5A7AAA";
  const labelColor = light ? MUTED     : "#8BA4C8";
  const activeBg   = light ? "#F0FAFA" : "rgba(42,140,140,.12)";

  return (
    <div style={{ marginBottom: light ? 0 : 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: labelColor, letterSpacing: 1.2, marginBottom: 6, textTransform: "uppercase" }}>
        {label} — {sub}
      </div>
      {value ? (
        <div style={{ position: "relative", borderRadius: 4, overflow: "hidden", lineHeight: 0 }}>
          <img src={value} alt={`${label} ${sub}`} style={{ width: "100%", display: "block", borderRadius: 4 }} />
          <button
            onClick={onClear}
            style={{ position: "absolute", top: 5, right: 5, background: "rgba(0,0,0,.72)", color: "#fff", border: "none", borderRadius: 3, width: 22, height: 22, cursor: "pointer", fontSize: 14, lineHeight: "22px", textAlign: "center", padding: 0 }}>
            ×
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current?.click()}
          style={{ border: `1.5px dashed ${dragOver ? TEAL : idleBorder}`, borderRadius: 6, padding: "14px 10px", textAlign: "center", cursor: "pointer", background: dragOver ? activeBg : "transparent", transition: "all .15s" }}>
          <div style={{ fontSize: 16, marginBottom: 4, opacity: 0.45 }}>↑</div>
          <div style={{ fontSize: 11, color: dragOver ? TEAL : idleText, fontWeight: 500, lineHeight: 1.6 }}>
            Drop or click to upload
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files[0])} />
        </div>
      )}
    </div>
  );
}
