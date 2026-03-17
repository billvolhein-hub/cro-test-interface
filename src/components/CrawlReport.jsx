import { useState, useRef } from "react";
import { CARD, BORDER, BG, TEXT, MUTED, TEAL, ACCENT } from "../lib/constants";

// ── Palette ──────────────────────────────────────────────────────────────────
const GREENS  = ["#15803D","#16A34A","#4ADE80","#86EFAC"];
const REDS    = ["#DC2626","#EF4444","#FCA5A5"];
const AMBERS  = ["#D97706","#F59E0B","#FDE68A"];
const BLUES   = ["#1B3A6B","#2563EB","#60A5FA","#BFDBFE"];
const PURPLES = ["#7C3AED","#A78BFA","#DDD6FE"];
const GRAYS   = ["#374151","#6B7280","#D1D5DB"];

const PRIORITY_COLORS = { "High": "#DC2626", "Medium": "#D97706", "Low": "#16A34A" };
const PRIORITY_BG     = { "High": "#FEF2F2", "Medium": "#FFFBEB", "Low": "#F0FDF4" };
const TYPE_COLORS     = { "Issue": "#DC2626", "Warning": "#D97706", "Opportunity": "#2563EB" };
const CARBON_COLORS   = { "A+":"#15803D","A":"#22C55E","B":"#86EFAC","C":"#FDE68A","D":"#F59E0B","E":"#EF4444","F":"#DC2626","N/A":"#9CA3AF" };
const READABILITY_COLORS = { "Very Easy":"#15803D","Easy":"#22C55E","Fairly Easy":"#86EFAC","Standard":"#F59E0B","Fairly Hard":"#FB923C","Hard":"#EF4444","Very Confusing":"#DC2626" };

// ── CSV Parsers ───────────────────────────────────────────────────────────────
function parseLine(line) {
  const res = []; let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { res.push(cur); cur = ""; }
    else cur += ch;
  }
  res.push(cur);
  return res;
}

function parseCrawlCSV(text) {
  const lines = text.trim().split("\n");
  const headers = parseLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ""));
  const col = (row, name) => (row[headers.indexOf(name)] ?? "").trim();
  const allRows = lines.slice(1).filter(l => l.trim()).map(l => parseLine(l));
  const htmlRows = allRows.filter(r => col(r, "Content Type").startsWith("text/html") && col(r, "Status Code") === "200");
  return { col, allRows, htmlRows };
}

function parseIssuesCSV(text) {
  const lines = text.trim().split("\n");
  const headers = parseLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ""));
  if (!headers.includes("Issue Name") && !headers.includes("Issue Priority")) throw new Error("Doesn't look like a Screaming Frog Issues export.");
  const col = (row, name) => (row[headers.indexOf(name)] ?? "").trim();
  return lines.slice(1).filter(l => l.trim()).map(l => {
    const r = parseLine(l);
    const name = col(r, "Issue Name");
    return {
      name,
      type:     col(r, "Issue Type"),
      priority: col(r, "Issue Priority"),
      urls:     parseInt(col(r, "URLs")) || 0,
      pct:      parseFloat(col(r, "% of Total")) || 0,
      fix:      col(r, "How To Fix"),
      category: name.includes(":") ? name.split(":")[0].trim() : "Other",
    };
  }).filter(i => i.name);
}

