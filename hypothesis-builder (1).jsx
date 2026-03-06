import { useState, useRef } from "react";

const TEST_TYPES = ["A/B", "A/B/n", "Multivariate", "Split URL", "Redirect"];
const METRICS = [
  "Form submissions", "RFI completions", "CTA clicks", "Scroll depth",
  "Time on page", "Bounce rate", "Sessions", "Conversion rate",
  "Engagement rate", "Exit rate"
];
const AUDIENCES = [
  "All users", "New users", "Returning users", "Organic search",
  "Paid search", "Mobile users", "Desktop users", "Direct traffic"
];

const PIE_CRITERIA = [
  {
    key: "potential", label: "Potential", color: "#C9A84C", bg: "#FDFBF3", border: "#EFE0A8",
    description: "How much improvement can this test realistically deliver?",
    hints: ["1–2: Marginal uplift expected, page already well-optimized","3–5: Moderate improvement possible, some clear friction points","6–8: Significant gains likely, known conversion barriers present","9–10: High-impact opportunity, strong evidence of friction or drop-off"],
  },
  {
    key: "importance", label: "Importance", color: "#1B3A6B", bg: "#F0F4FA", border: "#C0CFEA",
    description: "How much traffic and strategic value does this page carry?",
    hints: ["1–2: Low-traffic or low-priority page","3–5: Moderate traffic, secondary program or audience","6–8: High-traffic page, meaningful conversion volume","9–10: Core acquisition page, top program, significant business impact"],
  },
  {
    key: "ease", label: "Ease", color: "#2A8C8C", bg: "#F0FAFA", border: "#A8D8D8",
    description: "How easy is it to design, build, and launch this test?",
    hints: ["1–2: Complex dev work, stakeholder dependencies, or technical risk","3–5: Moderate effort, some design or dev required","6–8: Straightforward change, limited dev involvement","9–10: Simple copy or layout swap, can be done in Convert quickly"],
  },
];

const OVERLAY_TYPES = [
  { label: "Add/Blur", color: "#4A90D9" },
  { label: "Removed", color: "#E74C3C" },
  { label: "Copy Change", color: "#2ECC71" },
  { label: "Layout Shift", color: "#9B59B6" },
  { label: "Sticky Element", color: "#F39C12" },
  { label: "CTA Highlight", color: "#1ABC9C" },
  { label: "Brand Accent", color: "#E91E63" },
];

const emptyHypothesis = {
  id: Date.now(), testName: "", pageUrl: "", testType: "", audience: "",
  primaryMetric: "", secondaryMetrics: [], if: "", then: "", because: "",
  potential: 5, importance: 5, ease: 5,
};

const preloadedTest = {
  id: Date.now(),
  testName: "High-Traffic Article Conversion",
  pageUrl: "https://csuglobal.edu/blog/how-does-ai-actually-work",
  testType: "A/B",
  audience: "New users",
  primaryMetric: "CTA clicks",
  secondaryMetrics: ["Form submissions"],
  if: "we add an inline RFI CTA immediately after the first main H2 heading on long-form blog articles",
  then: "CTA engagement and program form submissions will increase among new users",
  because: "readers who reach the first H2 have demonstrated content engagement and are at a high-attention moment — a contextual in-flow CTA reduces friction compared to relying on persistent or footer placements alone",
  potential: 6,
  importance: 6,
  ease: 6,
};

const ACCENT = "#1B3A6B";
const TEAL = "#2A8C8C";
const GOLD = "#C9A84C";
const BG = "#F7F8FA";
const CARD = "#FFFFFF";
const BORDER = "#DDE3ED";
const TEXT = "#0F1923";
const MUTED = "#4A5568";
const DIM = "#C4CDD8";
const IF_COLOR = "#1B3A6B";
const THEN_COLOR = "#2A8C8C";
const BECAUSE_COLOR = "#C9A84C";

const pieScore = (t) => ((Number(t.potential) + Number(t.importance) + Number(t.ease)) / 3).toFixed(1);
const scoreColor = (s) => s >= 7.5 ? "#16A34A" : s >= 5 ? "#D97706" : "#DC2626";
const scoreBg = (s) => s >= 7.5 ? "#F0FDF4" : s >= 5 ? "#FFFBEB" : "#FEF2F2";
const scoreBorder = (s) => s >= 7.5 ? "#BBF7D0" : s >= 5 ? "#FDE68A" : "#FECACA";
const scoreLabel = (s) => s >= 7.5 ? "High Priority" : s >= 5 ? "Medium Priority" : "Low Priority";

// ── SVG helpers ──────────────────────────────────────────────────────────────
function escXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrap(text, maxChars) {
  if (!text) return ["—"];
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (candidate.length > maxChars) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["—"];
}

function svgLines(lines, x, y, fontSize, fill, fontWeight, leading) {
  return lines.map((l, i) =>
    `<text x="${x}" y="${y + i * leading}" font-size="${fontSize}" fill="${fill}" font-weight="${fontWeight}" font-family="Inter,Arial,sans-serif">${escXml(l)}</text>`
  ).join("\n");
}

