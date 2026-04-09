import { useState, useEffect, useRef } from "react";
import { BORDER, BG, CARD, MUTED, TEXT, TEAL } from "../lib/constants";
import { mergeReportData, reapplySegments, DEFAULT_SEGMENT_RULES, ctrBenchmark } from "../lib/mergeReportData";

// ── Palette ───────────────────────────────────────────────────────────────────
const VIOLET  = "#7C3AED";
const V_LIGHT = "#F5F3FF";
const V_BADGE = "#EDE9FE";

const PRIORITY_COLORS = { high: "#DC2626", medium: "#D97706", low: "#16A34A" };
const PRIORITY_BG     = { high: "#FEF2F2", medium: "#FFFBEB", low: "#F0FDF4" };
const COVERAGE = {
  "full":    { bg: "#F0FDF4", color: "#15803D", label: "Full" },
  "sf+gsc":  { bg: "#EFF6FF", color: "#2563EB", label: "SF+GSC" },
  "sf+ga":   { bg: "#F0FDFA", color: "#0E7490", label: "SF+GA4" },
  "sf-only": { bg: "#F9FAFB", color: "#6B7280", label: "SF Only" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n, decimals = 0) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: decimals });
}
function fmtPct(n) {
  if (n == null || isNaN(n)) return "—";
  return (Number(n) * 100).toFixed(1) + "%";
}
function shortUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname + u.search;
    return path.length > 60 ? path.slice(0, 57) + "…" : path;
  } catch { return url; }
}

// ── Coverage badge ────────────────────────────────────────────────────────────
function CoverageBadge({ coverage }) {
  const c = COVERAGE[coverage] || COVERAGE["sf-only"];
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: c.bg, color: c.color, whiteSpace: "nowrap" }}>
      {c.label}
    </span>
  );
}

// ── Sortable table header ─────────────────────────────────────────────────────
function Th({ label, sortKey, current, dir, onSort }) {
  const active = current === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{ padding: "6px 10px", fontSize: 10, fontWeight: 700, color: active ? TEXT : MUTED, textAlign: "left", cursor: "pointer", whiteSpace: "nowrap", borderBottom: `1px solid ${BORDER}`, userSelect: "none" }}
    >
      {label}{active ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );
}