// ── Crawl Stats ───────────────────────────────────────────────────────────────
function computeStats(allRows, htmlRows, col) {
  const bucket = (obj, key) => { obj[key] = (obj[key] || 0) + 1; };

  const statusCodes = {};
  for (const r of allRows) {
    const c = col(r, "Status Code");
    const b = c.startsWith("2") ? "2xx OK" : c.startsWith("3") ? "3xx Redirect" : c.startsWith("4") ? "4xx Error" : c.startsWith("5") ? "5xx Server Error" : "Other";
    bucket(statusCodes, b);
  }
  const indexable = allRows.filter(r => col(r, "Indexability") === "Indexable").length;

  const depth = {};
  for (const r of htmlRows) { const d = parseInt(col(r, "Crawl Depth")) || 0; bucket(depth, d >= 5 ? "5+" : String(d)); }

  let rtTotal = 0, rtCount = 0;
  const rt = { "<0.5s":0,"0.5–1s":0,"1–2s":0,"2–3s":0,">3s":0 };
  for (const r of htmlRows) {
    const v = parseFloat(col(r, "Response Time")) || 0;
    if (v > 0) { rtTotal += v; rtCount++; }
    if (v < 0.5) rt["<0.5s"]++; else if (v < 1) rt["0.5–1s"]++; else if (v < 2) rt["1–2s"]++; else if (v < 3) rt["2–3s"]++; else rt[">3s"]++;
  }

  const size = { "<50 KB":0,"50–100 KB":0,"100–200 KB":0,">200 KB":0 };
  for (const r of htmlRows) {
    const v = parseInt(col(r, "Size (bytes)")) || 0;
    if (v < 51200) size["<50 KB"]++; else if (v < 102400) size["50–100 KB"]++; else if (v < 204800) size["100–200 KB"]++; else size[">200 KB"]++;
  }

  const title = { "Missing":0,"Too Short (<30)":0,"Optimal (30–60)":0,"Too Long (>60)":0 };
  for (const r of htmlRows) {
    const len = parseInt(col(r, "Title 1 Length")) || 0;
    if (len === 0) title["Missing"]++; else if (len < 30) title["Too Short (<30)"]++; else if (len <= 60) title["Optimal (30–60)"]++; else title["Too Long (>60)"]++;
  }

  const meta = { "Missing":0,"Too Short (<70)":0,"Optimal (70–155)":0,"Too Long (>155)":0 };
  for (const r of htmlRows) {
    const len = parseInt(col(r, "Meta Description 1 Length")) || 0;
    if (len === 0) meta["Missing"]++; else if (len < 70) meta["Too Short (<70)"]++; else if (len <= 155) meta["Optimal (70–155)"]++; else meta["Too Long (>155)"]++;
  }

  const h1 = { "Present":0,"Missing":0,"Multiple H1s":0 };
  for (const r of htmlRows) {
    const v = col(r, "H1-1"), v2 = col(r, "H1-2");
    if (!v) h1["Missing"]++; else if (v2) h1["Multiple H1s"]++; else h1["Present"]++;
  }

  const readability = {};
  for (const r of htmlRows) { const v = col(r, "Readability"); if (v) bucket(readability, v); }

  let fleschTotal = 0, fleschCount = 0;
  const flesch = { "Very Confusing (<30)":0,"Difficult (30–50)":0,"Fairly Hard (50–60)":0,"Standard (60–70)":0,"Fairly Easy (70–80)":0,"Easy (80–90)":0,"Very Easy (90+)":0 };
  for (const r of htmlRows) {
    const v = parseFloat(col(r, "Flesch Reading Ease Score")) || 0;
    if (v > 0) { fleschTotal += v; fleschCount++; }
    if (v >= 90) flesch["Very Easy (90+)"]++; else if (v >= 80) flesch["Easy (80–90)"]++; else if (v >= 70) flesch["Fairly Easy (70–80)"]++; else if (v >= 60) flesch["Standard (60–70)"]++; else if (v >= 50) flesch["Fairly Hard (50–60)"]++; else if (v >= 30) flesch["Difficult (30–50)"]++; else flesch["Very Confusing (<30)"]++;
  }

  let wcTotal = 0;
  const wordCount = { "Thin (<300)":0,"Low (300–600)":0,"Medium (600–1200)":0,"Rich (>1200)":0 };
  for (const r of htmlRows) {
    const v = parseInt(col(r, "Word Count")) || 0; wcTotal += v;
    if (v < 300) wordCount["Thin (<300)"]++; else if (v < 600) wordCount["Low (300–600)"]++; else if (v < 1200) wordCount["Medium (600–1200)"]++; else wordCount["Rich (>1200)"]++;
  }

  let spellTotal = 0;
  const spelling = { "None":0,"1–2":0,"3–5":0,"6–10":0,"10+":0 };
  const grammar  = { "None":0,"1–2":0,"3–5":0,"6+":0 };
  for (const r of htmlRows) {
    const s = parseInt(col(r, "Spelling Errors")) || 0; spellTotal += s;
    if (s === 0) spelling["None"]++; else if (s <= 2) spelling["1–2"]++; else if (s <= 5) spelling["3–5"]++; else if (s <= 10) spelling["6–10"]++; else spelling["10+"]++;
    const g = parseInt(col(r, "Grammar Errors")) || 0;
    if (g === 0) grammar["None"]++; else if (g <= 2) grammar["1–2"]++; else if (g <= 5) grammar["3–5"]++; else grammar["6+"]++;
  }

  const inlinks = { "Orphaned (0)":0,"Low (1–10)":0,"Medium (11–50)":0,"High (50+)":0 };
  for (const r of htmlRows) {
    const v = parseInt(col(r, "Unique Inlinks")) || 0;
    if (v === 0) inlinks["Orphaned (0)"]++; else if (v <= 10) inlinks["Low (1–10)"]++; else if (v <= 50) inlinks["Medium (11–50)"]++; else inlinks["High (50+)"]++;
  }
  const topInlinks = [...htmlRows]
    .map(r => ({ url: col(r, "Address"), inlinks: parseInt(col(r, "Unique Inlinks")) || 0, title: col(r, "Title 1") }))
    .sort((a, b) => b.inlinks - a.inlinks).slice(0, 12);

  const carbon = {}; let co2Total = 0;
  for (const r of htmlRows) { const rt2 = col(r, "Carbon Rating") || "N/A"; bucket(carbon, rt2); co2Total += parseFloat(col(r, "CO2 (mg)")) || 0; }

  const intent = {}, sentiment = {};
  for (const r of htmlRows) {
    const i = col(r, "Intent of Page"); if (i) bucket(intent, i);
    const s = col(r, "Sentiment of page"); if (s) bucket(sentiment, s);
  }

  const urBuckets = { "No data":0,"0–10":0,"11–25":0,"26–50":0,"50+":0 };
  for (const r of htmlRows) {
    const v = parseFloat(col(r, "Ahrefs URL Rating - Exact"));
    if (isNaN(v) || !col(r, "Ahrefs URL Rating - Exact")) urBuckets["No data"]++;
    else if (v <= 10) urBuckets["0–10"]++; else if (v <= 25) urBuckets["11–25"]++; else if (v <= 50) urBuckets["26–50"]++; else urBuckets["50+"]++;
  }

  const dupeCount = htmlRows.filter(r => parseInt(col(r, "No. Near Duplicates")) > 0).length;

  return {
    totalCrawled: allRows.length, htmlPages: htmlRows.length,
    indexable, nonIndexable: allRows.length - indexable,
    avgRt: rtCount ? (rtTotal / rtCount).toFixed(2) : "—",
    avgWordCount: htmlRows.length ? Math.round(wcTotal / htmlRows.length) : 0,
    avgFlesch: fleschCount ? (fleschTotal / fleschCount).toFixed(1) : "—",
    totalSpelling: spellTotal, dupeCount,
    totalCO2: (co2Total / 1000).toFixed(1),
    statusCodes, depth, rt, size, title, meta, h1,
    readability, flesch, wordCount, spelling, grammar,
    inlinks, topInlinks, carbon, intent, sentiment, urBuckets,
  };
}

