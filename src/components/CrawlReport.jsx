import { useState, useRef, forwardRef, useImperativeHandle } from "react";
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
  const inlinkRows = htmlRows.map(r => ({
    url:    col(r, "Address"),
    title:  col(r, "Title 1"),
    depth:  parseInt(col(r, "Crawl Depth")) || 0,
    links:  parseInt(col(r, "Unique Inlinks")) || 0,
  }));
  for (const r of inlinkRows) {
    const v = r.links;
    if (v === 0) inlinks["Orphaned (0)"]++; else if (v <= 10) inlinks["Low (1–10)"]++; else if (v <= 50) inlinks["Medium (11–50)"]++; else inlinks["High (50+)"]++;
  }
  const orphanedPages = inlinkRows.filter(r => r.links === 0).sort((a, b) => a.depth - b.depth);
  const buriedPages   = inlinkRows.filter(r => r.depth >= 3 && r.links <= 5 && r.links > 0).sort((a, b) => b.depth - a.depth || a.links - b.links).slice(0, 10);
  // Link concentration: what % of pages hold 80% of all inlinks
  const sortedByLinks = [...inlinkRows].sort((a, b) => b.links - a.links);
  const totalInlinks  = sortedByLinks.reduce((s, r) => s + r.links, 0);
  let cumLinks = 0, topPct = 0;
  for (let i = 0; i < sortedByLinks.length; i++) {
    cumLinks += sortedByLinks[i].links;
    if (cumLinks / totalInlinks >= 0.8) { topPct = Math.round(((i + 1) / sortedByLinks.length) * 100); break; }
  }

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
    inlinks, orphanedPages, buriedPages, topPct, carbon, intent, sentiment, urBuckets,
  };
}

// ── Issues Stats ──────────────────────────────────────────────────────────────
// ── Accessibility Scoring ──────────────────────────────────────────────────────
const A11Y_PRIORITY_WEIGHT = { High: 100, Medium: 55, Low: 20 };

function issueImpactScore(issue) {
  const base = A11Y_PRIORITY_WEIGHT[issue.priority] ?? 20;
  const coverage = Math.min(issue.pct / 100, 1); // 0–1
  return Math.round(base * coverage);
}

function a11yHealthScore(issues) {
  if (!issues.length) return 100;
  // Penalty per issue: High×0.45, Medium×0.15, Low×0.04 × pct coverage, capped at 100
  const PENALTY = { High: 0.45, Medium: 0.15, Low: 0.04 };
  const penalty = issues.reduce((sum, i) => {
    return sum + (PENALTY[i.priority] ?? 0.04) * Math.min(i.pct, 100);
  }, 0);
  return Math.max(0, Math.round(100 - penalty));
}

function scoreGrade(score) {
  if (score >= 90) return { grade: "A", color: "#15803D", bg: "#F0FDF4", border: "#BBF7D0", label: "Excellent" };
  if (score >= 75) return { grade: "B", color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", label: "Good" };
  if (score >= 60) return { grade: "C", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", label: "Needs Work" };
  if (score >= 40) return { grade: "D", color: "#EA580C", bg: "#FFF7ED", border: "#FED7AA", label: "Poor" };
  return           { grade: "F", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", label: "Critical" };
}

// ── Accessibility Health Gauge ─────────────────────────────────────────────────
function A11yGauge({ score }) {
  const { grade, color, bg, border, label } = scoreGrade(score);
  // SVG half-circle gauge: 180° arc, filled to score%
  const R = 54, cx = 70, cy = 66;
  const toRad = d => (d * Math.PI) / 180;
  // Arc from 180° (left) to 0° (right) — half circle
  const arcPct = score / 100;
  const sweepDeg = 180 * arcPct;
  const startA = 180;
  const endA   = 180 - sweepDeg;
  const x1 = cx + R * Math.cos(toRad(startA));
  const y1 = cy + R * Math.sin(toRad(startA));
  const x2 = cx + R * Math.cos(toRad(endA));
  const y2 = cy + R * Math.sin(toRad(endA));
  const largeArc = sweepDeg > 180 ? 1 : 0;
  // Track path (full half)
  const tx1 = cx - R, ty1 = cy;
  const tx2 = cx + R, ty2 = cy;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 160 }}>
      <svg width="140" height="80" viewBox="0 0 140 80">
        {/* Track */}
        <path d={`M ${tx1} ${ty1} A ${R} ${R} 0 0 1 ${tx2} ${ty2}`}
          fill="none" stroke="#E5E7EB" strokeWidth="10" strokeLinecap="round" />
        {/* Filled arc */}
        {score > 0 && (
          <path d={`M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 0 ${x2} ${y2}`}
            fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
        )}
        {/* Score text */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" fontWeight="800" fill={color} fontFamily="Inter,sans-serif">{score}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fontWeight="700" fill="#9CA3AF" fontFamily="Inter,sans-serif" letterSpacing="1.5">/ 100</text>
      </svg>
      <div style={{ marginTop: -8, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 18, fontWeight: 900, color, background: bg, border: `1.5px solid ${border}`, borderRadius: 6, padding: "2px 10px", lineHeight: 1.4 }}>{grade}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
      </div>
      <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4, textAlign: "center" }}>Accessibility Health Score</div>
    </div>
  );
}

