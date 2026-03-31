import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { ACCENT, BG, BORDER, CARD, MUTED, TEXT } from "../lib/constants";
import {
  getDomainRating, getDomainRatingHistory, getMetricsExtended,
  getBacklinksHistory, getRefdomains, getAnchors,
} from "../lib/ahrefs";

// ── Palette ───────────────────────────────────────────────────────────────────
const BLUE   = "#2563EB";
const GREEN  = "#16A34A";
const RED    = "#DC2626";
const AMBER  = "#D97706";
const PURPLE = "#7C3AED";
const TEAL   = "#0E7490";
const PALETTE = [BLUE, GREEN, AMBER, PURPLE, TEAL, RED, "#F97316", "#EC4899", "#14B8A6", "#6366F1"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function drColor(dr) {
  if (dr >= 70) return GREEN;
  if (dr >= 40) return AMBER;
  return RED;
}

// Unwrap Ahrefs nested metric objects like { live: N, all_time: N } or plain numbers
function exNum(field) {
  if (field == null) return null;
  if (typeof field === "number") return field;
  if (typeof field === "object") return field.live ?? field.all_time ?? field.value ?? null;
  return null;
}

function fmtNum(n) {
  const v = exNum(n);
  if (v == null) return "—";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000)     return (v / 1_000).toFixed(1) + "K";
  return v.toLocaleString();
}

function stripProtocol(url) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "").split("/")[0];
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = TEXT, bg = CARD, border = BORDER }) {
  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 10, padding: "14px 18px", textAlign: "center", flex: "1 1 120px" }}>
      <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize: 10, color, opacity: 0.7, fontWeight: 600, marginTop: 1 }}>{sub}</div>}
      <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, marginTop: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ title, color = TEAL }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, marginTop: 24 }}>
      <div style={{ width: 4, height: 18, background: color, borderRadius: 2, flexShrink: 0 }} />
      <div style={{ fontSize: 13, fontWeight: 800, color: TEXT, letterSpacing: 0.3 }}>{title}</div>
      <div style={{ flex: 1, height: 1, background: BORDER }} />
    </div>
  );
}

// ── Chart Card ────────────────────────────────────────────────────────────────
function ChartCard({ title, hint, children }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px", flex: "1 1 280px", minWidth: 260 }}>
      {title && <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, marginBottom: 2 }}>{title}</div>}
      {hint  && <div style={{ fontSize: 10, color: MUTED, marginBottom: 10, lineHeight: 1.4 }}>{hint}</div>}
      {children}
    </div>
  );
}

// ── Error Box ─────────────────────────────────────────────────────────────────
function ErrBox({ msg }) {
  return (
    <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 7, padding: "8px 12px", fontSize: 11, color: RED }}>
      {msg}
    </div>
  );
}

