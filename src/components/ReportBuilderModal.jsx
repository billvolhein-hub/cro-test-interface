import { useState, useRef, useCallback } from "react";
import JSZip from "jszip";
import { BORDER, MUTED, TEXT, TEAL } from "../lib/constants";
import { parseCSVToObjects, parseGA4CSVToObjects } from "../lib/mergeReportData";

const PURPLE = "#7C3AED";
const BLUE   = "#2563EB";
const GREEN  = "#15803D";
const ORANGE = "#D97706";
const PINK   = "#DB2777";

function DropZone({ label, subLabel, icon, color, bg, borderColor, onFile, done, loading, accept = ".csv", optional }) {
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
      onClick={() => !loading && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        flex: 1,
        border: `2px dashed ${dragging || done ? color : borderColor}`,
        borderRadius: 10,
        padding: "20px 14px",
        background: dragging || done ? bg : "#FAFAFA",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        cursor: loading ? "default" : "pointer",
        transition: "all .15s ease",
        position: "relative",
      }}
    >
      <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }}
        onChange={e => { if (e.target.files[0]) { onFile(e.target.files[0]); e.target.value = ""; } }} />
      {optional && !done && (
        <span style={{ position: "absolute", top: 7, right: 8, fontSize: 9, fontWeight: 700, color: MUTED, background: "#F3F4F6", borderRadius: 3, padding: "1px 5px" }}>OPTIONAL</span>
      )}
      <span style={{ fontSize: 24 }}>{done ? "✅" : loading ? "⏳" : icon}</span>
      <div style={{ fontSize: 12, fontWeight: 700, color: done ? color : TEXT, textAlign: "center" }}>
        {done ? "Processed ✓" : loading ? "Processing…" : label}
      </div>
      {!done && !loading && (
        <div style={{ fontSize: 10, color: MUTED, textAlign: "center", lineHeight: 1.5 }}>{subLabel}</div>
      )}
    </div>
  );
}

function StatusRow({ icon, doneIcon, label, detail, done, loading, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, border: `1px solid ${done ? "#BBF7D0" : loading ? "#BFDBFE" : BORDER}`, background: done ? "#F0FDF4" : loading ? "#EFF6FF" : "#F8FAFC" }}>
      <span style={{ fontSize: 18 }}>{done ? doneIcon || "✅" : loading ? "⏳" : icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{label}</div>
        <div style={{ fontSize: 11, color: MUTED }}>{detail}</div>
      </div>
      {loading && <div style={{ fontSize: 11, fontWeight: 700, color: BLUE }}>Syncing…</div>}
      {done    && <div style={{ fontSize: 11, fontWeight: 700, color: GREEN }}>Done ✓</div>}
    </div>
  );
}

async function readGscZip(file) {
  const zip = await JSZip.loadAsync(file);
  const names = Object.keys(zip.files);
  let pagesText = null, queriesText = null;
  for (const name of names) {
    const base = name.split("/").pop().toLowerCase();
    if (base === "pages.csv")   pagesText   = await zip.files[name].async("string");
    if (base === "queries.csv") queriesText = await zip.files[name].async("string");
  }
  if (!pagesText) throw new Error("No Pages.csv found inside the GSC zip.");
  return {
    pages:   parseCSVToObjects(pagesText),
    queries: queriesText ? parseCSVToObjects(queriesText) : [],
  };
}