// ── Issues Stats ──────────────────────────────────────────────────────────────
function computeIssueStats(issues) {
  const bucket = (obj, key, val = 1) => { obj[key] = (obj[key] || 0) + val; };

  const byPriority = {}, byPriorityUrls = {}, byType = {}, byTypeUrls = {}, byCategory = {}, byCategoryUrls = {};
  for (const issue of issues) {
    bucket(byPriority, issue.priority);
    bucket(byPriorityUrls, issue.priority, issue.urls);
    bucket(byType, issue.type);
    bucket(byTypeUrls, issue.type, issue.urls);
    bucket(byCategory, issue.category);
    bucket(byCategoryUrls, issue.category, issue.urls);
  }

  const accessibilityIssues = issues.filter(i => i.category === "Accessibility").sort((a, b) => b.urls - a.urls);
  const topHigh = issues.filter(i => i.priority === "High").sort((a, b) => b.urls - a.urls).slice(0, 10);
  const topOpportunities = issues.filter(i => i.type === "Opportunity").sort((a, b) => b.urls - a.urls).slice(0, 8);

  // Category URLs sorted desc
  const categoryUrlsSorted = Object.fromEntries(
    Object.entries(byCategoryUrls).sort(([, a], [, b]) => b - a)
  );

  return {
    total: issues.length,
    totalHigh:   byPriority["High"] || 0,
    totalMedium: byPriority["Medium"] || 0,
    totalLow:    byPriority["Low"] || 0,
    byPriority, byPriorityUrls, byType, byTypeUrls,
    byCategory, byCategoryUrls: categoryUrlsSorted,
    accessibilityIssues, topHigh, topOpportunities,
  };
}