// ── SVG Line Chart ────────────────────────────────────────────────────────────
function LineChart({ data, valueKey, labelKey, color = BLUE, inverted = false, formatY = fmtNum, tooltipDateKey = "date" }) {
  const [hovered, setHovered] = useState(null);
  if (!data?.length) return <div style={{ fontSize: 11, color: MUTED }}>No history data</div>;
  const W = 420, H = 120, PAD = { t: 10, r: 10, b: 28, l: 44 };
  const vals = data.map(d => d[valueKey]);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const toX = (i) => PAD.l + (i / (data.length - 1)) * (W - PAD.l - PAD.r);
  const toY = (v) => PAD.t + (inverted
    ? ((v - min) / range) * (H - PAD.t - PAD.b)
    : (1 - (v - min) / range) * (H - PAD.t - PAD.b));
  const pts = data.map((d, i) => `${toX(i)},${toY(d[valueKey])}`).join(" ");
  const area = `M${toX(0)},${H - PAD.b} ` + data.map((d, i) => `L${toX(i)},${toY(d[valueKey])}`).join(" ") + ` L${toX(data.length - 1)},${H - PAD.b} Z`;
  const ticks = [0, Math.floor(data.length / 2), data.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  const yTicks = [min, (min + max) / 2, max].map(v => ({ v, y: toY(v) }));

  const fmtTooltipDate = (raw) => {
    if (!raw) return "";
    // Parse as UTC to avoid timezone shifting (e.g. "2026-03-01T00:00:00Z" → "Mar 2026")
    const d = new Date(raw);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
      onMouseLeave={() => setHovered(null)}>
      <defs>
        <linearGradient id={`ag-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTicks.map(({ y }, i) => (
        <line key={i} x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke={BORDER} strokeWidth="0.5" strokeDasharray="3,3" />
      ))}
      {yTicks.map(({ v, y }, i) => (
        <text key={i} x={PAD.l - 4} y={y + 3.5} textAnchor="end" fontSize="7" fill={MUTED}>{formatY(Math.round(v))}</text>
      ))}
      <path d={area} fill={`url(#ag-${color.replace("#","")})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => {
        const cx = toX(i), cy = toY(d[valueKey]);
        const isHovered = hovered === i;
        return (
          <circle key={i} cx={cx} cy={cy} r={isHovered ? 3.5 : 2} fill={color}
            stroke={isHovered ? "#fff" : "none"} strokeWidth="1"
            style={{ cursor: "crosshair" }}
            onMouseEnter={() => setHovered(i)}
          />
        );
      })}
      {ticks.map(i => (
        <text key={i} x={toX(i)} y={H - PAD.b + 11} textAnchor="middle" fontSize="7" fill={MUTED}>
          {data[i][labelKey]}
        </text>
      ))}
      {/* Tooltip */}
      {hovered !== null && (() => {
        const d = data[hovered];
        const cx = toX(hovered), cy = toY(d[valueKey]);
        const label = fmtTooltipDate(d[tooltipDateKey]) || d[labelKey];
        const val   = formatY(d[valueKey]);
        const text  = `${label}: ${val}`;
        const TW = text.length * 5.5 + 16, TH = 18;
        const tx = Math.min(Math.max(cx - TW / 2, PAD.l), W - PAD.r - TW);
        const ty = cy - TH - 8 < PAD.t ? cy + 10 : cy - TH - 8;
        return (
          <g pointerEvents="none">
            <rect x={tx} y={ty} width={TW} height={TH} rx="4" fill="#1E293B" opacity="0.9" />
            <text x={tx + TW / 2} y={ty + 12} textAnchor="middle" fontSize="9" fill="#fff" fontWeight="600">{text}</text>
          </g>
        );
      })()}
    </svg>
  );
}

// ── SVG Donut Chart ───────────────────────────────────────────────────────────
function DonutChart({ segments, centerLabel }) {
  // segments: [{label, value, color}]
  const total = segments.reduce((s, x) => s + (x.value || 0), 0);
  if (!total) return <div style={{ fontSize: 11, color: MUTED }}>No data</div>;
  const R = 40, CX = 60, CY = 52, CIRC = 2 * Math.PI * R;
  let offset = 0;
  const arcs = segments.map(seg => {
    const pct = seg.value / total;
    const arc = { ...seg, pct, dash: pct * CIRC, offset };
    offset += pct * CIRC;
    return arc;
  });
  const center = centerLabel ?? `${Math.round(arcs[0]?.pct * 100)}%`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width="120" height="104" style={{ flexShrink: 0 }}>
        {arcs.map((a, i) => (
          <circle key={i} cx={CX} cy={CY} r={R}
            fill="none" stroke={a.color} strokeWidth="18"
            strokeDasharray={`${a.dash} ${CIRC - a.dash}`}
            strokeDashoffset={-(a.offset - CIRC / 4)}
            style={{ transition: "stroke-dasharray .4s ease" }}
          />
        ))}
        <text x={CX} y={CY + 5} textAnchor="middle" fontSize="13" fontWeight="800" fill={TEXT}>
          {center}
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {arcs.map((a, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: a.color, flexShrink: 0 }} />
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: TEXT }}>{Math.round(a.pct * 100)}% </span>
              <span style={{ fontSize: 10, color: MUTED }}>{a.label} ({fmtNum(a.value)})</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Horizontal Bar Chart ──────────────────────────────────────────────────────
