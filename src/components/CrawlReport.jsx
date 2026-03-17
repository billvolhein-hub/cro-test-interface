import { useState, useRef } from "react";
import { CARD, BORDER, BG, TEXT, MUTED, TEAL, ACCENT } from "../lib/constants";

// ── Palette ─────────────────────────────────────────────────────────────────
const GREENS  = ["#15803D","#16A34A","#4ADE80","#86EFAC"];
const REDS    = ["#DC2626","#EF4444","#FCA5A5"];
const AMBERS  = ["#D97706","#F59E0B","#FDE68A"];
const BLUES   = ["#1B3A6B","#2563EB","#60A5FA","#BFDBFE"];
const PURPLES = ["#7C3AED","#A78BFA","#DDD6FE"];
const GRAYS   = ["#374151","#6B7280","#D1D5DB"];

// ── CSV Parser ───────────────────────────────────────────────────────────────
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
  return { col, allRows, htmlRows, headers };
}

// ── Stats Computation ────────────────────────────────────────────────────────
function computeStats(allRows, htmlRows, col) {
  const bucket = (obj, key) => { obj[key] = (obj[key] || 0) + 1; };

  // Status code breakdown (all crawled)
  const statusCodes = {};
  for (const r of allRows) {
    const code = col(r, "Status Code");
    const b = code.startsWith("2") ? "2xx OK" : code.startsWith("3") ? "3xx Redirect" : code.startsWith("4") ? "4xx Error" : code.startsWith("5") ? "5xx Server Error" : "Other";
    bucket(statusCodes, b);
  }

  // Indexability
  const indexable    = allRows.filter(r => col(r, "Indexability") === "Indexable").length;
  const nonIndexable = allRows.length - indexable;

  // Crawl depth (HTML)
  const depth = {};
  for (const r of htmlRows) { const d = parseInt(col(r, "Crawl Depth")) || 0; bucket(depth, d >= 5 ? "5+" : String(d)); }

  // Response time (HTML)
  let rtTotal = 0, rtCount = 0;
  const rt = { "<0.5s": 0, "0.5–1s": 0, "1–2s": 0, "2–3s": 0, ">3s": 0 };
  for (const r of htmlRows) {
    const v = parseFloat(col(r, "Response Time")) || 0;
    if (v > 0) { rtTotal += v; rtCount++; }
    if (v < 0.5) rt["<0.5s"]++; else if (v < 1) rt["0.5–1s"]++; else if (v < 2) rt["1–2s"]++; else if (v < 3) rt["2–3s"]++; else rt[">3s"]++;
  }

  // Page size (HTML)
  const size = { "<50 KB": 0, "50–100 KB": 0, "100–200 KB": 0, ">200 KB": 0 };
  for (const r of htmlRows) {
    const v = parseInt(col(r, "Size (bytes)")) || 0;
    if (v < 51200) size["<50 KB"]++; else if (v < 102400) size["50–100 KB"]++; else if (v < 204800) size["100–200 KB"]++; else size[">200 KB"]++;
  }

  // Title (HTML)
  const title = { "Missing": 0, "Too Short (<30)": 0, "Optimal (30–60)": 0, "Too Long (>60)": 0 };
  for (const r of htmlRows) {
    const len = parseInt(col(r, "Title 1 Length")) || 0;
    if (len === 0) title["Missing"]++; else if (len < 30) title["Too Short (<30)"]++; else if (len <= 60) title["Optimal (30–60)"]++; else title["Too Long (>60)"]++;
  }

  // Meta desc (HTML)
  const meta = { "Missing": 0, "Too Short (<70)": 0, "Optimal (70–155)": 0, "Too Long (>155)": 0 };
  for (const r of htmlRows) {
    const len = parseInt(col(r, "Meta Description 1 Length")) || 0;
    if (len === 0) meta["Missing"]++; else if (len < 70) meta["Too Short (<70)"]++; else if (len <= 155) meta["Optimal (70–155)"]++; else meta["Too Long (>155)"]++;
  }

  // H1 (HTML)
  const h1 = { "Present": 0, "Missing": 0, "Multiple H1s": 0 };
  for (const r of htmlRows) {
    const v = col(r, "H1-1"), v2 = col(r, "H1-2");
    if (!v) h1["Missing"]++; else if (v2) h1["Multiple H1s"]++; else h1["Present"]++;
  }

  // Readability (HTML)
  const readability = {};
  for (const r of htmlRows) { const v = col(r, "Readability") || "N/A"; if (v !== "N/A" && v) bucket(readability, v); }

  // Flesch (HTML)
  let fleschTotal = 0, fleschCount = 0;
  const flesch = { "Very Confusing (<30)": 0, "Difficult (30–50)": 0, "Fairly Hard (50–60)": 0, "Standard (60–70)": 0, "Fairly Easy (70–80)": 0, "Easy (80–90)": 0, "Very Easy (90+)": 0 };
  for (const r of htmlRows) {
    const v = parseFloat(col(r, "Flesch Reading Ease Score")) || 0;
    if (v > 0) { fleschTotal += v; fleschCount++; }
    if (v >= 90) flesch["Very Easy (90+)"]++; else if (v >= 80) flesch["Easy (80–90)"]++; else if (v >= 70) flesch["Fairly Easy (70–80)"]++; else if (v >= 60) flesch["Standard (60–70)"]++; else if (v >= 50) flesch["Fairly Hard (50–60)"]++; else if (v >= 30) flesch["Difficult (30–50)"]++; else flesch["Very Confusing (<30)"]++;
  }

  // Word count (HTML)
  let wcTotal = 0;
  const wordCount = { "Thin (<300)": 0, "Low (300–600)": 0, "Medium (600–1200)": 0, "Rich (>1200)": 0 };
  for (const r of htmlRows) {
    const v = parseInt(col(r, "Word Count")) || 0; wcTotal += v;
    if (v < 300) wordCount["Thin (<300)"]++; else if (v < 600) wordCount["Low (300–600)"]++; else if (v < 1200) wordCount["Medium (600–1200)"]++; else wordCount["Rich (>1200)"]++;
  }

  // Spelling / Grammar (HTML)
  let spellTotal = 0;
  const spelling = { "None": 0, "1–2": 0, "3–5": 0, "6–10": 0, "10+": 0 };
  const grammar  = { "None": 0, "1–2": 0, "3–5": 0, "6+": 0 };
  for (const r of htmlRows) {
    const s = parseInt(col(r, "Spelling Errors")) || 0; spellTotal += s;
    if (s === 0) spelling["None"]++; else if (s <= 2) spelling["1–2"]++; else if (s <= 5) spelling["3–5"]++; else if (s <= 10) spelling["6–10"]++; else spelling["10+"]++;
    const g = parseInt(col(r, "Grammar Errors")) || 0;
    if (g === 0) grammar["None"]++; else if (g <= 2) grammar["1–2"]++; else if (g <= 5) grammar["3–5"]++; else grammar["6+"]++;
  }

  // Inlinks (HTML)
  const inlinks = { "Orphaned (0)": 0, "Low (1–10)": 0, "Medium (11–50)": 0, "High (50+)": 0 };
  for (const r of htmlRows) {
    const v = parseInt(col(r, "Unique Inlinks")) || 0;
    if (v === 0) inlinks["Orphaned (0)"]++; else if (v <= 10) inlinks["Low (1–10)"]++; else if (v <= 50) inlinks["Medium (11–50)"]++; else inlinks["High (50+)"]++;
  }
  const topInlinks = [...htmlRows]
    .map(r => ({ url: col(r, "Address"), inlinks: parseInt(col(r, "Unique Inlinks")) || 0, title: col(r, "Title 1") }))
    .sort((a, b) => b.inlinks - a.inlinks).slice(0, 12);

  // CO2 / Carbon (HTML)
  const carbon = {};
  let co2Total = 0;
  for (const r of htmlRows) {
    const rating = col(r, "Carbon Rating") || "N/A";
    bucket(carbon, rating);
    co2Total += parseFloat(col(r, "CO2 (mg)")) || 0;
  }

  // Intent / Sentiment (HTML) — AI-generated columns
  const intent = {}, sentiment = {};
  for (const r of htmlRows) {
    const i = col(r, "Intent of Page"); if (i) bucket(intent, i);
    const s = col(r, "Sentiment of page"); if (s) bucket(sentiment, s);
  }

  // Near duplicates
  const dupeCount = htmlRows.filter(r => parseInt(col(r, "No. Near Duplicates")) > 0).length;

  // Ahrefs (HTML, where available)
  const urBuckets = { "No data": 0, "0–10": 0, "11–25": 0, "26–50": 0, "50+": 0 };
  for (const r of htmlRows) {
    const v = parseFloat(col(r, "Ahrefs URL Rating - Exact"));
    if (isNaN(v) || !col(r, "Ahrefs URL Rating - Exact")) urBuckets["No data"]++;
    else if (v <= 10) urBuckets["0–10"]++; else if (v <= 25) urBuckets["11–25"]++; else if (v <= 50) urBuckets["26–50"]++; else urBuckets["50+"]++;
  }

  return {
    totalCrawled: allRows.length,
    htmlPages:    htmlRows.length,
    indexable, nonIndexable,
    avgRt:        rtCount ? (rtTotal / rtCount).toFixed(2) : "—",
    avgWordCount: htmlRows.length ? Math.round(wcTotal / htmlRows.length) : 0,
    avgFlesch:    fleschCount ? (fleschTotal / fleschCount).toFixed(1) : "—",
    totalSpelling: spellTotal,
    totalCO2:     (co2Total / 1000).toFixed(1),
    dupeCount,
    statusCodes, depth, rt, size,
    title, meta, h1,
    readability, flesch, wordCount,
    spelling, grammar,
    inlinks, topInlinks,
    carbon, intent, sentiment, urBuckets,
  };
}