// ── Chart Primitives ──────────────────────────────────────────────────────────
function HBar({ label, value, max, color, pct, sub, small }) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: small ? 4 : 6 }}>
      <div style={{ width: small ? 130 : 150, fontSize: 11, color: TEXT, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={label}>{label}</div>
      <div style={{ flex: 1, height: small ? 10 : 14, background: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${width}%`, height: "100%", background: color, borderRadius: 4, transition: "width .4s ease" }} />
      </div>
      <div style={{ width: 56, textAlign: "right", flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{typeof value === "number" ? value.toLocaleString() : value}</span>
        {pct != null && <span style={{ fontSize: 10, color: MUTED, marginLeft: 3 }}>{pct}%</span>}
      </div>
    </div>
  );
}

function BarChart({ data, colors, title, hint, total }) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  const tot = total ?? entries.reduce((s, [, v]) => s + v, 0);
  return (
    <ChartCard title={title} hint={hint}>
      {entries.map(([label, value], i) => (
        <HBar key={label} label={label} value={value} max={max}
          color={Array.isArray(colors) ? colors[i % colors.length] : (colors[label] || "#9CA3AF")}
          pct={tot > 0 ? Math.round((value / tot) * 100) : 0} />
      ))}
    </ChartCard>
  );
}

function DonutChart({ segments, size = 80, title, hint }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size / 2) - 8; const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <ChartCard title={title} hint={hint} row>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        {segments.map((seg, i) => {
          const frac = total > 0 ? seg.value / total : 0;
          const dash = frac * circ; const gap = circ - dash;
          const el = <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={seg.color} strokeWidth={8}
            strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset} transform={`rotate(-90 ${size/2} ${size/2})`} />;
          offset += dash; return el;
        })}
      </svg>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
        {segments.map(seg => (
          <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: TEXT, flex: 1 }}>{seg.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{seg.value.toLocaleString()}</span>
            <span style={{ fontSize: 10, color: MUTED, width: 34, textAlign: "right" }}>
              {total > 0 ? Math.round((seg.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

function StatRow({ stats }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
      {stats.map(s => (
        <div key={s.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 16px", flex: "1 1 100px", minWidth: 90 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: s.color ?? TEXT, lineHeight: 1 }}>{s.value}</div>
          {s.sub && <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>{s.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function SectionHeader({ title, color = TEAL }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, marginTop: 28 }}>
      <div style={{ width: 4, height: 18, background: color, borderRadius: 2, flexShrink: 0 }} />
      <div style={{ fontSize: 13, fontWeight: 800, color: TEXT, letterSpacing: 0.3 }}>{title}</div>
      <div style={{ flex: 1, height: 1, background: BORDER }} />
    </div>
  );
}

function ChartCard({ title, hint, children, row }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px", flex: "1 1 280px", minWidth: 260 }}>
      {title && <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, marginBottom: 2 }}>{title}</div>}
      {hint  && <div style={{ fontSize: 10, color: MUTED, marginBottom: 10, lineHeight: 1.4 }}>{hint}</div>}
      <div style={row ? { display: "flex", alignItems: "center", gap: 14 } : {}}>{children}</div>
    </div>
  );
}

function TopInlinksTable({ rows }) {
  return (
    <ChartCard title="Top Pages by Inlinks" hint="Most internally-linked pages carry the most link equity.">
      {rows.map((r, i) => (
        <div key={r.url} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{ width: 18, fontSize: 10, fontWeight: 700, color: MUTED, textAlign: "right", flexShrink: 0 }}>#{i+1}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: TEXT, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title || r.url}</div>
            <div style={{ fontSize: 9, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.url}</div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, flexShrink: 0, background: "#EEF2FF", borderRadius: 4, padding: "2px 7px" }}>{r.inlinks.toLocaleString()}</div>
        </div>
      ))}
    </ChartCard>
  );
}

// ── Issues list card ──────────────────────────────────────────────────────────
function IssueListCard({ title, hint, issues, showFix }) {
  const [expanded, setExpanded] = useState(null);
  const max = Math.max(...issues.map(i => i.urls), 1);
  return (
    <ChartCard title={title} hint={hint}>
      {issues.map((issue, idx) => {
        const pColor = PRIORITY_COLORS[issue.priority] || "#6B7280";
        const tColor = TYPE_COLORS[issue.type] || "#6B7280";
        const isOpen = expanded === idx;
        return (
          <div key={idx} style={{ marginBottom: 6 }}>
            <div
              onClick={() => setExpanded(isOpen ? null : idx)}
              style={{ display: "flex", alignItems: "center", gap: 8, cursor: showFix ? "pointer" : "default" }}
            >
              <div style={{ width: 130, fontSize: 10, color: TEXT, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={issue.name}>{issue.name.replace(/^[^:]+:\s*/, "")}</div>
              <div style={{ flex: 1, height: 10, background: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${Math.max((issue.urls / max) * 100, issue.urls > 0 ? 2 : 0)}%`, height: "100%", background: pColor, borderRadius: 4 }} />
              </div>
              <div style={{ width: 50, textAlign: "right", flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: TEXT }}>{issue.urls.toLocaleString()}</span>
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, color: pColor, background: PRIORITY_BG[issue.priority] || "#F9FAFB", borderRadius: 3, padding: "1px 5px", flexShrink: 0 }}>
                {issue.priority}
              </span>
            </div>
            {isOpen && issue.fix && (
              <div style={{ marginTop: 4, marginLeft: 8, fontSize: 10, color: MUTED, lineHeight: 1.5, background: "#F9FAFB", border: `1px solid ${BORDER}`, borderRadius: 5, padding: "7px 10px" }}>
                <strong style={{ color: TEXT }}>Fix: </strong>{issue.fix}
              </div>
            )}
          </div>
        );
      })}
    </ChartCard>
  );
}