function HBar({ rows, color = BLUE, valueLabel = "" }) {
  // rows: [{label, value}]
  if (!rows?.length) return <div style={{ fontSize: 11, color: MUTED }}>No data</div>;
  const max = Math.max(...rows.map(r => r.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {rows.map((r, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "75%" }} title={r.label}>
              {r.label || "(empty)"}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color, flexShrink: 0 }}>{fmtNum(r.value)}{valueLabel}</div>
          </div>
          <div style={{ height: 6, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${(r.value / max) * 100}%`, height: "100%", background: color, borderRadius: 4, transition: "width .4s ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── DR Distribution Histogram ─────────────────────────────────────────────────
function DRHistogram({ refdomains }) {
  if (!refdomains?.length) return <div style={{ fontSize: 11, color: MUTED }}>No referring domain data</div>;
  const buckets = [
    { label: "DR 0–20",   min: 0,  max: 20,  color: RED },
    { label: "DR 21–50",  min: 21, max: 50,  color: AMBER },
    { label: "DR 51–70",  min: 51, max: 70,  color: BLUE },
    { label: "DR 71–100", min: 71, max: 100, color: GREEN },
  ];
  const counts = buckets.map(b => ({
    ...b,
    count: refdomains.filter(d => (d.domain_rating ?? 0) >= b.min && (d.domain_rating ?? 0) <= b.max).length,
  }));
  const total = counts.reduce((s, b) => s + b.count, 0) || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {counts.map((b, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: b.color }}>{b.label}</div>
            <div style={{ fontSize: 10, color: MUTED }}>{b.count.toLocaleString()} ({Math.round((b.count / total) * 100)}%)</div>
          </div>
          <div style={{ height: 8, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${(b.count / total) * 100}%`, height: "100%", background: b.color, borderRadius: 4, transition: "width .5s ease" }} />
          </div>
        </div>
      ))}
      <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>
        Healthy profiles are weighted toward DR 21–70. DR 0–20 should be a minority.
      </div>
    </div>
  );
}

// ── Anchor Category Analysis ──────────────────────────────────────────────────
function categorizeAnchor(anchor, domain) {
  if (!anchor || anchor.trim() === "") return "naked/empty";
  const a = anchor.toLowerCase();
  const d = (domain || "").toLowerCase().replace(/^www\./, "");
  // Naked URL
  if (a.includes(d) || a.startsWith("http")) return "naked URL";
  // Branded (contains domain name keywords — simple heuristic)
  const brandWords = d.split(".")[0].split(/[-_]/);
  if (brandWords.some(w => w.length > 3 && a.includes(w))) return "branded";
  // Generic
  const generic = ["click here", "read more", "learn more", "here", "this", "visit", "link", "website", "page", "source"];
  if (generic.some(g => a.includes(g))) return "generic";
  // Everything else is keyword-rich
  return "keyword-rich";
}