export default function ReportBuilderModal({
  isOpen, onClose,
  crawlRef,
  savedDomain,
  crawlDone, issuesDone, ahrefsDone,
  gscDone, ga4Done,
  onGscData, onGa4Data,
}) {
  const [crawlLoading,  setCrawlLoading]  = useState(false);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [gscLoading,    setGscLoading]    = useState(false);
  const [ga4Loading,    setGa4Loading]    = useState(false);
  const [gscError,      setGscError]      = useState("");
  const [ga4Error,      setGa4Error]      = useState("");

  const ahrefsLoading = crawlLoading && !ahrefsDone;
  const coreReady     = crawlDone && issuesDone && ahrefsDone;
  const anyLoading    = (crawlLoading && !crawlDone) || (issuesLoading && !issuesDone) || ahrefsLoading || gscLoading || ga4Loading;

  const handleCrawlFile = useCallback((file) => {
    setCrawlLoading(true);
    crawlRef.current?.processCrawlFile(file);
  }, [crawlRef]);

  const handleIssuesFile = useCallback((file) => {
    setIssuesLoading(true);
    crawlRef.current?.processIssuesFile(file);
  }, [crawlRef]);

  const handleGscFile = useCallback(async (file) => {
    setGscLoading(true);
    setGscError("");
    try {
      const { pages, queries } = await readGscZip(file);
      onGscData?.(pages, queries);
    } catch (e) {
      setGscError(e.message);
    } finally {
      setGscLoading(false);
    }
  }, [onGscData]);

  const handleGa4File = useCallback(async (file) => {
    setGa4Loading(true);
    setGa4Error("");
    try {
      const text = await file.text();
      const rows = parseGA4CSVToObjects(text);
      if (!rows.length) throw new Error("No data rows parsed. Make sure this is a GA4 Pages & Screens CSV export.");
      onGa4Data?.(rows);
    } catch (e) {
      setGa4Error(e.message);
    } finally {
      setGa4Loading(false);
    }
  }, [onGa4Data]);

  if (!isOpen) return null;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && !anyLoading) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 620, boxShadow: "0 24px 60px rgba(0,0,0,.18)", fontFamily: "'Inter',sans-serif", maxHeight: "90vh", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ padding: "22px 24px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: TEXT }}>Build Site Report</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>Upload all data sources to generate the full cross-signal report.</div>
          </div>
          {!anyLoading && (
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: MUTED, cursor: "pointer", lineHeight: 1, padding: "0 2px", marginTop: -2 }}>×</button>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ── Screaming Frog ── */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Screaming Frog</div>
            <div style={{ display: "flex", gap: 10 }}>
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
          </div>

          {/* ── Cross-Signal ── */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Cross-Signal Intelligence <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— optional, unlocks deeper insights</span></div>
            <div style={{ display: "flex", gap: 10 }}>
              <DropZone
                label="GSC Export (.zip)"
                subLabel="Google Search Console → Performance → Export → Download"
                icon="📊" color={ORANGE} bg="#FFFBEB" borderColor="#FDE68A"
                accept=".zip,application/zip"
                onFile={handleGscFile}
                done={gscDone} loading={gscLoading}
                optional
              />
              <DropZone
                label="GA4 Pages & Screens (.csv)"
                subLabel="GA4 → Reports → Engagement → Pages & screens → Export CSV"
                icon="📈" color={PINK} bg="#FDF2F8" borderColor="#F9A8D4"
                onFile={handleGa4File}
                done={ga4Done} loading={ga4Loading}
                optional
              />
            </div>
            {gscError && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 6, padding: "6px 10px", background: "#FEF2F2", borderRadius: 6 }}>GSC: {gscError}</div>}
            {ga4Error && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 6, padding: "6px 10px", background: "#FEF2F2", borderRadius: 6 }}>GA4: {ga4Error}</div>}
          </div>

          {/* ── Ahrefs ── */}
          <StatusRow
            icon="🔗" doneIcon="✅"
            label="Backlink Intelligence"
            detail={
              ahrefsDone   ? `Ahrefs data synced${savedDomain ? ` for ${savedDomain}` : ""}` :
              ahrefsLoading ? "Fetching from Ahrefs API…" :
              "Auto-fetches from Ahrefs once both Screaming Frog files are processed"
            }
            done={ahrefsDone}
            loading={ahrefsLoading}
          />

          {/* ── Footer ── */}
          {coreReady ? (
            <button onClick={onClose} style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 8, padding: "13px 0", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              ✓ Reports Ready — Close & View
            </button>
          ) : (
            <div style={{ fontSize: 11, color: MUTED, textAlign: "center", paddingTop: 2 }}>
              {anyLoading ? "Processing… this may take a moment." : "Upload the Screaming Frog files to generate the core report. GSC and GA4 are optional."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
