import { useState, useRef, useCallback } from "react";
import { BORDER, MUTED, TEXT, TEAL } from "../lib/constants";

const PURPLE = "#7C3AED";
const BLUE   = "#2563EB";
const GREEN  = "#15803D";

function DropZone({ label, subLabel, icon, color, bg, borderColor, onFile, done, loading }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  return (
    <div
      onClick={() => !done && !loading && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        flex: 1,
        border: `2px dashed ${dragging || done ? color : borderColor}`,
        borderRadius: 12,
        padding: "28px 16px",
        background: dragging || done ? bg : "#FAFAFA",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        cursor: done || loading ? "default" : "pointer",
        transition: "all .15s ease",
      }}
    >
      <input ref={inputRef} type="file" accept=".csv" style={{ display: "none" }}
        onChange={e => { if (e.target.files[0]) { onFile(e.target.files[0]); e.target.value = ""; } }} />
      <span style={{ fontSize: 28 }}>{done ? "✅" : loading ? "⏳" : icon}</span>
      <div style={{ fontSize: 13, fontWeight: 700, color: done ? color : TEXT, textAlign: "center" }}>
        {done ? "Processed ✓" : loading ? "Processing…" : label}
      </div>
      {!done && !loading && (
        <>
          <div style={{ fontSize: 10, color: MUTED, textAlign: "center", lineHeight: 1.5 }}>{subLabel}</div>
          <div style={{ fontSize: 10, color: MUTED, marginTop: 2, fontWeight: 500 }}>Drop file or click to browse</div>
        </>
      )}
    </div>
  );
}

export default function ReportBuilderModal({
  isOpen, onClose,
  crawlRef,
  savedDomain,
  crawlDone, issuesDone, ahrefsDone,
}) {
  // Track which files have been submitted (loading = submitted but not yet done)
  const [crawlLoading,  setCrawlLoading]  = useState(false);
  const [issuesLoading, setIssuesLoading] = useState(false);

  const ahrefsLoading = crawlLoading && !ahrefsDone;
  const allReady   = crawlDone && issuesDone && ahrefsDone;
  const anyLoading = (crawlLoading && !crawlDone) || (issuesLoading && !issuesDone) || ahrefsLoading;

  const handleCrawlFile = useCallback((file) => {
    setCrawlLoading(true);
    crawlRef.current?.processCrawlFile(file);
  }, [crawlRef]);

  const handleIssuesFile = useCallback((file) => {
    setIssuesLoading(true);
    crawlRef.current?.processIssuesFile(file);
  }, [crawlRef]);

  if (!isOpen) return null;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && !anyLoading) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 580, boxShadow: "0 24px 60px rgba(0,0,0,.18)", fontFamily: "'Inter',sans-serif" }}>

        {/* Header */}
        <div style={{ padding: "22px 24px 18px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: TEXT }}>Build Site Report</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>Upload both Screaming Frog exports — Ahrefs syncs after both are processed</div>
          </div>
          {!anyLoading && (
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: MUTED, cursor: "pointer", lineHeight: 1, padding: "0 2px", marginTop: -2 }}>×</button>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Drop zones */}
          <div style={{ display: "flex", gap: 12 }}>
            <DropZone
              label="Internal HTML CSV"
              subLabel="Screaming Frog → Internal tab → Export as CSV"
              icon="🕷️" color={TEAL} bg="#F0FDFA" borderColor="#99E6DA"
              onFile={handleCrawlFile}
              done={crawlDone} loading={crawlLoading && !crawlDone}
            />
            <DropZone
              label="Issues Overview CSV"
              subLabel="Screaming Frog → Reports → Issues → Export"
              icon="⚠️" color={PURPLE} bg="#F5F3FF" borderColor="#C4B5FD"
              onFile={handleIssuesFile}
              done={issuesDone} loading={issuesLoading && !issuesDone}
            />
          </div>

          {/* Ahrefs row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 8, border: `1px solid ${ahrefsDone ? "#BBF7D0" : ahrefsLoading ? "#BFDBFE" : BORDER}`, background: ahrefsDone ? "#F0FDF4" : ahrefsLoading ? "#EFF6FF" : "#F8FAFC" }}>
            <span style={{ fontSize: 20 }}>{ahrefsDone ? "✅" : ahrefsLoading ? "⏳" : "🔗"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>Backlink Intelligence</div>
              <div style={{ fontSize: 11, color: MUTED }}>
                {ahrefsDone   ? `Ahrefs data synced${savedDomain ? ` for ${savedDomain}` : ""}` :
                 ahrefsLoading ? "Fetching from Ahrefs API…" :
                 "Auto-fetches from Ahrefs once both CSVs are processed"}
              </div>
            </div>
            {ahrefsLoading && <div style={{ fontSize: 11, fontWeight: 700, color: BLUE }}>Fetching…</div>}
            {ahrefsDone    && <div style={{ fontSize: 11, fontWeight: 700, color: GREEN }}>Done ✓</div>}
          </div>

          {/* Footer */}
          {allReady ? (
            <button onClick={onClose} style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 8, padding: "13px 0", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              ✓ All Reports Ready — Close & View
            </button>
          ) : (
            <div style={{ fontSize: 11, color: MUTED, textAlign: "center", paddingTop: 2 }}>
              {anyLoading ? "Building your reports… this may take a moment." : "Upload both CSV files to generate the full report."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
