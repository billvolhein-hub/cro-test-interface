import { useRef, useState } from "react";
import { CARD, BORDER, BG, TEXT, MUTED, TEAL, ACCENT, GOLD } from "../lib/constants";
import { fetchConvertResults } from "../lib/utils";

// ── CSV Parser ────────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) throw new Error("CSV too short");

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).filter(l => l.trim()).map(l => {
    const vals = parseLine(l);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim().replace(/^"|"$/g, "")] = (vals[i] || "").trim().replace(/^"|"$/g, ""); });
    return obj;
  });

  if (!rows.length) throw new Error("No data rows");

  const pct = s => parseFloat(s.replace("%", "")) || 0;
  const num = s => parseInt(s.replace(/,/g, ""), 10) || 0;

  const meta = rows[0];
  const startDate = meta["Start Date"]?.split(" ")?.[0] ?? "";
  const endDate   = meta["End Date"]?.split(" ")?.[0] ?? "";

  // Group by Goal
  const goalMap = {};
  for (const row of rows) {
    const goal = row["Goal"] || "Unknown";
    if (!goalMap[goal]) goalMap[goal] = [];
    goalMap[goal].push({
      variant:    row["Variation Name"],
      visitors:   num(row["Visitors"]),
      conversions:num(row["Conversions"]),
      rate:       pct(row["Conversion Rate"]),
      change:     pct(row["Conversion Rate Observed Change"]),
      confidence: pct(row["Conversion Rate Observed Change Confidence"]),
    });
  }

  // Collect unique variants in order
  const variantOrder = [];
  for (const row of rows) {
    if (!variantOrder.includes(row["Variation Name"])) variantOrder.push(row["Variation Name"]);
  }

  const controlName = variantOrder[0];
  const control = rows.find(r => r["Variation Name"] === controlName);

  return {
    testId:      meta["Test ID"],
    testName:    meta["Test Name"],
    startDate,
    endDate,
    visitors:    num(control?.["Visitors"] ?? "0"),
    variantOrder,
    goals: Object.entries(goalMap).map(([name, rows]) => ({ name, rows })),
  };
}

