import { useRef } from "react";
import { CARD, BORDER, BG, TEXT, MUTED, TEAL, ACCENT, GOLD } from "../lib/constants";

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

// ── Main component ─────────────────────────────────────────────────────────────

export default function TestResults({ results, onImport, onClear }) {
  const fileRef = useRef();

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
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{ border: `2px dashed ${BORDER}`, borderRadius: 8, padding: "28px 20px", textAlign: "center", cursor: "pointer", background: BG, transition: "border-color .15s" }}
        onMouseEnter={e => e.currentTarget.style.borderColor = TEAL}
        onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
      >
        <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
        <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Import Convert.com results</div>
        <div style={{ fontSize: 11, color: MUTED }}>Drop a CSV file here or click to browse</div>
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

      {/* Replace / clear */}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button
          onClick={() => fileRef.current?.click()}
          style={{ flex: 1, background: "none", border: `1.5px solid ${BORDER}`, color: MUTED, padding: "7px 0", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          Replace CSV
        </button>
        <button
          onClick={onClear}
          style={{ background: "none", border: "1.5px solid #FECACA", color: "#DC2626", padding: "7px 14px", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          Clear
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
      </div>
    </div>
  );
}