// ── Chart Primitives ─────────────────────────────────────────────────────────

function HBar({ label, value, max, color, pct, sub }) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <div style={{ width: 150, fontSize: 11, color: TEXT, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ flex: 1, height: 14, background: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${width}%`, height: "100%", background: color, borderRadius: 4, transition: "width .4s ease" }} />
      </div>
      <div style={{ width: 56, textAlign: "right", flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{value.toLocaleString()}</span>
        {pct && <span style={{ fontSize: 10, color: MUTED, marginLeft: 3 }}>{pct}%</span>}
      </div>
      {sub && <div style={{ width: 40, fontSize: 10, color: MUTED, flexShrink: 0 }}>{sub}</div>}
    </div>
  );
}

function BarChart({ data, colors, title, hint, total }) {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  const tot = total ?? entries.reduce((s, [, v]) => s + v, 0);
  return (
    <ChartCard title={title} hint={hint}>
      {entries.map(([label, value], i) => (
        <HBar key={label} label={label} value={value} max={max} color={colors[i % colors.length]}
          pct={tot > 0 ? Math.round((value / tot) * 100) : 0} />
      ))}
    </ChartCard>
  );
}

function DonutChart({ segments, size = 80, title, hint }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <ChartCard title={title} hint={hint} row>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        {segments.map((seg, i) => {
          const frac  = total > 0 ? seg.value / total : 0;
          const dash  = frac * circ;
          const gap   = circ - dash;
          const el = (
            <circle key={i} cx={size/2} cy={size/2} r={r}
              fill="none" stroke={seg.color} strokeWidth={8}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size/2} ${size/2})`}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
        {segments.map(seg => (
          <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: TEXT, flex: 1 }}>{seg.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{seg.value.toLocaleString()}</span>
            <span style={{ fontSize: 10, color: MUTED, width: 34, textAlign: "right" }}>{total > 0 ? Math.round((seg.value / total) * 100) : 0}%</span>
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
      <div style={row ? { display: "flex", alignItems: "center", gap: 14 } : {}}>
        {children}
      </div>
    </div>
  );
}

function TopInlinksTable({ rows }) {
  return (
    <ChartCard title="Top Pages by Inlinks" hint="Most internally-linked pages — these carry the most link equity.">
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

// ── Carbon color helper ───────────────────────────────────────────────────────
const CARBON_COLORS = { "A+": "#15803D", "A": "#22C55E", "B": "#86EFAC", "C": "#FDE68A", "D": "#F59E0B", "E": "#EF4444", "F": "#DC2626", "N/A": "#9CA3AF" };
const READABILITY_COLORS = { "Very Easy": "#15803D", "Easy": "#22C55E", "Fairly Easy": "#86EFAC", "Standard": "#F59E0B", "Fairly Hard": "#FB923C", "Hard": "#EF4444", "Very Confusing": "#DC2626" };
const FLESCH_COLORS = ["#15803D","#22C55E","#86EFAC","#F59E0B","#FB923C","#EF4444","#DC2626"];

// ── Drop Zone ─────────────────────────────────────────────────────────────────
function UploadZone({ onFile }) {
  const ref = useRef();
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      onClick={() => ref.current?.click()}
      style={{ border: `2px dashed ${over ? TEAL : BORDER}`, borderRadius: 10, padding: "36px 24px", textAlign: "center", cursor: "pointer", background: over ? "#F0FDFA" : BG, transition: "all .15s" }}
    >
      <input ref={ref} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={e => onFile(e.target.files[0])} />
      <div style={{ fontSize: 28, marginBottom: 8 }}>🕷️</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Upload Screaming Frog Crawl</div>
      <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
        Export: <strong>Internal → All</strong> tab as CSV<br />
        Drop here or click to browse
      </div>
    </div>
  );
}

// ── Main Report ───────────────────────────────────────────────────────────────
export default function CrawlReport({ clientId }) {
  const [stats,   setStats]   = useState(() => {
    try { const raw = localStorage.getItem(`crawl_${clientId}`); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const [domain,  setDomain]  = useState(() => { try { return localStorage.getItem(`crawl_domain_${clientId}`) || ""; } catch { return ""; } });
  const [crawledAt, setCrawledAt] = useState(() => { try { return localStorage.getItem(`crawl_date_${clientId}`) || ""; } catch { return ""; } });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [open,    setOpen]    = useState(!!stats);

  const handleFile = (file) => {
    setLoading(true); setError("");
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const { col, allRows, htmlRows } = parseCrawlCSV(e.target.result);
        const s = computeStats(allRows, htmlRows, col);
        const dom = htmlRows[0] ? new URL(col(htmlRows[0], "Address")).hostname : "";
        const now = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        setStats(s); setDomain(dom); setCrawledAt(now);
        localStorage.setItem(`crawl_${clientId}`, JSON.stringify(s));
        localStorage.setItem(`crawl_domain_${clientId}`, dom);
        localStorage.setItem(`crawl_date_${clientId}`, now);
        setOpen(true);
      } catch (err) {
        setError("Could not parse CSV: " + err.message);
      } finally { setLoading(false); }
    };
    reader.readAsText(file);
  };

  const handleClear = () => {
    localStorage.removeItem(`crawl_${clientId}`);
    localStorage.removeItem(`crawl_domain_${clientId}`);
    localStorage.removeItem(`crawl_date_${clientId}`);
    setStats(null); setDomain(""); setCrawledAt("");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 10, marginBottom: 24, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>

      {/* Header */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", cursor: "pointer", background: "#F0FDFA", borderBottom: open ? `1px solid ${BORDER}` : "none" }}
      >
        <div style={{ width: 20, height: 20, borderRadius: 6, background: TEAL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <circle cx="5" cy="5" r="3.5" stroke="#fff" strokeWidth="1.3"/>
            <path d="M7.5 7.5l2 2" stroke="#fff" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: TEAL, letterSpacing: 0.5 }}>
          Crawl Report
          {domain && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: MUTED }}>{domain}</span>}
          {crawledAt && <span style={{ marginLeft: 6, fontSize: 10, color: MUTED }}>· {crawledAt}</span>}
        </div>
        {stats && (
          <button onClick={e => { e.stopPropagation(); handleClear(); }}
            style={{ fontSize: 10, color: MUTED, background: "none", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontFamily: "'Inter',sans-serif", marginRight: 6 }}>
            Clear
          </button>
        )}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform .2s", color: MUTED }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Body */}
      {open && (
        <div style={{ padding: "20px 22px" }}>
          {!stats ? (
            <>
              <UploadZone onFile={handleFile} />
              {loading && <div style={{ textAlign: "center", color: MUTED, fontSize: 12, marginTop: 12 }}>Parsing crawl data…</div>}
              {error   && <div style={{ color: "#DC2626", fontSize: 12, marginTop: 10, background: "#FFF8F8", border: "1px solid #FECACA", borderRadius: 6, padding: "8px 12px" }}>{error}</div>}
            </>
          ) : (
            <ReportBody stats={stats} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Report Body ───────────────────────────────────────────────────────────────
function ReportBody({ stats: s }) {
  return (
    <div style={{ fontFamily: "'Inter',sans-serif" }}>

      {/* ── Overview ── */}
      <SectionHeader title="Overview" color={TEAL} />
      <StatRow stats={[
        { label: "HTML Pages",      value: s.htmlPages.toLocaleString(),  color: TEXT  },
        { label: "Indexable",       value: s.indexable.toLocaleString(),  color: "#15803D" },
        { label: "Avg Response",    value: `${s.avgRt}s`,                 color: s.avgRt > 2 ? "#DC2626" : s.avgRt > 1 ? "#D97706" : "#15803D", sub: "target <1s" },
        { label: "Avg Word Count",  value: s.avgWordCount.toLocaleString(), color: TEXT },
        { label: "Avg Flesch",      value: s.avgFlesch,                   color: parseFloat(s.avgFlesch) >= 60 ? "#15803D" : "#DC2626", sub: "higher = easier" },
        { label: "Spelling Errors", value: s.totalSpelling.toLocaleString(), color: s.totalSpelling > 50 ? "#DC2626" : "#D97706" },
        { label: "Near Dupes",      value: s.dupeCount.toLocaleString(),  color: s.dupeCount > 0 ? "#D97706" : "#15803D" },
        { label: "Total CO₂",       value: `${s.totalCO2}g`,             color: MUTED, sub: "per crawled page" },
      ]} />

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <DonutChart
          title="Status Codes" hint="Distribution of all crawled URLs by HTTP status."
          segments={Object.entries(s.statusCodes).map(([label, value], i) => ({
            label, value,
            color: label.startsWith("2") ? "#16A34A" : label.startsWith("3") ? "#D97706" : label.startsWith("4") ? "#DC2626" : label.startsWith("5") ? "#7C3AED" : "#9CA3AF"
          }))}
        />
        <DonutChart
          title="Indexability" hint="Pages Google can vs. cannot index."
          segments={[
            { label: "Indexable",     value: s.indexable,    color: "#16A34A" },
            { label: "Non-Indexable", value: s.nonIndexable, color: "#DC2626" },
          ]}
        />
        <BarChart title="Crawl Depth" hint="Clicks from homepage to reach each page. >3 clicks risks poor crawl coverage."
          data={s.depth} colors={[...BLUES].reverse()} />
      </div>

      {/* ── Performance ── */}
      <SectionHeader title="Performance" color="#2563EB" />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <BarChart title="Response Time" hint="Server response time for HTML pages. Aim for >80% under 1s."
          data={s.rt} colors={["#15803D","#22C55E","#F59E0B","#EF4444","#DC2626"]} />
        <BarChart title="Page Size" hint="HTML document size in bytes. Larger pages = more bandwidth and slower renders."
          data={s.size} colors={["#15803D","#22C55E","#F59E0B","#DC2626"]} />
        <BarChart title="Carbon Rating" hint="Screaming Frog's carbon efficiency rating per page. A+ is cleanest, F is highest emissions."
          data={s.carbon}
          colors={Object.keys(s.carbon).map(k => CARBON_COLORS[k] || "#9CA3AF")} />
      </div>

      {/* ── On-Page SEO ── */}
      <SectionHeader title="On-Page SEO" color={ACCENT} />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <BarChart title="Title Tag Length" hint="Optimal: 30–60 characters. Too long gets truncated in SERPs."
          data={s.title} colors={["#DC2626","#EF4444","#16A34A","#F59E0B"]} />
        <BarChart title="Meta Description Length" hint="Optimal: 70–155 characters. Missing = Google auto-generates snippets."
          data={s.meta} colors={["#DC2626","#EF4444","#16A34A","#F59E0B"]} />
        <DonutChart
          title="H1 Coverage" hint="Every indexable page should have exactly one H1."
          segments={[
            { label: "Present",      value: s.h1["Present"],      color: "#16A34A" },
            { label: "Missing",      value: s.h1["Missing"],      color: "#DC2626" },
            { label: "Multiple H1s", value: s.h1["Multiple H1s"], color: "#D97706" },
          ]}
        />
      </div>

      {/* ── Readability & Content ── */}
      <SectionHeader title="Readability & Content" color="#7C3AED" />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <BarChart title="Flesch Reading Ease" hint="Higher = easier to read. College-level content typically scores 30–50. Web content should aim for 60+."
          data={s.flesch}
          colors={FLESCH_COLORS.slice().reverse()} />
        <BarChart title="Readability Grade" hint="Screaming Frog readability category derived from Flesch score."
          data={s.readability}
          colors={Object.keys(s.readability).map(k => READABILITY_COLORS[k] || "#9CA3AF")} />
        <BarChart title="Word Count" hint="Thin content (<300 words) may signal low quality to search engines."
          data={s.wordCount} colors={["#DC2626","#D97706","#22C55E","#15803D"]} />
      </div>

      {/* ── Content Quality ── */}
      <SectionHeader title="Content Quality" color="#D97706" />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <BarChart title="Spelling Errors per Page" hint="Screaming Frog flags potential spelling issues. Errors on key conversion pages hurt credibility."
          data={s.spelling} colors={["#15803D","#22C55E","#F59E0B","#EF4444","#DC2626"]} />
        <BarChart title="Grammar Errors per Page" hint="Grammar issues can reduce trust signals, especially on high-intent pages."
          data={s.grammar} colors={["#15803D","#22C55E","#F59E0B","#DC2626"]} />
        <ChartCard title="Near-Duplicate Pages" hint="Pages with very similar content to another page. Consolidation may improve crawl efficiency and ranking clarity.">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 42, fontWeight: 800, color: s.dupeCount > 0 ? "#D97706" : "#16A34A", lineHeight: 1 }}>{s.dupeCount.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>pages with near duplicates</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 8, textAlign: "center" }}>out of {s.htmlPages.toLocaleString()} HTML pages</div>
          </div>
        </ChartCard>
      </div>

      {/* ── Internal Linking ── */}
      <SectionHeader title="Internal Linking" color="#0E7490" />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <BarChart title="Pages by Inlink Count" hint="Orphaned pages (0 inlinks) are invisible to crawlers unless in a sitemap. High-inlink pages receive the most authority."
          data={s.inlinks} colors={["#DC2626","#F59E0B","#22C55E","#15803D"]} />
        <TopInlinksTable rows={s.topInlinks} />
      </div>

      {/* ── Intent & Sentiment (AI) ── */}
      {(Object.keys(s.intent).length > 0 || Object.keys(s.sentiment).length > 0) && (
        <>
          <SectionHeader title="AI Signals — Intent & Sentiment" color="#6D28D9" />
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {Object.keys(s.intent).length > 0 && (
              <BarChart title="Page Intent" hint="AI-inferred intent type per page. Informational = top-of-funnel; Transactional = conversion-ready."
                data={s.intent} colors={[...PURPLES, ...BLUES, ...GREENS]} />
            )}
            {Object.keys(s.sentiment).length > 0 && (
              <BarChart title="Page Sentiment" hint="AI-inferred sentiment per page. Strongly negative pages on conversion paths may suppress conversions."
                data={s.sentiment} colors={["#15803D","#22C55E","#F59E0B","#EF4444","#DC2626","#9CA3AF"]} />
            )}
            {Object.keys(s.urBuckets).length > 0 && (
              <BarChart title="Ahrefs URL Rating" hint="URL-level authority signal. Pages with higher UR have stronger backlink profiles."
                data={s.urBuckets} colors={["#9CA3AF",...BLUES]} />
            )}
          </div>
        </>
      )}

    </div>
  );
}