// impactGrade: higher score = worse = redder (opposite of scoreGrade)
function impactGrade(score) {
  if (score >= 80) return { label: "Critical", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", bar: "#DC2626" };
  if (score >= 60) return { label: "Severe",   color: "#EA580C", bg: "#FFF7ED", border: "#FED7AA", bar: "#EA580C" };
  if (score >= 35) return { label: "Moderate", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", bar: "#D97706" };
  if (score >= 15) return { label: "Minor",    color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE", bar: "#2563EB" };
  return            { label: "Minimal",  color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB", bar: "#9CA3AF" };
}

// ── Issue Impact Cards ─────────────────────────────────────────────────────────
function A11yIssueGrid({ issues }) {
  const sorted = [...issues].sort((a, b) => issueImpactScore(b) - issueImpactScore(a));
  const PRIORITY_COLOR = { High: "#DC2626", Medium: "#D97706", Low: "#16A34A" };
  const PRIORITY_BG    = { High: "#FEF2F2", Medium: "#FFFBEB", Low: "#F0FDF4" };
  const TYPE_COLOR     = { Issue: "#DC2626", Warning: "#D97706", Opportunity: "#2563EB" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, width: "100%" }}>
      {sorted.map((issue, idx) => {
        const impact  = issueImpactScore(issue);
        const { label: sevLabel, color: sevColor, bg: sevBg, border: sevBorder, bar: barColor } = impactGrade(impact);
        const pColor  = PRIORITY_COLOR[issue.priority] ?? "#6B7280";
        const pBg     = PRIORITY_BG[issue.priority]    ?? "#F9FAFB";
        const tColor  = TYPE_COLOR[issue.type]         ?? "#6B7280";
        const name    = issue.name.replace(/^[^:]+:\s*/, "");

        return (
          <div key={idx} style={{
            background: "#fff",
            border: `1.5px solid ${sevBorder}`,
            borderLeft: `4px solid ${sevColor}`,
            borderRadius: 8,
            overflow: "hidden",
          }}>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px 10px" }}>
              {/* Score block */}
              <div style={{ flexShrink: 0, textAlign: "center", background: sevBg, border: `1px solid ${sevBorder}`, borderRadius: 7, padding: "6px 10px", minWidth: 54 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: sevColor, lineHeight: 1 }}>{impact}</div>
                <div style={{ fontSize: 8, fontWeight: 800, color: sevColor, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 2 }}>{sevLabel}</div>
              </div>
              {/* Name + badges */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, lineHeight: 1.4, marginBottom: 6 }}>{name}</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: pColor, background: pBg, border: `1px solid ${pColor}33`, borderRadius: 4, padding: "2px 7px" }}>{issue.priority} Priority</span>
                  {issue.type && <span style={{ fontSize: 9, fontWeight: 700, color: tColor, background: `${tColor}12`, border: `1px solid ${tColor}33`, borderRadius: 4, padding: "2px 7px" }}>{issue.type}</span>}
                </div>
              </div>
              {/* Page count */}
              <div style={{ flexShrink: 0, textAlign: "right" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: sevColor }}>{issue.pct.toFixed(0)}%</div>
                <div style={{ fontSize: 9, color: MUTED, fontWeight: 600 }}>of pages</div>
                <div style={{ fontSize: 9, color: MUTED }}>{issue.urls.toLocaleString()} URLs</div>
              </div>
            </div>

            {/* Coverage bar — full width, colored by severity */}
            <div style={{ height: 6, background: "#F3F4F6" }}>
              <div style={{ width: `${Math.min(issue.pct, 100)}%`, height: "100%", background: barColor, transition: "width .5s ease" }} />
            </div>

            {/* Fix — always shown */}
            {issue.fix && (
              <div style={{ padding: "9px 14px", background: "#FAFAFA", borderTop: `1px solid ${BORDER}` }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: TEXT }}>How to fix: </span>
                <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.6 }}>{issue.fix}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Quick Wins ────────────────────────────────────────────────────────────────
function QuickWins({ issues }) {
  const wins = issues
    .filter(i => i.priority !== "High" && i.pct >= 50)
    .sort((a, b) => issueImpactScore(b) - issueImpactScore(a))
    .slice(0, 5);
  if (!wins.length) return null;
  return (
    <ChartCard title="Quick Wins" hint="Medium/Low issues affecting more than half your pages — high ROI fixes.">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {wins.map((issue, i) => {
          const impact = issueImpactScore(issue);
          const { color, bg, border } = impactGrade(impact);
          const name = issue.name.replace(/^[^:]+:\s*/, "");
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < wins.length - 1 ? `1px solid ${BORDER}` : "none" }}>
              <div style={{ flexShrink: 0, background: bg, border: `1px solid ${border}`, borderRadius: 5, padding: "3px 7px", textAlign: "center", minWidth: 36 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color, lineHeight: 1 }}>{impact}</div>
              </div>
              <div style={{ flex: 1, fontSize: 11, color: TEXT, lineHeight: 1.3 }}>{name}</div>
              <span style={{ fontSize: 11, fontWeight: 700, color }}>{issue.pct.toFixed(0)}% of pages</span>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}

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
function HBar({ label, value, max, color, pct }) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: TEXT, marginBottom: 3, lineHeight: 1.3 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 12, background: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${width}%`, height: "100%", background: color, borderRadius: 4, transition: "width .4s ease" }} />
        </div>
        <div style={{ width: 64, textAlign: "right", flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{typeof value === "number" ? value.toLocaleString() : value}</span>
          {pct != null && <span style={{ fontSize: 10, color: MUTED, marginLeft: 3 }}>{pct}%</span>}
        </div>
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

function ChartCard({ title, hint, children, row, collapsible, defaultCollapsed, summary }) {
  const [open, setOpen] = useState(collapsible ? !defaultCollapsed : true);
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px", flex: !open ? "0 0 auto" : "1 1 280px", minWidth: 260 }}>
      {title && (
        <div
          onClick={collapsible ? () => setOpen(o => !o) : undefined}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2, cursor: collapsible ? "pointer" : "default" }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: TEXT }}>{title}</div>
          {collapsible && <span style={{ fontSize: 10, color: MUTED, userSelect: "none" }}>{open ? "▲" : "▼"}</span>}
        </div>
      )}
      {!open && summary && <div style={{ marginTop: 10 }}>{summary}</div>}
      {open && hint  && <div style={{ fontSize: 10, color: MUTED, marginBottom: 10, lineHeight: 1.4 }}>{hint}</div>}
      {open && <div style={row ? { display: "flex", alignItems: "center", gap: 14 } : {}}>{children}</div>}
    </div>
  );
}

function InternalLinkingInsights({ orphaned, buried, topPct }) {
  const [showAllOrphans, setShowAllOrphans] = useState(false);
  const visibleOrphans = showAllOrphans ? orphaned : orphaned.slice(0, 8);

  return (
    <div style={{ display: "flex", gap: 10, flex: "1 1 0", minWidth: 0, flexWrap: "wrap" }}>
      {/* Orphaned Pages */}
      <ChartCard
        title={`Orphaned Pages`}
        hint="No internal links point to these pages — crawlers and users can't find them organically."
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: orphaned.length > 0 ? "#DC2626" : "#16A34A", lineHeight: 1 }}>{orphaned.length}</div>
          <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.4 }}>pages with<br/>zero inlinks</div>
          {topPct > 0 && (
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: TEXT }}>{topPct}%</div>
              <div style={{ fontSize: 9, color: MUTED }}>of pages hold<br/>80% of links</div>
            </div>
          )}
        </div>
        {orphaned.length === 0 ? (
          <div style={{ fontSize: 11, color: "#16A34A", fontWeight: 600 }}>No orphaned pages found.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {visibleOrphans.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#DC2626", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title || r.url}</div>
                  <div style={{ fontSize: 9, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.url}</div>
                </div>
                <div style={{ fontSize: 9, color: MUTED, flexShrink: 0 }}>Depth {r.depth}</div>
              </div>
            ))}
            {orphaned.length > 8 && (
              <button onClick={() => setShowAllOrphans(v => !v)} style={{ marginTop: 4, fontSize: 10, color: ACCENT, background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", fontWeight: 600 }}>
                {showAllOrphans ? "Show less" : `+${orphaned.length - 8} more orphaned pages`}
              </button>
            )}
          </div>
        )}
      </ChartCard>

      {/* Buried Pages */}
      {buried.length > 0 && (
        <ChartCard
          title="Buried Pages"
          hint="Deep pages (3+ clicks from home) with few inlinks — hard for crawlers to reach, add internal links."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {buried.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6 }}>
                <div style={{ flexShrink: 0, textAlign: "center", background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 4, padding: "2px 6px" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#D97706" }}>D{r.depth}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title || r.url}</div>
                  <div style={{ fontSize: 9, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.url}</div>
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#D97706", flexShrink: 0, background: "#FEF3C7", borderRadius: 4, padding: "2px 6px" }}>{r.links} link{r.links !== 1 ? "s" : ""}</div>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
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
          <div key={idx} style={{ marginBottom: 10, cursor: showFix ? "pointer" : "default" }} onClick={() => setExpanded(isOpen ? null : idx)}>
            {/* Label row */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.4, flex: 1 }}>
                {issue.name.replace(/^[^:]+:\s*/, "")}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{issue.urls.toLocaleString()}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: pColor, background: PRIORITY_BG[issue.priority] || "#F9FAFB", borderRadius: 3, padding: "1px 5px" }}>
                  {issue.priority}
                </span>
              </div>
            </div>
            {/* Bar row */}
            <div style={{ height: 8, background: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${Math.max((issue.urls / max) * 100, issue.urls > 0 ? 2 : 0)}%`, height: "100%", background: pColor, borderRadius: 4 }} />
            </div>
            {/* Expanded fix */}
            {isOpen && issue.fix && (
              <div style={{ marginTop: 6, fontSize: 10, color: MUTED, lineHeight: 1.5, background: "#F9FAFB", border: `1px solid ${BORDER}`, borderRadius: 5, padding: "7px 10px" }}>
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
const CrawlReport = forwardRef(function CrawlReport({ crawlReport, onSave, onDomainExtracted, onBuildStart, onBuildComplete }, ref) {
  const [crawl,     setCrawl]     = useState(crawlReport?.internal ?? null);
  const [issues,    setIssues]    = useState(crawlReport?.issues   ?? null);
  const [domain,    setDomain]    = useState(crawlReport?.domain   ?? "");
  const [crawledAt, setCrawledAt] = useState(crawlReport?.date     ?? "");
  const [loadingC,  setLoadingC]  = useState(false);
  const [loadingI,  setLoadingI]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [errorC,    setErrorC]    = useState("");
  const [errorI,    setErrorI]    = useState("");
  const [open,      setOpen]      = useState(false);

  const crawlInputRef  = useRef(null);
  const issuesInputRef = useRef(null);

  const persist = async (patch) => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave({ internal: crawl, issues, domain, date: crawledAt, ...patch });
    } finally { setSaving(false); }
  };

  const handleCrawlFile = (file) => {
    setLoadingC(true); setErrorC("");
    onBuildStart?.();
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      setTimeout(() => {
        try {
          const { col, allRows, htmlRows } = parseCrawlCSV(text);
          const s = computeStats(allRows, htmlRows, col);
          const dom = htmlRows[0] ? (() => { try { return new URL(htmlRows[0][0]).hostname; } catch { return ""; } })() : "";
          const now = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          setCrawl(s); setDomain(dom); setCrawledAt(now);
          persist({ internal: s, domain: dom, date: now });
          if (dom) onDomainExtracted?.(dom);
          onBuildComplete?.("crawl");
        } catch (err) { setErrorC("Could not parse crawl CSV: " + err.message); onBuildComplete?.("crawl"); }
        finally { setLoadingC(false); }
      }, 0);
    };
    reader.readAsText(file);
  };

  const handleIssuesFile = (file) => {
    setLoadingI(true); setErrorI("");
    onBuildStart?.();
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      setTimeout(() => {
        try {
          const raw = parseIssuesCSV(text);
          const s = computeIssueStats(raw);
          setIssues(s);
          persist({ issues: s });
          onBuildComplete?.("issues");
        } catch (err) { setErrorI("Could not parse issues CSV: " + err.message); onBuildComplete?.("issues"); }
        finally { setLoadingI(false); }
      }, 0);
    };
    reader.readAsText(file);
  };

  useImperativeHandle(ref, () => ({
    triggerCrawlUpload:  () => crawlInputRef.current?.click(),
    triggerIssuesUpload: () => issuesInputRef.current?.click(),
    processCrawlFile:    (file) => handleCrawlFile(file),
    processIssuesFile:   (file) => handleIssuesFile(file),
  }));

  const handleClear = () => {
    setCrawl(null); setIssues(null); setDomain(""); setCrawledAt("");
    onSave?.(null);
  };

  const hasData = !!(crawl || issues);

  return (
    <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 10, marginBottom: 24, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>

      {/* Hidden file inputs for external triggers */}
      <input ref={crawlInputRef}  type="file" accept=".csv" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) handleCrawlFile(e.target.files[0]); e.target.value = ""; }} />
      <input ref={issuesInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) handleIssuesFile(e.target.files[0]); e.target.value = ""; }} />

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
          SEO Report
          {domain    && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: MUTED }}>{domain}</span>}
          {crawledAt && <span style={{ marginLeft: 6, fontSize: 10, color: MUTED }}>· {crawledAt}</span>}
          {crawl     && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: TEAL, background: "#CCFBF1", borderRadius: 4, padding: "1px 6px" }}>Internal ✓</span>}
          {issues    && <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 600, color: "#7C3AED", background: "#EDE9FE", borderRadius: 4, padding: "1px 6px" }}>Issues ✓</span>}
          {saving    && <span style={{ marginLeft: 6, fontSize: 10, color: MUTED }}>Saving…</span>}
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
});