// ── Upload Zone ───────────────────────────────────────────────────────────────
function UploadZone({ onFile, label, icon, subLabel, accept = ".csv,text/csv", compact }) {
  const ref = useRef();
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      onClick={() => ref.current?.click()}
      style={{ border: `2px dashed ${over ? TEAL : BORDER}`, borderRadius: 8, padding: compact ? "16px 14px" : "28px 20px", textAlign: "center", cursor: "pointer", background: over ? "#F0FDFA" : BG, transition: "all .15s", flex: 1 }}
    >
      <input ref={ref} type="file" accept={accept} style={{ display: "none" }} onChange={e => onFile(e.target.files[0])} />
      <div style={{ fontSize: compact ? 20 : 26, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: compact ? 12 : 13, fontWeight: 700, color: TEXT, marginBottom: 3 }}>{label}</div>
      {subLabel && <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.5 }}>{subLabel}</div>}
    </div>
  );
}

// ── Replace button ────────────────────────────────────────────────────────────
function ReplaceBtn({ label, onFile }) {
  const ref = useRef();
  return (
    <>
      <input ref={ref} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={e => onFile(e.target.files[0])} />
      <button onClick={e => { e.stopPropagation(); ref.current?.click(); }}
        style={{ fontSize: 10, color: MUTED, background: "none", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
        Replace {label}
      </button>
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CrawlReport({ clientId }) {
  const load = (key) => { try { const r = localStorage.getItem(`crawl_${key}_${clientId}`); return r ? JSON.parse(r) : null; } catch { return null; } };
  const loadStr = (key) => { try { return localStorage.getItem(`crawl_${key}_${clientId}`) || ""; } catch { return ""; } };

  const [crawl,      setCrawl]      = useState(() => load("internal"));
  const [issues,     setIssues]     = useState(() => load("issues"));
  const [domain,     setDomain]     = useState(() => loadStr("domain"));
  const [crawledAt,  setCrawledAt]  = useState(() => loadStr("date"));
  const [loadingC,   setLoadingC]   = useState(false);
  const [loadingI,   setLoadingI]   = useState(false);
  const [errorC,     setErrorC]     = useState("");
  const [errorI,     setErrorI]     = useState("");
  const [open,       setOpen]       = useState(!!(load("internal") || load("issues")));

  const save = (key, val) => localStorage.setItem(`crawl_${key}_${clientId}`, JSON.stringify(val));
  const del  = (key)      => localStorage.removeItem(`crawl_${key}_${clientId}`);

  const handleCrawlFile = (file) => {
    setLoadingC(true); setErrorC("");
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const { col, allRows, htmlRows } = parseCrawlCSV(e.target.result);
        const s = computeStats(allRows, htmlRows, col);
        const dom = htmlRows[0] ? (() => { try { return new URL(htmlRows[0][0]).hostname; } catch { return ""; } })() : "";
        const now = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        setCrawl(s); setDomain(dom); setCrawledAt(now);
        save("internal", s); save("domain", dom); save("date", now);
        localStorage.setItem(`crawl_domain_${clientId}`, dom);
        localStorage.setItem(`crawl_date_${clientId}`, now);
        setOpen(true);
      } catch (err) { setErrorC("Could not parse crawl CSV: " + err.message); }
      finally { setLoadingC(false); }
    };
    reader.readAsText(file);
  };

  const handleIssuesFile = (file) => {
    setLoadingI(true); setErrorI("");
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const raw = parseIssuesCSV(e.target.result);
        const s = computeIssueStats(raw);
        setIssues(s); save("issues", s); setOpen(true);
      } catch (err) { setErrorI("Could not parse issues CSV: " + err.message); }
      finally { setLoadingI(false); }
    };
    reader.readAsText(file);
  };

  const handleClear = () => {
    ["internal","issues","domain","date"].forEach(del);
    setCrawl(null); setIssues(null); setDomain(""); setCrawledAt("");
  };

  const hasData = !!(crawl || issues);

  return (
    <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 10, marginBottom: 24, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>

      {/* Header */}
      <div onClick={() => setOpen(v => !v)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", cursor: "pointer", background: "#F0FDFA", borderBottom: open ? `1px solid ${BORDER}` : "none" }}>
        <div style={{ width: 20, height: 20, borderRadius: 6, background: TEAL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <circle cx="5" cy="5" r="3.5" stroke="#fff" strokeWidth="1.3"/>
            <path d="M7.5 7.5l2 2" stroke="#fff" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: TEAL, letterSpacing: 0.5 }}>
          Crawl Report
          {domain    && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: MUTED }}>{domain}</span>}
          {crawledAt && <span style={{ marginLeft: 6, fontSize: 10, color: MUTED }}>· {crawledAt}</span>}
          {crawl     && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: TEAL, background: "#CCFBF1", borderRadius: 4, padding: "1px 6px" }}>Internal ✓</span>}
          {issues    && <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 600, color: "#7C3AED", background: "#EDE9FE", borderRadius: 4, padding: "1px 6px" }}>Issues ✓</span>}
        </div>
        {hasData && (
          <button onClick={e => { e.stopPropagation(); handleClear(); }}
            style={{ fontSize: 10, color: MUTED, background: "none", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontFamily: "'Inter',sans-serif", marginRight: 6 }}>
            Clear All
          </button>
        )}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform .2s", color: MUTED }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Body */}
      {open && (
        <div style={{ padding: "20px 22px" }}>

          {/* Upload row — shown when either file is missing */}
          {(!crawl || !issues) && (
            <div style={{ display: "flex", gap: 12, marginBottom: hasData ? 24 : 0 }}>
              {!crawl ? (
                <UploadZone onFile={handleCrawlFile} icon="🕷️" label="Internal HTML CSV"
                  subLabel={"Screaming Frog → Internal tab → Export"} compact={hasData} />
              ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px", background: "#F0FDFA" }}>
                  <span style={{ fontSize: 11, color: TEAL, fontWeight: 600 }}>Internal ✓</span>
                  <ReplaceBtn label="Internal" onFile={handleCrawlFile} />
                </div>
              )}
              {!issues ? (
                <UploadZone onFile={handleIssuesFile} icon="⚠️" label="Issues Overview CSV"
                  subLabel={"Screaming Frog → Reports → Issues → Export"} compact={hasData} />
              ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px", background: "#F5F3FF" }}>
                  <span style={{ fontSize: 11, color: "#7C3AED", fontWeight: 600 }}>Issues ✓</span>
                  <ReplaceBtn label="Issues" onFile={handleIssuesFile} />
                </div>
              )}
            </div>
          )}

          {/* Replace row — shown when both files are loaded */}
          {crawl && issues && (
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <ReplaceBtn label="Internal CSV" onFile={handleCrawlFile} />
              <ReplaceBtn label="Issues CSV"   onFile={handleIssuesFile} />
            </div>
          )}

          {(loadingC || loadingI) && <div style={{ textAlign: "center", color: MUTED, fontSize: 12, marginBottom: 12 }}>Parsing…</div>}
          {errorC && <div style={{ color: "#DC2626", fontSize: 12, marginBottom: 10, background: "#FFF8F8", border: "1px solid #FECACA", borderRadius: 6, padding: "8px 12px" }}>{errorC}</div>}
          {errorI && <div style={{ color: "#DC2626", fontSize: 12, marginBottom: 10, background: "#FFF8F8", border: "1px solid #FECACA", borderRadius: 6, padding: "8px 12px" }}>{errorI}</div>}

          {crawl  && <CrawlBody  stats={crawl} />}
          {issues && <IssuesBody stats={issues} />}
        </div>
      )}
    </div>
  );
}