function parseLine(line) {
  const result = [];
  let cur = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { result.push(cur); cur = ""; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

// ── Confidence helpers ─────────────────────────────────────────────────────────

function confidenceColor(conf) {
  if (conf >= 95) return "#15803D";
  if (conf >= 80) return "#B45309";
  return "#6B7280";
}
function confidenceBg(conf) {
  if (conf >= 95) return "#F0FDF4";
  if (conf >= 80) return "#FFFBEB";
  return "#F9FAFB";
}
function confidenceBorder(conf) {
  if (conf >= 95) return "#BBF7D0";
  if (conf >= 80) return "#FDE68A";
  return "#E5E7EB";
}
function confidenceLabel(conf) {
  if (conf >= 95) return "Significant";
  if (conf >= 80) return "Trending";
  return "Inconclusive";
}

// ── Bar chart ─────────────────────────────────────────────────────────────────

const VARIANT_PALETTE = ["#1B3A6B", "#2A8C8C", "#C9A84C", "#6D28D9", "#E74C3C"];

function GoalCard({ goal, variantOrder }) {
  const control = goal.rows.find(r => r.variant === variantOrder[0]);
  const variants = goal.rows.filter(r => r.variant !== variantOrder[0]);
  const allRates = goal.rows.map(r => r.rate);
  const maxRate = Math.max(...allRates, 1);

  return (
    <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 18px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 14 }}>{goal.name}</div>

      {/* Bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {goal.rows.map((row, i) => {
          const isControl = row.variant === variantOrder[0];
          const barColor = VARIANT_PALETTE[i] ?? "#888";
          const barPct = (row.rate / maxRate) * 100;
          const conf = isControl ? null : row.confidence;
          const ch = isControl ? null : row.change;

          return (
            <div key={row.variant}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: barColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: TEXT }}>{row.variant}</span>
                  {!isControl && conf !== null && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: confidenceColor(conf), background: confidenceBg(conf), border: `1px solid ${confidenceBorder(conf)}`, borderRadius: 4, padding: "1px 5px", letterSpacing: 0.5 }}>
                      {confidenceLabel(conf)} · {conf.toFixed(0)}%
                    </span>
                  )}
                  {isControl && (
                    <span style={{ fontSize: 9, fontWeight: 600, color: MUTED, background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 4, padding: "1px 5px" }}>Control</span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {!isControl && ch !== null && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: ch >= 0 ? "#15803D" : "#DC2626" }}>
                      {ch >= 0 ? "▲" : "▼"} {Math.abs(ch).toFixed(2)}%
                    </span>
                  )}
                  <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{row.rate.toFixed(2)}%</span>
                </div>
              </div>
              <div style={{ height: 10, background: "#E5E7EB", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${barPct}%`, background: barColor, borderRadius: 5, transition: "width .4s ease" }} />
              </div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>
                {row.conversions.toLocaleString()} / {row.visitors.toLocaleString()} visitors
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Convert sync panel ────────────────────────────────────────────────────────

function ConvertSyncPanel({ convertId, setConvertId, onSync, loading, error, raw, lastSynced }) {
  return (
    <div style={{ background: BG, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: TEAL }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>Sync from Convert.com API</span>
        {lastSynced && (
          <span style={{ fontSize: 10, color: MUTED, marginLeft: "auto" }}>
            Last synced {new Date(lastSynced).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={convertId}
          onChange={e => setConvertId(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !loading) onSync(); }}
          placeholder="Convert.com Experience ID (e.g. 100136426)"
          style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: `1.5px solid ${BORDER}`, fontFamily: "'Inter',sans-serif", fontSize: 12, color: TEXT, background: "#fff", outline: "none" }}
        />
        <button
          onClick={onSync}
          disabled={loading || !convertId.trim()}
          style={{ background: TEAL, color: "#fff", border: "none", padding: "8px 14px", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 700, cursor: loading || !convertId.trim() ? "not-allowed" : "pointer", opacity: loading || !convertId.trim() ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          {loading ? (
            <><svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 1s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,.4)" strokeWidth="2"/><path d="M14 8a6 6 0 00-6-6" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>Syncing…</>
          ) : "Sync"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#DC2626", background: "#FFF8F8", border: "1px solid #FECACA", borderRadius: 6, padding: "8px 12px" }}>
          <strong>Error:</strong> {error}
          {raw && (
            <details style={{ marginTop: 6 }}>
              <summary style={{ cursor: "pointer", fontSize: 11, color: MUTED }}>Show raw API response</summary>
              <pre style={{ marginTop: 6, fontSize: 10, color: MUTED, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{JSON.stringify(raw, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function TestResults({ results, onImport, onClear }) {
  const fileRef = useRef();
  const [convertId, setConvertId] = useState(results?.convertExperienceId ?? "");
  const [convertLoading, setConvertLoading] = useState(false);
  const [convertError, setConvertError] = useState("");
  const [convertRaw, setConvertRaw] = useState(null);
  const [showConvertPanel, setShowConvertPanel] = useState(false);

  const handleConvertSync = async () => {
    const expId = convertId.trim();
    if (!expId) return;
    setConvertLoading(true);
    setConvertError("");
    setConvertRaw(null);
    try {
      const parsed = await fetchConvertResults(expId);
      onImport(parsed);
      setShowConvertPanel(false);
    } catch (e) {
      setConvertError(e.message);
      if (e.raw) setConvertRaw(e.raw);
    } finally {
      setConvertLoading(false);
    }
  };

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = parseCSV(e.target.result);
        onImport(parsed);
      } catch (err) {
        alert("Could not parse CSV: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  if (!results) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* CSV drop zone */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${BORDER}`, borderRadius: 8, padding: "22px 20px", textAlign: "center", cursor: "pointer", background: BG, transition: "border-color .15s" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = TEAL}
          onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
        >
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
          <div style={{ fontSize: 20, marginBottom: 6 }}>📄</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 3 }}>Import CSV export</div>
          <div style={{ fontSize: 11, color: MUTED }}>Drop a Convert.com CSV here or click to browse</div>
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
          <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>or</span>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
        </div>

        {/* Convert API sync */}
        <ConvertSyncPanel
          convertId={convertId}
          setConvertId={setConvertId}
          onSync={handleConvertSync}
          loading={convertLoading}
          error={convertError}
          raw={convertRaw}
        />
      </div>
    );
  }

  const totalVisitors = results.variantOrder.reduce((sum, v) => {
    const row = results.goals[0]?.rows.find(r => r.variant === v);
    return sum + (row?.visitors ?? 0);
  }, 0);

  const dayCount = (() => {
    if (!results.startDate || !results.endDate) return null;
    const ms = new Date(results.endDate) - new Date(results.startDate);
    return Math.round(ms / 86400000) + 1;
  })();

  return (
    <div>
      {/* Summary strip */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { label: "Visitors", value: totalVisitors.toLocaleString() },
          { label: "Variants", value: results.variantOrder.length },
          { label: "Goals Tracked", value: results.goals.length },
          ...(dayCount ? [{ label: "Duration", value: `${dayCount}d` }] : []),
          ...(results.startDate ? [{ label: "Period", value: `${results.startDate} → ${results.endDate}` }] : []),
        ].map(s => (
          <div key={s.label} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 12px", flex: s.label === "Period" ? "1 1 auto" : "0 0 auto" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: "uppercase" }}>{s.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginTop: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Goal charts */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {results.goals.map(goal => (
          <GoalCard key={goal.name} goal={goal} variantOrder={results.variantOrder} />
        ))}
      </div>

      {/* Footer actions */}
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button
          onClick={() => setShowConvertPanel(p => !p)}
          style={{ flex: 1, background: showConvertPanel ? ACCENT : "none", border: `1.5px solid ${showConvertPanel ? ACCENT : BORDER}`, color: showConvertPanel ? "#fff" : MUTED, padding: "7px 0", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          {results.convertExperienceId ? "↻ Re-sync Convert" : "⟳ Sync from Convert"}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          style={{ background: "none", border: `1.5px solid ${BORDER}`, color: MUTED, padding: "7px 14px", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          CSV
        </button>
        <button
          onClick={onClear}
          style={{ background: "none", border: "1.5px solid #FECACA", color: "#DC2626", padding: "7px 14px", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          Clear
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
      </div>

      {showConvertPanel && (
        <div style={{ marginTop: 12 }}>
          <ConvertSyncPanel
            convertId={convertId}
            setConvertId={setConvertId}
            onSync={handleConvertSync}
            loading={convertLoading}
            error={convertError}
            raw={convertRaw}
            lastSynced={results.syncedAt}
          />
        </div>
      )}
    </div>
  );
}