// ── Loading Skeleton ──────────────────────────────────────────────────────────
function Skeleton({ h = 80 }) {
  return (
    <div style={{ height: h, background: "linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)", backgroundSize: "200% 100%", borderRadius: 8, animation: "shimmer 1.4s infinite" }} />
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
const AhrefsReport = forwardRef(function AhrefsReport({ defaultDomain, onFetchComplete, isPortal }, ref) {
  const [domain,   setDomain]   = useState(defaultDomain || "");
  const [loading,  setLoading]  = useState(false);
  const [data,     setData]     = useState(null);
  const [errors,   setErrors]   = useState({});
  const [open,     setOpen]     = useState(false);

  useImperativeHandle(ref, () => ({
    triggerFetch: (targetDomain) => {
      const target = targetDomain || domain;
      if (targetDomain) setDomain(targetDomain);
      fetchAll(target);
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [domain]);

  const fetchAll = async (overrideDomain) => {
    const target = (overrideDomain || domain).trim();
    if (!target) return;
    setLoading(true);
    setData(null);
    setErrors({});

    const safe = async (key, fn) => {
      try { return { [key]: await fn() }; }
      catch (e) { return { [`_err_${key}`]: e.message }; }
    };

    const results = await Promise.all([
      safe("dr",         () => getDomainRating(target)),
      safe("history",    () => getDomainRatingHistory(target)),
      safe("metrics",    () => getMetricsExtended(target)),
      safe("blhistory",  () => getBacklinksHistory(target)),
      safe("refs",       () => getRefdomains(target)),
      safe("anchors",    () => getAnchors(target)),
    ]);

    const merged = Object.assign({}, ...results);
    const errs = {};
    const d = {};
    for (const [k, v] of Object.entries(merged)) {
      if (k.startsWith("_err_")) errs[k.replace("_err_", "")] = v;
      else d[k] = v;
    }
    setData(d);
    setErrors(errs);
    setLoading(false);
    onFetchComplete?.();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const dr      = data?.dr;
  const history = data?.history?.domain_ratings ?? data?.history?.domain_rating_history ?? [];
  const mRaw      = data?.metrics;
  const m         = mRaw?.metrics ?? mRaw ?? null;
  const blHistory = data?.blhistory ?? [];
  const refs      = data?.refs?.refdomains ?? [];
  const anchors   = data?.anchors?.anchors ?? [];

  // Normalise history date labels to "Mon 'YY"
  const historyPoints = history.map(h => ({
    ...h,
    label: new Date(h.date).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
  }));

  // Anchor category breakdown
  const anchorCats = { "branded": 0, "keyword-rich": 0, "naked URL": 0, "generic": 0, "naked/empty": 0 };
  anchors.forEach(a => { const cat = categorizeAnchor(a.anchor, domain); anchorCats[cat] = (anchorCats[cat] || 0) + (a.links_to_target ?? a.backlinks ?? 0); });
  const anchorCatSegments = [
    { label: "Branded",      value: anchorCats["branded"],      color: BLUE },
    { label: "Naked URL",    value: anchorCats["naked URL"],    color: TEAL },
    { label: "Keyword-rich", value: anchorCats["keyword-rich"], color: AMBER },
    { label: "Generic",      value: anchorCats["generic"],      color: PURPLE },
    { label: "Empty/other",  value: anchorCats["naked/empty"],  color: "#9CA3AF" },
  ].filter(s => s.value > 0);

  const handleClear = () => { setData(null); setErrors({}); setDomain(defaultDomain || ""); };

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 10, marginBottom: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* ── Title Bar ── */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", cursor: "pointer", background: "#EFF6FF", borderBottom: open ? `1px solid ${BORDER}` : "none" }}
      >
        <div style={{ width: 20, height: 20, borderRadius: 6, background: BLUE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2 9c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round"/>
            <circle cx="6" cy="4" r="1.5" stroke="#fff" strokeWidth="1.3"/>
          </svg>
        </div>
        <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: BLUE, letterSpacing: 0.5 }}>
          Backlink Intelligence
          {domain    && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: MUTED }}>{domain}</span>}
          {loading   && <span style={{ marginLeft: 6, fontSize: 10, color: MUTED }}>Fetching…</span>}
          {data      && !loading && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: BLUE, background: "#DBEAFE", borderRadius: 4, padding: "1px 6px" }}>Data ✓</span>}
        </div>
        {data && !isPortal && (
          <button onClick={e => { e.stopPropagation(); handleClear(); }}
            style={{ fontSize: 10, color: MUTED, background: "none", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontFamily: "'Inter',sans-serif", marginRight: 6 }}>
            Clear All
          </button>
        )}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform .2s", color: MUTED }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {open && (
      <div style={{ padding: "20px 24px" }}>

      {/* ── Domain Input (admin only) ── */}
      {!isPortal && !data && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
            <span style={{ padding: "0 10px", fontSize: 12, color: MUTED, borderRight: `1px solid ${BORDER}`, lineHeight: "38px" }}>🔗</span>
            <input
              value={domain}
              onChange={e => setDomain(e.target.value)}
              onKeyDown={e => e.key === "Enter" && fetchAll()}
              placeholder="example.com"
              style={{ flex: 1, border: "none", outline: "none", padding: "0 12px", fontSize: 13, color: TEXT, fontFamily: "'Inter',sans-serif", height: 38, background: "transparent" }}
            />
          </div>
          <button
            onClick={() => fetchAll()}
            disabled={loading || !domain.trim()}
            style={{ padding: "0 20px", height: 38, borderRadius: 8, border: "none", background: ACCENT, color: "#fff", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1, flexShrink: 0 }}
          >
            {loading ? "Fetching…" : "Fetch Data"}
          </button>
        </div>
      )}

      {!data && !loading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: MUTED, fontSize: 13 }}>
          {isPortal ? "No backlink data available yet." : "Enter a domain above and click Fetch Data."}
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Skeleton h={60} /><Skeleton h={140} /><Skeleton h={100} /><Skeleton h={120} />
        </div>
      )}

      {data && !loading && (
        <div>
          {/* ── Authority ── */}
          <SectionHeader title="Authority / Domain Strength" color={BLUE} />

          {errors.dr && <ErrBox msg={`Domain Rating: ${errors.dr}`} />}
          {dr && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <StatCard
                label="Domain Rating"
                value={dr.domain_rating ?? "—"}
                sub="/ 100"
                color={drColor(dr.domain_rating ?? 0)}
                bg={dr.domain_rating >= 70 ? "#F0FDF4" : dr.domain_rating >= 40 ? "#FFFBEB" : "#FEF2F2"}
                border={dr.domain_rating >= 70 ? "#BBF7D0" : dr.domain_rating >= 40 ? "#FDE68A" : "#FECACA"}
              />
              <StatCard
                label="Ahrefs Rank"
                value={dr.ahrefs_rank ? `#${fmtNum(dr.ahrefs_rank)}` : "—"}
                sub="global"
                color={TEXT}
              />
              <StatCard label="Domain" value={stripProtocol(domain)} color={TEAL} />
            </div>
          )}

          {errors.history && <ErrBox msg={`DR History: ${errors.history}`} />}

          {/* ── Volume & Growth ── */}
          <SectionHeader title="Volume & Growth" color={GREEN} />

          {errors.metrics && <ErrBox msg={`Metrics: ${errors.metrics}`} />}
          {m && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <StatCard label="Live Backlinks"    value={fmtNum(m.live)}                 sub="active today"  color={BLUE}  />
              <StatCard label="All-time Backlinks" value={fmtNum(m.all_time)}            sub="ever acquired" color={BLUE}  bg="#EFF6FF" border="#BFDBFE" />
              <StatCard label="Live Ref. Domains"  value={fmtNum(m.live_refdomains)}     sub="active today"  color={GREEN} />
              <StatCard label="All-time Ref. Domains" value={fmtNum(m.all_time_refdomains)} sub="ever linked" color={GREEN} bg="#F0FDF4" border="#BBF7D0" />
            </div>
          )}

          {errors.blhistory && <ErrBox msg={`Backlink History: ${errors.blhistory}`} />}
          {blHistory.length > 0 && blHistory.some(p => p.backlinks > 0) && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
              <ChartCard title="Total Backlinks — 12-Month Trend" hint="Monthly backlink count snapshots. Steady growth signals a healthy acquisition pattern.">
                <LineChart data={blHistory} valueKey="backlinks" labelKey="label" color={BLUE} />
              </ChartCard>
              <ChartCard title="Referring Domains — 12-Month Trend" hint="Unique domains linking to you. Growth here is the most meaningful authority signal.">
                <LineChart data={blHistory} valueKey="refdomains" labelKey="label" color={GREEN} />
              </ChartCard>
            </div>
          )}

          {/* ── Referring Domain Quality ── */}
          {refs.length > 0 && (() => {
            const sorted = [...refs].filter(r => (r.domain_rating ?? 0) > 0).sort((a, b) => (b.domain_rating ?? 0) - (a.domain_rating ?? 0));
            const top    = sorted.slice(0, 5).map((r, i) => ({ label: r.domain, value: r.domain_rating ?? 0, color: PALETTE[i] }));
            const bottom = [...sorted].reverse().slice(0, 5).map((r, i) => ({ label: r.domain, value: r.domain_rating ?? 0, color: PALETTE[i] }));
            return (
              <>
                <SectionHeader title="Referring Domain Quality" color={AMBER} />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {historyPoints.length > 0 && (
                    <ChartCard title="Domain Rating — 3-Year Trend" hint="Monthly DR snapshots. A steady upward trend signals healthy link acquisition.">
                      <LineChart data={historyPoints} valueKey="domain_rating" labelKey="label" color={BLUE} tooltipDateKey="date" />
                    </ChartCard>
                  )}
                  <ChartCard title="Referring Domains" hint="Top 5 and bottom 5 referring domains by Domain Rating.">
                    <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Top 5 by DR</div>
                    <DonutChart segments={top} centerLabel="Top" />
                    <div style={{ height: 1, background: BORDER, margin: "12px 0" }} />
                    <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Bottom 5 by DR</div>
                    <DonutChart segments={bottom} centerLabel="Bot" />
                  </ChartCard>
                </div>
              </>
            );
          })()}

          {/* ── Link Quality ── */}
          {refs.length > 0 && (() => {
            const dofollow = refs.reduce((s, r) => s + (r.dofollow_links ?? 0), 0);
            const total    = refs.reduce((s, r) => s + (r.links_to_target ?? 0), 0);
            const nofollow = Math.max(0, total - dofollow);

            const now = Date.now();
            const ageBuckets = [
              { label: "< 1 year",  color: GREEN,  ms: 0,              max: 365 * 864e5 },
              { label: "1–2 years", color: BLUE,   ms: 365 * 864e5,    max: 730 * 864e5 },
              { label: "2–3 years", color: AMBER,  ms: 730 * 864e5,    max: 1095 * 864e5 },
              { label: "3+ years",  color: "#9CA3AF", ms: 1095 * 864e5, max: Infinity },
            ];
            const ageSegments = ageBuckets.map(b => ({
              label: b.label,
              color: b.color,
              value: refs.filter(r => {
                if (!r.first_seen) return false;
                const age = now - new Date(r.first_seen).getTime();
                return age >= b.ms && age < b.max;
              }).length,
            })).filter(s => s.value > 0);

            return (dofollow + nofollow) > 0 ? (
              <>
                <SectionHeader title="Link Quality" color={TEAL} />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <ChartCard title="Dofollow vs. Nofollow Referring Domains" hint="Dofollow domains pass link equity. A healthy profile is majority dofollow.">
                    <DonutChart segments={[
                      { label: "Dofollow", value: dofollow, color: GREEN },
                      { label: "Nofollow", value: nofollow, color: "#9CA3AF" },
                    ]} />
                  </ChartCard>
                  {ageSegments.length > 0 && (
                    <ChartCard title="Link Age Distribution" hint="Fresh links signal active acquisition. An aging profile with no new links may be stagnating.">
                      <DonutChart segments={ageSegments} centerLabel="Age" />
                    </ChartCard>
                  )}
                </div>
              </>
            ) : null;
          })()}


          {/* ── Anchor Text ── */}
          <SectionHeader title="Anchor Text Distribution" color={PURPLE} />

          {errors.anchors && <ErrBox msg={`Anchors: ${errors.anchors}`} />}
          {anchors.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <ChartCard title="Top Anchors by Backlinks" hint="A natural profile has mostly branded + naked URLs, with a minority of exact-match keywords.">
                <DonutChart
                  segments={anchors.slice(0, 8).map((a, i) => ({ label: a.anchor || "(empty)", value: a.links_to_target ?? a.backlinks ?? 0, color: PALETTE[i] }))}
                  centerLabel="Anchors"
                />
              </ChartCard>

              {anchorCatSegments.length > 0 && (
                <ChartCard title="Anchor Type Breakdown" hint="Exact-match keyword anchors above ~5% can trigger Penguin-style signals.">
                  <DonutChart segments={anchorCatSegments} />
                </ChartCard>
              )}
            </div>
          )}

        </div>
      )}
      </div>
      )}
    </div>
  );
});

export default AhrefsReport;