// ── Crawl Report Body ─────────────────────────────────────────────────────────
function CrawlBody({ stats: s }) {
  return (
    <div style={{ fontFamily: "'Inter',sans-serif" }}>
      <SectionHeader title="Overview" color={TEAL} />
      <StatRow stats={[
        { label: "HTML Pages",      value: s.htmlPages.toLocaleString(),    color: TEXT },
        { label: "Indexable",       value: s.indexable.toLocaleString(),    color: "#15803D" },
        { label: "Avg Response",    value: `${s.avgRt}s`,                   color: parseFloat(s.avgRt) > 2 ? "#DC2626" : parseFloat(s.avgRt) > 1 ? "#D97706" : "#15803D", sub: "target <1s" },
        { label: "Avg Word Count",  value: s.avgWordCount.toLocaleString(), color: TEXT },
        { label: "Avg Flesch",      value: s.avgFlesch,                     color: parseFloat(s.avgFlesch) >= 60 ? "#15803D" : "#DC2626", sub: "higher = easier" },
        { label: "Spelling Errors", value: s.totalSpelling.toLocaleString(), color: s.totalSpelling > 50 ? "#DC2626" : "#D97706" },
        { label: "Near Dupes",      value: s.dupeCount.toLocaleString(),    color: s.dupeCount > 0 ? "#D97706" : "#15803D" },
        { label: "Total CO₂",       value: `${s.totalCO2}g`,               color: MUTED, sub: "crawled pages" },
      ]} />

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <DonutChart title="Status Codes" hint="Distribution of all crawled URLs."
          segments={Object.entries(s.statusCodes).map(([label, value]) => ({
            label, value,
            color: label.startsWith("2") ? "#16A34A" : label.startsWith("3") ? "#D97706" : label.startsWith("4") ? "#DC2626" : label.startsWith("5") ? "#7C3AED" : "#9CA3AF"
          }))} />
        <DonutChart title="Indexability" hint="Pages Google can vs. cannot index."
          segments={[{ label: "Indexable", value: s.indexable, color: "#16A34A" }, { label: "Non-Indexable", value: s.nonIndexable, color: "#DC2626" }]} />
        <BarChart title="Crawl Depth" hint=">3 clicks risks poor crawl coverage." data={s.depth} colors={[...BLUES].reverse()} />
      </div>

      <SectionHeader title="Performance" color="#2563EB" />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <BarChart title="Response Time" hint="Aim for >80% under 1s." data={s.rt} colors={["#15803D","#22C55E","#F59E0B","#EF4444","#DC2626"]} />
        <BarChart title="Page Size" hint="Larger pages = more bandwidth and slower renders." data={s.size} colors={["#15803D","#22C55E","#F59E0B","#DC2626"]} />
        <BarChart title="Carbon Rating" hint="A+ is cleanest, F is highest CO₂ per page view."
          data={s.carbon} colors={Object.keys(s.carbon).map(k => CARBON_COLORS[k] || "#9CA3AF")} />
      </div>

      <SectionHeader title="On-Page SEO" color={ACCENT} />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <BarChart title="Title Tag Length" hint="Optimal: 30–60 characters." data={s.title} colors={["#DC2626","#EF4444","#16A34A","#F59E0B"]} />
        <BarChart title="Meta Description Length" hint="Optimal: 70–155 characters." data={s.meta} colors={["#DC2626","#EF4444","#16A34A","#F59E0B"]} />
        <DonutChart title="H1 Coverage" hint="Every indexable page should have exactly one H1."
          segments={[{ label: "Present", value: s.h1["Present"], color: "#16A34A" }, { label: "Missing", value: s.h1["Missing"], color: "#DC2626" }, { label: "Multiple H1s", value: s.h1["Multiple H1s"], color: "#D97706" }]} />
      </div>

      <SectionHeader title="Readability & Content" color="#7C3AED" />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <BarChart title="Flesch Reading Ease" hint="Higher = easier to read. Web content should aim for 60+."
          data={s.flesch} colors={["#15803D","#22C55E","#86EFAC","#F59E0B","#FB923C","#EF4444","#DC2626"].reverse()} />
        <BarChart title="Readability Grade" hint="Category derived from Flesch score."
          data={s.readability} colors={Object.keys(s.readability).map(k => READABILITY_COLORS[k] || "#9CA3AF")} />
        <BarChart title="Word Count" hint="Thin content (<300 words) may signal low quality." data={s.wordCount} colors={["#DC2626","#D97706","#22C55E","#15803D"]} />
      </div>

      <SectionHeader title="Content Quality" color="#D97706" />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <BarChart title="Spelling Errors per Page" data={s.spelling} colors={["#15803D","#22C55E","#F59E0B","#EF4444","#DC2626"]} />
        <BarChart title="Grammar Errors per Page"  data={s.grammar}  colors={["#15803D","#22C55E","#F59E0B","#DC2626"]} />
        <ChartCard title="Near-Duplicate Pages" hint="Pages flagged as very similar to another page.">
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 42, fontWeight: 800, color: s.dupeCount > 0 ? "#D97706" : "#16A34A", lineHeight: 1 }}>{s.dupeCount.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>pages with near duplicates</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>out of {s.htmlPages.toLocaleString()} HTML pages</div>
          </div>
        </ChartCard>
      </div>

      <SectionHeader title="Internal Linking" color="#0E7490" />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <BarChart title="Pages by Inlink Count" hint="Orphaned pages (0 inlinks) are invisible to crawlers."
          data={s.inlinks} colors={["#DC2626","#F59E0B","#22C55E","#15803D"]} />
        <TopInlinksTable rows={s.topInlinks} />
      </div>

      {(Object.keys(s.intent).length > 0 || Object.keys(s.sentiment).length > 0) && (
        <>
          <SectionHeader title="AI Signals — Intent & Sentiment" color="#6D28D9" />
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {Object.keys(s.intent).length > 0 && (
              <BarChart title="Page Intent" hint="Informational = top-of-funnel; Transactional = conversion-ready."
                data={s.intent} colors={[...PURPLES,...BLUES,...GREENS]} />
            )}
            {Object.keys(s.sentiment).length > 0 && (
              <BarChart title="Page Sentiment" hint="Strongly negative sentiment on conversion paths may suppress conversions."
                data={s.sentiment} colors={["#15803D","#22C55E","#F59E0B","#EF4444","#DC2626","#9CA3AF"]} />
            )}
            <BarChart title="Ahrefs URL Rating" hint="URL-level authority. Higher UR = stronger backlink profile."
              data={s.urBuckets} colors={["#9CA3AF",...BLUES]} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Issues Report Body ────────────────────────────────────────────────────────
function IssuesBody({ stats: s }) {
  return (
    <div style={{ fontFamily: "'Inter',sans-serif" }}>
      <SectionHeader title="Issues Overview" color="#DC2626" />
      <StatRow stats={[
        { label: "Total Issues", value: s.total,        color: TEXT },
        { label: "High",         value: s.totalHigh,    color: "#DC2626", sub: "fix first" },
        { label: "Medium",       value: s.totalMedium,  color: "#D97706" },
        { label: "Low",          value: s.totalLow,     color: "#16A34A" },
        { label: "Accessibility",value: s.accessibilityIssues.length, color: "#7C3AED", sub: "issues found" },
        { label: "Opportunities",value: s.byType["Opportunity"] || 0, color: "#2563EB", sub: "to action" },
      ]} />

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <DonutChart title="Issues by Priority" hint="Count of distinct issue types per priority level."
          segments={[
            { label: "High",   value: s.byPriority["High"] || 0,   color: "#DC2626" },
            { label: "Medium", value: s.byPriority["Medium"] || 0, color: "#D97706" },
            { label: "Low",    value: s.byPriority["Low"] || 0,    color: "#16A34A" },
          ]} />
        <DonutChart title="Pages Affected by Priority" hint="Total URLs impacted across all issues per priority."
          segments={[
            { label: "High",   value: s.byPriorityUrls["High"] || 0,   color: "#DC2626" },
            { label: "Medium", value: s.byPriorityUrls["Medium"] || 0, color: "#D97706" },
            { label: "Low",    value: s.byPriorityUrls["Low"] || 0,    color: "#16A34A" },
          ]} />
        <DonutChart title="Issues by Type" hint="Issue = must fix · Warning = should fix · Opportunity = improve"
          segments={[
            { label: "Issue",       value: s.byType["Issue"] || 0,       color: "#DC2626" },
            { label: "Warning",     value: s.byType["Warning"] || 0,     color: "#D97706" },
            { label: "Opportunity", value: s.byType["Opportunity"] || 0, color: "#2563EB" },
          ]} />
      </div>

      <SectionHeader title="Impact by Category" color="#D97706" />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <BarChart
          title="URLs Affected per Category"
          hint="Total pages affected across all issues in each category. Hover a bar to see the fix."
          data={s.byCategoryUrls}
          colors={Object.keys(s.byCategoryUrls).map((k, i) => {
            if (k === "Accessibility") return "#7C3AED";
            if (k === "Security")      return "#DC2626";
            if (k === "Content")       return "#D97706";
            if (k === "Links")         return "#2563EB";
            const palette = [...BLUES,...PURPLES,...AMBERS,...GREENS];
            return palette[i % palette.length];
          })}
        />
      </div>

      <SectionHeader title="♿ Accessibility Issues" color="#7C3AED" />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {s.accessibilityIssues.length > 0 ? (
          <IssueListCard
            title="Accessibility Checks (axe-core)"
            hint="Click any row to see the recommended fix. Sorted by pages affected."
            issues={s.accessibilityIssues}
            showFix
          />
        ) : (
          <ChartCard title="Accessibility" hint="No accessibility issues detected in this export.">
            <div style={{ textAlign: "center", padding: "16px 0", color: "#16A34A", fontSize: 13, fontWeight: 600 }}>✓ No accessibility issues found</div>
          </ChartCard>
        )}
      </div>

      <SectionHeader title="Top High Priority Issues" color="#DC2626" />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <IssueListCard
          title="High Priority — Sorted by Pages Affected"
          hint="Click any row to see the recommended fix."
          issues={s.topHigh}
          showFix
        />
      </div>

      {s.topOpportunities.length > 0 && (
        <>
          <SectionHeader title="Top Opportunities" color="#2563EB" />
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <IssueListCard
              title="Opportunities — Sorted by Pages Affected"
              hint="Click any row to see the recommended fix."
              issues={s.topOpportunities}
              showFix
            />
          </div>
        </>
      )}
    </div>
  );
}