// ── Insight panel ─────────────────────────────────────────────────────────────
function InsightPanel({ insight, columns, headerAction, bodyPrefix, beforeTable }) {
  const hasPages = (insight.pages?.length ?? 0) > 0;
  const [open,    setOpen]    = useState(hasPages);
  const [showAll, setShowAll] = useState(false);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("desc");

  const pages = insight.pages || [];

  const sorted = sortKey
    ? [...pages].sort((a, b) => {
        const va = a[sortKey] ?? 0, vb = b[sortKey] ?? 0;
        return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
      })
    : pages;

  const displayed = showAll ? sorted : sorted.slice(0, 10);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, marginBottom: 10, overflow: "hidden" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", cursor: "pointer", background: BG, borderBottom: open ? `1px solid ${BORDER}` : "none" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{insight.title}</span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: PRIORITY_BG[insight.priority] || "#F9FAFB", color: PRIORITY_COLORS[insight.priority] || MUTED }}>
            {insight.priority.toUpperCase()}
          </span>
          {pages.length > 0 && (
            <span style={{ fontSize: 10, color: MUTED }}>{pages.length} {insight.id === "segment-health" ? "segments" : insight.id === "keyword-intent-gap" || insight.id === "query-expansion-gap" ? "queries" : "pages"}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {headerAction && <div onClick={e => e.stopPropagation()}>{headerAction}</div>}
          <span style={{ fontSize: 12, color: MUTED, display: "inline-block", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▾</span>
        </div>
      </div>

      {open && (
        <div style={{ padding: "12px 14px" }}>
          {bodyPrefix}
          <p style={{ fontSize: 11, color: MUTED, margin: "0 0 6px 0" }}>{insight.description}</p>
          <div style={{ fontSize: 11, color: TEXT, background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, padding: "6px 10px", marginBottom: 10 }}>
            💡 {insight.recommendation}
          </div>

          {pages.length === 0 ? (
            <div style={{ fontSize: 12, color: MUTED, textAlign: "center", padding: "16px 0" }}>No pages match this criteria.</div>
          ) : (
            <>
              {beforeTable}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: BG }}>
                      {columns.map(col => col.sortKey
                        ? <Th key={col.key} label={col.label} sortKey={col.sortKey} current={sortKey} dir={sortDir} onSort={handleSort} />
                        : <th key={col.key} style={{ padding: "6px 10px", fontSize: 10, fontWeight: 700, color: MUTED, textAlign: "left", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>{col.label}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 === 0 ? "#fff" : BG }}>
                        {columns.map(col => (
                          <td key={col.key} style={{ padding: "6px 10px", color: TEXT, whiteSpace: col.wrap ? "normal" : "nowrap", maxWidth: col.maxWidth }}>
                            {col.render ? col.render(row) : (row[col.key] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pages.length > 10 && (
                <div style={{ textAlign: "center", marginTop: 8 }}>
                  <button
                    onClick={() => setShowAll(s => !s)}
                    style={{ fontSize: 11, color: VIOLET, background: "none", border: `1px solid ${VIOLET}`, borderRadius: 5, padding: "3px 12px", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}
                  >
                    {showAll ? "Show top 10" : `Show all ${pages.length}`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Segment donut chart ───────────────────────────────────────────────────────
const SEG_COLORS = ["#7C3AED","#3B82F6","#14B8A6","#F59E0B","#EF4444","#22C55E","#EC4899","#8B5CF6","#0EA5E9","#A3E635"];

function SegmentDonutChart({ segments }) {
  const sorted = [...segments].sort((a, b) => b.page_count - a.page_count);
  const total  = sorted.reduce((s, r) => s + (r.page_count || 0), 0);
  if (!total) return null;

  const cx = 70, cy = 70, R = 62, ri = 40;
  let angle = -Math.PI / 2;

  const slices = sorted.map((seg, i) => {
    const pct   = (seg.page_count || 0) / total;
    const sweep = pct * 2 * Math.PI * 0.9998; // avoid perfect-360 SVG edge case
    const a1    = angle, a2 = angle + sweep;
    angle += pct * 2 * Math.PI;
    const large = sweep > Math.PI ? 1 : 0;
    const p = (a, rr) => `${cx + rr * Math.cos(a)} ${cy + rr * Math.sin(a)}`;
    const path = `M ${p(a1,R)} A ${R} ${R} 0 ${large} 1 ${p(a2,R)} L ${p(a2,ri)} A ${ri} ${ri} 0 ${large} 0 ${p(a1,ri)} Z`;
    return { ...seg, path, color: SEG_COLORS[i % SEG_COLORS.length], pct };
  });

  const maxPages = sorted[0]?.page_count || 1;

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "center", margin: "0 0 14px 0", padding: "14px 0 14px 0", borderBottom: `1px solid ${BORDER}` }}>
      {/* Donut */}
      <svg width={140} height={140} viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth={2} />
        ))}
        <text x={cx} y={cy - 7} textAnchor="middle" fontSize={15} fontWeight={800} fill={TEXT} fontFamily="Inter,sans-serif">
          {total.toLocaleString()}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fontWeight={600} fill={MUTED} fontFamily="Inter,sans-serif" letterSpacing="0.8">
          PAGES
        </text>
      </svg>

      {/* Legend */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: TEXT, textTransform: "capitalize", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.segment}
            </span>
            {/* Mini bar */}
            <div style={{ width: 80, height: 5, borderRadius: 3, background: BORDER, overflow: "hidden", flexShrink: 0 }}>
              <div style={{ height: "100%", borderRadius: 3, background: s.color, width: `${(s.page_count / maxPages) * 100}%`, transition: "width .4s" }} />
            </div>
            <span style={{ fontSize: 10, color: MUTED, width: 42, textAlign: "right", flexShrink: 0 }}>
              {s.page_count.toLocaleString()}
            </span>
            <span style={{ fontSize: 10, fontWeight: 800, color: s.color, width: 34, textAlign: "right", flexShrink: 0 }}>
              {(s.pct * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Full Funnel Score distribution chart ─────────────────────────────────────
function FullFunnelChart({ pages }) {
  if (!pages?.length) return null;

  const W = 580, H = 230;
  const ML = 44, MR = 148, MT = 28, MB = 38;
  const PW = W - ML - MR, PH = H - MT - MB;

  // 10 buckets: 0–9, 10–19, … 90–100
  const buckets = Array.from({ length: 10 }, (_, i) => ({ min: i * 10, count: 0 }));
  for (const p of pages) buckets[Math.min(Math.floor((p.page_score || 0) / 10), 9)].count++;
  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const barW = PW / 10;

  const barColor = min =>
    min < 20 ? "#EF4444" : min < 40 ? "#F97316" : min < 60 ? "#F59E0B" : min < 80 ? "#84CC16" : "#22C55E";

  const avgScore = pages.reduce((s, p) => s + (p.page_score || 0), 0) / pages.length;
  const avgX = ML + (avgScore / 100) * PW;

  const critical = pages.filter(p => (p.page_score || 0) < 20).length;
  const strong   = pages.filter(p => (p.page_score || 0) >= 60).length;

  const n = pages.length;
  const stages = [
    { label: "Search reach",   pct: pages.filter(p => (p.impressions      || 0) > 0   ).length / n, color: "#3B82F6" },
    { label: "CTR health",     pct: pages.filter(p => (p.ctr              || 0) > 0.03).length / n, color: "#7C3AED" },
    { label: "Engagement",     pct: pages.filter(p => (p.engagement_rate  || 0) > 0   ).length / n, color: "#14B8A6" },
    { label: "Conversions",    pct: pages.filter(p => (p.key_events       || 0) > 0   ).length / n, color: "#F59E0B" },
    { label: "No tech issues", pct: pages.filter(p => !p.has_sf_issues                ).length / n, color: "#22C55E" },
  ];

  const yTicks = [0, Math.round(maxCount / 2), maxCount];

  return (
    <div style={{ margin: "0 0 16px 0", padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", flex: "1 1 auto", minWidth: 0 }}>

          {/* "Target zone" background: scores 60–100 */}
          <rect x={ML + PW * 0.6} y={MT} width={PW * 0.4} height={PH} fill="#F0FDF4" rx={2} />
          <text x={ML + PW * 0.8} y={MT - 6} textAnchor="middle" fontSize={8} fill="#16A34A" fontWeight={700} fontFamily="Inter,sans-serif" letterSpacing="0.4">TARGET ZONE</text>

          {/* Y gridlines */}
          {yTicks.map(v => {
            const y = MT + PH - (v / maxCount) * PH;
            return (
              <g key={v}>
                {v > 0 && <line x1={ML} y1={y} x2={ML + PW} y2={y} stroke={BORDER} strokeWidth={1} />}
                <text x={ML - 6} y={y + 4} textAnchor="end" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">{v}</text>
              </g>
            );
          })}

          {/* Bars */}
          {buckets.map((b, i) => {
            const x    = ML + i * barW;
            const barH = (b.count / maxCount) * PH;
            const y    = MT + PH - barH;
            const col  = barColor(b.min);
            return (
              <g key={i}>
                <rect x={x + 2} y={y} width={barW - 4} height={barH} fill={col} fillOpacity={0.75} rx={2} />
                {b.count > 0 && (
                  <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={9} fontWeight={700} fill={col} fontFamily="Inter,sans-serif">{b.count}</text>
                )}
              </g>
            );
          })}

          {/* Average line */}
          <line x1={avgX} y1={MT - 2} x2={avgX} y2={MT + PH} stroke="#475569" strokeWidth={1.5} strokeDasharray="4,2" />
          <text x={avgX} y={MT - 8} textAnchor="middle" fontSize={8} fontWeight={700} fill="#475569" fontFamily="Inter,sans-serif">avg {avgScore.toFixed(0)}</text>

          {/* Axes */}
          <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />
          <line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />

          {/* X axis labels */}
          {[0, 20, 40, 60, 80, 100].map(v => (
            <text key={v} x={ML + (v / 100) * PW} y={MT + PH + 15} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">{v}</text>
          ))}

          {/* Axis labels */}
          <text x={ML + PW / 2} y={H - 3} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">Page Score (0–100)</text>
          <text x={10} y={MT + PH / 2} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif" transform={`rotate(-90,10,${MT + PH / 2})`}>Pages</text>
        </svg>

        {/* Stage Health sidebar */}
        <div style={{ width: 134, flexShrink: 0, paddingTop: MT }}>
          <div style={{ fontSize: 8.5, color: MUTED, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 10 }}>Stage Health</div>
          {stages.map(({ label, pct, color }) => (
            <div key={label} style={{ marginBottom: 9 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 9, color: TEXT, fontFamily: "Inter,sans-serif" }}>{label}</span>
                <span style={{ fontSize: 9, fontWeight: 800, color, fontFamily: "Inter,sans-serif" }}>{Math.round(pct * 100)}%</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: BORDER }}>
                <div style={{ height: "100%", borderRadius: 3, background: color, width: `${pct * 100}%`, transition: "width .4s" }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { label: "Critical (< 20)", value: critical, color: "#EF4444" },
              { label: "Strong (60+)",    value: strong,   color: "#22C55E" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color, fontFamily: "Inter,sans-serif" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CTR Opportunity Gap chart ─────────────────────────────────────────────────
function CTROpportunityChart({ pages }) {
  if (!pages?.length) return null;

  const W = 600, H = 260;
  const ML = 50, MR = 124, MT = 24, MB = 40;
  const PW = W - ML - MR, PH = H - MT - MB;

  const maxPos = Math.min(50, Math.max(...pages.map(p => p.position || 0), 10));
  const maxImp = Math.max(...pages.map(p => p.impressions || 0), 1);
  const maxGap = Math.max(...pages.map(p => p.ctr_gap || 0), 0.01);

  const xScale = pos => ML + (Math.log(Math.min(pos, maxPos)) / Math.log(maxPos)) * PW;
  const yScale = ctr => MT + PH - (Math.min(ctr, 0.30) / 0.30) * PH;
  const rScale = imp => Math.max(3.5, Math.min(9, 3.5 + Math.sqrt(imp / maxImp) * 6));
  const lineColor = gap => (gap / maxGap) > 0.6 ? "#EF4444" : (gap / maxGap) > 0.3 ? "#F97316" : "#F59E0B";

  // Benchmark curve + fill
  const bPos = Array.from({ length: 50 }, (_, i) => i + 1).filter(p => p <= maxPos);
  const benchCurve = bPos.map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p)} ${yScale(ctrBenchmark(p))}`).join(" ");
  const benchFill  = benchCurve + ` L ${xScale(maxPos)} ${MT + PH} L ${xScale(1)} ${MT + PH} Z`;

  const totalMissed = pages.reduce((s, p) => s + Math.round((p.ctr_gap || 0) * (p.impressions || 0)), 0);
  const avgGap  = pages.reduce((s, p) => s + (p.ctr_gap || 0), 0) / pages.length;
  const avgPos  = pages.reduce((s, p) => s + (p.position || 0), 0) / pages.length;

  const yTicks = [0, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30];
  const xTicks = [1, 2, 5, 10, 20, 30, 50].filter(v => v <= maxPos);

  return (
    <div style={{ margin: "0 0 16px 0", padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", flex: "1 1 auto", minWidth: 0 }}>

          {/* Expected CTR region */}
          <path d={benchFill} fill="#EFF6FF" />
          <path d={benchCurve} fill="none" stroke="#3B82F6" strokeWidth={1.5} strokeOpacity={0.7} />
          <text x={xScale(2.5) + 4} y={yScale(ctrBenchmark(2.5)) - 5} fontSize={8} fill="#3B82F6" fontFamily="Inter,sans-serif" opacity={0.9}>Expected CTR</text>

          {/* Y gridlines */}
          {yTicks.map(v => {
            const y = yScale(v);
            return (
              <g key={v}>
                {v > 0 && <line x1={ML} y1={y} x2={ML + PW} y2={y} stroke={BORDER} strokeWidth={1} />}
                <text x={ML - 6} y={y + 4} textAnchor="end" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">{Math.round(v * 100)}%</text>
              </g>
            );
          })}

          {/* X gridlines */}
          {xTicks.map(v => {
            const x = xScale(v);
            return (
              <g key={v}>
                <line x1={x} y1={MT} x2={x} y2={MT + PH} stroke={BORDER} strokeWidth={1} strokeDasharray="3,2" />
                <text x={x} y={MT + PH + 15} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">{v}</text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />
          <line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />

          {/* Axis labels */}
          <text x={ML + PW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">Search Position — log scale →</text>
          <text x={10} y={MT + PH / 2} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif" transform={`rotate(-90,10,${MT + PH / 2})`}>CTR %</text>

          {/* Gap lines + dots — draw lines first, then dots on top */}
          {[...pages].filter(p => p.position > 0).map((p, i) => {
            const x      = xScale(p.position);
            const yAct   = yScale(p.ctr || 0);
            const yBench = yScale(ctrBenchmark(p.position));
            const col    = lineColor(p.ctr_gap || 0);
            return (
              <line key={`l${i}`} x1={x} y1={yBench} x2={x} y2={yAct}
                stroke={col} strokeWidth={2} strokeOpacity={0.5} />
            );
          })}
          {[...pages]
            .filter(p => p.position > 0)
            .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
            .map((p, i) => {
              const x      = xScale(p.position);
              const yAct   = yScale(p.ctr || 0);
              const yBench = yScale(ctrBenchmark(p.position));
              const r      = rScale(p.impressions);
              const col    = lineColor(p.ctr_gap || 0);
              return (
                <g key={`d${i}`}>
                  <circle cx={x} cy={yAct}   r={r}   fill={col}      fillOpacity={0.65} stroke="#fff" strokeWidth={1.5} />
                  <circle cx={x} cy={yBench} r={2.5} fill="#3B82F6"  fillOpacity={0.85} stroke="#fff" strokeWidth={1}   />
                </g>
              );
            })}
        </svg>

        {/* Stats sidebar */}
        <div style={{ width: 110, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, paddingTop: MT }}>
          {[
            { label: "Pages",          value: pages.length,                           color: TEXT      },
            { label: "Avg CTR Gap",    value: `${(avgGap * 100).toFixed(1)}%`,        color: "#F97316" },
            { label: "Avg Position",   value: avgPos.toFixed(1),                      color: TEXT      },
            { label: "Est. Missed",    value: totalMissed.toLocaleString(), sub: "clicks vs benchmark", color: "#EF4444" },
          ].map(({ label, value, color, sub }) => (
            <div key={label} style={{ background: "#F8FAFC", borderRadius: 6, padding: "6px 10px", border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 8.5, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
              {sub && <div style={{ fontSize: 8, color: MUTED, marginTop: 2 }}>{sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 6, paddingLeft: ML }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width={10} height={10}><circle cx={5} cy={5} r={3.5} fill="#3B82F6" fillOpacity={0.85} stroke="#fff" strokeWidth={1} /></svg>
          <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>benchmark CTR at position</span>
        </div>
        {[["large gap", "#EF4444"], ["medium gap", "#F97316"], ["small gap", "#F59E0B"]].map(([label, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width={14} height={10}>
              <line x1={7} y1={1} x2={7} y2={9} stroke={color} strokeWidth={2} strokeOpacity={0.6} />
              <circle cx={7} cy={8} r={3} fill={color} fillOpacity={0.7} stroke="#fff" strokeWidth={1} />
            </svg>
            <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>{label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width={22} height={10}><circle cx={4} cy={5} r={3} fill="#94A3B8" fillOpacity={0.4} stroke="#fff" strokeWidth={1} /><circle cx={16} cy={5} r={5} fill="#94A3B8" fillOpacity={0.4} stroke="#fff" strokeWidth={1} /></svg>
          <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>size = impressions</span>
        </div>
      </div>
    </div>
  );
}

// ── Position Cliff Pages chart ────────────────────────────────────────────────
function PositionCliffChart({ pages }) {
  if (!pages?.length) return null;

  const W = 600, H = 240;
  const ML = 56, MR = 124, MT = 24, MB = 40;
  const PW = W - ML - MR, PH = H - MT - MB;

  const X_MIN = 7.5, X_MAX = 15.5;
  const xScale = pos => ML + ((Math.min(Math.max(pos, X_MIN), X_MAX) - X_MIN) / (X_MAX - X_MIN)) * PW;

  const maxImp = Math.max(...pages.map(p => p.impressions || 0), 200);
  const yScale = imp => MT + PH - (Math.log(Math.max(imp, 1)) / Math.log(maxImp)) * PH;
  const maxGap    = Math.max(...pages.map(p => p.ctr_gap || 0), 0.01);
  const maxExtRef = Math.max(...pages.map(p => p.ext_refdomains || 0), 1);
  const cliffHasAhrefs = pages.some(p => p.ext_refdomains > 0);
  const rScale = (gap, extRef) => cliffHasAhrefs
    ? Math.max(4, Math.min(12, 4 + Math.sqrt((extRef || 0) / maxExtRef) * 8))
    : Math.max(4, Math.min(10, 4 + ((gap || 0) / maxGap) * 6));
  const dotColor = pos => pos <= 10 ? "#22C55E" : pos <= 12 ? "#F59E0B" : "#F97316";

  const boundX = xScale(10.5);
  const page1Count  = pages.filter(p => p.position <= 10).length;
  const page2Count  = pages.filter(p => p.position > 10).length;
  const totalImp    = pages.reduce((s, p) => s + (p.impressions || 0), 0);
  const extAuthCount = pages.filter(p => p.ext_refdomains > 0).length;

  const xTicks = [8, 9, 10, 11, 12, 13, 14, 15];
  const yTicks = [200, 500, 1000, 5000, 10000, 50000].filter(v => v <= maxImp * 1.1);

  return (
    <div style={{ margin: "0 0 16px 0", padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", flex: "1 1 auto", minWidth: 0 }}>

          {/* Zone backgrounds */}
          <rect x={ML}      y={MT} width={boundX - ML}      height={PH} fill="#F0FDF4" /> {/* page 1 — green tint */}
          <rect x={boundX}  y={MT} width={ML + PW - boundX} height={PH} fill="#FFFBEB" /> {/* page 2 — amber tint */}

          {/* Zone labels */}
          <text x={ML + (boundX - ML) / 2} y={MT + 13} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#16A34A" fontFamily="Inter,sans-serif" letterSpacing="0.4">PAGE 1</text>
          <text x={boundX + (ML + PW - boundX) / 2} y={MT + 13} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#D97706" fontFamily="Inter,sans-serif" letterSpacing="0.4">PAGE 2</text>

          {/* Page 1 / Page 2 boundary */}
          <line x1={boundX} y1={MT} x2={boundX} y2={MT + PH} stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="5,3" />

          {/* Y gridlines */}
          {yTicks.map(v => {
            const y = yScale(v);
            return (
              <g key={v}>
                <line x1={ML} y1={y} x2={ML + PW} y2={y} stroke={BORDER} strokeWidth={1} />
                <text x={ML - 6} y={y + 4} textAnchor="end" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">
                  {v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : v}
                </text>
              </g>
            );
          })}

          {/* X position ticks */}
          {xTicks.map(v => {
            const x = xScale(v);
            return (
              <g key={v}>
                <line x1={x} y1={MT} x2={x} y2={MT + PH} stroke={BORDER} strokeWidth={1} strokeDasharray="3,2" />
                <text x={x} y={MT + PH + 15} textAnchor="middle" fontSize={9} fill={v <= 10 ? "#16A34A" : MUTED} fontWeight={v <= 10 ? 700 : 400} fontFamily="Inter,sans-serif">#{v}</text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />
          <line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />

          {/* Axis labels */}
          <text x={ML + PW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">Search Position</text>
          <text x={10} y={MT + PH / 2} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif" transform={`rotate(-90,10,${MT + PH / 2})`}>Impressions (log)</text>

          {/* Dots — largest behind */}
          {[...pages]
            .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
            .map((p, i) => {
              const x = xScale(p.position), y = yScale(p.impressions || 200);
              const r = rScale(p.ctr_gap, p.ext_refdomains), col = dotColor(p.position);
              return <circle key={i} cx={x} cy={y} r={r} fill={col} fillOpacity={0.65} stroke="#fff" strokeWidth={1.5} />;
            })}
        </svg>

        {/* Stats sidebar */}
        <div style={{ width: 110, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, paddingTop: MT }}>
          {[
            { label: "Total Pages",    value: pages.length,  color: TEXT      },
            { label: "On Page 1",      value: page1Count,    color: "#22C55E", sub: "positions 8–10" },
            { label: "On Page 2",      value: page2Count,    color: "#F59E0B", sub: "positions 11–15" },
            { label: "Total Impr.",    value: totalImp >= 1000 ? `${(totalImp / 1000).toFixed(1)}k` : totalImp, color: TEXT },
            ...(cliffHasAhrefs ? [{ label: "Ext. Authority", value: extAuthCount, sub: "has ref. domains", color: "#7C3AED" }] : []),
          ].map(({ label, value, color, sub }) => (
            <div key={label} style={{ background: "#F8FAFC", borderRadius: 6, padding: "6px 10px", border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 8.5, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
              {sub && <div style={{ fontSize: 8, color: MUTED, marginTop: 2 }}>{sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 6, paddingLeft: ML }}>
        {[["Pos 8–10 (page 1)", "#22C55E"], ["Pos 11–12", "#F59E0B"], ["Pos 13–15", "#F97316"]].map(([label, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill={color} fillOpacity={0.7} stroke="#fff" strokeWidth={1} /></svg>
            <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>{label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width={22} height={10}><circle cx={4} cy={5} r={3} fill="#94A3B8" fillOpacity={0.4} stroke="#fff" strokeWidth={1} /><circle cx={16} cy={5} r={5} fill="#94A3B8" fillOpacity={0.4} stroke="#fff" strokeWidth={1} /></svg>
          <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>{cliffHasAhrefs ? "size = ref. domains" : "size = CTR gap"}</span>
        </div>
      </div>
    </div>
  );
}

// ── High-Value Orphan Pages chart ─────────────────────────────────────────────
function OrphanPagesChart({ pages }) {
  if (!pages?.length) return null;

  const W = 600, H = 220;
  const ML = 76, MR = 124, MT = 16, MB = 34;
  const PW = W - ML - MR, PH = H - MT - MB;
  const LANE_H = PH / 3;

  const maxViews  = Math.max(...pages.map(p => p.views   || 0), 100);
  const maxClicks = Math.max(...pages.map(p => p.clicks  || 0), 1);

  // Log scale X — views spread across the lane
  const xScale = v  => ML + (Math.log(Math.max(v, 1)) / Math.log(maxViews)) * PW;
  const rScale = cl => Math.max(3.5, Math.min(10, 3.5 + Math.sqrt(cl / maxClicks) * 7));
  // Color by views — orphans often have no GSC data so impressions is always 0
  const dotColor = v => v > 5000 ? "#7C3AED" : v > 1000 ? "#3B82F6" : v > 100 ? "#14B8A6" : "#94A3B8";

  const LANES = [
    { il: 0, label: "No inlinks",  bg: "#FEF2F2", textColor: "#EF4444" },
    { il: 1, label: "1 inlink",    bg: "#FFF7ED", textColor: "#F97316" },
    { il: 2, label: "2 inlinks",   bg: "#FFFBEB", textColor: "#D97706" },
  ];

  // Group + sort by views within each lane, then stagger y to reduce overlap
  const byLane = { 0: [], 1: [], 2: [] };
  for (const p of pages) byLane[Math.min(p.inlinks || 0, 2)].push(p);
  for (const il of [0, 1, 2]) byLane[il].sort((a, b) => (a.views || 0) - (b.views || 0));

  const xTicks = [10, 50, 100, 500, 1000, 5000].filter(v => v <= maxViews);

  const totalViews  = pages.reduce((s, p) => s + (p.views || 0), 0);
  const zeroLinks   = pages.filter(p => !p.inlinks).length;
  const hasSearch   = pages.filter(p => (p.views || 0) > 1000).length;
  const hasAhrefs   = pages.some(p => p.ext_refdomains > 0);
  const extAuth     = pages.filter(p => p.ext_refdomains > 0).length;

  return (
    <div style={{ margin: "0 0 16px 0", padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", flex: "1 1 auto", minWidth: 0 }}>

          {/* Swim lanes */}
          {LANES.map(({ il, label, bg, textColor }) => {
            const y0 = MT + il * LANE_H;
            const yC = y0 + LANE_H / 2;
            return (
              <g key={il}>
                <rect x={ML} y={y0} width={PW} height={LANE_H} fill={bg} />
                {/* Lane label on left */}
                <text x={ML - 8} y={yC + 4} textAnchor="end" fontSize={9} fontWeight={700} fill={textColor} fontFamily="Inter,sans-serif">{label}</text>
                {/* Dots — stagger y position (cycle -10, 0, +10) to reduce overlap */}
                {byLane[il].map((p, i) => {
                  const x    = xScale(p.views || 1);
                  const yOff = (i % 3 - 1) * 9;
                  const r    = rScale(p.clicks || 0);
                  const col  = dotColor(p.views || 0);
                  const hasExt = hasAhrefs && p.ext_refdomains > 0;
                  return (
                    <g key={i}>
                      {hasExt && <circle cx={x} cy={yC + yOff} r={r + 4} fill="none" stroke="#7C3AED" strokeWidth={1.5} strokeDasharray="3,2" opacity={0.7} />}
                      <circle cx={x} cy={yC + yOff} r={r} fill={col} fillOpacity={0.8} stroke="#fff" strokeWidth={1.5} />
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Lane dividers */}
          {[1, 2].map(il => (
            <line key={il} x1={ML} y1={MT + il * LANE_H} x2={ML + PW} y2={MT + il * LANE_H} stroke="#E2E8F0" strokeWidth={1} />
          ))}

          {/* X gridlines + labels */}
          {xTicks.map(v => {
            const x = xScale(v);
            return (
              <g key={v}>
                <line x1={x} y1={MT} x2={x} y2={MT + PH} stroke="#E2E8F0" strokeWidth={1} strokeDasharray="3,2" />
                <text x={x} y={MT + PH + 14} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">
                  {v >= 1000 ? `${v / 1000}k` : v}
                </text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />
          <line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />

          {/* Axis label */}
          <text x={ML + PW / 2} y={H - 3} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">Views — log scale →</text>
        </svg>

        {/* Stats sidebar */}
        <div style={{ width: 110, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, paddingTop: MT }}>
          {[
            { label: "Pages",         value: pages.length,  color: TEXT      },
            { label: "No Inlinks",    value: zeroLinks,     color: "#EF4444" },
            { label: "Total Views",   value: totalViews >= 1000 ? `${(totalViews / 1000).toFixed(1)}k` : totalViews, color: TEXT },
            { label: "High Traffic",  value: hasSearch, sub: "views > 1,000",    color: "#3B82F6" },
            ...(hasAhrefs ? [{ label: "Ext. Authority", value: extAuth, sub: "has ref. domains", color: "#7C3AED" }] : []),
          ].map(({ label, value, color, sub }) => (
            <div key={label} style={{ background: "#F8FAFC", borderRadius: 6, padding: "6px 10px", border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 8.5, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
              {sub && <div style={{ fontSize: 8, color: MUTED, marginTop: 2 }}>{sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 6, paddingLeft: ML, flexWrap: "wrap" }}>
        {[["5k+ views", "#7C3AED"], ["1k–5k", "#3B82F6"], ["100–1k", "#14B8A6"], ["< 100", "#94A3B8"]].map(([label, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill={color} fillOpacity={0.8} stroke="#fff" strokeWidth={1} /></svg>
            <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>{label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width={22} height={10}><circle cx={4} cy={5} r={3} fill="#94A3B8" fillOpacity={0.4} stroke="#fff" strokeWidth={1} /><circle cx={16} cy={5} r={5} fill="#94A3B8" fillOpacity={0.4} stroke="#fff" strokeWidth={1} /></svg>
          <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>size = clicks</span>
        </div>
        {hasAhrefs && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width={16} height={16}><circle cx={8} cy={8} r={5} fill="none" stroke="#7C3AED" strokeWidth={1.5} strokeDasharray="3,2" /></svg>
            <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>ring = ext. ref. domains</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Engaged but Not Converting chart ─────────────────────────────────────────
function EngagedNoConvertChart({ pages }) {
  if (!pages?.length) return null;

  const W = 600, H = 250;
  const ML = 54, MR = 124, MT = 24, MB = 40;
  const PW = W - ML - MR, PH = H - MT - MB;

  const maxTime = Math.max(...pages.map(p => p.avg_engagement_time || 0), 60);
  const maxViews = Math.max(...pages.map(p => p.views || 0), 10);

  // Log scales on both axes to spread out the clusters
  const xScale = t => ML + (Math.log(Math.max(t, 1)) / Math.log(maxTime)) * PW;
  const yScale = v => MT + PH - (Math.log(Math.max(v, 1)) / Math.log(maxViews)) * PH;
  const rScale = rate => Math.max(4, Math.min(9, 4 + (rate || 0) * 5));

  const dotColor = ke => ke === 0 ? "#EF4444" : ke < 10 ? "#F97316" : "#F59E0B";

  // "Attention trap" quadrant — above median on both axes
  const medTime  = [...pages].sort((a, b) => (a.avg_engagement_time || 0) - (b.avg_engagement_time || 0))[Math.floor(pages.length / 2)]?.avg_engagement_time || 60;
  const medViews = [...pages].sort((a, b) => (a.views || 0) - (b.views || 0))[Math.floor(pages.length / 2)]?.views || 50;
  const trapX1 = xScale(medTime), trapY2 = yScale(medViews);

  const fmtTime = s => { const m = Math.floor(s / 60), sec = Math.round(s % 60); return m > 0 ? `${m}m ${sec}s` : `${sec}s`; };

  const avgTime   = pages.reduce((s, p) => s + (p.avg_engagement_time || 0), 0) / pages.length;
  const totalViews = pages.reduce((s, p) => s + (p.views || 0), 0);
  const zeroConvert = pages.filter(p => !p.key_events).length;
  const trapCount  = pages.filter(p => (p.avg_engagement_time || 0) >= medTime && (p.views || 0) >= medViews).length;

  // X ticks in seconds, formatted as time
  const xTickVals = [30, 60, 120, 180, 300, 600].filter(v => v <= maxTime);
  // Y ticks: log-spaced round numbers
  const yTickVals = [1, 10, 50, 100, 500, 1000, 5000].filter(v => v <= maxViews);

  return (
    <div style={{ margin: "0 0 16px 0", padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", flex: "1 1 auto", minWidth: 0 }}>
          {/* Attention trap quadrant */}
          <rect x={trapX1} y={MT} width={ML + PW - trapX1} height={trapY2 - MT} fill="#FFF7ED" rx={3} />
          <text x={ML + PW - 5} y={MT + 11} textAnchor="end" fontSize={8} fill="#F97316" fontWeight={700} fontFamily="Inter,sans-serif" letterSpacing="0.5">ATTENTION TRAP</text>
          <line x1={trapX1} y1={MT} x2={trapX1} y2={trapY2} stroke="#F97316" strokeWidth={1} strokeDasharray="3,2" strokeOpacity={0.5} />
          <line x1={trapX1} y1={trapY2} x2={ML + PW} y2={trapY2} stroke="#F97316" strokeWidth={1} strokeDasharray="3,2" strokeOpacity={0.5} />

          {/* Y gridlines */}
          {yTickVals.map(v => {
            const y = yScale(v);
            return (
              <g key={v}>
                <line x1={ML} y1={y} x2={ML + PW} y2={y} stroke={BORDER} strokeWidth={1} />
                <text x={ML - 6} y={y + 4} textAnchor="end" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">
                  {v >= 1000 ? `${v / 1000}k` : v}
                </text>
              </g>
            );
          })}

          {/* X gridlines */}
          {xTickVals.map(v => {
            const x = xScale(v);
            return (
              <g key={v}>
                <line x1={x} y1={MT} x2={x} y2={MT + PH} stroke={BORDER} strokeWidth={1} strokeDasharray="3,2" />
                <text x={x} y={MT + PH + 15} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">{fmtTime(v)}</text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />
          <line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />

          {/* Axis labels */}
          <text x={ML + PW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">Avg Engagement Time — log scale →</text>
          <text x={10} y={MT + PH / 2} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif" transform={`rotate(-90,10,${MT + PH / 2})`}>Views (log)</text>

          {/* Dots — most views behind */}
          {[...pages]
            .filter(p => p.avg_engagement_time > 0 && p.views > 0)
            .sort((a, b) => (b.views || 0) - (a.views || 0))
            .map((p, i) => {
              const x = xScale(p.avg_engagement_time), y = yScale(p.views);
              const r = rScale(p.engagement_rate), col = dotColor(p.key_events || 0);
              return <circle key={i} cx={x} cy={y} r={r} fill={col} fillOpacity={0.6} stroke="#fff" strokeWidth={1.5} />;
            })}
        </svg>

        {/* Stats sidebar */}
        <div style={{ width: 110, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, paddingTop: MT }}>
          {[
            { label: "Pages",          value: pages.length,              color: TEXT      },
            { label: "Avg Eng. Time",  value: fmtTime(Math.round(avgTime)), color: "#F97316" },
            { label: "Total Views",    value: totalViews >= 1000 ? `${(totalViews / 1000).toFixed(1)}k` : totalViews, color: TEXT },
            { label: "Attention Trap", value: trapCount, sub: "high time + high views", color: "#EF4444" },
          ].map(({ label, value, color, sub }) => (
            <div key={label} style={{ background: "#F8FAFC", borderRadius: 6, padding: "6px 10px", border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 8.5, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
              {sub && <div style={{ fontSize: 8, color: MUTED, marginTop: 2 }}>{sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 6, paddingLeft: ML }}>
        {[["0 key events", "#EF4444"], ["1–9", "#F97316"], ["10–49", "#F59E0B"]].map(([label, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill={color} fillOpacity={0.65} stroke="#fff" strokeWidth={1} /></svg>
            <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>{label} key events</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width={22} height={10}><circle cx={4} cy={5} r={3} fill="#94A3B8" fillOpacity={0.4} stroke="#fff" strokeWidth={1} /><circle cx={16} cy={5} r={5} fill="#94A3B8" fillOpacity={0.4} stroke="#fff" strokeWidth={1} /></svg>
          <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>size = engagement rate</span>
        </div>
      </div>
    </div>
  );
}

// ── High Impressions / Near-Zero CTR chart ────────────────────────────────────
function ImpressionCTRChart({ pages }) {
  if (!pages?.length) return null;

  const W = 600, H = 250;
  const ML = 50, MR = 124, MT = 24, MB = 40;
  const PW = W - ML - MR, PH = H - MT - MB;

  const maxPos = Math.min(50, Math.max(...pages.map(p => p.position || 0), 10));
  const maxImp = Math.max(...pages.map(p => p.impressions || 0), 1);

  // Log scale X so positions 1–10 spread out
  const xScale = pos => ML + (Math.log(Math.min(pos, maxPos)) / Math.log(maxPos)) * PW;
  const yScale = ctr => MT + PH - (Math.min(ctr, 0.30) / 0.30) * PH;
  const rScale = imp => Math.max(3.5, Math.min(10, 3.5 + Math.sqrt(imp / maxImp) * 7));

  // Benchmark curve sampled across all positions
  const benchPositions = Array.from({ length: 50 }, (_, i) => i + 1).filter(p => p <= maxPos);
  const benchCurve = benchPositions.map((pos, i) => `${i === 0 ? "M" : "L"} ${xScale(pos)} ${yScale(ctrBenchmark(pos))}`).join(" ");
  const benchFill  = benchCurve + ` L ${xScale(maxPos)} ${MT + PH} L ${xScale(1)} ${MT + PH} Z`;

  // Actual CTR threshold line at 0.5% (the widget filter)
  const threshY = yScale(0.005);

  const totalImpressions = pages.reduce((s, p) => s + (p.impressions || 0), 0);
  const avgPos   = pages.reduce((s, p) => s + (p.position   || 0), 0) / pages.length;
  const avgCtr   = pages.reduce((s, p) => s + (p.ctr        || 0), 0) / pages.length;
  const estMissedClicks = pages.reduce((s, p) => s + Math.round((ctrBenchmark(p.position) - p.ctr) * p.impressions), 0);

  const yTicks = [0, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30];
  const xTicks = [1, 2, 5, 10, 20, 30, 50].filter(v => v <= maxPos);

  return (
    <div style={{ margin: "0 0 16px 0", padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", flex: "1 1 auto", minWidth: 0 }}>
          {/* Expected CTR region (blue fill under benchmark curve) */}
          <path d={benchFill} fill="#EFF6FF" />

          {/* Near-zero CTR band — where all actual pages live */}
          <rect x={ML} y={threshY} width={PW} height={MT + PH - threshY} fill="#FEF2F2" opacity={0.7} />

          {/* Benchmark curve */}
          <path d={benchCurve} fill="none" stroke="#3B82F6" strokeWidth={1.5} strokeOpacity={0.7} />

          {/* 0.5% threshold line */}
          <line x1={ML} y1={threshY} x2={ML + PW} y2={threshY} stroke="#EF4444" strokeWidth={1} strokeDasharray="4,2" strokeOpacity={0.5} />
          <text x={ML + PW - 2} y={threshY - 4} textAnchor="end" fontSize={8} fill="#EF4444" fontFamily="Inter,sans-serif" opacity={0.8}>0.5% threshold</text>

          {/* Curve label */}
          <text x={xScale(3) + 4} y={yScale(ctrBenchmark(3)) - 5} fontSize={8} fill="#3B82F6" fontFamily="Inter,sans-serif" opacity={0.9}>Expected CTR</text>

          {/* Y gridlines */}
          {yTicks.map(v => {
            const y = yScale(v);
            return (
              <g key={v}>
                {v > 0 && <line x1={ML} y1={y} x2={ML + PW} y2={y} stroke={BORDER} strokeWidth={1} />}
                <text x={ML - 6} y={y + 4} textAnchor="end" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">{Math.round(v * 100)}%</text>
              </g>
            );
          })}

          {/* X gridlines */}
          {xTicks.map(v => {
            const x = xScale(v);
            return (
              <g key={v}>
                <line x1={x} y1={MT} x2={x} y2={MT + PH} stroke={BORDER} strokeWidth={1} strokeDasharray="3,2" />
                <text x={x} y={MT + PH + 15} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">{v}</text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />
          <line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />

          {/* Axis labels */}
          <text x={ML + PW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">Search Position (GSC) — log scale →</text>
          <text x={10} y={MT + PH / 2} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif" transform={`rotate(-90,10,${MT + PH / 2})`}>CTR %</text>

          {/* Dots — largest behind */}
          {[...pages]
            .filter(p => p.position > 0)
            .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
            .map((p, i) => {
              const x = xScale(p.position), y = yScale(p.ctr || 0);
              const r = rScale(p.impressions);
              return (
                <circle key={i} cx={x} cy={y} r={r}
                  fill="#EF4444" fillOpacity={0.55}
                  stroke="#fff" strokeWidth={1.5}
                />
              );
            })}
        </svg>

        {/* Stats sidebar */}
        <div style={{ width: 110, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, paddingTop: MT }}>
          {[
            { label: "Pages",            value: pages.length,                           color: TEXT      },
            { label: "Total Impressions", value: `${(totalImpressions / 1000).toFixed(1)}k`, color: "#3B82F6" },
            { label: "Avg CTR",          value: `${(avgCtr * 100).toFixed(2)}%`,        color: "#EF4444" },
            { label: "Est. Missed Clicks", value: estMissedClicks.toLocaleString(), sub: "vs benchmark", color: "#F97316" },
          ].map(({ label, value, color, sub }) => (
            <div key={label} style={{ background: "#F8FAFC", borderRadius: 6, padding: "6px 10px", border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 8.5, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
              {sub && <div style={{ fontSize: 8, color: MUTED, marginTop: 2 }}>{sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 6, paddingLeft: ML }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width={24} height={10}><path d="M0 8 L24 2" stroke="#3B82F6" strokeWidth={1.5} strokeOpacity={0.7} fill="none" /><rect x={0} y={2} width={24} height={6} fill="#EFF6FF" /></svg>
          <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>expected CTR by position</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill="#EF4444" fillOpacity={0.6} stroke="#fff" strokeWidth={1} /></svg>
          <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>actual page CTR</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width={22} height={10}><circle cx={4} cy={5} r={3} fill="#94A3B8" fillOpacity={0.4} stroke="#fff" strokeWidth={1} /><circle cx={16} cy={5} r={5} fill="#94A3B8" fillOpacity={0.4} stroke="#fff" strokeWidth={1} /></svg>
          <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>size = impressions</span>
        </div>
      </div>
    </div>
  );
}

// ── Deep Content / No Traffic chart ──────────────────────────────────────────
function DeepContentChart({ pages }) {
  if (!pages?.length) return null;

  const W = 600, H = 250;
  const ML = 44, MR = 124, MT = 24, MB = 40;
  const PW = W - ML - MR;
  const PH = H - MT - MB;

  const maxWords   = Math.max(...pages.map(p => p.word_count  || 0), 2000);
  const maxInlinks = Math.max(...pages.map(p => p.inlinks     || 0), 5);
  const maxImp     = Math.max(...pages.map(p => p.impressions || 0), 1);

  const xScale = wc  => ML + ((wc - 1000) / Math.max(maxWords - 1000, 1)) * PW;
  const yScale = il  => MT + PH - (il / Math.max(maxInlinks, 1)) * PH;
  // Dot size encodes word count — bigger = more written
  const rScale = wc  => Math.max(4, Math.min(11, 4 + ((wc - 1000) / Math.max(maxWords - 1000, 1)) * 7));
  // Color encodes impressions — red = invisible, amber = some signal
  const dotColor = imp => imp === 0 ? "#EF4444" : imp < 20 ? "#F97316" : "#F59E0B";

  // "Lost investment" zone: inlinks < 3 — isolated deep content
  const izY1 = yScale(2), izY2 = MT + PH;

  const xTicks = [1000, 1500, 2000, 3000, Math.round(maxWords / 500) * 500].filter((v, i, a) => v <= maxWords && a.indexOf(v) === i);
  const yTicks = [...new Set([0, Math.round(maxInlinks / 3), Math.round(maxInlinks * 2 / 3), maxInlinks].map(v => Math.round(v)))];

  const totalWords    = pages.reduce((s, p) => s + (p.word_count || 0), 0);
  const zeroImpCount  = pages.filter(p => !p.impressions).length;
  const zeroLinkCount = pages.filter(p => !p.inlinks).length;
  const avgWords      = Math.round(totalWords / pages.length);
  const deepHasAhrefs = pages.some(p => p.ext_refdomains > 0);
  const deepExtAuth   = pages.filter(p => p.ext_refdomains > 0).length;

  return (
    <div style={{ margin: "0 0 16px 0", padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", flex: "1 1 auto", minWidth: 0 }}>
          {/* Lost-investment zone */}
          <rect x={ML} y={izY1} width={PW} height={izY2 - izY1} fill="#FEF2F2" rx={3} />
          <text x={ML + 5} y={izY2 - 6} textAnchor="start" fontSize={8} fill="#EF4444" fontWeight={700} fontFamily="Inter,sans-serif" letterSpacing="0.5">ISOLATED (≤2 inlinks)</text>

          {/* Y gridlines */}
          {yTicks.map(v => {
            const y = yScale(v);
            return (
              <g key={v}>
                {v > 0 && <line x1={ML} y1={y} x2={ML + PW} y2={y} stroke={BORDER} strokeWidth={1} />}
                <text x={ML - 6} y={y + 4} textAnchor="end" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">{v}</text>
              </g>
            );
          })}

          {/* X gridlines */}
          {xTicks.map(v => {
            const x = xScale(v);
            return (
              <g key={v}>
                <line x1={x} y1={MT} x2={x} y2={MT + PH} stroke={BORDER} strokeWidth={1} strokeDasharray="3,2" />
                <text x={x} y={MT + PH + 15} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">
                  {v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : v}
                </text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />
          <line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />

          {/* Axis labels */}
          <text x={ML + PW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">Word Count →</text>
          <text x={10} y={MT + PH / 2} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif" transform={`rotate(-90,10,${MT + PH / 2})`}>Internal Links</text>

          {/* Dots: largest behind, smallest in front */}
          {[...pages]
            .sort((a, b) => (b.word_count || 0) - (a.word_count || 0))
            .map((p, i) => {
              const x   = xScale(p.word_count || 1000);
              const y   = yScale(p.inlinks    || 0);
              const r   = rScale(p.word_count || 1000);
              const col = dotColor(p.impressions || 0);
              return (
                <circle key={i} cx={x} cy={y} r={r}
                  fill={col} fillOpacity={0.55}
                  stroke={deepHasAhrefs && p.ext_refdomains > 0 ? "#7C3AED" : "#fff"}
                  strokeWidth={deepHasAhrefs && p.ext_refdomains > 0 ? 2.5 : 1.5}
                />
              );
            })}
        </svg>

        {/* Stats sidebar */}
        <div style={{ width: 110, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, paddingTop: MT }}>
          {[
            { label: "Pages",          value: pages.length,               color: TEXT       },
            { label: "Avg Word Count", value: avgWords.toLocaleString(),  color: "#7C3AED"  },
            { label: "Zero Impressions", value: zeroImpCount,             color: "#EF4444"  },
            { label: "No Inlinks",     value: zeroLinkCount, sub: "completely isolated", color: "#F97316" },
            ...(deepHasAhrefs ? [{ label: "Ext. Authority", value: deepExtAuth, sub: "has ref. domains", color: "#7C3AED" }] : []),
          ].map(({ label, value, color, sub }) => (
            <div key={label} style={{ background: "#F8FAFC", borderRadius: 6, padding: "6px 10px", border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 8.5, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
              {sub && <div style={{ fontSize: 8, color: MUTED, marginTop: 2 }}>{sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 6, paddingLeft: ML, flexWrap: "wrap" }}>
        {[["0 impressions", "#EF4444"], ["1–19", "#F97316"], ["20–49", "#F59E0B"]].map(([label, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill={color} fillOpacity={0.65} stroke="#fff" strokeWidth={1} /></svg>
            <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>{label} impressions</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width={22} height={10}><circle cx={4} cy={5} r={3} fill="#94A3B8" fillOpacity={0.4} stroke="#fff" strokeWidth={1} /><circle cx={16} cy={5} r={5} fill="#94A3B8" fillOpacity={0.4} stroke="#fff" strokeWidth={1} /></svg>
          <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>size = word count</span>
        </div>
        {deepHasAhrefs && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill="#94A3B8" fillOpacity={0.55} stroke="#7C3AED" strokeWidth={2} /></svg>
            <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>purple border = ext. ref. domains</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Broken Link Reclamation chart ─────────────────────────────────────────────
function BrokenLinkReclamationChart({ pages }) {
  if (!pages?.length) return null;

  const W = 600, H = 250;
  const ML = 50, MR = 124, MT = 24, MB = 40;
  const PW = W - ML - MR, PH = H - MT - MB;

  const maxRD  = Math.max(...pages.map(p => p.incoming_refdomains || 0), 1);
  const maxLnk = Math.max(...pages.map(p => p.incoming_links     || 0), 1);

  // X = avg DR (0–100), Y = referring domains (log), size = incoming_links
  const xScale = dr  => ML + (Math.min(dr, 100) / 100) * PW;
  const yScale = rd  => MT + PH - (Math.log(Math.max(rd, 1)) / Math.log(maxRD)) * PH;
  const rScale = lnk => Math.max(4, Math.min(10, 4 + Math.sqrt(lnk / maxLnk) * 7));
  const dotColor = dr => dr >= 60 ? "#16A34A" : dr >= 40 ? "#D97706" : dr >= 20 ? "#F97316" : "#EF4444";

  // Priority quadrant: avg DR ≥ 40 AND refdomains ≥ 2
  const priBoundX = xScale(40);
  const priBoundY = yScale(2);

  const highDR    = pages.filter(p => (p.avg_incoming_dr || 0) >= 60).length;
  const totalRD   = pages.reduce((s, p) => s + (p.incoming_refdomains || 0), 0);
  const totalDof  = pages.reduce((s, p) => s + (p.dofollow_count || 0), 0);

  const yTicks = [1, 2, 5, 10, 20, 50].filter(v => v <= maxRD * 1.2);
  const xTicks = [0, 20, 40, 60, 80, 100];

  return (
    <div style={{ margin: "0 0 16px 0", padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", flex: "1 1 auto", minWidth: 0 }}>
          {/* Priority quadrant */}
          <rect x={priBoundX} y={MT} width={ML + PW - priBoundX} height={priBoundY - MT} fill="#F0FDF4" rx={3} />
          <text x={ML + PW - 4} y={MT + 12} textAnchor="end" fontSize={8} fontWeight={700} fill="#16A34A" fontFamily="Inter,sans-serif" letterSpacing="0.5">FIX FIRST</text>
          <line x1={priBoundX} y1={MT} x2={priBoundX} y2={priBoundY} stroke="#16A34A" strokeWidth={1} strokeDasharray="3,2" strokeOpacity={0.4} />
          <line x1={priBoundX} y1={priBoundY} x2={ML + PW} y2={priBoundY} stroke="#16A34A" strokeWidth={1} strokeDasharray="3,2" strokeOpacity={0.4} />

          {/* Y gridlines */}
          {yTicks.map(v => {
            const y = yScale(v);
            return (
              <g key={v}>
                <line x1={ML} y1={y} x2={ML + PW} y2={y} stroke={BORDER} strokeWidth={1} />
                <text x={ML - 6} y={y + 4} textAnchor="end" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">{v}</text>
              </g>
            );
          })}

          {/* X gridlines */}
          {xTicks.map(v => {
            const x = xScale(v);
            return (
              <g key={v}>
                <line x1={x} y1={MT} x2={x} y2={MT + PH} stroke={BORDER} strokeWidth={1} strokeDasharray="3,2" />
                <text x={x} y={MT + PH + 15} textAnchor="middle" fontSize={9} fill={v >= 60 ? "#16A34A" : v >= 40 ? "#D97706" : MUTED} fontWeight={v >= 40 ? 700 : 400} fontFamily="Inter,sans-serif">{v}</text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />
          <line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />

          {/* Axis labels */}
          <text x={ML + PW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">Avg DR of Linking Sites →</text>
          <text x={10} y={MT + PH / 2} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif" transform={`rotate(-90,10,${MT + PH / 2})`}>Referring Domains (log)</text>

          {/* Dots — largest links count behind */}
          {[...pages].sort((a, b) => (b.incoming_links || 0) - (a.incoming_links || 0)).map((p, i) => {
            const x = xScale(p.avg_incoming_dr || 0), y = yScale(p.incoming_refdomains || 1);
            const r = rScale(p.incoming_links), col = dotColor(p.avg_incoming_dr || 0);
            return <circle key={i} cx={x} cy={y} r={r} fill={col} fillOpacity={0.75} stroke="#fff" strokeWidth={1.5} />;
          })}
        </svg>

        {/* Stats sidebar */}
        <div style={{ width: 110, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, paddingTop: MT }}>
          {[
            { label: "Broken URLs",   value: pages.length,                                                          color: "#DC2626" },
            { label: "High DR (60+)", value: highDR,                                                                color: "#16A34A" },
            { label: "Total Ref. Dom", value: totalRD.toLocaleString(),                                             color: "#7C3AED" },
            { label: "Dofollow Links", value: totalDof.toLocaleString(),                                            color: TEXT      },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "#F8FAFC", borderRadius: 6, padding: "6px 10px", border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 8.5, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 6, paddingLeft: ML }}>
        {[["DR 60+ (high)", "#16A34A"], ["DR 40–59 (med)", "#D97706"], ["DR 20–39", "#F97316"], ["DR < 20", "#EF4444"]].map(([label, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill={color} fillOpacity={0.8} stroke="#fff" strokeWidth={1} /></svg>
            <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>{label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width={22} height={10}><circle cx={4} cy={5} r={3} fill="#94A3B8" fillOpacity={0.4} stroke="#fff" strokeWidth={1} /><circle cx={16} cy={5} r={5} fill="#94A3B8" fillOpacity={0.4} stroke="#fff" strokeWidth={1} /></svg>
          <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>size = total backlinks</span>
        </div>
      </div>
    </div>
  );
}

// ── Ranking Velocity chart ────────────────────────────────────────────────────
function RankingVelocityChart({ pages }) {
  if (!pages?.length) return null;

  const W = 600, H = 250;
  const ML = 60, MR = 124, MT = 24, MB = 40;
  const PW = W - ML - MR, PH = H - MT - MB;

  const maxTime = Math.max(...pages.map(p => p.avg_engagement_time || 0), 120);
  const maxViews = Math.max(...pages.map(p => p.views || 0), 10);
  const maxEng  = Math.max(...pages.map(p => p.engagement_rate || 0), 0.01);

  // X = position (11–25), Y = avg_engagement_time (log), size = views, color = engagement_rate
  const X_MIN = 10.5, X_MAX = 25.5;
  const xScale = pos => ML + ((Math.min(Math.max(pos, X_MIN), X_MAX) - X_MIN) / (X_MAX - X_MIN)) * PW;
  const yScale = t   => MT + PH - (Math.log(Math.max(t, 1)) / Math.log(maxTime)) * PH;
  const rScale = v   => Math.max(4, Math.min(10, 4 + Math.sqrt((v || 0) / maxViews) * 7));
  const dotColor = er => er > 0.5 ? "#7C3AED" : er > 0.3 ? "#3B82F6" : er > 0.1 ? "#14B8A6" : "#94A3B8";

  // Page 2 vs page 3 boundary
  const p2BoundX = xScale(15.5);
  const medTime  = [...pages].sort((a, b) => (a.avg_engagement_time || 0) - (b.avg_engagement_time || 0))[Math.floor(pages.length / 2)]?.avg_engagement_time || 60;
  const medY     = yScale(medTime);

  const p2Count = pages.filter(p => p.position <= 15).length;
  const p3Count = pages.filter(p => p.position > 15).length;
  const avgTime = pages.reduce((s, p) => s + (p.avg_engagement_time || 0), 0) / pages.length;
  const highEng = pages.filter(p => (p.engagement_rate || 0) > 0.4).length;

  const fmtTime = s => { const m = Math.floor(s / 60), sec = Math.round(s % 60); return m > 0 ? `${m}m ${sec}s` : `${sec}s`; };
  const yTickVals = [30, 60, 120, 180, 300, 600].filter(v => v <= maxTime);
  const xTicks   = [11, 12, 13, 14, 15, 16, 18, 20, 25].filter(v => v <= X_MAX);

  return (
    <div style={{ margin: "0 0 16px 0", padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", flex: "1 1 auto", minWidth: 0 }}>
          {/* Zone backgrounds */}
          <rect x={ML}        y={MT} width={p2BoundX - ML}      height={PH} fill="#EFF6FF" />
          <rect x={p2BoundX}  y={MT} width={ML + PW - p2BoundX} height={PH} fill="#F5F3FF" />

          {/* Zone labels */}
          <text x={ML + (p2BoundX - ML) / 2} y={MT + 13} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#2563EB" fontFamily="Inter,sans-serif" letterSpacing="0.4">PAGE 2 (11–15)</text>
          <text x={p2BoundX + (ML + PW - p2BoundX) / 2} y={MT + 13} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#7C3AED" fontFamily="Inter,sans-serif" letterSpacing="0.4">PAGE 3+ (16–25)</text>

          {/* Zone divider */}
          <line x1={p2BoundX} y1={MT} x2={p2BoundX} y2={MT + PH} stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="5,3" />

          {/* Median engagement line */}
          <line x1={ML} y1={medY} x2={ML + PW} y2={medY} stroke="#7C3AED" strokeWidth={1} strokeDasharray="4,2" strokeOpacity={0.4} />
          <text x={ML + PW + 2} y={medY + 3} fontSize={8} fill="#7C3AED" fontFamily="Inter,sans-serif" opacity={0.7}>med</text>

          {/* Y gridlines */}
          {yTickVals.map(v => {
            const y = yScale(v);
            return (
              <g key={v}>
                <line x1={ML} y1={y} x2={ML + PW} y2={y} stroke={BORDER} strokeWidth={1} />
                <text x={ML - 6} y={y + 4} textAnchor="end" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">{fmtTime(v)}</text>
              </g>
            );
          })}

          {/* X gridlines */}
          {xTicks.map(v => {
            const x = xScale(v);
            return (
              <g key={v}>
                <line x1={x} y1={MT} x2={x} y2={MT + PH} stroke={BORDER} strokeWidth={1} strokeDasharray="3,2" />
                <text x={x} y={MT + PH + 15} textAnchor="middle" fontSize={9} fill={v <= 15 ? "#2563EB" : MUTED} fontWeight={v <= 15 ? 700 : 400} fontFamily="Inter,sans-serif">#{v}</text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />
          <line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />

          {/* Axis labels */}
          <text x={ML + PW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">Search Position</text>
          <text x={10} y={MT + PH / 2} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif" transform={`rotate(-90,10,${MT + PH / 2})`}>Engagement Time (log)</text>

          {/* Dots — large views behind */}
          {[...pages].sort((a, b) => (b.views || 0) - (a.views || 0)).map((p, i) => {
            const x = xScale(p.position), y = yScale(p.avg_engagement_time || 1);
            const r = rScale(p.views), col = dotColor(p.engagement_rate || 0);
            return <circle key={i} cx={x} cy={y} r={r} fill={col} fillOpacity={0.7} stroke="#fff" strokeWidth={1.5} />;
          })}
        </svg>

        {/* Stats sidebar */}
        <div style={{ width: 110, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, paddingTop: MT }}>
          {[
            { label: "Pages",         value: pages.length,      color: TEXT      },
            { label: "On Page 2",     value: p2Count,           color: "#2563EB", sub: "pos 11–15" },
            { label: "On Page 3+",    value: p3Count,           color: "#7C3AED", sub: "pos 16–25" },
            { label: "Avg Eng. Time", value: fmtTime(Math.round(avgTime)), color: "#7C3AED" },
            { label: "High Eng. Rate", value: highEng,          color: "#22C55E", sub: "> 40%" },
          ].map(({ label, value, color, sub }) => (
            <div key={label} style={{ background: "#F8FAFC", borderRadius: 6, padding: "6px 10px", border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 8.5, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
              {sub && <div style={{ fontSize: 8, color: MUTED, marginTop: 2 }}>{sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 6, paddingLeft: ML }}>
        {[["Eng. rate > 50%", "#7C3AED"], ["30–50%", "#3B82F6"], ["10–30%", "#14B8A6"], ["< 10%", "#94A3B8"]].map(([label, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill={color} fillOpacity={0.75} stroke="#fff" strokeWidth={1} /></svg>
            <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>{label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width={22} height={10}><circle cx={4} cy={5} r={3} fill="#94A3B8" fillOpacity={0.4} stroke="#fff" strokeWidth={1} /><circle cx={16} cy={5} r={5} fill="#94A3B8" fillOpacity={0.4} stroke="#fff" strokeWidth={1} /></svg>
          <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>size = views</span>
        </div>
      </div>
    </div>
  );
}

// ── Content Freshness Risk chart ───────────────────────────────────────────────
function FreshnessRiskChart({ pages }) {
  if (!pages?.length) return null;

  const W = 600, H = 250;
  const ML = 48, MR = 124, MT = 24, MB = 40;
  const PW = W - ML - MR, PH = H - MT - MB;

  const maxImp = Math.max(...pages.map(p => p.impressions || 0), 1);
  // X = word count (0–600), Y = position (1–15), size = impressions
  const xScale = wc  => ML + (Math.min(wc, 600) / 600) * PW;
  const yScale = pos => MT + ((Math.min(Math.max(pos, 1), 15) - 1) / 14) * PH;
  const rScale = imp => Math.max(3.5, Math.min(10, 3.5 + Math.sqrt(imp / maxImp) * 7));
  const dotColor = wc => wc < 150 ? "#EF4444" : wc < 300 ? "#F97316" : "#F59E0B";

  // Risk zone: < 300 words
  const riskX = xScale(300);
  const critX = xScale(150);

  const critCount   = pages.filter(p => (p.word_count || 0) < 150).length;
  const warnCount   = pages.filter(p => (p.word_count || 0) >= 150 && (p.word_count || 0) < 300).length;
  const thinCount   = pages.filter(p => (p.word_count || 0) >= 300 && (p.word_count || 0) < 600).length;
  const avgWords    = Math.round(pages.reduce((s, p) => s + (p.word_count || 0), 0) / pages.length);
  const totalImpr   = pages.reduce((s, p) => s + (p.impressions || 0), 0);

  const yTicks = [1, 3, 5, 10, 15];
  const xTicks = [0, 150, 300, 450, 600];

  return (
    <div style={{ margin: "0 0 16px 0", padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", flex: "1 1 auto", minWidth: 0 }}>
          {/* Risk zone backgrounds */}
          <rect x={ML}    y={MT} width={critX - ML}      height={PH} fill="#FEF2F2" />
          <rect x={critX} y={MT} width={riskX - critX}   height={PH} fill="#FFF7ED" />
          <rect x={riskX} y={MT} width={ML + PW - riskX} height={PH} fill="#FFFBEB" />

          {/* Zone labels */}
          <text x={ML + (critX - ML) / 2}         y={MT + PH - 6} textAnchor="middle" fontSize={8} fontWeight={700} fill="#EF4444" fontFamily="Inter,sans-serif" letterSpacing="0.4">CRITICAL</text>
          <text x={critX + (riskX - critX) / 2}   y={MT + PH - 6} textAnchor="middle" fontSize={8} fontWeight={700} fill="#F97316" fontFamily="Inter,sans-serif" letterSpacing="0.4">HIGH RISK</text>
          <text x={riskX + (ML + PW - riskX) / 2} y={MT + PH - 6} textAnchor="middle" fontSize={8} fontWeight={700} fill="#D97706" fontFamily="Inter,sans-serif" letterSpacing="0.4">WATCH</text>

          {/* Zone dividers */}
          <line x1={critX} y1={MT} x2={critX} y2={MT + PH} stroke="#FCA5A5" strokeWidth={1} strokeDasharray="4,3" />
          <line x1={riskX} y1={MT} x2={riskX} y2={MT + PH} stroke="#FCD34D" strokeWidth={1} strokeDasharray="4,3" />

          {/* Y gridlines */}
          {yTicks.map(v => {
            const y = yScale(v);
            return (
              <g key={v}>
                <line x1={ML} y1={y} x2={ML + PW} y2={y} stroke={BORDER} strokeWidth={1} />
                <text x={ML - 6} y={y + 4} textAnchor="end" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">#{v}</text>
              </g>
            );
          })}

          {/* X gridlines */}
          {xTicks.map(v => {
            const x = xScale(v);
            return (
              <g key={v}>
                <line x1={x} y1={MT} x2={x} y2={MT + PH} stroke={BORDER} strokeWidth={1} strokeDasharray="3,2" />
                <text x={x} y={MT + PH + 15} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">{v}w</text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />
          <line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />

          {/* Axis labels */}
          <text x={ML + PW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">Word Count →</text>
          <text x={10} y={MT + PH / 2} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif" transform={`rotate(-90,10,${MT + PH / 2})`}>Search Position</text>

          {/* Dots — largest impressions behind */}
          {[...pages].sort((a, b) => (b.impressions || 0) - (a.impressions || 0)).map((p, i) => {
            const x = xScale(p.word_count || 0), y = yScale(p.position || 1);
            const r = rScale(p.impressions), col = dotColor(p.word_count || 0);
            return <circle key={i} cx={x} cy={y} r={r} fill={col} fillOpacity={0.7} stroke="#fff" strokeWidth={1.5} />;
          })}
        </svg>

        {/* Stats sidebar */}
        <div style={{ width: 110, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, paddingTop: MT }}>
          {[
            { label: "Pages",        value: pages.length,                                                color: TEXT      },
            { label: "Critical",     value: critCount,  sub: "< 150 words",                             color: "#EF4444" },
            { label: "High Risk",    value: warnCount,  sub: "150–299 words",                           color: "#F97316" },
            { label: "Watch",        value: thinCount,  sub: "300–599 words",                           color: "#D97706" },
            { label: "Total Impr.",  value: totalImpr >= 1000 ? `${(totalImpr / 1000).toFixed(1)}k` : totalImpr, color: TEXT },
          ].map(({ label, value, color, sub }) => (
            <div key={label} style={{ background: "#F8FAFC", borderRadius: 6, padding: "6px 10px", border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 8.5, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
              {sub && <div style={{ fontSize: 8, color: MUTED, marginTop: 2 }}>{sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 6, paddingLeft: ML }}>
        {[["< 150 words (critical)", "#EF4444"], ["150–299 (high risk)", "#F97316"], ["300–599 (watch)", "#F59E0B"]].map(([label, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill={color} fillOpacity={0.75} stroke="#fff" strokeWidth={1} /></svg>
            <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>{label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width={22} height={10}><circle cx={4} cy={5} r={3} fill="#94A3B8" fillOpacity={0.4} stroke="#fff" strokeWidth={1} /><circle cx={16} cy={5} r={5} fill="#94A3B8" fillOpacity={0.4} stroke="#fff" strokeWidth={1} /></svg>
          <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>size = impressions</span>
        </div>
      </div>
    </div>
  );
}

// ── Keyword Intent Landscape chart ────────────────────────────────────────────
function IntentLandscapeChart({ pages }) {
  if (!pages?.length) return null;

  const W = 600, H = 260;
  const ML = 46, MR = 124, MT = 24, MB = 40;
  const PW = W - ML - MR, PH = H - MT - MB;

  const maxImp  = Math.max(...pages.map(p => p.impressions || 0), 100);
  const maxPos  = Math.max(...pages.map(p => p.position || 0), 20);
  const maxClk  = Math.max(...pages.map(p => p.clicks || 0), 1);
  const xScale  = imp => ML + (Math.log(Math.max(imp, 1)) / Math.log(maxImp)) * PW;
  const yScale  = pos => MT + ((pos - 1) / Math.max(maxPos - 1, 1)) * PH;
  const rScale  = clk => Math.max(4, Math.min(10, 4 + Math.sqrt(clk / maxClk) * 7));
  const dotColor = intent => intent === "transactional" ? "#DC2626" : "#D97706";

  const p1BoundY  = yScale(10.5);
  const transCount = pages.filter(p => p.intent === "transactional").length;
  const commCount  = pages.filter(p => p.intent === "commercial").length;
  const page1Count = pages.filter(p => p.position <= 10).length;
  const topImpSum  = pages.slice(0, 5).reduce((s, p) => s + (p.impressions || 0), 0);

  const impTicks = [100, 500, 1000, 5000, 10000, 50000].filter(v => v <= maxImp * 1.1);
  const posTicks = [1, 5, 10, 15, 20].filter(v => v <= maxPos);

  return (
    <div style={{ margin: "0 0 16px 0", padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", flex: "1 1 auto", minWidth: 0 }}>

          {/* Zone backgrounds: top = page 1 (green), bottom = page 2+ (amber) */}
          <rect x={ML} y={MT}         width={PW} height={p1BoundY - MT}         fill="#F0FDF4" />
          <rect x={ML} y={p1BoundY}   width={PW} height={MT + PH - p1BoundY}    fill="#FFFBEB" />

          {/* Zone labels */}
          <text x={ML + 4} y={MT + 13} textAnchor="start" fontSize={8.5} fontWeight={700} fill="#16A34A" fontFamily="Inter,sans-serif" letterSpacing="0.4">PAGE 1</text>
          <text x={ML + 4} y={p1BoundY + 13} textAnchor="start" fontSize={8.5} fontWeight={700} fill="#D97706" fontFamily="Inter,sans-serif" letterSpacing="0.4">PAGE 2+</text>

          {/* Page 1 boundary */}
          <line x1={ML} y1={p1BoundY} x2={ML + PW} y2={p1BoundY} stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="5,3" />

          {/* Y gridlines */}
          {posTicks.map(v => {
            const y = yScale(v);
            return (
              <g key={v}>
                <line x1={ML} y1={y} x2={ML + PW} y2={y} stroke={BORDER} strokeWidth={1} />
                <text x={ML - 6} y={y + 4} textAnchor="end" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">#{v}</text>
              </g>
            );
          })}

          {/* X gridlines */}
          {impTicks.map(v => {
            const x = xScale(v);
            return (
              <g key={v}>
                <line x1={x} y1={MT} x2={x} y2={MT + PH} stroke={BORDER} strokeWidth={1} strokeDasharray="3,2" />
                <text x={x} y={MT + PH + 15} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">
                  {v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : v}
                </text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />
          <line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />

          {/* Axis labels */}
          <text x={ML + PW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">Impressions (log) →</text>
          <text x={10} y={MT + PH / 2} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif" transform={`rotate(-90,10,${MT + PH / 2})`}>Search Position</text>

          {/* Dots — largest behind */}
          {[...pages].sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).map((p, i) => {
            const x = xScale(p.impressions || 1), y = yScale(p.position || 20);
            const r = rScale(p.clicks || 0), col = dotColor(p.intent);
            return <circle key={i} cx={x} cy={y} r={r} fill={col} fillOpacity={0.7} stroke="#fff" strokeWidth={1.5} />;
          })}
        </svg>

        {/* Sidebar */}
        <div style={{ width: 110, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, paddingTop: MT }}>
          {[
            { label: "Total Queries",    value: pages.length,   color: TEXT       },
            { label: "Transactional",    value: transCount,     color: "#DC2626"  },
            { label: "Commercial",       value: commCount,      color: "#D97706"  },
            { label: "On Page 1",        value: page1Count,     color: "#16A34A", sub: "pos ≤ 10" },
            { label: "Top 5 Impr.",      value: topImpSum >= 1000 ? `${(topImpSum / 1000).toFixed(1)}k` : topImpSum, color: TEXT },
          ].map(({ label, value, color, sub }) => (
            <div key={label} style={{ background: "#F8FAFC", borderRadius: 6, padding: "6px 10px", border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 8.5, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
              {sub && <div style={{ fontSize: 8, color: MUTED, marginTop: 2 }}>{sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 6, paddingLeft: ML }}>
        {[["Transactional", "#DC2626"], ["Commercial", "#D97706"]].map(([label, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill={color} fillOpacity={0.75} stroke="#fff" strokeWidth={1} /></svg>
            <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>{label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width={22} height={10}><circle cx={4} cy={5} r={3} fill="#94A3B8" fillOpacity={0.6} stroke="#fff" strokeWidth={1} /><circle cx={16} cy={5} r={5} fill="#94A3B8" fillOpacity={0.6} stroke="#fff" strokeWidth={1} /></svg>
          <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>size = clicks</span>
        </div>
      </div>
    </div>
  );
}

// ── Query Expansion Gap chart ──────────────────────────────────────────────────
function QueryGapChart({ pages }) {
  if (!pages?.length) return null;

  const W = 600, H = 260;
  const ML = 46, MR = 124, MT = 24, MB = 40;
  const PW = W - ML - MR, PH = H - MT - MB;

  const maxImp = Math.max(...pages.map(p => p.impressions || 0), 100);
  const xScale = imp => ML + (Math.log(Math.max(imp, 1)) / Math.log(maxImp)) * PW;
  const yScale = pct => MT + PH - (pct / 100) * PH;
  const dotColor = gt => gt === "no content" ? "#DC2626" : gt === "weak match" ? "#F59E0B" : "#16A34A";

  const noContent   = pages.filter(p => p.gap_type === "no content").length;
  const weakMatch   = pages.filter(p => p.gap_type === "weak match").length;
  const needsOpt    = pages.filter(p => p.gap_type === "needs optimization").length;
  const totalImp    = pages.reduce((s, p) => s + (p.impressions || 0), 0);

  // Zone boundaries
  const gapY    = yScale(25);   // below 25% = content gap zone
  const weakY   = yScale(55);   // 25–55% = weak coverage zone

  const impTicks = [100, 500, 1000, 5000, 10000].filter(v => v <= maxImp * 1.1);
  const yTicks   = [0, 25, 55, 100];

  return (
    <div style={{ margin: "0 0 16px 0", padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", flex: "1 1 auto", minWidth: 0 }}>

          {/* Zone backgrounds */}
          <rect x={ML} y={gapY}  width={PW} height={MT + PH - gapY} fill="#FEF2F2" />
          <rect x={ML} y={weakY} width={PW} height={gapY - weakY}    fill="#FFFBEB" />
          <rect x={ML} y={MT}    width={PW} height={weakY - MT}       fill="#F0FDF4" />

          {/* Zone labels */}
          <text x={ML + PW - 4} y={MT + PH - 6}  textAnchor="end" fontSize={8} fontWeight={700} fill="#DC2626" fontFamily="Inter,sans-serif" letterSpacing="0.4">CONTENT GAP</text>
          <text x={ML + PW - 4} y={gapY - 6}      textAnchor="end" fontSize={8} fontWeight={700} fill="#D97706" fontFamily="Inter,sans-serif" letterSpacing="0.4">WEAK MATCH</text>
          <text x={ML + PW - 4} y={MT + 13}        textAnchor="end" fontSize={8} fontWeight={700} fill="#16A34A" fontFamily="Inter,sans-serif" letterSpacing="0.4">OPTIMIZE</text>

          {/* Zone boundary lines */}
          <line x1={ML} y1={gapY}  x2={ML + PW} y2={gapY}  stroke="#FDA4AF" strokeWidth={1} strokeDasharray="4,3" />
          <line x1={ML} y1={weakY} x2={ML + PW} y2={weakY} stroke="#FCD34D" strokeWidth={1} strokeDasharray="4,3" />

          {/* Y gridlines */}
          {yTicks.map(v => {
            const y = yScale(v);
            return (
              <g key={v}>
                <line x1={ML} y1={y} x2={ML + PW} y2={y} stroke={BORDER} strokeWidth={1} />
                <text x={ML - 6} y={y + 4} textAnchor="end" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">{v}%</text>
              </g>
            );
          })}

          {/* X gridlines */}
          {impTicks.map(v => {
            const x = xScale(v);
            return (
              <g key={v}>
                <line x1={x} y1={MT} x2={x} y2={MT + PH} stroke={BORDER} strokeWidth={1} strokeDasharray="3,2" />
                <text x={x} y={MT + PH + 15} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">
                  {v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : v}
                </text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />
          <line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />

          {/* Axis labels */}
          <text x={ML + PW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">Impressions (log) →</text>
          <text x={10} y={MT + PH / 2} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif" transform={`rotate(-90,10,${MT + PH / 2})`}>Content Match %</text>

          {/* Dots — highest impressions behind */}
          {[...pages].sort((a, b) => (b.impressions || 0) - (a.impressions || 0)).map((p, i) => {
            const x = xScale(p.impressions || 1), y = yScale(p.match_score || 0);
            const col = dotColor(p.gap_type);
            return <circle key={i} cx={x} cy={y} r={5} fill={col} fillOpacity={0.7} stroke="#fff" strokeWidth={1.5} />;
          })}
        </svg>

        {/* Sidebar */}
        <div style={{ width: 110, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, paddingTop: MT }}>
          {[
            { label: "Total Queries",   value: pages.length, color: TEXT      },
            { label: "No Content",      value: noContent,    color: "#DC2626" },
            { label: "Weak Match",      value: weakMatch,    color: "#F59E0B" },
            { label: "Needs Opt.",      value: needsOpt,     color: "#16A34A" },
            { label: "Total Impr.",     value: totalImp >= 1000 ? `${(totalImp / 1000).toFixed(1)}k` : totalImp, color: TEXT },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "#F8FAFC", borderRadius: 6, padding: "6px 10px", border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 8.5, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 6, paddingLeft: ML }}>
        {[["No content", "#DC2626"], ["Weak match", "#F59E0B"], ["Needs optimization", "#16A34A"]].map(([label, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill={color} fillOpacity={0.75} stroke="#fff" strokeWidth={1} /></svg>
            <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── On-Page Alignment scatter plot ────────────────────────────────────────────
function AlignmentScatterPlot({ pages }) {
  if (!pages?.length) return null;

  const W = 600, H = 260;
  const ML = 42, MR = 124, MT = 24, MB = 40;
  const PW = W - ML - MR;
  const PH = H - MT - MB;

  const maxPos = Math.min(50, Math.max(...pages.map(p => p.position || 0), 10));
  const maxImp = Math.max(...pages.map(p => p.impressions || 0), 1);

  // Log scale stretches the crowded 1–15 range, compresses sparse tail
  const xScale = pos => ML + (Math.log(Math.min(pos, maxPos)) / Math.log(maxPos)) * PW;
  const yScale = score => MT + PH - (Math.min(score ?? 0, 0.30) / 0.30) * PH;
  const rScale = imp   => Math.max(3.5, Math.min(10, 3.5 + Math.sqrt(imp / maxImp) * 7));
  const dotColor = score => {
    const p = (score ?? 0) * 100;
    return p < 10 ? "#EF4444" : p < 20 ? "#F97316" : "#F59E0B";
  };

  // "Fix first" quadrant: top-15 rank AND <15% alignment
  const qx2 = xScale(15), qy1 = yScale(0.15), qy2 = MT + PH;

  const yTicks = [0, 0.10, 0.20, 0.30];
  const xTicks = [1, 2, 5, 10, 20, 30, 50].filter(v => v <= maxPos);

  const avgScore = pages.reduce((s, p) => s + (p.alignment_score || 0), 0) / pages.length;
  const avgPos   = pages.reduce((s, p) => s + (p.position || 0), 0) / pages.length;
  const highPri  = pages.filter(p => p.position <= 15 && (p.alignment_score || 0) < 0.15).length;

  return (
    <div style={{ margin: "0 0 16px 0", padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", flex: "1 1 auto", minWidth: 0 }}>
          {/* Fix-first quadrant */}
          <rect x={ML} y={qy1} width={qx2 - ML} height={qy2 - qy1} fill="#FEF2F2" rx={3} />
          {/* Label above the quadrant so it doesn't overlap dots */}
          <text x={ML + 4} y={qy1 - 5} textAnchor="start" fontSize={8} fill="#EF4444" fontWeight={700} fontFamily="Inter,sans-serif" letterSpacing="0.5">FIX FIRST</text>
          <line x1={ML} y1={qy1} x2={qx2} y2={qy1} stroke="#EF4444" strokeWidth={1} strokeDasharray="3,2" strokeOpacity={0.4} />
          <line x1={qx2} y1={qy1} x2={qx2} y2={qy2} stroke="#EF4444" strokeWidth={1} strokeDasharray="3,2" strokeOpacity={0.4} />

          {/* Y gridlines */}
          {yTicks.map(v => {
            const y = yScale(v);
            return (
              <g key={v}>
                {v > 0 && <line x1={ML} y1={y} x2={ML + PW} y2={y} stroke={BORDER} strokeWidth={1} />}
                <text x={ML - 6} y={y + 4} textAnchor="end" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">{v * 100}%</text>
              </g>
            );
          })}

          {/* X gridlines (log-spaced ticks) */}
          {xTicks.map(v => {
            const x = xScale(v);
            return (
              <g key={v}>
                <line x1={x} y1={MT} x2={x} y2={MT + PH} stroke={BORDER} strokeWidth={1} strokeDasharray="3,2" />
                <text x={x} y={MT + PH + 15} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">{v}</text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />
          <line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke="#CBD5E1" strokeWidth={1.5} />

          {/* Axis labels */}
          <text x={ML + PW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif">Search Position (GSC) — log scale →</text>
          <text x={10} y={MT + PH / 2} textAnchor="middle" fontSize={9} fill={MUTED} fontFamily="Inter,sans-serif" transform={`rotate(-90,10,${MT + PH / 2})`}>Alignment %</text>

          {/* Dots: large impressions behind, small in front */}
          {[...pages]
            .filter(p => p.position > 0)
            .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
            .map((p, i) => {
              const x = xScale(p.position), y = yScale(p.alignment_score ?? 0);
              const r = rScale(p.impressions), col = dotColor(p.alignment_score ?? 0);
              return (
                <circle key={i} cx={x} cy={y} r={r}
                  fill={col} fillOpacity={0.55}
                  stroke="#fff" strokeWidth={1.5}
                />
              );
            })}
        </svg>

        {/* Stats sidebar */}
        <div style={{ width: 110, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, paddingTop: MT }}>
          {[
            { label: "Pages",         value: pages.length,                    color: TEXT       },
            { label: "Avg Alignment", value: `${Math.round(avgScore * 100)}%`, color: "#F59E0B" },
            { label: "Avg Position",  value: avgPos.toFixed(1),               color: TEXT       },
            { label: "Fix First",     value: highPri, sub: "rank ≤15, align <15%", color: "#EF4444" },
          ].map(({ label, value, color, sub }) => (
            <div key={label} style={{ background: "#F8FAFC", borderRadius: 6, padding: "6px 10px", border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 8.5, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
              {sub && <div style={{ fontSize: 8, color: MUTED, marginTop: 2 }}>{sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 6, paddingLeft: ML }}>
        {[["< 10%", "#EF4444"], ["10–20%", "#F97316"], ["20–30%", "#F59E0B"]].map(([label, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill={color} fillOpacity={0.65} stroke="#fff" strokeWidth={1} /></svg>
            <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>{label} alignment</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width={22} height={10}><circle cx={4} cy={5} r={3} fill="#94A3B8" fillOpacity={0.4} stroke="#fff" strokeWidth={1} /><circle cx={16} cy={5} r={5} fill="#94A3B8" fillOpacity={0.4} stroke="#fff" strokeWidth={1} /></svg>
          <span style={{ fontSize: 9, color: MUTED, fontFamily: "Inter,sans-serif" }}>size = impressions</span>
        </div>
      </div>
    </div>
  );
}

// ── Column definitions ────────────────────────────────────────────────────────
const URL_COL = {
  key: "Address", label: "Page", maxWidth: 280, wrap: true,
  render: r => <a href={r["Address"]} target="_blank" rel="noreferrer" style={{ color: TEAL, textDecoration: "none" }}>{shortUrl(r["Address"])}</a>,
};
const COVERAGE_COL = {
  key: "data_coverage", label: "Coverage",
  render: r => <CoverageBadge coverage={r.data_coverage} />,
};

const INSIGHT_COLUMNS = {
  "ctr-opportunity": [
    URL_COL,
    { key: "position",      label: "Pos",        sortKey: "position",      render: r => fmt(r.position, 1) },
    { key: "impressions",   label: "Impressions", sortKey: "impressions",   render: r => fmt(r.impressions) },
    { key: "ctr",           label: "Actual CTR",  sortKey: "ctr",           render: r => fmtPct(r.ctr) },
    { key: "ctr_benchmark", label: "Benchmark",                             render: r => fmtPct(r.ctr_benchmark) },
    { key: "ctr_gap",       label: "Gap",         sortKey: "ctr_gap",       render: r => <span style={{ color: "#DC2626", fontWeight: 700 }}>+{fmtPct(r.ctr_gap)}</span> },
    COVERAGE_COL,
  ],
  "thin-traffic": [
    URL_COL,
    { key: "clicks",     label: "Clicks", sortKey: "clicks",     render: r => fmt(r.clicks) },
    { key: "word_count", label: "Words",  sortKey: "word_count", render: r => fmt(r.word_count) },
    { key: "position",   label: "Pos",    sortKey: "position",   render: r => fmt(r.position, 1) },
    COVERAGE_COL,
  ],
  "ranking-not-converting": [
    URL_COL,
    { key: "clicks",      label: "Clicks",     sortKey: "clicks",      render: r => fmt(r.clicks) },
    { key: "bounce_rate", label: "Bounce",      sortKey: "bounce_rate", render: r => <span style={{ color: "#DC2626" }}>{fmtPct(r.bounce_rate)}</span> },
    { key: "key_events",  label: "Key Events",  sortKey: "key_events",  render: r => fmt(r.key_events) },
    { key: "position",    label: "Pos",         sortKey: "position",    render: r => fmt(r.position, 1) },
    COVERAGE_COL,
  ],
  "position-cliff": [
    URL_COL,
    { key: "position",       label: "Pos",          sortKey: "position",       render: r => fmt(r.position, 1) },
    { key: "impressions",    label: "Impressions",   sortKey: "impressions",    render: r => fmt(r.impressions) },
    { key: "ctr",            label: "CTR",                                      render: r => fmtPct(r.ctr) },
    { key: "ext_refdomains", label: "Ref. Domains",  sortKey: "ext_refdomains", render: r => r.ext_refdomains > 0 ? <span style={{ fontWeight: 700, color: "#7C3AED" }}>{fmt(r.ext_refdomains)}</span> : "—" },
    { key: "ext_avg_dr",     label: "Avg DR",        sortKey: "ext_avg_dr",     render: r => r.ext_avg_dr > 0 ? <span style={{ fontWeight: 700, color: r.ext_avg_dr >= 60 ? "#16A34A" : r.ext_avg_dr >= 40 ? "#D97706" : "#6B7280" }}>{r.ext_avg_dr}</span> : "—" },
    { key: "has_sf_issues",  label: "SF Issues",                                render: r => r.has_sf_issues ? <span style={{ color: "#DC2626" }}>Yes</span> : <span style={{ color: "#16A34A" }}>None</span> },
    COVERAGE_COL,
  ],
  "orphan-pages": [
    URL_COL,
    { key: "views",          label: "Views",          sortKey: "views",          render: r => fmt(r.views) },
    { key: "inlinks",        label: "Internal Links", sortKey: "inlinks",        render: r => <span style={{ color: r.inlinks < 3 ? "#DC2626" : TEXT }}>{fmt(r.inlinks)}</span> },
    { key: "ext_refdomains", label: "Ref. Domains",   sortKey: "ext_refdomains", render: r => r.ext_refdomains > 0 ? <span style={{ fontWeight: 700, color: "#7C3AED" }}>{fmt(r.ext_refdomains)}</span> : "—" },
    { key: "ext_avg_dr",     label: "Avg DR",         sortKey: "ext_avg_dr",     render: r => r.ext_avg_dr > 0 ? <span style={{ fontWeight: 700, color: r.ext_avg_dr >= 60 ? "#16A34A" : r.ext_avg_dr >= 40 ? "#D97706" : "#6B7280" }}>{r.ext_avg_dr}</span> : "—" },
    { key: "clicks",         label: "Clicks",         sortKey: "clicks",         render: r => fmt(r.clicks) },
    COVERAGE_COL,
  ],
  "engaged-no-convert": [
    URL_COL,
    { key: "views",               label: "Views",         sortKey: "views",               render: r => fmt(r.views) },
    { key: "avg_engagement_time", label: "Avg Eng. Time", sortKey: "avg_engagement_time", render: r => {
      const s = Math.round(r.avg_engagement_time || 0);
      const m = Math.floor(s / 60), sec = s % 60;
      return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
    }},
    { key: "engagement_rate", label: "Eng. Rate", sortKey: "engagement_rate", render: r => fmtPct(r.engagement_rate) },
    { key: "key_events",      label: "Key Events", sortKey: "key_events",     render: r => <span style={{ color: "#DC2626", fontWeight: 700 }}>{fmt(r.key_events)}</span> },
    COVERAGE_COL,
  ],
  "impression-black-hole": [
    URL_COL,
    { key: "impressions", label: "Impressions", sortKey: "impressions", render: r => fmt(r.impressions) },
    { key: "ctr",         label: "CTR",         sortKey: "ctr",         render: r => <span style={{ color: "#DC2626", fontWeight: 700 }}>{fmtPct(r.ctr)}</span> },
    { key: "position",    label: "Position",    sortKey: "position",    render: r => fmt(r.position, 1) },
    { key: "clicks",      label: "Clicks",      sortKey: "clicks",      render: r => fmt(r.clicks) },
    COVERAGE_COL,
  ],
  "deep-no-traffic": [
    URL_COL,
    { key: "word_count",     label: "Word Count",     sortKey: "word_count",     render: r => fmt(r.word_count) },
    { key: "impressions",    label: "Impressions",    sortKey: "impressions",    render: r => <span style={{ color: r.impressions < 10 ? "#DC2626" : TEXT }}>{fmt(r.impressions)}</span> },
    { key: "clicks",         label: "Clicks",         sortKey: "clicks",         render: r => fmt(r.clicks) },
    { key: "inlinks",        label: "Internal Links", sortKey: "inlinks",        render: r => fmt(r.inlinks) },
    { key: "ext_refdomains", label: "Ref. Domains",   sortKey: "ext_refdomains", render: r => r.ext_refdomains > 0 ? <span style={{ fontWeight: 700, color: "#7C3AED" }}>{fmt(r.ext_refdomains)}</span> : "—" },
    { key: "ext_avg_dr",     label: "Avg DR",         sortKey: "ext_avg_dr",     render: r => r.ext_avg_dr > 0 ? <span style={{ fontWeight: 700, color: r.ext_avg_dr >= 60 ? "#16A34A" : r.ext_avg_dr >= 40 ? "#D97706" : "#6B7280" }}>{r.ext_avg_dr}</span> : "—" },
    COVERAGE_COL,
  ],
  "intent-mismatch": [
    URL_COL,
    { key: "Title 1",           label: "Title",       maxWidth: 160, wrap: true, render: r => r["Title 1"] || "—" },
    { key: "h1",                label: "H1",          maxWidth: 160, wrap: true, render: r => r.h1 || "—" },
    { key: "Meta Description 1", label: "Meta Desc",  maxWidth: 180, wrap: true, render: r => r["Meta Description 1"] || "—" },
    { key: "sim_title_h1",      label: "T↔H1",        sortKey: "sim_title_h1",   render: r => r.sim_title_h1 != null ? `${Math.round(r.sim_title_h1 * 100)}%` : "—" },
    { key: "alignment_score",   label: "Alignment",   sortKey: "alignment_score", render: r => {
      if (r.alignment_score == null) return "—";
      const pct = Math.round(r.alignment_score * 100);
      const color = pct < 15 ? "#EF4444" : pct < 30 ? "#F59E0B" : "#22C55E";
      return <span style={{ color, fontWeight: 700 }}>{pct}%</span>;
    }},
    { key: "position", label: "Rank", sortKey: "position", render: r => r.position > 0 ? r.position.toFixed(1) : "—" },
  ],
  "keyword-intent-gap": [
    { key: "query",       label: "Query",      maxWidth: 260, wrap: true, render: r => r.query || "—" },
    { key: "intent",      label: "Intent",     render: r => <span style={{ fontSize: 10, fontWeight: 700, color: r.intent === "transactional" ? "#DC2626" : "#D97706", textTransform: "capitalize" }}>{r.intent}</span> },
    { key: "impressions", label: "Impressions", sortKey: "impressions", render: r => fmt(r.impressions) },
    { key: "position",    label: "Position",   sortKey: "position",    render: r => fmt(r.position, 1) },
    { key: "ctr",         label: "CTR",        sortKey: "ctr",         render: r => fmtPct(r.ctr) },
    { key: "clicks",      label: "Clicks",     sortKey: "clicks",      render: r => fmt(r.clicks) },
  ],
  "query-expansion-gap": [
    { key: "query",         label: "Query",         maxWidth: 240, wrap: true, render: r => r.query || "—" },
    { key: "impressions",   label: "Impressions",   sortKey: "impressions",  render: r => fmt(r.impressions) },
    { key: "position",      label: "Avg Position",  sortKey: "position",     render: r => fmt(r.position, 1) },
    { key: "match_score",   label: "Content Match", sortKey: "match_score",  render: r => {
      const color = r.match_score < 25 ? "#DC2626" : r.match_score < 55 ? "#F59E0B" : "#16A34A";
      return <span style={{ fontWeight: 700, color }}>{r.match_score}%</span>;
    }},
    { key: "gap_type",      label: "Gap",           render: r => {
      const colors = { "no content": "#DC2626", "weak match": "#F59E0B", "needs optimization": "#16A34A" };
      return <span style={{ fontSize: 10, fontWeight: 700, color: colors[r.gap_type] || MUTED, textTransform: "capitalize" }}>{r.gap_type}</span>;
    }},
    { key: "best_match_url", label: "Closest Page", maxWidth: 200, render: r => r.best_match_url ? <span style={{ fontSize: 10, color: MUTED }}>{shortUrl(r.best_match_url)}</span> : "—" },
  ],
  "segment-health": [
    { key: "segment",             label: "Segment",        render: r => <span style={{ fontWeight: 700, textTransform: "capitalize" }}>{r.segment}</span> },
    { key: "page_count",          label: "Pages",          sortKey: "page_count",          render: r => fmt(r.page_count) },
    { key: "avg_position",        label: "Avg Pos",        sortKey: "avg_position",        render: r => r.avg_position ? fmt(r.avg_position, 1) : "—" },
    { key: "total_views",         label: "Views",          sortKey: "total_views",         render: r => fmt(r.total_views) },
    { key: "avg_engagement_time", label: "Avg Eng. Time",  sortKey: "avg_engagement_time", render: r => {
        if (r.avg_engagement_time == null) return "—";
        const s = Math.round(r.avg_engagement_time);
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
      }},
    { key: "total_key_events",    label: "Key Events",     sortKey: "total_key_events",    render: r => fmt(r.total_key_events) },
    { key: "avg_page_score",    label: "Page Score",   sortKey: "avg_page_score",    render: r => <span style={{ fontWeight: 700, color: r.avg_page_score < 30 ? "#DC2626" : r.avg_page_score < 60 ? "#D97706" : "#16A34A" }}>{fmt(r.avg_page_score, 0)}</span> },
    { key: "sf_issue_pages",      label: "SF Issues",      sortKey: "sf_issue_pages",      render: r => fmt(r.sf_issue_pages) },
  ],
  "full-funnel": [
    URL_COL,
    { key: "page_score", label: "Score",       sortKey: "page_score", render: r => <span style={{ fontWeight: 700, color: r.page_score < 30 ? "#DC2626" : r.page_score < 60 ? "#D97706" : "#16A34A" }}>{fmt(r.page_score)}</span> },
    { key: "impressions",  label: "Impressions", sortKey: "impressions",  render: r => fmt(r.impressions) },
    { key: "clicks",       label: "Clicks",      sortKey: "clicks",       render: r => fmt(r.clicks) },
    { key: "views",        label: "Views",       sortKey: "views",        render: r => fmt(r.views) },
    { key: "key_events",   label: "Key Events",  sortKey: "key_events",   render: r => fmt(r.key_events) },
    COVERAGE_COL,
  ],
  "ranking-velocity": [
    URL_COL,
    { key: "position",            label: "Pos",          sortKey: "position",            render: r => fmt(r.position, 1) },
    { key: "avg_engagement_time", label: "Avg Eng. Time", sortKey: "avg_engagement_time", render: r => {
      const s = Math.round(r.avg_engagement_time || 0);
      const m = Math.floor(s / 60), sec = s % 60;
      return <span style={{ fontWeight: 700, color: "#7C3AED" }}>{m > 0 ? `${m}m ${sec}s` : `${sec}s`}</span>;
    }},
    { key: "views",           label: "Views",        sortKey: "views",           render: r => fmt(r.views) },
    { key: "impressions",     label: "Impressions",  sortKey: "impressions",     render: r => fmt(r.impressions) },
    { key: "engagement_rate", label: "Eng. Rate",    sortKey: "engagement_rate", render: r => fmtPct(r.engagement_rate) },
    { key: "ext_refdomains",  label: "Ref. Domains", sortKey: "ext_refdomains",  render: r => r.ext_refdomains > 0 ? <span style={{ fontWeight: 700, color: "#7C3AED" }}>{fmt(r.ext_refdomains)}</span> : "—" },
    { key: "ext_avg_dr",      label: "Avg DR",       sortKey: "ext_avg_dr",      render: r => r.ext_avg_dr > 0 ? <span style={{ fontWeight: 700, color: r.ext_avg_dr >= 60 ? "#16A34A" : r.ext_avg_dr >= 40 ? "#D97706" : "#6B7280" }}>{r.ext_avg_dr}</span> : "—" },
    COVERAGE_COL,
  ],
  "content-freshness-risk": [
    URL_COL,
    { key: "position",       label: "Pos",          sortKey: "position",       render: r => fmt(r.position, 1) },
    { key: "impressions",    label: "Impressions",  sortKey: "impressions",    render: r => fmt(r.impressions) },
    { key: "word_count",     label: "Words",        sortKey: "word_count",     render: r => <span style={{ fontWeight: 700, color: (r.word_count || 0) < 300 ? "#DC2626" : "#F97316" }}>{fmt(r.word_count)}</span> },
    { key: "clicks",         label: "Clicks",       sortKey: "clicks",         render: r => fmt(r.clicks) },
    { key: "ext_refdomains", label: "Ref. Domains", sortKey: "ext_refdomains", render: r => r.ext_refdomains > 0 ? <span style={{ fontWeight: 700, color: "#7C3AED" }}>{fmt(r.ext_refdomains)}</span> : "—" },
    { key: "ext_avg_dr",     label: "Avg DR",       sortKey: "ext_avg_dr",     render: r => r.ext_avg_dr > 0 ? <span style={{ fontWeight: 700, color: r.ext_avg_dr >= 60 ? "#16A34A" : r.ext_avg_dr >= 40 ? "#D97706" : "#6B7280" }}>{r.ext_avg_dr}</span> : "—" },
    COVERAGE_COL,
  ],
  "broken-link-reclamation": [
    { key: "Address",             label: "Broken URL",    maxWidth: 320, wrap: true,
      render: r => <span style={{ fontSize: 11, color: "#DC2626", wordBreak: "break-all" }}>{r.Address?.replace(/^https?:\/\/[^/]+/, "") || r.Address}</span> },
    { key: "incoming_refdomains", label: "Ref. Domains",  sortKey: "incoming_refdomains", render: r => <span style={{ fontWeight: 700, color: "#7C3AED" }}>{fmt(r.incoming_refdomains)}</span> },
    { key: "avg_incoming_dr",     label: "Avg DR",        sortKey: "avg_incoming_dr",     render: r => <span style={{ fontWeight: 700, color: r.avg_incoming_dr >= 60 ? "#16A34A" : r.avg_incoming_dr >= 40 ? "#D97706" : "#6B7280" }}>{r.avg_incoming_dr || "—"}</span> },
    { key: "top_incoming_dr",     label: "Top DR",        sortKey: "top_incoming_dr",     render: r => <span style={{ fontWeight: 700, color: r.top_incoming_dr >= 60 ? "#16A34A" : r.top_incoming_dr >= 40 ? "#D97706" : "#6B7280" }}>{r.top_incoming_dr || "—"}</span> },
    { key: "dofollow_count",      label: "Dofollow",      sortKey: "dofollow_count",      render: r => fmt(r.dofollow_count) },
    { key: "incoming_links",      label: "Total Links",   sortKey: "incoming_links",      render: r => fmt(r.incoming_links) },
  ],
};

const INSIGHT_ORDER = [
  "full_funnel", "ctr_opportunity", "thin_traffic",
  "ranking_not_converting", "position_cliff", "orphan_pages",
  "engaged_no_convert", "impression_black_hole", "deep_no_traffic",
  "ranking_velocity", "content_freshness_risk", "broken_link_reclamation",
  "intent_mismatch", "keyword_intent_gap", "query_expansion_gap",
  "segment_health",
];

// Only keep fields used in each insight's table columns before saving to Supabase.
// Keeps the stored JSON small (~10 fields/row instead of 75+).
const SLIM_FIELDS = {
  "ctr-opportunity":        ["Address", "data_coverage", "position", "impressions", "ctr", "ctr_benchmark", "ctr_gap"],
  "thin-traffic":           ["Address", "data_coverage", "clicks", "word_count", "position"],
  "ranking-not-converting": ["Address", "data_coverage", "clicks", "bounce_rate", "key_events", "position"],
  "position-cliff":         ["Address", "data_coverage", "position", "impressions", "ctr", "ext_refdomains", "ext_avg_dr", "has_sf_issues"],
  "orphan-pages":           ["Address", "data_coverage", "views", "inlinks", "ext_refdomains", "ext_avg_dr", "clicks"],
  "engaged-no-convert":     ["Address", "data_coverage", "views", "avg_engagement_time", "engagement_rate", "key_events"],
  "impression-black-hole":  ["Address", "data_coverage", "impressions", "ctr", "position", "clicks"],
  "deep-no-traffic":        ["Address", "data_coverage", "word_count", "impressions", "clicks", "inlinks", "ext_refdomains", "ext_avg_dr"],
  "intent-mismatch":        ["Address", "data_coverage", "h1", "Title 1", "Meta Description 1", "sim_title_h1", "sim_title_meta", "sim_h1_meta", "alignment_score", "alignment_field_count", "position", "impressions"],
  "segment-health":           null,
  "full-funnel":              ["Address", "data_coverage", "page_score", "impressions", "clicks", "views", "key_events"],
  "ranking-velocity":         ["Address", "data_coverage", "position", "avg_engagement_time", "views", "impressions", "engagement_rate", "ext_refdomains", "ext_avg_dr"],
  "content-freshness-risk":   ["Address", "data_coverage", "position", "impressions", "word_count", "clicks", "ext_refdomains", "ext_avg_dr"],
  "broken-link-reclamation":  null,
  "keyword-intent-gap":       null,
  "query-expansion-gap":      null,
};

function slimForSave(insights) {
  const out = {};
  for (const [key, insight] of Object.entries(insights)) {
    const fields = SLIM_FIELDS[insight.id];
    out[key] = {
      ...insight,
      pages: fields
        ? insight.pages.map(row => Object.fromEntries(fields.map(f => [f, row[f] ?? null])))
        : insight.pages,
    };
  }
  return out;
}

// ── Meta chip ─────────────────────────────────────────────────────────────────
function Chip({ label, value, color }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "8px 12px", minWidth: 80 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: color || TEXT, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 600, color: MUTED, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

// ── Segment builder ───────────────────────────────────────────────────────────
function SegmentBuilder({ rules, onChange }) {
  const [draft, setDraft] = useState(rules.map(r => ({ ...r })));
  const [editIdx, setEditIdx] = useState(null);
  const nameRef = useRef(null);

  const apply = () => { onChange(draft.filter(r => r.name.trim() && r.pattern.trim())); setEditIdx(null); };
  const add    = () => { setDraft(d => [...d, { name: "", pattern: "" }]); setEditIdx(draft.length); };
  const remove = (i) => setDraft(d => d.filter((_, j) => j !== i));
  const move   = (i, dir) => {
    const next = [...draft];
    const to = i + dir;
    if (to < 0 || to >= next.length) return;
    [next[i], next[to]] = [next[to], next[i]];
    setDraft(next);
  };
  const update = (i, field, val) => setDraft(d => d.map((r, j) => j === i ? { ...r, [field]: val } : r));

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
        Segment Rules <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— first match wins, "other" is the catch-all</span>
      </div>
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: BG }}>
              <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, color: MUTED, fontSize: 10, borderBottom: `1px solid ${BORDER}`, width: 28 }}>#</th>
              <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, color: MUTED, fontSize: 10, borderBottom: `1px solid ${BORDER}` }}>Segment Name</th>
              <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, color: MUTED, fontSize: 10, borderBottom: `1px solid ${BORDER}` }}>URL Pattern (regex)</th>
              <th style={{ padding: "6px 10px", borderBottom: `1px solid ${BORDER}`, width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {draft.map((rule, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${BORDER}`, background: editIdx === i ? "#FAFAFA" : "#fff" }}>
                <td style={{ padding: "4px 10px", color: MUTED, fontWeight: 700 }}>{i + 1}</td>
                <td style={{ padding: "4px 6px" }}>
                  {editIdx === i
                    ? <input ref={i === 0 ? nameRef : null} value={rule.name} onChange={e => update(i, "name", e.target.value)}
                        style={{ width: "100%", padding: "4px 7px", border: `1.5px solid ${BORDER}`, borderRadius: 5, fontFamily: "'Inter',sans-serif", fontSize: 11 }} />
                    : <span style={{ fontWeight: 600, color: TEXT }}>{rule.name || <em style={{ color: MUTED }}>unnamed</em>}</span>
                  }
                </td>
                <td style={{ padding: "4px 6px" }}>
                  {editIdx === i
                    ? <input value={rule.pattern} onChange={e => update(i, "pattern", e.target.value)}
                        style={{ width: "100%", padding: "4px 7px", border: `1.5px solid ${BORDER}`, borderRadius: 5, fontFamily: "monospace", fontSize: 11 }} />
                    : <code style={{ fontSize: 10, color: "#6D28D9", background: "#F5F3FF", padding: "2px 5px", borderRadius: 3 }}>{rule.pattern}</code>
                  }
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center" }}>
                    {editIdx === i
                      ? <button onClick={() => setEditIdx(null)} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, border: `1px solid ${BORDER}`, background: "none", cursor: "pointer", color: MUTED }}>Done</button>
                      : <button onClick={() => setEditIdx(i)} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, border: `1px solid ${BORDER}`, background: "none", cursor: "pointer", color: MUTED }}>Edit</button>
                    }
                    <button onClick={() => move(i, -1)} disabled={i === 0} style={{ fontSize: 10, padding: "2px 5px", borderRadius: 4, border: `1px solid ${BORDER}`, background: "none", cursor: i === 0 ? "default" : "pointer", color: MUTED, opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                    <button onClick={() => move(i, 1)} disabled={i === draft.length - 1} style={{ fontSize: 10, padding: "2px 5px", borderRadius: 4, border: `1px solid ${BORDER}`, background: "none", cursor: i === draft.length - 1 ? "default" : "pointer", color: MUTED, opacity: i === draft.length - 1 ? 0.3 : 1 }}>↓</button>
                    <button onClick={() => remove(i)} style={{ fontSize: 10, padding: "2px 5px", borderRadius: 4, border: "1px solid #FECACA", background: "none", cursor: "pointer", color: "#DC2626" }}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
            <tr style={{ background: "#F9FAFB" }}>
              <td colSpan={2} style={{ padding: "6px 10px" }}>
                <button onClick={add} style={{ fontSize: 11, fontWeight: 600, color: VIOLET, background: "none", border: "none", cursor: "pointer", padding: 0 }}>+ Add Segment</button>
              </td>
              <td colSpan={2} style={{ padding: "6px 10px", textAlign: "right" }}>
                <button onClick={() => setDraft(DEFAULT_SEGMENT_RULES.map(r => ({ ...r })))} style={{ fontSize: 10, color: MUTED, background: "none", border: "none", cursor: "pointer", marginRight: 10 }}>Reset defaults</button>
                <button onClick={apply} style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: VIOLET, border: "none", borderRadius: 5, padding: "5px 14px", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Apply & Re-run</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CrossSignalReport({ sfRows, sfIssueRows, gscPages, gscQueries, ga4Rows, savedData, onSave, ahrefsData }) {
  const [open,         setOpen]         = useState(false);
  const [report,       setReport]       = useState(savedData || null);
  const [loading,      setLoading]      = useState(false);
  const [segmentRules, setSegmentRules] = useState(savedData?.segmentRules || DEFAULT_SEGMENT_RULES);
  const [segBuilderOpen, setSegBuilderOpen] = useState(false);
  // Ref so the merge useEffect can always read latest rules without re-triggering
  const segmentRulesRef = useRef(segmentRules);
  useEffect(() => { segmentRulesRef.current = segmentRules; }, [segmentRules]);

  // Refs for merged data — avoids stale closure in handleSegmentApply.
  // Seeded from sessionStorage so Apply & Re-run works after a page refresh
  // without requiring a re-upload.
  const SESSION_ROWS_KEY = "csr_merged_rows";
  const SESSION_META_KEY = "csr_merged_meta";
  const mergedRowsRef = useRef(null);
  const mergedMetaRef = useRef(null);
  useEffect(() => {
    if (mergedRowsRef.current) return;
    try {
      const r = sessionStorage.getItem(SESSION_ROWS_KEY);
      const m = sessionStorage.getItem(SESSION_META_KEY);
      if (r) mergedRowsRef.current = JSON.parse(r);
      if (m) mergedMetaRef.current = JSON.parse(m);
    } catch (_) {}
  }, []);

  const hasSf  = sfRows  && sfRows.length  > 0;
  const hasGsc = gscPages && gscPages.length > 0;
  const hasGa  = ga4Rows  && ga4Rows.length  > 0;

  // Keep refs to the latest non-empty data so runMerge always has access
  // even if the parent re-renders with empty props after onSave.
  const sfRowsRef      = useRef(sfRows);
  const sfIssueRowsRef = useRef(sfIssueRows);
  const gscPagesRef    = useRef(gscPages);
  const gscQueriesRef  = useRef(gscQueries);
  const ga4RowsRef     = useRef(ga4Rows);
  if (sfRows?.length)      sfRowsRef.current      = sfRows;
  if (sfIssueRows?.length) sfIssueRowsRef.current = sfIssueRows;
  if (gscPages?.length)    gscPagesRef.current    = gscPages;
  if (gscQueries?.length)  gscQueriesRef.current  = gscQueries;
  if (ga4Rows?.length)     ga4RowsRef.current     = ga4Rows;

  const runMerge = (rules) => {
    const rows = sfRowsRef.current;
    if (!rows?.length) return;
    setLoading(true);
    setTimeout(() => {
      try {
        const result = mergeReportData({
          sfRows:      rows,
          sfIssueRows: sfIssueRowsRef.current || [],
          gscPages:    gscPagesRef.current    || [],
          gscQueries:  gscQueriesRef.current  || [],
          ga4Rows:     ga4RowsRef.current     || [],
          segmentRules: rules,
          ahrefsData:  ahrefsData ?? null,
        });
        mergedRowsRef.current = result.merged_rows;
        mergedMetaRef.current = result.meta;
        // Persist slim rows to sessionStorage so Apply & Re-run survives refresh
        try {
          const slim = result.merged_rows.map(r => ({
            Address: r.Address, data_coverage: r.data_coverage, segment: r.segment,
            ctr: r.ctr, impressions: r.impressions, clicks: r.clicks,
            position: r.position, ctr_benchmark: r.ctr_benchmark, ctr_gap: r.ctr_gap,
            views: r.views, key_events: r.key_events, event_count: r.event_count,
            bounce_rate: r.bounce_rate, engagement_rate: r.engagement_rate,
            avg_engagement_time: r.avg_engagement_time,
            word_count: r.word_count, response_time: r.response_time,
            inlinks: r.inlinks, has_sf_issues: r.has_sf_issues, h1: r.h1,
            "Title 1": r["Title 1"], "Meta Description 1": r["Meta Description 1"],
            sim_title_h1: r.sim_title_h1, sim_title_meta: r.sim_title_meta,
            sim_h1_meta: r.sim_h1_meta, alignment_score: r.alignment_score,
            alignment_field_count: r.alignment_field_count, low_alignment: r.low_alignment,
            page_score: r.page_score,
            orphan_flag: r.orphan_flag, thin_traffic_flag: r.thin_traffic_flag,
            cliff_flag: r.cliff_flag,
            engaged_no_convert_flag: r.engaged_no_convert_flag,
            impression_black_hole_flag: r.impression_black_hole_flag,
            deep_no_traffic_flag: r.deep_no_traffic_flag,
            ext_backlinks: r.ext_backlinks, ext_refdomains: r.ext_refdomains, ext_avg_dr: r.ext_avg_dr,
            ext_orphan_flag: r.ext_orphan_flag,
            ranking_velocity_flag: r.ranking_velocity_flag,
            freshness_risk_flag: r.freshness_risk_flag,
          }));
          sessionStorage.setItem(SESSION_ROWS_KEY, JSON.stringify(slim));
          sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(result.meta));
        } catch (_) {}
        setReport(result);
        onSave?.({ meta: result.meta, insights: slimForSave(result.insights), segmentRules: rules, savedAt: new Date().toISOString() });
      } catch (e) {
        console.error("Cross-signal merge failed:", e);
      } finally {
        setLoading(false);
      }
    }, 0);
  };

  useEffect(() => {
    if (!hasSf) return;
    runMerge(segmentRulesRef.current);
  }, [sfRows, sfIssueRows, gscPages, gscQueries, ga4Rows]);

  const handleSegmentApply = (newRules) => {
    setSegmentRules(newRules);
    segmentRulesRef.current = newRules;

    const cachedRows = mergedRowsRef.current;
    if (cachedRows?.length) {
      // Fast path: re-segment in-memory rows — no re-upload needed, no loading flash
      try {
        const result = reapplySegments(cachedRows, newRules, mergedMetaRef.current, gscQueriesRef.current || [],
          { broken_link_reclamation: report?.insights?.broken_link_reclamation });
        mergedRowsRef.current = result.merged_rows;
        setReport(prev => ({ ...prev, ...result }));
        onSave?.({ meta: result.meta, insights: slimForSave(result.insights), segmentRules: newRules, savedAt: new Date().toISOString() });
      } catch (e) {
        console.error("Segment re-apply failed:", e);
      }
    } else if (sfRowsRef.current?.length) {
      // No cached merged rows yet — full re-merge
      runMerge(newRules);
    } else {
      // No data at all — persist rules so they apply on next upload
      onSave?.({ ...(report || {}), segmentRules: newRules, savedAt: new Date().toISOString() });
    }
  };

  const { meta, insights } = report || {};
  const savedAt = report?.savedAt ? new Date(report.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 10, marginBottom: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>

      {/* ── Title bar ── */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", cursor: "pointer", background: V_LIGHT, borderBottom: open ? `1px solid ${BORDER}` : "none" }}
      >
        <div style={{ width: 20, height: 20, borderRadius: 6, background: VIOLET, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <circle cx="3"  cy="9"  r="1.8" stroke="#fff" strokeWidth="1.2"/>
            <circle cx="9"  cy="9"  r="1.8" stroke="#fff" strokeWidth="1.2"/>
            <circle cx="6"  cy="3"  r="1.8" stroke="#fff" strokeWidth="1.2"/>
            <path d="M3 9L6 3M6 3L9 9" stroke="#fff" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: VIOLET, letterSpacing: 0.5 }}>
          Cross-Signal Intelligence
          {loading  && <span style={{ marginLeft: 6, fontSize: 10, color: MUTED }}>Analyzing…</span>}
          {report && !loading && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: VIOLET, background: V_BADGE, borderRadius: 4, padding: "1px 6px" }}>Analysis ✓</span>}
          {savedAt  && !hasSf && <span style={{ marginLeft: 6, fontSize: 10, color: MUTED }}>· {savedAt}</span>}
          {meta && <span style={{ marginLeft: 6, fontSize: 10, color: MUTED }}>{meta.sf_row_count} pages</span>}
          {meta?.gsc_row_count > 0 && <span style={{ marginLeft: 4, fontSize: 10, color: MUTED }}>+ GSC</span>}
          {meta?.ga_row_count  > 0 && <span style={{ marginLeft: 4, fontSize: 10, color: MUTED }}>+ GA4</span>}
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform .2s", color: MUTED, flexShrink: 0 }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* ── Body ── */}
      {open && (
        <div style={{ padding: "20px 22px" }}>

          {/* Empty state — only when no live data AND no saved analysis */}
          {!report && !loading && (
            <div style={{ textAlign: "center", padding: "32px 20px", color: MUTED }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 6 }}>No analysis yet</div>
              <div style={{ fontSize: 12 }}>Use <strong>Build Site Report</strong> to upload Screaming Frog, GSC, and GA4 files.</div>
            </div>
          )}

          {/* Stale saved data — nudge to re-run */}
          {report && !hasSf && !loading && (
            <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#92400E", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1 }}>Showing saved analysis from {savedAt || "a previous session"}. Re-upload via <strong>Build Site Report</strong> to refresh with the latest data.</span>
            </div>
          )}

          {/* SF only — nudge toward adding cross-signal sources */}
          {hasSf && !hasGsc && !hasGa && !loading && report && (
            <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#92400E" }}>
              Showing SF-only analysis. Add <strong>GSC</strong> and <strong>GA4</strong> via Build Site Report to unlock CTR, engagement, and conversion insights.
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: "center", color: MUTED, fontSize: 12, padding: "20px 0" }}>Running analysis…</div>
          )}

          {/* Report */}
          {!loading && report && (
            <>
              {/* ── Intelligence dashboard header ─────────────────────────── */}
              {(() => {
                const avgCtr      = meta.total_impressions > 0 ? meta.total_clicks / meta.total_impressions : 0;
                const scoreColor  = meta.avg_page_score < 30 ? "#DC2626" : meta.avg_page_score < 60 ? "#D97706" : "#16A34A";
                const quickWins   = insights.position_cliff?.pages?.length     || 0;
                const convLeaks   = insights.engaged_no_convert?.pages?.length  || 0;
                const intentQ     = insights.keyword_intent_gap?.pages?.length  || 0;
                const queryGaps   = insights.query_expansion_gap?.pages?.filter(p => p.gap_type === "no content").length || 0;
                const orphans     = insights.orphan_pages?.pages?.length        || 0;

                return (
                  <div style={{ marginBottom: 16 }}>
                    {/* Row 1: Performance KPIs */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      {[
                        { label: "Impressions",  value: meta.total_impressions >= 1e6 ? `${(meta.total_impressions/1e6).toFixed(1)}M` : meta.total_impressions >= 1000 ? `${(meta.total_impressions/1000).toFixed(1)}k` : fmt(meta.total_impressions), color: "#0E7490"  },
                        { label: "Clicks",        value: meta.total_clicks >= 1000 ? `${(meta.total_clicks/1000).toFixed(1)}k` : fmt(meta.total_clicks),                                                                                                    color: "#2563EB"  },
                        { label: "Avg CTR",       value: fmtPct(avgCtr),                                                                                                                                                                                     color: TEXT       },
                        { label: "Page Score",    value: meta.avg_page_score ?? "—",                                                                                                                                                                          color: scoreColor },
                        { label: "GA4 Views",     value: meta.total_views >= 1e6 ? `${(meta.total_views/1e6).toFixed(1)}M` : meta.total_views >= 1000 ? `${(meta.total_views/1000).toFixed(1)}k` : fmt(meta.total_views),                                    color: "#7C3AED"  },
                        { label: "Key Events",    value: meta.total_key_events >= 1e6 ? `${(meta.total_key_events/1e6).toFixed(1)}M` : meta.total_key_events >= 1000 ? `${(meta.total_key_events/1000).toFixed(1)}k` : fmt(meta.total_key_events), color: "#16A34A"  },
                        { label: "GSC Queries",   value: fmt(meta.gsc_query_count || 0),                                                                                                                                                                      color: TEXT       },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 14px", minWidth: 90 }}>
                          <div style={{ fontSize: 8.5, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>{label}</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1, fontFamily: "'Inter',sans-serif" }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Row 2: Actionable signals */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {[
                        { label: "Quick Wins",       count: quickWins,  bg: "#F0FDF4", border: "#86EFAC", color: "#15803D", desc: "cliff pages" },
                        { label: "Conv. Leaks",      count: convLeaks,  bg: "#FEF2F2", border: "#FCA5A5", color: "#DC2626", desc: "engaged, not converting" },
                        { label: "Intent Queries",   count: intentQ,    bg: "#FFF7ED", border: "#FCD34D", color: "#D97706", desc: "commercial / transactional" },
                        { label: "Content Gaps",     count: queryGaps,  bg: "#EFF6FF", border: "#93C5FD", color: "#2563EB", desc: "no matching page" },
                        { label: "Orphan Pages",     count: orphans,    bg: "#F5F3FF", border: "#C4B5FD", color: "#7C3AED", desc: "traffic, no internal links" },
                      ].map(({ label, count, bg, border, color, desc }) => (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: "6px 14px" }}>
                          <span style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1, fontFamily: "'Inter',sans-serif" }}>{count}</span>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color }}>{label}</div>
                            <div style={{ fontSize: 9, color, opacity: 0.7 }}>{desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* GSC column inspector — shown when GSC matched but all clicks are 0 */}
              {meta.gsc_row_count > 0 && (meta.matched_sf_gsc + meta.matched_3way) > 0 && (() => {
                const sample = meta._debug?.gscKeys?.[0];
                const hasClicks = sample && sample.clicks != null && sample.clicks !== "" && sample.clicks !== "0";
                if (hasClicks) return null;
                return (
                  <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "12px 14px", marginBottom: 14, fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: "#92400E", marginBottom: 8 }}>⚠ GSC URLs matched but Clicks/Impressions = 0 — actual GSC columns:</div>
                    {(meta._debug?.gscKeys || []).slice(0, 2).map((k, i) => (
                      <div key={i} style={{ marginBottom: 8, padding: "8px 10px", background: "#fff", borderRadius: 6, border: "1px solid #FDE68A" }}>
                        <div style={{ fontFamily: "monospace", fontSize: 9, color: "#6B7280", marginBottom: 4, wordBreak: "break-all" }}>Columns: {k.cols}</div>
                        <div style={{ fontFamily: "monospace", fontSize: 10, color: "#1E293B", wordBreak: "break-all" }}>
                          URL: {k.raw}<br/>
                          Clicks: "{k.clicks}" | Impressions: "{k.impressions}" | CTR: "{k.ctr}" | Position: "{k.position}"
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Join rate warnings + debug samples */}
              {meta.sf_row_count > 0 && meta.gsc_row_count > 0 && meta.matched_sf_gsc + meta.matched_3way === 0 && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 14px", marginBottom: 14, fontSize: 12, color: "#DC2626" }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>⚠ 0 GSC URL matches — diagnosing mismatch:</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#6B7280", marginBottom: 4, fontSize: 10, textTransform: "uppercase" }}>SF — Address column (raw → normalized)</div>
                      {(meta._debug?.sfKeys || []).map((k, i) => (
                        <div key={i} style={{ marginBottom: 4 }}>
                          <div style={{ fontFamily: "monospace", fontSize: 9, color: "#6B7280", wordBreak: "break-all" }}>{k.raw}</div>
                          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#1E293B", background: "#FEE2E2", borderRadius: 3, padding: "2px 5px", wordBreak: "break-all" }}>→ {k.norm || "(empty)"}</div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: "#6B7280", marginBottom: 4, fontSize: 10, textTransform: "uppercase" }}>GSC — columns: {meta._debug?.gscKeys?.[0]?.cols}</div>
                      {(meta._debug?.gscKeys || []).map((k, i) => (
                        <div key={i} style={{ marginBottom: 4 }}>
                          <div style={{ fontFamily: "monospace", fontSize: 9, color: "#6B7280", wordBreak: "break-all" }}>{k.raw}</div>
                          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#1E293B", background: "#FEE2E2", borderRadius: 3, padding: "2px 5px", wordBreak: "break-all" }}>→ {k.norm || "(empty)"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {meta.sf_row_count > 0 && meta.ga_row_count > 0 && meta.matched_sf_ga + meta.matched_3way === 0 && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 14px", marginBottom: 14, fontSize: 12, color: "#DC2626" }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>⚠ 0 GA4 URL matches — diagnosing mismatch:</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#6B7280", marginBottom: 4, fontSize: 10, textTransform: "uppercase" }}>SF paths (from Address)</div>
                      {(meta._debug?.sfKeys || []).map((k, i) => {
                        const path = "/" + k.norm.split("/").slice(1).join("/");
                        return (
                          <div key={i} style={{ fontFamily: "monospace", fontSize: 10, color: "#1E293B", background: "#FEE2E2", borderRadius: 3, padding: "2px 5px", marginBottom: 2, wordBreak: "break-all" }}>{path}</div>
                        );
                      })}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: "#6B7280", marginBottom: 4, fontSize: 10, textTransform: "uppercase" }}>GA4 paths — cols: {meta._debug?.ga4Keys?.[0]?.cols}</div>
                      {(meta._debug?.ga4Keys || []).map((k, i) => (
                        <div key={i} style={{ marginBottom: 4 }}>
                          <div style={{ fontFamily: "monospace", fontSize: 9, color: "#6B7280", wordBreak: "break-all" }}>{k.raw}</div>
                          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#1E293B", background: "#FEE2E2", borderRadius: 3, padding: "2px 5px", wordBreak: "break-all" }}>→ {k.norm || "(empty)"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Coverage legend */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
                {Object.entries(COVERAGE).map(([key, c]) => (
                  <span key={key} style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 4, background: c.bg, color: c.color }}>{c.label}</span>
                ))}
                <span style={{ fontSize: 10, color: MUTED }}>— coverage per page</span>
              </div>

              {/* Insight panels — auto-open if they have results */}
              {INSIGHT_ORDER.map(key => {
                const insight = insights?.[key];
                if (!insight) return null;
                const isSegment     = insight.id === "segment-health";
                const isAlignment   = insight.id === "intent-mismatch";
                const isDeep        = insight.id === "deep-no-traffic";
                const isBlackHole   = insight.id === "impression-black-hole";
                const isEngaged     = insight.id === "engaged-no-convert";
                const isOrphan      = insight.id === "orphan-pages";
                const isCliff       = insight.id === "position-cliff";
                const isCTR         = insight.id === "ctr-opportunity";
                const isFullFunnel  = insight.id === "full-funnel";
                const isIntentGap   = insight.id === "keyword-intent-gap";
                const isQueryGap    = insight.id === "query-expansion-gap";
                const isVelocity    = insight.id === "ranking-velocity";
                const isFreshness   = insight.id === "content-freshness-risk";
                const isBrokenReclaim = insight.id === "broken-link-reclamation";
                return (
                  <InsightPanel
                    key={key}
                    insight={insight}
                    columns={(INSIGHT_COLUMNS[insight.id] || []).filter(col =>
                      (col.key !== "ext_refdomains" || (insight.pages || []).some(p => p.ext_refdomains > 0)) &&
                      (col.key !== "ext_avg_dr"     || (insight.pages || []).some(p => p.ext_avg_dr     > 0))
                    )}
                    beforeTable={
                      isSegment   ? <SegmentDonutChart        segments={insight.pages} /> :
                      isAlignment ? <AlignmentScatterPlot     pages={insight.pages}    /> :
                      isDeep      ? <DeepContentChart         pages={insight.pages}    /> :
                      isBlackHole ? <ImpressionCTRChart       pages={insight.pages}    /> :
                      isEngaged   ? <EngagedNoConvertChart    pages={insight.pages}    /> :
                      isOrphan    ? <OrphanPagesChart         pages={insight.pages}    /> :
                      isCliff     ? <PositionCliffChart       pages={insight.pages}    /> :
                      isCTR       ? <CTROpportunityChart      pages={insight.pages}    /> :
                      isFullFunnel? <FullFunnelChart          pages={insight.pages}    /> :
                      isIntentGap ? <IntentLandscapeChart     pages={insight.pages}    /> :
                      isQueryGap  ? <QueryGapChart            pages={insight.pages}    /> :
                      isVelocity      ? <RankingVelocityChart          pages={insight.pages} /> :
                      isFreshness     ? <FreshnessRiskChart             pages={insight.pages} /> :
                      isBrokenReclaim ? <BrokenLinkReclamationChart     pages={insight.pages} /> :
                      undefined
                    }
                    headerAction={isSegment ? (
                      <button
                        onClick={() => setSegBuilderOpen(v => !v)}
                        style={{ fontSize: 10, fontWeight: 700, color: VIOLET, background: V_LIGHT, border: `1px solid #DDD6FE`, borderRadius: 5, padding: "3px 9px", cursor: "pointer", fontFamily: "'Inter',sans-serif", whiteSpace: "nowrap" }}
                      >
                        ⚙ Configure Segments
                      </button>
                    ) : undefined}
                    bodyPrefix={isSegment ? (
                      <>
                        {segBuilderOpen && (
                          <div style={{ marginBottom: 14 }}>
                            <SegmentBuilder
                              rules={segmentRules}
                              onChange={newRules => { handleSegmentApply(newRules); setSegBuilderOpen(false); }}
                            />
                          </div>
                        )}
                        {!insight.hasEngagementData && (
                          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, padding: "8px 12px", marginBottom: 10, fontSize: 11, color: "#92400E" }}>
                            ⚠ <strong>Avg Bounce and Avg Engagement are unavailable</strong> — your GA4 export doesn't include Bounce rate, Engagement rate, Sessions, or Engaged sessions columns. In GA4, customize your Pages and screens report to add <strong>Engagement rate</strong> (or <strong>Sessions</strong> + <strong>Engaged sessions</strong>) before exporting.
                          </div>
                        )}
                      </>
                    ) : undefined}
                  />
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
