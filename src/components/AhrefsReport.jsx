import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { ACCENT, BG, BORDER, CARD, MUTED, TEXT } from "../lib/constants";
import {
  getDomainRating, getDomainRatingHistory, getMetricsExtended,
  getBacklinksHistory, getRefdomains, getAnchors, getTopBacklinks,
  getBestByLinks, getBrokenBacklinks,
  getOrganicKeywords, getSerpFeaturesHistory, getOrganicCompetitors,
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

// ── SERP Feature helpers ───────────────────────────────────────────────────────
const SERP_META = {
  featured_snippet:       { label: "Featured Snippet",      icon: "⭐", color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", desc: "Position 0 — highest-value capture opportunity" },
  people_also_ask:        { label: "People Also Ask",       icon: "💬", color: "#0E7490", bg: "#ECFEFF", border: "#A5F3FC", desc: "Question-based content opportunity" },
  image_pack:             { label: "Image Pack",            icon: "🖼",  color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", desc: "Add or optimise images for these queries" },
  video:                  { label: "Videos",                icon: "▶️",  color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", desc: "Video content ranks prominently here" },
  knowledge_panel:        { label: "Knowledge Panel",       icon: "📖", color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE", desc: "Brand/entity authority signal" },
  knowledge_card:         { label: "Knowledge Card",        icon: "🃏", color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE", desc: "Quick-answer card for simple queries" },
  local_pack:             { label: "Local Pack",            icon: "📍", color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", desc: "Local SEO presence opportunity" },
  shopping:               { label: "Shopping",              icon: "🛒", color: "#EA580C", bg: "#FFF7ED", border: "#FED7AA", desc: "Product listing opportunity" },
  sitelinks:              { label: "Sitelinks",             icon: "🔗", color: "#0369A1", bg: "#F0F9FF", border: "#BAE6FD", desc: "Brand SERP dominance" },
  top_stories:            { label: "Top Stories",           icon: "📰", color: "#475569", bg: "#F8FAFC", border: "#CBD5E1", desc: "News / PR content opportunity" },
  twitter:                { label: "X (Twitter)",           icon: "𝕏",  color: "#1E293B", bg: "#F8FAFC", border: "#E2E8F0", desc: "Social presence visible in SERP" },
  x_twitter:              { label: "X (Twitter)",           icon: "𝕏",  color: "#1E293B", bg: "#F8FAFC", border: "#E2E8F0", desc: "Social presence visible in SERP" },
  faq:                    { label: "FAQ",                   icon: "❓", color: "#6D28D9", bg: "#F5F3FF", border: "#DDD6FE", desc: "Structured FAQ schema opportunity" },
  review_snippet:         { label: "Review Snippet",        icon: "🌟", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", desc: "Add review schema markup" },
  ai_overview:            { label: "AI Overview",           icon: "🤖", color: "#F97316", bg: "#FFF7ED", border: "#FED7AA", desc: "Generative AI answer — brand visibility risk/opportunity" },
  ai_overviews:           { label: "AI Overview",           icon: "🤖", color: "#F97316", bg: "#FFF7ED", border: "#FED7AA", desc: "Generative AI answer — brand visibility risk/opportunity" },
  discussions_and_forums: { label: "Discussions & Forums",  icon: "🗣",  color: "#0891B2", bg: "#ECFEFF", border: "#A5F3FC", desc: "Reddit / forum content competes here" },
  discussions_forums:     { label: "Discussions & Forums",  icon: "🗣",  color: "#0891B2", bg: "#ECFEFF", border: "#A5F3FC", desc: "Reddit / forum content competes here" },
  thumbnail:              { label: "Thumbnail",             icon: "🖼",  color: "#B45309", bg: "#FFFBEB", border: "#FDE68A", desc: "Rich result with image thumbnail" },
  video_preview:          { label: "Video Preview",         icon: "🎬", color: "#BE123C", bg: "#FFF1F2", border: "#FECDD3", desc: "Video with inline preview in SERP" },
  recipes:                { label: "Recipes",               icon: "🍽",  color: "#15803D", bg: "#F0FDF4", border: "#BBF7D0", desc: "Structured recipe schema opportunity" },
  jobs_results:           { label: "Jobs",                  icon: "💼", color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE", desc: "Job listing schema opportunity" },
  events:                 { label: "Events",                icon: "📅", color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", desc: "Event schema opportunity" },
  ads_top:                { label: "Paid Ads (top)",        icon: "💰", color: "#9CA3AF", bg: "#F9FAFB", border: "#E5E7EB", desc: "High commercial intent — paid competition" },
  paid_ads:               { label: "Paid Ads",              icon: "💰", color: "#9CA3AF", bg: "#F9FAFB", border: "#E5E7EB", desc: "Paid ads present on this SERP" },
  related_searches:       { label: "Related Searches",      icon: "🔎", color: "#64748B", bg: "#F8FAFC", border: "#E2E8F0", desc: "Related query expansion" },
};

const OPPORTUNITY_FEATURES = ["featured_snippet", "people_also_ask", "faq", "image_pack", "video"];

function normaliseSerpFeatures(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(f => (typeof f === "string" ? f.toLowerCase().replace(/ /g, "_") : String(f)));
  if (typeof raw === "string") return raw.split(",").map(f => f.trim().toLowerCase().replace(/ /g, "_"));
  return [];
}

function exportSerpCSV(keywords, domainName) {
  const header = ["Keyword", "Position", "Volume", "Traffic", "URL", "CPC", "Difficulty", "Intent", "SERP Features"];
  const rows = keywords.map(k => {
    const intent = [k.is_branded && "Branded", k.is_commercial && "Commercial", k.is_transactional && "Transactional", k.is_informational && "Informational"].filter(Boolean).join("|");
    return [
      `"${(k.keyword ?? "").replace(/"/g, '""')}"`,
      k.best_position ?? "",
      k.volume ?? "",
      k.sum_traffic ?? "",
      `"${(k.best_position_url ?? "").replace(/"/g, '""')}"`,
      k.cpc ?? "",
      k.keyword_difficulty ?? "",
      `"${intent}"`,
      `"${normaliseSerpFeatures(k.serp_features).join(", ")}"`,
    ];
  });
  const csv = [header, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `${domainName ?? "keywords"}-serp-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Bubble / Scatter Chart ────────────────────────────────────────────────────
const BUBBLE_COLORS = ["#F59E0B","#EF4444","#8B5CF6","#10B981","#3B82F6","#F97316","#EC4899","#06B6D4","#84CC16","#A78BFA"];

function BubbleChart({ competitors, target }) {
  const [hovered, setHovered] = useState(null); // "t" = target, number = competitor index
  if (!competitors?.length) return null;

  const W = 560, H = 220, PAD = { t: 28, r: 20, b: 36, l: 56 };
  const TARGET_COLOR = "#2563EB";

  const allTraffic = [...competitors.map(c => c.traffic ?? 0), target?.traffic ?? 0];
  const allValue   = [...competitors.map(c => c.value   ?? 0), target?.value   ?? 0];
  const allPages   = [...competitors.map(c => c.pages   ?? 0), target?.pages   ?? 0];

  const maxTraffic = Math.max(...allTraffic, 1);
  const maxValue   = Math.max(...allValue,   1);
  const maxPages   = Math.max(...allPages,   1);
  const MAX_R = 36, MIN_R = 6;

  const toX = v => PAD.l + (v / maxValue)   * (W - PAD.l - PAD.r);
  const toY = v => PAD.t + (1 - v / maxTraffic) * (H - PAD.t - PAD.b);
  const toR = p => MIN_R + Math.sqrt(p / maxPages) * (MAX_R - MIN_R);

  const fmtK = n => n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}K` : `$${n}`;
  const fmtT = n => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(0)}K` : String(n);

  const yTicks = [0, maxTraffic / 2, maxTraffic].map(v => ({ v, y: toY(v) }));
  const xTicks = [0, maxValue / 4, maxValue / 2, (3 * maxValue) / 4, maxValue].map(v => ({ v, x: toX(v) }));

  const renderTooltip = (cx, cy, r, lines) => {
    const TW = Math.max(...lines.map(l => l.length * 5.8)) + 20;
    const TH = lines.length * 14 + 10;
    const tx = Math.min(Math.max(cx - TW / 2, PAD.l), W - PAD.r - TW);
    const ty = Math.max(cy - r - TH - 6, PAD.t);
    return (
      <g pointerEvents="none">
        <rect x={tx} y={ty} width={TW} height={TH} rx="5" fill="#1E293B" opacity="0.93" />
        {lines.map((line, li) => (
          <text key={li} x={tx + 10} y={ty + 14 + li * 14} fontSize="9" fill={li === 0 ? "#fff" : "#CBD5E1"} fontWeight={li === 0 ? "700" : "400"}>{line}</text>
        ))}
      </g>
    );
  };

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
        onMouseLeave={() => setHovered(null)}>
        {/* Grid */}
        {yTicks.map(({ v, y }, i) => (
          <g key={i}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke={BORDER} strokeWidth="0.5" strokeDasharray="3,3" />
            <text x={PAD.l - 5} y={y + 3.5} textAnchor="end" fontSize="7.5" fill={MUTED}>{fmtT(v)}</text>
          </g>
        ))}
        {xTicks.map(({ v, x }, i) => (
          <text key={i} x={x} y={H - PAD.b + 11} textAnchor="middle" fontSize="7.5" fill={MUTED}>{fmtK(v)}</text>
        ))}
        <text x={PAD.l - 40} y={(PAD.t + H - PAD.b) / 2} textAnchor="middle" fontSize="7.5" fill={MUTED}
          transform={`rotate(-90, ${PAD.l - 40}, ${(PAD.t + H - PAD.b) / 2})`}>Organic traffic</text>
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 2} textAnchor="middle" fontSize="7.5" fill={MUTED}>Organic traffic value</text>
        <text x={(PAD.l + W - PAD.r) / 2} y={PAD.t - 10} textAnchor="middle" fontSize="7.5" fill={MUTED} fontStyle="italic">Circle size = Organic pages</text>

        {/* Competitor bubbles */}
        {competitors.map((c, i) => {
          const cx = toX(c.value ?? 0);
          const cy = toY(c.traffic ?? 0);
          const r  = toR(c.pages ?? 0);
          const color = BUBBLE_COLORS[i % BUBBLE_COLORS.length];
          const isHov = hovered === i;
          return (
            <g key={i} style={{ cursor: "pointer" }} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <circle cx={cx} cy={cy} r={r} fill={color} opacity={isHov ? 0.9 : 0.72} stroke={isHov ? color : "none"} strokeWidth="2" />
              {isHov && renderTooltip(cx, cy, r, [c.competitor_domain ?? c.domain, `Traffic: ${fmtT(c.traffic ?? 0)}`, `Value: ${fmtK(c.value ?? 0)}`, `Pages: ${(c.pages ?? 0).toLocaleString()}`])}
            </g>
          );
        })}

        {/* Target bubble — rendered last so it sits on top */}
        {target && (() => {
          const cx = toX(target.value ?? 0);
          const cy = toY(target.traffic ?? 0);
          const r  = toR(target.pages ?? 0);
          const isHov = hovered === "t";
          return (
            <g style={{ cursor: "pointer" }} onMouseEnter={() => setHovered("t")} onMouseLeave={() => setHovered(null)}>
              <circle cx={cx} cy={cy} r={r} fill="#fff" stroke={TARGET_COLOR} strokeWidth="2.5" opacity="1" />
              <circle cx={cx} cy={cy} r={r * 0.45} fill={TARGET_COLOR} opacity="0.9" />
              {isHov && renderTooltip(cx, cy, r, [`${target.domain} (target)`, `Traffic: ${fmtT(target.traffic ?? 0)}`, `Value: ${fmtK(target.value ?? 0)}`, `Pages: ${target.pages.toLocaleString()}`])}
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      {target && (
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8, fontSize: 10, color: MUTED }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="14" height="14" viewBox="0 0 14 14">
              <circle cx="7" cy="7" r="6" fill="#fff" stroke={TARGET_COLOR} strokeWidth="2" />
              <circle cx="7" cy="7" r="2.5" fill={TARGET_COLOR} />
            </svg>
            <strong style={{ color: TEXT }}>{target.domain}</strong> — target
          </span>
        </div>
      )}
    </div>
  );
}

// ── Multi-Line Chart ──────────────────────────────────────────────────────────
function MultiLineChart({ data, series }) {
  // data: [{ label, date, features: { feat: N } }]
  // series: [{ key, label, color, active }]
  const [hovered, setHovered] = useState(null);
  const activeSeries = series.filter(s => s.active);
  if (!data?.length || !activeSeries.length) return <div style={{ fontSize: 11, color: MUTED, padding: "20px 0", textAlign: "center" }}>Select at least one feature above.</div>;

  const W = 520, H = 180, PAD = { t: 12, r: 16, b: 28, l: 44 };
  const allVals = activeSeries.flatMap(s => data.map(d => d.features?.[s.key] ?? 0));
  const maxVal  = Math.max(...allVals, 1);
  const toX = i => PAD.l + (i / (data.length - 1)) * (W - PAD.l - PAD.r);
  const toY = v => PAD.t + (1 - v / maxVal) * (H - PAD.t - PAD.b);
  const yTicks = [0, maxVal / 2, maxVal].map(v => ({ v: Math.round(v), y: toY(v) }));
  const xTicks = [0, 2, 5, 8, 11].filter(i => i < data.length);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
      onMouseLeave={() => setHovered(null)}>
      <defs>
        {activeSeries.map(s => (
          <linearGradient key={s.key} id={`mlg-${s.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.12" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>

      {/* Grid */}
      {yTicks.map(({ y, v }, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke={BORDER} strokeWidth="0.5" strokeDasharray="3,3" />
          <text x={PAD.l - 4} y={y + 3.5} textAnchor="end" fontSize="7" fill={MUTED}>{v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}</text>
        </g>
      ))}

      {/* Area fills */}
      {activeSeries.map(s => {
        const area = `M${toX(0)},${H - PAD.b} ` +
          data.map((d, i) => `L${toX(i)},${toY(d.features?.[s.key] ?? 0)}`).join(" ") +
          ` L${toX(data.length - 1)},${H - PAD.b} Z`;
        return <path key={s.key} d={area} fill={`url(#mlg-${s.key})`} />;
      })}

      {/* Lines */}
      {activeSeries.map(s => {
        const pts = data.map((d, i) => `${toX(i)},${toY(d.features?.[s.key] ?? 0)}`).join(" ");
        return <polyline key={s.key} points={pts} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />;
      })}

      {/* Hover zones */}
      {data.map((_, i) => (
        <rect key={i} x={i === 0 ? 0 : (toX(i - 1) + toX(i)) / 2} y={PAD.t}
          width={i === 0 ? (toX(1) - toX(0)) / 2 : i === data.length - 1 ? (toX(i) - toX(i - 1)) / 2 + PAD.r : (toX(i + 1) - toX(i - 1)) / 2}
          height={H - PAD.t - PAD.b}
          fill="transparent" style={{ cursor: "crosshair" }}
          onMouseEnter={() => setHovered(i)} />
      ))}

      {/* Hover overlay */}
      {hovered !== null && (() => {
        const cx = toX(hovered);
        const d  = data[hovered];
        const lines = [d.label, ...activeSeries.map(s => `${s.label}: ${(d.features?.[s.key] ?? 0).toLocaleString()}`)];
        const TW = Math.max(...lines.map(l => l.length * 5.8)) + 20;
        const TH = lines.length * 14 + 10;
        const tx = Math.min(Math.max(cx - TW / 2, PAD.l), W - PAD.r - TW);
        const ty = PAD.t;
        return (
          <g>
            <line x1={cx} y1={PAD.t} x2={cx} y2={H - PAD.b} stroke={MUTED} strokeWidth="1" strokeDasharray="4,3" pointerEvents="none" />
            {activeSeries.map(s => (
              <circle key={s.key} cx={cx} cy={toY(d.features?.[s.key] ?? 0)} r="3.5" fill={s.color} stroke="#fff" strokeWidth="1.5" pointerEvents="none" />
            ))}
            <g pointerEvents="none">
              <rect x={tx} y={ty} width={TW} height={TH} rx="5" fill="#1E293B" opacity="0.93" />
              {lines.map((line, li) => (
                <text key={li} x={tx + 10} y={ty + 14 + li * 14} fontSize="9" fill={li === 0 ? "#fff" : (activeSeries[li - 1]?.color ?? "#fff")} fontWeight={li === 0 ? "700" : "600"}>{line}</text>
              ))}
            </g>
          </g>
        );
      })()}

      {/* X labels */}
      {xTicks.map(i => (
        <text key={i} x={toX(i)} y={H - PAD.b + 11} textAnchor="middle" fontSize="7" fill={MUTED}>{data[i]?.label}</text>
      ))}
    </svg>
  );
}

// ── Loading Skeleton ──────────────────────────────────────────────────────────
function Skeleton({ h = 80 }) {
  return (
    <div style={{ height: h, background: "linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)", backgroundSize: "200% 100%", borderRadius: 8, animation: "shimmer 1.4s infinite" }} />
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
const AhrefsReport = forwardRef(function AhrefsReport({ defaultDomain, onFetchComplete, onSave, savedData, isPortal }, ref) {
  const [domain,         setDomain]         = useState(savedData?.domain || defaultDomain || "");
  const [loading,        setLoading]        = useState(false);
  const [data,           setData]           = useState(savedData?.data   || null);
  const [errors,         setErrors]         = useState(savedData?.errors || {});
  const [open,           setOpen]           = useState(false);
  const [activeFeatures, setActiveFeatures] = useState(new Set(["featured_snippet", "ai_overview", "sitelinks"]));
  const [showAllBL,      setShowAllBL]      = useState(false);
  const [showAllBP,      setShowAllBP]      = useState(false);
  const [showAllBroken,  setShowAllBroken]  = useState(false);
  const onSaveRef = useRef(onSave);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

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
      safe("backlinks",  () => getTopBacklinks(target)),
      safe("bestpages",  () => getBestByLinks(target)),
      safe("broken",     () => getBrokenBacklinks(target)),
      safe("serp",        () => getOrganicKeywords(target)),
      safe("serptrend",   () => getSerpFeaturesHistory(target)),
      safe("competitors", () => getOrganicCompetitors(target)),
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
    onSaveRef.current?.({ data: d, errors: errs, domain: target, fetchedAt: new Date().toISOString() });
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

  const handleClear = () => { setData(null); setErrors({}); setDomain(defaultDomain || ""); onSaveRef.current?.(null); };

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
          <div style={{ display: "flex", gap: 6, marginRight: 6 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => fetchAll(domain)}
              style={{ fontSize: 10, color: BLUE, background: "none", border: `1px solid #BFDBFE`, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
              Refresh
            </button>
            <button onClick={handleClear}
              style={{ fontSize: 10, color: MUTED, background: "none", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
              Clear All
            </button>
          </div>
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

          {/* ── Top Backlinks ── */}
          {(() => {
            const backlinks = data?.backlinks?.backlinks ?? data?.backlinks?.all_backlinks ?? [];
            if (errors.backlinks && !backlinks.length) return <ErrBox msg={`Backlinks: ${errors.backlinks}`} />;
            if (!backlinks.length) return null;
            const dofollow = backlinks.filter(b => b.is_dofollow).length;
            return (
              <>
                <SectionHeader title="Top Backlinks" color={BLUE} />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                  <StatCard label="Total Fetched"  value={backlinks.length.toLocaleString()} />
                  <StatCard label="Dofollow"        value={dofollow.toLocaleString()}          color={GREEN} bg="#F0FDF4" border="#BBF7D0" />
                  <StatCard label="Nofollow"        value={(backlinks.length - dofollow).toLocaleString()} color={MUTED} />
                </div>
                <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead style={{ background: BG }}>
                      <tr>
                        {["Source Domain","DR","Anchor","Target URL","Type"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: 9, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllBL ? backlinks : backlinks.slice(0, 20)).map((b, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 ? BG : "transparent" }}>
                          <td style={{ padding: "6px 10px", fontWeight: 600, color: TEXT, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={b.url_from}>{b.name_source ?? b.url_from}</td>
                          <td style={{ padding: "6px 10px", fontWeight: 700, color: drColor(b.domain_rating_source ?? 0) }}>{b.domain_rating_source ?? "—"}</td>
                          <td style={{ padding: "6px 10px", color: MUTED, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={b.anchor}>{b.anchor || "(empty)"}</td>
                          <td style={{ padding: "6px 10px", color: BLUE, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={b.url_to}>{b.url_to?.replace(/^https?:\/\/[^/]+/, "") || "/"}</td>
                          <td style={{ padding: "6px 10px" }}>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: b.is_dofollow ? "#F0FDF4" : "#F9FAFB", color: b.is_dofollow ? GREEN : MUTED, border: `1px solid ${b.is_dofollow ? "#BBF7D0" : BORDER}` }}>
                              {b.is_dofollow ? "dofollow" : "nofollow"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {backlinks.length > 20 && (
                    <div style={{ padding: "8px 12px", background: BG, borderTop: `1px solid ${BORDER}`, textAlign: "center" }}>
                      <button onClick={() => setShowAllBL(v => !v)} style={{ fontSize: 11, color: BLUE, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                        {showAllBL ? "Show less" : `Show all ${backlinks.length.toLocaleString()} backlinks`}
                      </button>
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          {/* ── Best Pages by Links ── */}
          {(() => {
            const pages = data?.bestpages?.pages ?? data?.bestpages?.best_by_links ?? [];
            if (errors.bestpages && !pages.length) return <ErrBox msg={`Best pages: ${errors.bestpages}`} />;
            if (!pages.length) return null;
            const maxRefs = Math.max(...pages.map(p => p.refdomains_target ?? 0), 1);
            return (
              <>
                <SectionHeader title="Best Pages by Referring Domains" color={GREEN} />
                <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead style={{ background: BG }}>
                      <tr>
                        {["Page","Ref. Domains","Backlinks"].map(h => (
                          <th key={h} style={{ textAlign: h === "Page" ? "left" : "right", padding: "8px 10px", fontSize: 9, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllBP ? pages : pages.slice(0, 20)).map((p, i) => {
                        const slug = p.url_to?.replace(/^https?:\/\/[^/]+/, "") || "/";
                        const barPct = Math.round(((p.refdomains_target ?? 0) / maxRefs) * 100);
                        return (
                          <tr key={i} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 ? BG : "transparent" }}>
                            <td style={{ padding: "6px 10px", maxWidth: 380 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: BLUE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.url_to}>{slug}</div>
                              {p.title_target && <div style={{ fontSize: 10, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title_target}</div>}
                            </td>
                            <td style={{ padding: "6px 10px", textAlign: "right" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                                <div style={{ width: 60, height: 5, background: "#F1F5F9", borderRadius: 3, overflow: "hidden" }}>
                                  <div style={{ width: `${barPct}%`, height: "100%", background: GREEN, borderRadius: 3 }} />
                                </div>
                                <span style={{ fontWeight: 700, color: GREEN, minWidth: 28, textAlign: "right" }}>{(p.refdomains_target ?? 0).toLocaleString()}</span>
                              </div>
                            </td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: MUTED }}>{(p.links_to_target ?? 0).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {pages.length > 20 && (
                    <div style={{ padding: "8px 12px", background: BG, borderTop: `1px solid ${BORDER}`, textAlign: "center" }}>
                      <button onClick={() => setShowAllBP(v => !v)} style={{ fontSize: 11, color: BLUE, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                        {showAllBP ? "Show less" : `Show all ${pages.length.toLocaleString()} pages`}
                      </button>
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          {/* ── Broken Backlinks ── */}
          {(() => {
            const broken = data?.broken?.backlinks ?? data?.broken?.broken_backlinks ?? [];
            if (errors.broken && !broken.length) return <ErrBox msg={`Broken backlinks: ${errors.broken}`} />;
            if (!broken.length) return null;
            return (
              <>
                <SectionHeader title={`Broken Backlinks (${broken.length.toLocaleString()})`} color={RED} />
                <div style={{ fontSize: 11, color: MUTED, marginBottom: 10 }}>
                  External sites linking to pages that return 404 on this domain. Each is a lost link equity opportunity — reclaim with 301 redirects.
                </div>
                <div style={{ border: `1px solid #FCA5A5`, borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead style={{ background: "#FEF2F2" }}>
                      <tr>
                        {["Source Domain","DR","Anchor","Broken URL"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: 9, fontWeight: 700, color: RED, textTransform: "uppercase", letterSpacing: 0.6, borderBottom: `1px solid #FCA5A5` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllBroken ? broken : broken.slice(0, 20)).map((b, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid #FEE2E2`, background: i % 2 ? "#FFF5F5" : "transparent" }}>
                          <td style={{ padding: "6px 10px", fontWeight: 600, color: TEXT, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={b.url_from}>{b.name_source ?? b.url_from}</td>
                          <td style={{ padding: "6px 10px", fontWeight: 700, color: drColor(b.domain_rating_source ?? 0) }}>{b.domain_rating_source ?? "—"}</td>
                          <td style={{ padding: "6px 10px", color: MUTED, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.anchor || "(empty)"}</td>
                          <td style={{ padding: "6px 10px", color: RED, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={b.url_to}>{b.url_to?.replace(/^https?:\/\/[^/]+/, "") || "/"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {broken.length > 20 && (
                    <div style={{ padding: "8px 12px", background: "#FEF2F2", borderTop: `1px solid #FCA5A5`, textAlign: "center" }}>
                      <button onClick={() => setShowAllBroken(v => !v)} style={{ fontSize: 11, color: RED, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                        {showAllBroken ? "Show less" : `Show all ${broken.length.toLocaleString()} broken backlinks`}
                      </button>
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          {/* ── SERP Intelligence ── */}
          {(() => {
            const keywords = data?.serp?.keywords ?? data?.serp?.organic_keywords ?? [];
            if (errors.serp && !keywords.length) return <ErrBox msg={`SERP data: ${errors.serp}`} />;
            if (!keywords.length) return null;

            const totalKw     = keywords.length;
            const totalTraffic = keywords.reduce((s, k) => s + (k.sum_traffic ?? 0), 0);
            const avgPos      = Math.round(keywords.reduce((s, k) => s + (k.best_position ?? 0), 0) / totalKw);

            // ── Position buckets ──────────────────────────────────────────────
            const POS_BUCKETS = [
              { label: "Top 3",   min: 1,  max: 3,  color: GREEN,  bg: "#F0FDF4", border: "#BBF7D0" },
              { label: "4–10",    min: 4,  max: 10, color: BLUE,   bg: "#EFF6FF", border: "#BFDBFE" },
              { label: "11–20",   min: 11, max: 20, color: AMBER,  bg: "#FFFBEB", border: "#FDE68A" },
              { label: "21–50",   min: 21, max: 50, color: PURPLE, bg: "#F5F3FF", border: "#DDD6FE" },
              { label: "51+",     min: 51, max: 999,color: "#9CA3AF", bg: "#F9FAFB", border: "#E5E7EB" },
            ];
            const posBuckets = POS_BUCKETS.map(b => ({
              ...b,
              count:   keywords.filter(k => k.best_position >= b.min && k.best_position <= b.max).length,
              traffic: keywords.filter(k => k.best_position >= b.min && k.best_position <= b.max).reduce((s, k) => s + (k.sum_traffic ?? 0), 0),
            }));
            const maxBucketCount = Math.max(...posBuckets.map(b => b.count), 1);

            // ── Intent breakdown ──────────────────────────────────────────────
            const INTENTS = [
              { key: "branded",       label: "Branded",       flag: k => k.is_branded,       color: BLUE   },
              { key: "informational", label: "Informational", flag: k => k.is_informational, color: TEAL   },
              { key: "commercial",    label: "Commercial",    flag: k => k.is_commercial,    color: AMBER  },
              { key: "transactional", label: "Transactional", flag: k => k.is_transactional, color: GREEN  },
              { key: "navigational",  label: "Navigational",  flag: k => k.is_navigational,  color: PURPLE },
              { key: "local",         label: "Local",         flag: k => k.is_local,         color: RED    },
            ];
            const intentRows = INTENTS.map(intent => {
              const kws = keywords.filter(intent.flag);
              return { ...intent, count: kws.length, traffic: kws.reduce((s, k) => s + (k.sum_traffic ?? 0), 0) };
            }).filter(r => r.count > 0).sort((a, b) => b.traffic - a.traffic);

            // ── SERP feature map ──────────────────────────────────────────────
            const featureCount   = {};
            const featureTraffic = {};
            const ownedFeatures  = new Set(); // features where best_position_kind === feature
            keywords.forEach(kw => {
              const features = normaliseSerpFeatures(kw.serp_features);
              features.forEach(f => {
                featureCount[f]   = (featureCount[f] || 0) + 1;
                featureTraffic[f] = (featureTraffic[f] || 0) + (kw.sum_traffic ?? 0);
              });
              if (kw.best_position_kind && kw.best_position_kind !== "organic") {
                ownedFeatures.add(kw.best_position_kind.toLowerCase().replace(/ /g, "_"));
              }
            });
            const sovRows = Object.entries(featureCount)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([feat, count]) => {
                const meta = SERP_META[feat] ?? { label: feat.replace(/_/g, " "), icon: "🔎", color: MUTED, bg: "#F7F8FA", border: BORDER, desc: "" };
                const owned = ownedFeatures.has(feat);
                return { feat, meta, count, pct: Math.round((count / totalKw) * 100), traffic: featureTraffic[feat] ?? 0, owned };
              });

            // ── Opportunity keywords ──────────────────────────────────────────
            const oppKeywords = keywords
              .filter(kw => normaliseSerpFeatures(kw.serp_features).some(f => OPPORTUNITY_FEATURES.includes(f)))
              .slice(0, 15);

            // ── Top pages ─────────────────────────────────────────────────────
            const pageMap = {};
            keywords.forEach(kw => {
              const url = kw.best_position_url ?? "";
              if (!url) return;
              if (!pageMap[url]) pageMap[url] = { url, traffic: 0, keywords: 0 };
              pageMap[url].traffic  += kw.sum_traffic ?? 0;
              pageMap[url].keywords += 1;
            });
            const topPages = Object.values(pageMap).sort((a, b) => b.traffic - a.traffic).slice(0, 10);

            // ── Top keywords ──────────────────────────────────────────────────
            const topKeywords = [...keywords].slice(0, 15);

            return (
              <>
                <SectionHeader title="Organic Search Intelligence" color={PURPLE} />

                {/* ── Summary stats ── */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
                  <StatCard label="Keywords"       value={fmtNum(totalKw)}      sub="tracked"          color={TEXT}   />
                  <StatCard label="Organic Traffic" value={fmtNum(totalTraffic)} sub="est. monthly"     color={GREEN}  bg="#F0FDF4" border="#BBF7D0" />
                  <StatCard label="Avg. Position"  value={avgPos}               sub="across all kw"    color={BLUE}   bg="#EFF6FF" border="#BFDBFE" />
                  <StatCard label="Top 3 Keywords" value={posBuckets[0].count}  sub={fmtNum(posBuckets[0].traffic)+" visits"} color={GREEN} bg="#F0FDF4" border="#BBF7D0" />
                  <StatCard label="Top 10 Keywords" value={posBuckets[0].count + posBuckets[1].count} sub="positions 1–10" color={BLUE} bg="#EFF6FF" border="#BFDBFE" />
                </div>

                {/* ── Position distribution ── */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, marginBottom: 8 }}>Position Distribution</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    {posBuckets.map(b => (
                      <div key={b.label} style={{ flex: "1 1 80px", background: b.bg, border: `1.5px solid ${b.border}`, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: b.color, lineHeight: 1 }}>{b.count.toLocaleString()}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: b.color, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 3 }}>{b.label}</div>
                        <div style={{ fontSize: 9, color: MUTED, marginTop: 2 }}>{fmtNum(b.traffic)} visits</div>
                      </div>
                    ))}
                  </div>
                  {/* Stacked position bar */}
                  <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", gap: 1 }}>
                    {posBuckets.filter(b => b.count > 0).map(b => (
                      <div key={b.label} title={`${b.label}: ${b.count} keywords`}
                        style={{ flex: b.count, background: b.color, transition: "flex .4s ease" }} />
                    ))}
                  </div>
                </div>

                {/* ── Intent + SERP Features side by side ── */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>

                  {/* Intent table */}
                  {intentRows.length > 0 && (
                    <ChartCard title="Keywords by Intent" hint="How users intend to use the queries your site ranks for.">
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead>
                          <tr>
                            {["Intent","Keywords","Traffic","Share"].map(h => (
                              <th key={h} style={{ textAlign: h === "Intent" ? "left" : "right", padding: "0 0 8px", fontSize: 9, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {intentRows.map((r, i) => {
                            const sharePct = totalTraffic > 0 ? Math.round((r.traffic / totalTraffic) * 100) : 0;
                            return (
                              <tr key={r.key} style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
                                <td style={{ padding: "7px 0", display: "flex", alignItems: "center", gap: 6 }}>
                                  <div style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                                  <span style={{ fontWeight: 600, color: TEXT }}>{r.label}</span>
                                </td>
                                <td style={{ textAlign: "right", fontWeight: 700, color: r.color, padding: "7px 0" }}>{r.count.toLocaleString()}</td>
                                <td style={{ textAlign: "right", color: MUTED, padding: "7px 0" }}>{fmtNum(r.traffic)}</td>
                                <td style={{ textAlign: "right", padding: "7px 0", paddingLeft: 8 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                                    <div style={{ width: 36, height: 4, background: "#F1F5F9", borderRadius: 2, overflow: "hidden" }}>
                                      <div style={{ width: `${sharePct}%`, height: "100%", background: r.color, borderRadius: 2 }} />
                                    </div>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: r.color, minWidth: 28 }}>{sharePct}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </ChartCard>
                  )}

                  {/* SERP feature SOV */}
                  {sovRows.length > 0 && (
                    <ChartCard title="SERP Feature Share of Voice" hint="% of ranking keywords where each feature appears. 'Owned' = you hold that feature position.">
                      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                        {sovRows.map(({ feat, meta, count, pct, owned }) => (
                          <div key={feat}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                              <span style={{ fontSize: 12 }}>{meta.icon}</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: TEXT, flex: 1 }}>{meta.label}</span>
                              {owned && <span style={{ fontSize: 8, fontWeight: 800, color: GREEN, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 3, padding: "1px 4px" }}>OWNED</span>}
                              <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, minWidth: 30, textAlign: "right" }}>{pct}%</span>
                              <span style={{ fontSize: 9, color: MUTED, minWidth: 40, textAlign: "right" }}>{count.toLocaleString()} kw</span>
                            </div>
                            <div style={{ height: 5, background: "#F1F5F9", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: meta.color, borderRadius: 3, transition: "width .4s ease" }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </ChartCard>
                  )}
                </div>

                {/* ── SERP Feature Trend — full width ── */}
                {(() => {
                  const trend = data?.serptrend ?? [];
                  if (!trend.length) return null;

                  const allFeaturesInTrend = new Set();
                  trend.forEach(month => Object.keys(month.features ?? {}).forEach(f => allFeaturesInTrend.add(f)));

                  // Deduplicate aliases (ai_overview / ai_overviews, twitter / x_twitter, etc.)
                  const labelForKey = k => SERP_META[k]?.label ?? k;
                  const activeLabels = new Set([...activeFeatures].map(labelForKey));
                  const seen = new Set();
                  const trendSeries = [...allFeaturesInTrend]
                    .filter(f => {
                      if (!SERP_META[f]) return false;
                      const label = SERP_META[f].label;
                      if (seen.has(label)) return false;
                      seen.add(label);
                      return true;
                    })
                    .map(f => ({
                      key:    f,
                      label:  SERP_META[f].label,
                      color:  SERP_META[f].color,
                      icon:   SERP_META[f].icon,
                      bg:     SERP_META[f].bg,
                      border: SERP_META[f].border,
                      active: activeLabels.has(SERP_META[f].label),
                      total:  trend.reduce((s, m) => s + (m.features[f] ?? 0), 0),
                    }))
                    .sort((a, b) => b.total - a.total);

                  const toggleFeature = key => setActiveFeatures(prev => {
                    const next = new Set(prev);
                    const label = labelForKey(key);
                    const isOn = [...prev].some(k => labelForKey(k) === label);
                    if (isOn) {
                      [...next].forEach(k => { if (labelForKey(k) === label) next.delete(k); });
                    } else {
                      next.add(key);
                    }
                    return next;
                  });

                  return (
                    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 18px", marginBottom: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, marginBottom: 2 }}>SERP Feature Visibility — 12-Month Trend</div>
                      <div style={{ fontSize: 10, color: MUTED, marginBottom: 14 }}>Approximated from top 1,000 organic keywords by traffic per month — not Ahrefs' pre-aggregated domain-level data. Features like Sitelinks may appear in Share of Voice but not here. Click to toggle.</div>

                      {/* Toggle pills */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
                        {trendSeries.map(s => {
                          const isOn = activeFeatures.has(s.key);
                          return (
                            <button key={s.key} onClick={() => toggleFeature(s.key)}
                              style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 11px", border: `1.5px solid ${isOn ? s.color : BORDER}`, borderRadius: 6, background: isOn ? s.bg : "#fff", cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all .15s" }}>
                              <div style={{ width: 10, height: 10, borderRadius: 2, background: isOn ? s.color : "#D1D5DB", flexShrink: 0, transition: "background .15s" }} />
                              <span style={{ fontSize: 11, fontWeight: 600, color: isOn ? s.color : MUTED, whiteSpace: "nowrap" }}>{s.icon} {s.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      <MultiLineChart data={trend} series={trendSeries} />
                    </div>
                  );
                })()}

                {/* ── Opportunity keywords ── */}
                {oppKeywords.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Content Opportunity Keywords</div>
                    <div style={{ fontSize: 10, color: MUTED, marginBottom: 10 }}>Queries triggering Featured Snippet, PAA, FAQ, Image Pack or Video — high-value targets for new or refreshed content.</div>
                    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead style={{ background: BG }}>
                          <tr>
                            {["Keyword","Pos","Volume","Traffic","Features"].map(h => (
                              <th key={h} style={{ textAlign: h === "Keyword" ? "left" : "right", padding: "8px 12px", fontSize: 9, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {oppKeywords.map((kw, i) => {
                            const feats = normaliseSerpFeatures(kw.serp_features).filter(f => OPPORTUNITY_FEATURES.includes(f));
                            const posColor = kw.best_position <= 3 ? GREEN : kw.best_position <= 10 ? BLUE : kw.best_position <= 20 ? AMBER : MUTED;
                            return (
                              <tr key={i} style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : "none", background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                                <td style={{ padding: "8px 12px", fontWeight: 600, color: TEXT, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{kw.keyword}</td>
                                <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, color: posColor }}>#{kw.best_position}</td>
                                <td style={{ padding: "8px 12px", textAlign: "right", color: MUTED }}>{fmtNum(kw.volume)}</td>
                                <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: GREEN }}>{fmtNum(kw.sum_traffic)}</td>
                                <td style={{ padding: "8px 12px", textAlign: "right" }}>
                                  <div style={{ display: "flex", gap: 3, justifyContent: "flex-end", flexWrap: "wrap" }}>
                                    {feats.map(f => {
                                      const meta = SERP_META[f] ?? { icon: "🔎", color: MUTED, bg: "#F7F8FA", border: BORDER };
                                      return <span key={f} title={meta.label ?? f} style={{ fontSize: 13 }}>{meta.icon}</span>;
                                    })}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── Top keywords ── */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, marginBottom: 10 }}>Top Organic Keywords</div>
                  <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead style={{ background: BG }}>
                        <tr>
                          {["Keyword","Pos","Vol","Traffic","KD","Intent"].map(h => (
                            <th key={h} style={{ textAlign: h === "Keyword" ? "left" : "right", padding: "8px 12px", fontSize: 9, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {topKeywords.map((kw, i) => {
                          const posColor = kw.best_position <= 3 ? GREEN : kw.best_position <= 10 ? BLUE : kw.best_position <= 20 ? AMBER : MUTED;
                          const kd = kw.keyword_difficulty ?? null;
                          const kdColor = kd == null ? MUTED : kd >= 70 ? RED : kd >= 40 ? AMBER : GREEN;
                          const intent = kw.is_branded ? "B" : kw.is_transactional ? "T" : kw.is_commercial ? "C" : kw.is_informational ? "I" : kw.is_navigational ? "N" : "—";
                          const intentColor = { B: BLUE, T: GREEN, C: AMBER, I: TEAL, N: PURPLE, "—": MUTED }[intent];
                          return (
                            <tr key={i} style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : "none", background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                              <td style={{ padding: "8px 12px", fontWeight: 600, color: TEXT, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{kw.keyword}</td>
                              <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, color: posColor }}>#{kw.best_position}</td>
                              <td style={{ padding: "8px 12px", textAlign: "right", color: MUTED }}>{fmtNum(kw.volume)}</td>
                              <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: GREEN }}>{fmtNum(kw.sum_traffic)}</td>
                              <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: kdColor }}>{kd ?? "—"}</td>
                              <td style={{ padding: "8px 12px", textAlign: "right" }}>
                                <span style={{ fontSize: 10, fontWeight: 800, color: intentColor, background: "#F7F8FA", border: `1px solid ${BORDER}`, borderRadius: 3, padding: "1px 5px" }}>{intent}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize: 9, color: MUTED, marginTop: 4 }}>Intent: B=Branded · I=Informational · C=Commercial · T=Transactional · N=Navigational</div>
                </div>

                {/* ── Top pages ── */}
                {topPages.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, marginBottom: 10 }}>Top Organic Pages by Traffic</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {topPages.map((p, i) => {
                        const pct = totalTraffic > 0 ? (p.traffic / totalTraffic) * 100 : 0;
                        const slug = p.url.replace(/^https?:\/\/[^/]+/, "") || "/";
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 20, fontSize: 10, fontWeight: 700, color: MUTED, textAlign: "right", flexShrink: 0 }}>{i + 1}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: BLUE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }} title={p.url}>{slug}</div>
                              <div style={{ height: 5, background: "#F1F5F9", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ width: `${pct}%`, height: "100%", background: BLUE, borderRadius: 3 }} />
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: GREEN }}>{fmtNum(p.traffic)}</div>
                              <div style={{ fontSize: 9, color: MUTED }}>{p.keywords} kw</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Top Organic Competitors ── */}
                {errors.competitors && <ErrBox msg={`Competitors: ${errors.competitors}`} />}
                {(() => {
                  const raw = data?.competitors;
                  const comps = raw?.competitors ?? (Array.isArray(raw) ? raw : []);
                  if (!Array.isArray(comps) || !comps.length) return null;
                  const maxCommon = Math.max(...comps.map(c => c.keywords_common ?? 0), 1);
                  const fmtN = n => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(0)}K` : String(n ?? 0);
                  const serpKws = keywords;
                  const targetTraffic = serpKws.reduce((s, k) => s + (k.sum_traffic ?? 0), 0);
                  const targetValue   = serpKws.reduce((s, k) => s + Math.round((k.cpc ?? 0) * (k.sum_traffic ?? 0)), 0);
                  const targetPages   = new Set(serpKws.map(k => k.best_position_url).filter(Boolean)).size;
                  const targetBubble  = { domain, traffic: targetTraffic, value: targetValue, pages: targetPages };
                  return (
                    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 18px", marginBottom: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 2 }}>Top Organic Competitors</div>
                      <div style={{ fontSize: 11, color: MUTED, marginBottom: 16 }}>Domains competing for the same organic keywords. Circle size = organic pages.</div>

                      <BubbleChart competitors={comps} target={targetBubble} />

                      {/* Table */}
                      <div style={{ marginTop: 20, overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                          <thead>
                            <tr style={{ borderBottom: `1.5px solid ${BORDER}` }}>
                              <th style={{ textAlign: "left",  padding: "5px 8px", fontWeight: 700, color: MUTED, fontSize: 10 }}>Domain</th>
                              <th style={{ textAlign: "right", padding: "5px 8px", fontWeight: 700, color: MUTED, fontSize: 10 }}>DR</th>
                              <th style={{ textAlign: "center", padding: "5px 8px", fontWeight: 700, color: MUTED, fontSize: 10 }}>Keyword overlap</th>
                              <th style={{ textAlign: "right", padding: "5px 8px", fontWeight: 700, color: MUTED, fontSize: 10 }}>Common KWs</th>
                              <th style={{ textAlign: "right", padding: "5px 8px", fontWeight: 700, color: MUTED, fontSize: 10 }}>Share</th>
                              <th style={{ textAlign: "right", padding: "5px 8px", fontWeight: 700, color: MUTED, fontSize: 10 }}>Competitor KWs</th>
                              <th style={{ textAlign: "right", padding: "5px 8px", fontWeight: 700, color: MUTED, fontSize: 10 }}>Traffic</th>
                            </tr>
                          </thead>
                          <tbody>
                            {comps.slice(0, 15).map((c, i) => {
                              const color   = BUBBLE_COLORS[i % BUBBLE_COLORS.length];
                              const overlap = c.keywords_common ?? 0;
                              const share   = c.share != null ? `${(c.share * 100).toFixed(1)}%` : `${((overlap / maxCommon) * 100).toFixed(1)}%`;
                              const barW    = Math.round((overlap / maxCommon) * 80);
                              return (
                                <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
                                  <td style={{ padding: "6px 8px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
                                      <span style={{ fontWeight: 600, color: TEXT }}>{c.competitor_domain}</span>
                                    </div>
                                  </td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: MUTED }}>{c.domain_rating ?? "—"}</td>
                                  <td style={{ padding: "6px 8px" }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                                      <div style={{ height: 7, borderRadius: 3, background: color, width: barW, minWidth: 2 }} />
                                      <div style={{ height: 7, borderRadius: 3, background: "#E2E8F0", width: 80 - barW }} />
                                    </div>
                                  </td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: TEXT }}>{overlap.toLocaleString()}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: MUTED }}>{share}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: MUTED }}>{fmtN(c.keywords_competitor)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: MUTED }}>{fmtN(c.traffic)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Export ── */}
                {!isPortal && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#F8FAFC", border: `1px solid ${BORDER}`, borderRadius: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>Reporting Export</div>
                      <div style={{ fontSize: 11, color: MUTED }}>Download all {totalKw.toLocaleString()} keywords with positions, intent, difficulty and SERP features as CSV for Google Sheets or executive reporting.</div>
                    </div>
                    <button onClick={() => exportSerpCSV(keywords, domain)}
                      style={{ padding: "8px 16px", borderRadius: 7, border: `1.5px solid ${ACCENT}`, background: "#fff", color: ACCENT, fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                      ↓ Export CSV
                    </button>
                  </div>
                )}
              </>
            );
          })()}

        </div>
      )}
      </div>
      )}
    </div>
  );
});

export default AhrefsReport;