export default CrawlReport;

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
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
        <BarChart title="Pages by Inlink Count" hint="Orphaned pages (0 inlinks) are invisible to crawlers."
          data={s.inlinks} colors={["#DC2626","#F59E0B","#22C55E","#15803D"]} />
        <InternalLinkingInsights orphaned={s.orphanedPages ?? []} buried={s.buriedPages ?? []} topPct={s.topPct ?? 0} />
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

      <SectionHeader title="♿ Accessibility" color="#7C3AED" />
      {s.accessibilityIssues.length > 0 ? (() => {
        const healthScore = a11yHealthScore(s.accessibilityIssues);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Score + summary row */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "stretch" }}>
              <ChartCard title="Health Score" hint="Weighted score based on issue priority × % of pages affected. High issues on all pages penalise heavily.">
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px 0" }}>
                  <A11yGauge score={healthScore} />
                  <div style={{ marginTop: 14, display: "flex", gap: 16, justifyContent: "center" }}>
                    {[
                      { label: "High",   val: s.accessibilityIssues.filter(i => i.priority === "High").length,   color: "#DC2626" },
                      { label: "Medium", val: s.accessibilityIssues.filter(i => i.priority === "Medium").length, color: "#D97706" },
                      { label: "Low",    val: s.accessibilityIssues.filter(i => i.priority === "Low").length,    color: "#16A34A" },
                    ].map(({ label, val, color }) => val > 0 && (
                      <div key={label} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color }}>{val}</div>
                        <div style={{ fontSize: 9, color: MUTED, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </ChartCard>
              <QuickWins issues={s.accessibilityIssues} />
            </div>
            {/* Issue impact cards */}
            <ChartCard
              title="Issue Impact Scores"
              hint="Each issue scored 0–100 based on priority weight × % of pages affected."
              collapsible
              defaultCollapsed
              summary={(() => {
                const sorted = [...s.accessibilityIssues].sort((a, b) => issueImpactScore(b) - issueImpactScore(a));
                const counts = { Critical: 0, Severe: 0, Moderate: 0, Minor: 0, Minimal: 0 };
                sorted.forEach(i => { const g = impactGrade(issueImpactScore(i)); counts[g.label]++; });
                const severityColors = { Critical: "#DC2626", Severe: "#EA580C", Moderate: "#D97706", Minor: "#2563EB", Minimal: "#6B7280" };
                const severityBg    = { Critical: "#FEF2F2", Severe: "#FFF7ED", Moderate: "#FFFBEB", Minor: "#EFF6FF", Minimal: "#F9FAFB" };
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* Severity count pills */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {Object.entries(counts).filter(([, v]) => v > 0).map(([label, count]) => (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, background: severityBg[label], border: `1px solid ${severityColors[label]}33`, borderRadius: 6, padding: "5px 10px" }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: severityColors[label], flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 800, color: severityColors[label] }}>{count}</span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: severityColors[label] }}>{label}</span>
                        </div>
                      ))}
                      <div style={{ marginLeft: "auto", fontSize: 10, color: MUTED, alignSelf: "center" }}>{sorted.length} issues total · click ▲ to expand</div>
                    </div>
                    {/* Top 3 issues preview */}
                    <div style={{ display: "flex", gap: 8 }}>
                      {sorted.slice(0, 3).map((issue, i) => {
                        const impact = issueImpactScore(issue);
                        const { label: sevLabel, color, bg, border } = impactGrade(impact);
                        const name = issue.name.replace(/^[^:]+:\s*/, "");
                        return (
                          <div key={i} style={{ flex: 1, background: bg, border: `1px solid ${border}`, borderLeft: `3px solid ${color}`, borderRadius: 6, padding: "8px 10px", minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                              <span style={{ fontSize: 16, fontWeight: 900, color, lineHeight: 1 }}>{impact}</span>
                              <span style={{ fontSize: 8, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 0.6 }}>{sevLabel}</span>
                            </div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: TEXT, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{name}</div>
                            <div style={{ fontSize: 10, fontWeight: 700, color, marginTop: 4 }}>{issue.pct.toFixed(0)}% of pages</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            >
              <A11yIssueGrid issues={s.accessibilityIssues} />
            </ChartCard>
          </div>
        );
      })() : (
        <ChartCard title="Accessibility" hint="No accessibility issues detected in this export.">
          <div style={{ textAlign: "center", padding: "16px 0", color: "#16A34A", fontSize: 13, fontWeight: 600 }}>✓ No accessibility issues found</div>
        </ChartCard>
      )}

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