function pill(x, y, w, h, r, fill, stroke, label, textColor, fontSize) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
<text x="${x + w / 2}" y="${y + h / 2 + fontSize * 0.38}" text-anchor="middle" font-size="${fontSize}" fill="${textColor}" font-weight="700" font-family="Inter,Arial,sans-serif">${escXml(String(label))}</text>`;
}

function ssZone(x, y, w, h, label, sub) {
  const cx = x + w / 2, cy = y + h / 2;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#F0F4FA" stroke="#C0CFEA" stroke-width="1.5" stroke-dasharray="6,4"/>
<text x="${cx}" y="${cy - 16}" text-anchor="middle" font-size="13" fill="#8899BB" font-weight="600" font-family="Inter,Arial,sans-serif">${escXml(label)}</text>
<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" fill="#AAB8CC" font-family="Inter,Arial,sans-serif">${escXml(sub)}</text>
<text x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="10" fill="#C0CFEA" font-family="Inter,Arial,sans-serif">Import screenshot here</text>`;
}

// ── SVG Generator ────────────────────────────────────────────────────────────
function generateSVG(t) {
  const score = Number(pieScore(t));
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const W = 1200;

  // Hypothesis column: card x=338, inner text x=354, right edge ~690 → ~46 chars usable
  const HYP_WRAP = 46;
  const LEAD = 16;

  const ifLines   = wrap(t.if      || "—", HYP_WRAP);
  const thenLines = wrap(t.then    || "—", HYP_WRAP);
  const becLines  = wrap(t.because || "—", HYP_WRAP);

  // Each hypothesis block: 9px label + 8px gap + N lines + 12px bottom pad
  const blkH = (lines) => 9 + 8 + lines.length * LEAD + 12;
  const ifH   = blkH(ifLines);
  const thenH = blkH(thenLines);
  const becH  = blkH(becLines);

  // Hypothesis card height: 18px section header + 10 + all three blocks + gaps
  const hypContentH = 18 + 10 + ifH + 8 + thenH + 8 + becH + 16;
  const TEST_INFO_MIN_H = 280;
  const metaInnerH = Math.max(TEST_INFO_MIN_H, hypContentH);
  const META_TOP_BAR = 40;
  const metaH = META_TOP_BAR + metaInnerH + 16;

  // Section Y positions (sections are flush, separated only by stroke)
  const headerH = 90;
  const metaY   = headerH;
  const controlH = 500;
  const variantH = 500;
  const footerH  = 44;
  const controlY = metaY + metaH;
  const variantY = controlY + controlH;
  const footerY  = variantY + variantH;
  const totalH   = footerY + footerH;

  // Card geometry
  const cardPadTop = META_TOP_BAR + 8;
  const cardH = metaH - META_TOP_BAR - 16;

  // Col 1: Test Info (x=16, w=310)
  const c1x = 16, c1y = metaY + cardPadTop, c1w = 310, c1h = cardH;
  const c1tx = c1x + 12;

  // Col 2: Hypothesis (x=338, w=360)
  const c2x = 338, c2y = metaY + cardPadTop, c2w = 360, c2h = cardH;
  const c2tx = c2x + 14;
  const hypStartY = c2y + 18 + 10; // after "HYPOTHESIS" header
  const ifY   = hypStartY;
  const thenY = ifY   + ifH   + 8;
  const becY  = thenY + thenH + 8;

  // Col 3: Metrics (x=710, w=210)
  const c3x = 710, c3y = metaY + cardPadTop, c3w = 210, c3h = cardH;
  const c3tx = c3x + 12;

  // Col 4: Overlay (x=932, w=252)
  const c4x = 932, c4y = metaY + cardPadTop, c4w = 252, c4h = cardH;
  const c4tx = c4x + 12;

  const primaryMetric = t.primaryMetric || "—";
  const secondaryList = (t.secondaryMetrics || []).slice(0, 5);

  const tips = [
    "Use File > Import (not drag/drop)",
    "Place as image, not a fill",
    "Crop to changed area first",
    "Lock screenshot layer after",
    "Export at 1x — no scaling",
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}">
  <defs><style>text{font-family:Inter,Arial,sans-serif;}</style></defs>

  <!-- ══ HEADER ══ -->
  <rect x="0" y="0" width="${W}" height="${headerH}" fill="#1B3A6B"/>
  <rect x="28" y="22" width="10" height="44" rx="2" fill="#C9A84C" opacity="0.9"/>
  <rect x="42" y="16" width="10" height="50" rx="2" fill="#2A8C8C" opacity="0.9"/>
  <rect x="56" y="10" width="10" height="56" rx="2" fill="#FFF" opacity="0.9"/>
  <text x="76" y="48" font-size="20" fill="#FFF" font-family="Inter,Arial,sans-serif"><tspan font-weight="400">Metrics</tspan><tspan font-weight="700" fill="#C9A84C">Edge</tspan></text>
  <text x="76" y="65" font-size="9" fill="#8BA4C8" font-weight="600" letter-spacing="2">TEST DOCUMENTATION</text>
  <text x="${W/2}" y="36" text-anchor="middle" font-size="21" fill="#FFF" font-weight="700">${escXml(t.testName || "Untitled Test")}</text>
  <text x="${W/2}" y="58" text-anchor="middle" font-size="11" fill="#8BA4C8">${escXml(t.pageUrl || "URL not specified")}  ·  ${escXml(t.testType || "—")}  ·  ${escXml(t.audience || "All users")}  ·  ${today}</text>
  ${(()=>{
    const lbl = scoreLabel(score).toUpperCase(); // e.g. "MEDIUM PRIORITY"
    const words = lbl.split(" ");
    const line1 = words[0]; // "HIGH" / "MEDIUM" / "LOW"
    const line2 = words[1] || ""; // "PRIORITY"
    return `<rect x="${W-124}" y="10" width="106" height="70" rx="8" fill="${scoreBg(score)}" stroke="${scoreBorder(score)}" stroke-width="1.5"/>
  <text x="${W-71}" y="34" text-anchor="middle" font-size="26" fill="${scoreColor(score)}" font-weight="800">${pieScore(t)}</text>
  <text x="${W-71}" y="48" text-anchor="middle" font-size="9" fill="${scoreColor(score)}" font-weight="700" letter-spacing="1">${line1}</text>
  <text x="${W-71}" y="59" text-anchor="middle" font-size="9" fill="${scoreColor(score)}" font-weight="700" letter-spacing="1">${line2}</text>
  <text x="${W-71}" y="71" text-anchor="middle" font-size="8" fill="#888">PIE SCORE</text>`;
  })()}

  <!-- ══ META ══ -->
  <rect x="0" y="${metaY}" width="${W}" height="${metaH}" fill="#FFF" stroke="#DDE3ED" stroke-width="1"/>
  <rect x="0" y="${metaY}" width="${W}" height="${META_TOP_BAR}" fill="#F0F4FA"/>
  <text x="20" y="${metaY+24}" font-size="10" fill="#1B3A6B" font-weight="700" letter-spacing="2">META — SHARED TEST INFO</text>

  <!-- Col 1 -->
  <rect x="${c1x}" y="${c1y}" width="${c1w}" height="${c1h}" rx="6" fill="#F7F8FA" stroke="#DDE3ED" stroke-width="1"/>
  <text x="${c1tx}" y="${c1y+17}" font-size="9" fill="#1B3A6B" font-weight="700" letter-spacing="1.5">TEST INFO</text>
  <text x="${c1tx}" y="${c1y+36}" font-size="9" fill="#888">Test Name</text>
  <text x="${c1tx}" y="${c1y+51}" font-size="12" fill="#0F1923" font-weight="600">${escXml(t.testName || "—")}</text>
  <text x="${c1tx}" y="${c1y+72}" font-size="9" fill="#888">Page / URL</text>
  ${svgLines(wrap(t.pageUrl || "—", 34), c1tx, c1y+86, 10, "#1B3A6B", "500", 15)}
  <text x="${c1tx}" y="${c1y+130}" font-size="9" fill="#888">Audience</text>
  <text x="${c1tx}" y="${c1y+145}" font-size="11" fill="#0F1923" font-weight="500">${escXml(t.audience || "—")}</text>
  <text x="${c1tx}" y="${c1y+166}" font-size="9" fill="#888">Test Type</text>
  <text x="${c1tx}" y="${c1y+181}" font-size="11" fill="#0F1923" font-weight="500">${escXml(t.testType || "—")}</text>
  <text x="${c1tx}" y="${c1y+202}" font-size="9" fill="#888">PIE Score</text>
  ${pill(c1tx, c1y+208, 52, 22, 4, scoreBg(score), scoreBorder(score), pieScore(t), scoreColor(score), 12)}
  <text x="${c1tx+58}" y="${c1y+223}" font-size="10" fill="#C9A84C" font-weight="700">P${t.potential}</text>
  <text x="${c1tx+76}" y="${c1y+223}" font-size="10" fill="#1B3A6B" font-weight="700">I${t.importance}</text>
  <text x="${c1tx+94}" y="${c1y+223}" font-size="10" fill="#2A8C8C" font-weight="700">E${t.ease}</text>
  <text x="${c1tx}" y="${c1y+246}" font-size="9" fill="#888">Date</text>
  <text x="${c1tx}" y="${c1y+261}" font-size="11" fill="#0F1923" font-weight="500">${today}</text>

  <!-- Col 2: Hypothesis -->
  <rect x="${c2x}" y="${c2y}" width="${c2w}" height="${c2h}" rx="6" fill="#F7F8FA" stroke="#DDE3ED" stroke-width="1"/>
  <text x="${c2tx}" y="${c2y+17}" font-size="9" fill="#1B3A6B" font-weight="700" letter-spacing="1.5">HYPOTHESIS</text>

  <!-- IF -->
  <rect x="${c2x+8}" y="${ifY}" width="3" height="${ifH}" rx="1.5" fill="${IF_COLOR}"/>
  <text x="${c2tx}" y="${ifY+9}" font-size="8" fill="${IF_COLOR}" font-weight="700" letter-spacing="1">IF — THE CHANGE</text>
  ${svgLines(ifLines, c2tx, ifY+20, 10, "#0F1923", "500", LEAD)}

  <!-- THEN -->
  <rect x="${c2x+8}" y="${thenY}" width="3" height="${thenH}" rx="1.5" fill="${THEN_COLOR}"/>
  <text x="${c2tx}" y="${thenY+9}" font-size="8" fill="${THEN_COLOR}" font-weight="700" letter-spacing="1">THEN — EXPECTED OUTCOME</text>
  ${svgLines(thenLines, c2tx, thenY+20, 10, "#0F1923", "500", LEAD)}

  <!-- BECAUSE -->
  <rect x="${c2x+8}" y="${becY}" width="3" height="${becH}" rx="1.5" fill="${BECAUSE_COLOR}"/>
  <text x="${c2tx}" y="${becY+9}" font-size="8" fill="${BECAUSE_COLOR}" font-weight="700" letter-spacing="1">BECAUSE — RATIONALE</text>
  ${svgLines(becLines, c2tx, becY+20, 10, "#0F1923", "500", LEAD)}

  <!-- Col 3: Metrics -->
  <rect x="${c3x}" y="${c3y}" width="${c3w}" height="${c3h}" rx="6" fill="#F7F8FA" stroke="#DDE3ED" stroke-width="1"/>
  <text x="${c3tx}" y="${c3y+17}" font-size="9" fill="#1B3A6B" font-weight="700" letter-spacing="1.5">METRICS</text>
  <text x="${c3tx}" y="${c3y+34}" font-size="9" fill="#888">PRIMARY KPI</text>
  <rect x="${c3tx}" y="${c3y+40}" width="8" height="8" rx="2" fill="#1B3A6B"/>
  <text x="${c3tx+12}" y="${c3y+48}" font-size="11" fill="#0F1923" font-weight="600">${escXml(primaryMetric)}</text>
  <text x="${c3tx}" y="${c3y+70}" font-size="9" fill="#888">SECONDARY</text>
  ${secondaryList.map((m, i) => `<rect x="${c3tx}" y="${c3y+78+i*20}" width="6" height="6" rx="1" fill="#AAB8CC"/>
  <text x="${c3tx+11}" y="${c3y+86+i*20}" font-size="10" fill="#444">${escXml(m)}</text>`).join("\n")}

  <!-- Col 4: Overlay -->
  <rect x="${c4x}" y="${c4y}" width="${c4w}" height="${c4h}" rx="6" fill="#F7F8FA" stroke="#DDE3ED" stroke-width="1"/>
  <text x="${c4tx}" y="${c4y+17}" font-size="9" fill="#1B3A6B" font-weight="700" letter-spacing="1.5">OVERLAY LEGEND</text>
  ${OVERLAY_TYPES.map((o, i) => `<rect x="${c4tx}" y="${c4y+26+i*20}" width="10" height="10" rx="2" fill="${o.color}"/>
  <text x="${c4tx+15}" y="${c4y+35+i*20}" font-size="10" fill="#333">${escXml(o.label)}</text>`).join("\n")}
  <text x="${c4tx}" y="${c4y+176}" font-size="8" fill="#888" font-weight="700" letter-spacing="1">AI SCREENSHOT TIPS</text>
  ${tips.map((tip, i) => `<text x="${c4tx}" y="${c4y+190+i*14}" font-size="8" fill="#666">• ${escXml(tip)}</text>`).join("\n")}

  <!-- ══ CONTROL ══ -->
  <rect x="0" y="${controlY}" width="${W}" height="${controlH}" fill="#FFF" stroke="#DDE3ED" stroke-width="1"/>
  <rect x="0" y="${controlY}" width="${W}" height="36" fill="#1B3A6B"/>
  <text x="20" y="${controlY+23}" font-size="10" fill="#FFF" font-weight="700" letter-spacing="2">CONTROL — VARIANT A</text>
  <rect x="${W-34}" y="${controlY+9}" width="20" height="18" rx="4" fill="#FFF" opacity="0.15"/>
  <text x="${W-24}" y="${controlY+22}" text-anchor="middle" font-size="11" fill="#FFF" font-weight="700">A</text>
  <text x="20" y="${controlY+54}" font-size="9" fill="#888" font-weight="700" letter-spacing="1.5">DESKTOP</text>
  ${ssZone(16, controlY+62, 734, controlH-80, "CONTROL — DESKTOP", "Full-page screenshot")}
  <text x="766" y="${controlY+54}" font-size="9" fill="#888" font-weight="700" letter-spacing="1.5">MOBILE</text>
  ${ssZone(762, controlY+62, 422, controlH-80, "CONTROL — MOBILE", "Mobile viewport screenshot")}

  <!-- ══ VARIANT B ══ -->
  <rect x="0" y="${variantY}" width="${W}" height="${variantH}" fill="#FFF" stroke="#DDE3ED" stroke-width="1"/>
  <rect x="0" y="${variantY}" width="${W}" height="36" fill="#C9A84C"/>
  <text x="20" y="${variantY+23}" font-size="10" fill="#FFF" font-weight="700" letter-spacing="2">VARIANT — VARIANT B</text>
  <rect x="${W-34}" y="${variantY+9}" width="20" height="18" rx="4" fill="#FFF" opacity="0.15"/>
  <text x="${W-24}" y="${variantY+22}" text-anchor="middle" font-size="11" fill="#FFF" font-weight="700">B</text>
  <text x="20" y="${variantY+54}" font-size="9" fill="#888" font-weight="700" letter-spacing="1.5">DESKTOP</text>
  ${ssZone(16, variantY+62, 734, variantH-80, "VARIANT B — DESKTOP", "Full-page screenshot with changes")}
  <text x="766" y="${variantY+54}" font-size="9" fill="#888" font-weight="700" letter-spacing="1.5">MOBILE</text>
  ${ssZone(762, variantY+62, 422, variantH-80, "VARIANT B — MOBILE", "Mobile viewport with changes")}

  <!-- ══ FOOTER ══ -->
  <rect x="0" y="${footerY}" width="${W}" height="${footerH}" fill="#1B3A6B"/>
  <text x="20" y="${footerY+27}" font-size="9" fill="#8BA4C8">COLORADO STATE UNIVERSITY GLOBAL  —  CRO TEST DOCUMENTATION  —  MetricsEdge</text>
  <text x="${W-20}" y="${footerY+27}" text-anchor="end" font-size="9" fill="#8BA4C8">${today}  —  CONFIDENTIAL</text>

</svg>`;
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function HypothesisBuilder() {
  const [hypotheses, setHypotheses] = useState([{ ...preloadedTest }]);
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const [activeHint, setActiveHint] = useState(null);
  const [svgReady, setSvgReady] = useState(false);
  const [svgContent, setSvgContent] = useState("");
  const [exportMsg, setExportMsg] = useState("");
  const svgAreaRef = useRef(null);
  const stmtAreaRef = useRef(null);

  const current = hypotheses[active];
  const score = Number(pieScore(current));

  const update = (field, value) =>
    setHypotheses(hypotheses.map((h, i) => i === active ? { ...h, [field]: value } : h));

  const toggleSecondary = (metric) => {
    const existing = current.secondaryMetrics || [];
    update("secondaryMetrics", existing.includes(metric)
      ? existing.filter(m => m !== metric) : [...existing, metric]);
  };

  const addNew = () => {
    const next = [...hypotheses, { ...emptyHypothesis, id: Date.now() }];
    setHypotheses(next); setActive(next.length - 1);
  };

  const remove = (idx) => {
    if (hypotheses.length === 1) return;
    const next = hypotheses.filter((_, i) => i !== idx);
    setHypotheses(next); setActive(Math.min(active, next.length - 1));
  };

  // Reliable clipboard: select + execCommand with navigator.clipboard fallback
  const copyText = (text, ref, onDone) => {
    const doExec = () => {
      const el = ref?.current || document.createElement("textarea");
      if (!ref?.current) {
        el.style.cssText = "position:fixed;top:-9999px;opacity:0";
        document.body.appendChild(el);
      }
      el.value = text;
      el.select();
      el.setSelectionRange(0, 99999);
      try { document.execCommand("copy"); } catch (_) {}
      if (!ref?.current) document.body.removeChild(el);
      onDone();
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(onDone).catch(doExec);
    } else { doExec(); }
  };

  const fullStatement = `If ${current.if || "[condition]"}, then ${current.then || "[expected outcome]"}, because ${current.because || "[rationale]"}.`;

  const copyStatement = () =>
    copyText(fullStatement, stmtAreaRef, () => { setCopied(true); setTimeout(() => setCopied(false), 2000); });

  const exportSVG = () => { setSvgContent(generateSVG(current)); setSvgReady(true); setExportMsg(""); };

  const copySVG = () =>
    copyText(svgContent, svgAreaRef, () => { setExportMsg("✓ Copied!"); setTimeout(() => setExportMsg(""), 3000); });

  const closeSVG = () => { setSvgReady(false); setSvgContent(""); };

  const ranked = [...hypotheses].map((h, i) => ({ ...h, origIdx: i }))
    .sort((a, b) => Number(pieScore(b)) - Number(pieScore(a)));

  const SH = ({ children }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>{children}</div>
  );
  const Lbl = ({ children }) => (
    <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.8px" }}>{children}</div>
  );

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter',sans-serif", color: TEXT }}>
      {/* Hidden textareas for execCommand fallback */}
      <textarea ref={stmtAreaRef} readOnly aria-hidden="true" style={{ position: "fixed", top: -9999, left: -9999, opacity: 0, pointerEvents: "none" }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .fi{width:100%;background:#fff;border:1.5px solid ${BORDER};color:${TEXT};padding:10px 14px;border-radius:6px;font-family:'Inter',sans-serif;font-size:14px;font-weight:500;outline:none;transition:border-color .15s;resize:none;line-height:1.6;}
        .fi:focus{border-color:${ACCENT};box-shadow:0 0 0 3px #1B3A6B22;}
        .fi::placeholder{color:${DIM};font-weight:400;}
        .chip{display:inline-flex;align-items:center;padding:5px 12px;border-radius:5px;font-size:13px;font-weight:500;cursor:pointer;border:1.5px solid ${BORDER};background:#fff;color:${MUTED};font-family:'Inter',sans-serif;transition:all .15s;}
        .chip:hover{border-color:${ACCENT};color:${ACCENT};background:#F0F4FA;}
        .chip.on{border-color:${ACCENT};background:#F0F4FA;color:${ACCENT};font-weight:600;}
        .tab{padding:12px 18px;font-size:13px;font-weight:600;cursor:pointer;border:none;background:transparent;font-family:'Inter',sans-serif;border-bottom:2px solid transparent;white-space:nowrap;color:${MUTED};}
        .tab.on{color:${ACCENT};border-bottom-color:${ACCENT};}
        .tab:hover:not(.on){color:${TEXT};}
        .cbtn{background:${ACCENT};color:#fff;border:none;padding:11px 18px;border-radius:6px;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;cursor:pointer;}
        .cbtn:hover{background:#142d54;}
        .ebtn{background:${GOLD};color:#fff;border:none;padding:11px 18px;border-radius:6px;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;justify-content:center;}
        .ebtn:hover{background:#b8942e;}
        .ifb{border-left:4px solid;padding:16px 18px;border-radius:0 8px 8px 0;background:${CARD};margin-bottom:12px;border-top:1.5px solid ${BORDER};border-right:1.5px solid ${BORDER};border-bottom:1.5px solid ${BORDER};}
        .srow{display:flex;gap:12px;padding:8px 0;border-bottom:1px solid ${BORDER};font-size:13px;}
        input[type=range]{-webkit-appearance:none;width:100%;height:5px;border-radius:3px;outline:none;cursor:pointer;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;cursor:pointer;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.2);}
        .hbtn{background:none;border:none;cursor:pointer;font-size:11px;font-weight:600;font-family:'Inter',sans-serif;padding:0;text-decoration:underline;}
        .rrow{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:6px;background:${CARD};border:1.5px solid ${BORDER};margin-bottom:8px;cursor:pointer;}
        .rrow:hover{border-color:${ACCENT};}
        .rrow.on{border-color:${ACCENT};background:#F0F4FA;}
        .deltab{background:none;border:none;color:${DIM};cursor:pointer;font-size:16px;padding:0 0 0 4px;}
        .deltab:hover{color:#DC2626;}
        .addtab{padding:8px 14px;font-size:20px;cursor:pointer;border:none;background:transparent;color:${MUTED};font-weight:300;}
        .addtab:hover{color:${ACCENT};}
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "14px 28px", display: "flex", alignItems: "center", gap: 16, background: CARD, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <rect x="2" y="10" width="8" height="22" rx="2" fill="#C9A84C"/>
          <rect x="14" y="5" width="8" height="27" rx="2" fill="#2A8C8C"/>
          <rect x="26" y="1" width="8" height="31" rx="2" fill="#1B3A6B"/>
        </svg>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, lineHeight: 1.1 }}>
            <span style={{ fontWeight: 400 }}>Metrics</span><span style={{ color: ACCENT }}>Edge</span>
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 1 }}>Test Builder</div>
        </div>
        <div style={{ width: 1, height: 32, background: BORDER }} />
        <div style={{ fontSize: 12, fontWeight: 500, color: MUTED }}>Hypothesis + PIE Scoring</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {[GOLD, TEAL, ACCENT].map(c => <div key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />)}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "0 24px", display: "flex", alignItems: "center", overflowX: "auto", background: CARD }}>
        {hypotheses.map((h, i) => (
          <div key={h.id} style={{ display: "flex", alignItems: "center" }}>
            <button className={`tab${active === i ? " on" : ""}`} onClick={() => setActive(i)}>
              {h.testName || `Test ${i + 1}`}
              <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: scoreColor(Number(pieScore(h))) }}>{pieScore(h)}</span>
            </button>
            {hypotheses.length > 1 && <button className="deltab" onClick={() => remove(i)}>×</button>}
          </div>
        ))}
        <button className="addtab" onClick={addNew}>+</button>
      </div>

      {/* Body */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", minHeight: "calc(100vh - 116px)" }}>

        {/* Left */}
        <div style={{ padding: "28px 32px", borderRight: `1px solid ${BORDER}`, overflowY: "auto" }}>

          <div style={{ marginBottom: 32 }}>
            <SH>Test Details</SH>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
              <div><Lbl>Test Name *</Lbl><input className="fi" placeholder="e.g. Remove PDF download element" value={current.testName} onChange={e => update("testName", e.target.value)} /></div>
              <div><Lbl>Page / URL</Lbl><input className="fi" placeholder="e.g. /masters/data-analytics" value={current.pageUrl} onChange={e => update("pageUrl", e.target.value)} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <Lbl>Test Type</Lbl>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {TEST_TYPES.map(t => <button key={t} className={`chip${current.testType === t ? " on" : ""}`} onClick={() => update("testType", current.testType === t ? "" : t)}>{t}</button>)}
                </div>
              </div>
              <div>
                <Lbl>Audience / Segment</Lbl>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {AUDIENCES.map(a => <button key={a} className={`chip${current.audience === a ? " on" : ""}`} onClick={() => update("audience", current.audience === a ? "" : a)}>{a}</button>)}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <SH>Metrics</SH>
            <div style={{ marginBottom: 16 }}>
              <Lbl>Primary Metric</Lbl>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {METRICS.map(m => <button key={m} className={`chip${current.primaryMetric === m ? " on" : ""}`} onClick={() => update("primaryMetric", current.primaryMetric === m ? "" : m)}>{m}</button>)}
              </div>
            </div>
            <div>
              <Lbl>Secondary Metrics <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(select multiple)</span></Lbl>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {METRICS.filter(m => m !== current.primaryMetric).map(m => <button key={m} className={`chip${(current.secondaryMetrics || []).includes(m) ? " on" : ""}`} onClick={() => toggleSecondary(m)}>{m}</button>)}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <SH>PIE Score</SH>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 16px", background: scoreBg(score), border: `1.5px solid ${scoreBorder(score)}`, borderRadius: 8 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: scoreColor(score), lineHeight: 1 }}>{pieScore(current)}</div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: scoreColor(score), textTransform: "uppercase", letterSpacing: 1 }}>{scoreLabel(score)}</div>
                  <div style={{ fontSize: 10, color: MUTED, fontWeight: 500 }}>(P+I+E) ÷ 3</div>
                </div>
              </div>
            </div>
            {PIE_CRITERIA.map(c => (
              <div key={c.key} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 8, padding: "14px 16px", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.color, textTransform: "uppercase", letterSpacing: 1, flex: 1 }}>{c.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: c.color, lineHeight: 1, marginRight: 12 }}>{current[c.key]}</div>
                  <button className="hbtn" style={{ color: c.color }} onClick={() => setActiveHint(activeHint === c.key ? null : c.key)}>
                    {activeHint === c.key ? "▲ hide guide" : "▼ scoring guide"}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: MUTED, fontWeight: 500, marginBottom: 10 }}>{c.description}</div>
                <input type="range" min="1" max="10" step="1" value={current[c.key]}
                  onChange={e => update(c.key, Number(e.target.value))}
                  style={{ background: `linear-gradient(to right,${c.color} 0%,${c.color} ${(current[c.key]-1)/9*100}%,#ddd ${(current[c.key]-1)/9*100}%,#ddd 100%)` }} />
                {activeHint === c.key && (
                  <div style={{ marginTop: 10, padding: "10px 14px", background: "#fff", borderRadius: 6, border: `1px solid ${c.border}` }}>
                    {c.hints.map((h, i) => <div key={i} style={{ fontSize: 12, fontWeight: 500, color: MUTED, lineHeight: 1.8 }}>— {h}</div>)}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div>
            <SH>Hypothesis Statement</SH>
            {[
              { color: IF_COLOR, label: "IF — The Change", field: "if", ph: "we remove the PDF download element from the hero section..." },
              { color: THEN_COLOR, label: "THEN — Expected Outcome", field: "then", ph: "form submission rate will increase among new users..." },
              { color: BECAUSE_COLOR, label: "BECAUSE — The Rationale", field: "because", ph: "the PDF acts as a conversion escape hatch..." },
            ].map(({ color, label, field, ph }) => (
              <div key={field} className="ifb" style={{ borderLeftColor: color }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color, marginBottom: 10, textTransform: "uppercase" }}>{label}</div>
                <textarea className="fi" rows={2} placeholder={ph} value={current[field]} onChange={e => update(field, e.target.value)} style={{ background: "transparent", border: "none", padding: 0, resize: "none", boxShadow: "none" }} />
              </div>
            ))}
          </div>
        </div>

        {/* Right */}
        <div style={{ padding: "28px 24px", background: "#F1F5F9", overflowY: "auto" }}>
          <SH>Preview</SH>

          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {[{ label: "Name", done: !!current.testName }, { label: "IF", done: !!current.if }, { label: "THEN", done: !!current.then }, { label: "BECAUSE", done: !!current.because }]
              .map((item, i, arr) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", fontSize: 12, fontWeight: 600, color: item.done ? THEN_COLOR : DIM }}>
                  <span style={{ marginRight: 4 }}>{item.done ? "✓" : "○"}</span>{item.label}
                  {i < arr.length - 1 && <span style={{ margin: "0 8px", color: BORDER }}>·</span>}
                </div>
              ))}
          </div>

          <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: 20, marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
            <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.9, color: TEXT }}>
              <span style={{ color: IF_COLOR, fontWeight: 700 }}>If </span>
              {current.if || <span style={{ color: DIM }}>the change...</span>}
              <span style={{ color: THEN_COLOR, fontWeight: 700 }}>, then </span>
              {current.then || <span style={{ color: DIM }}>expected outcome...</span>}
              <span style={{ color: BECAUSE_COLOR, fontWeight: 700 }}>, because </span>
              {current.because || <span style={{ color: DIM }}>the rationale...</span>}
              {(current.if || current.then || current.because) && "."}
            </div>
          </div>

          <button className="cbtn" onClick={copyStatement} style={{ width: "100%", marginBottom: 10 }}>
            {copied ? "✓ COPIED" : "COPY STATEMENT"}
          </button>
          <button className="ebtn" onClick={exportSVG} style={{ width: "100%", marginBottom: 24 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1v8M5 6l3 3 3-3M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            EXPORT SVG TEMPLATE
          </button>

          <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,.07)", marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: MUTED, marginBottom: 10 }}>Test Summary</div>
            {[
              { label: "Test Name", value: current.testName },
              { label: "Page", value: current.pageUrl },
              { label: "Type", value: current.testType },
              { label: "Audience", value: current.audience },
              { label: "Primary", value: current.primaryMetric },
              { label: "Secondary", value: (current.secondaryMetrics || []).join(", ") },
            ].map(row => (
              <div key={row.label} className="srow">
                <span style={{ color: MUTED, fontWeight: 600, minWidth: 90 }}>{row.label}</span>
                <span style={{ color: row.value ? TEXT : DIM, fontWeight: row.value ? 500 : 400 }}>{row.value || "—"}</span>
              </div>
            ))}
          </div>

          {hypotheses.length > 1 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Priority Ranking</div>
              {ranked.map((h, i) => {
                const s = Number(pieScore(h));
                return (
                  <div key={h.id} className={`rrow${h.origIdx === active ? " on" : ""}`} onClick={() => setActive(h.origIdx)}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: DIM, minWidth: 22 }}>#{i+1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {h.testName || <span style={{ color: DIM, fontWeight: 400 }}>Unnamed test</span>}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                        {PIE_CRITERIA.map(c => <div key={c.key} style={{ fontSize: 11, fontWeight: 600, color: c.color }}>{c.label[0]}{h[c.key]}</div>)}
                      </div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: scoreColor(s), background: scoreBg(s), border: `1.5px solid ${scoreBorder(s)}`, borderRadius: 6, padding: "4px 10px", minWidth: 52, textAlign: "center" }}>{pieScore(h)}</div>
                  </div>
                );
              })}
              <div style={{ marginTop: 12, padding: 12, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 11, fontWeight: 500, color: MUTED, lineHeight: 2 }}>
                <div style={{ color: THEN_COLOR, fontWeight: 600 }}>● 7.5–10 &nbsp;High priority</div>
                <div style={{ color: "#D97706", fontWeight: 600 }}>● 5.0–7.4 &nbsp;Medium priority</div>
                <div style={{ color: "#DC2626", fontWeight: 600 }}>● 1.0–4.9 &nbsp;Low priority</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SVG Modal */}
      {svgReady && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,25,35,.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: CARD, borderRadius: 12, width: "100%", maxWidth: 700, maxHeight: "82vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,.35)" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>SVG Template Ready</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Paste into TextEdit/Notepad → save as <strong>.svg</strong> → open in Illustrator.</div>
              </div>
              <button onClick={closeSVG} style={{ background: "none", border: "none", fontSize: 22, color: MUTED, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ padding: "10px 24px", background: "#FFFBEB", borderBottom: `1px solid #FDE68A`, fontSize: 12, color: "#92400E", fontWeight: 500 }}>
              <strong>Tip:</strong> Click inside the code box → <kbd>Cmd/Ctrl+A</kbd> → <kbd>Cmd/Ctrl+C</kbd> — or use the copy button below.
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "14px 24px" }}>
              <textarea
                ref={svgAreaRef}
                readOnly
                value={svgContent}
                onClick={e => { e.target.select(); e.target.setSelectionRange(0, 99999); }}
                style={{ width: "100%", height: 300, fontFamily: "monospace", fontSize: 10.5, color: "#334155", background: "#F8FAFC", border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12, resize: "none", lineHeight: 1.5 }}
              />
            </div>
            <div style={{ padding: "14px 24px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 10 }}>
              <button onClick={copySVG} style={{ flex: 1, background: GOLD, color: "#fff", border: "none", padding: "11px 18px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {exportMsg || "📋 Copy SVG Code"}
              </button>
              <button onClick={closeSVG} style={{ background: BG, color: MUTED, border: `1.5px solid ${BORDER}`, padding: "11px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
