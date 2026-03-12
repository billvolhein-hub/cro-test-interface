import { pieScore, scoreColor, scoreBg, scoreBorder, scoreLabel } from "./utils";
import { OVERLAY_TYPES } from "./constants";

const VARIANT_COLORS = {
  B: "#C9A84C", C: "#2A8C8C", D: "#6D28D9",
  E: "#E74C3C", F: "#2ECC71", G: "#F39C12", H: "#E91E63",
};
function variantKeys(label) {
  return label === "B"
    ? { desktop: "variantDesktop", mobile: "variantMobile" }
    : { desktop: `variant${label}Desktop`, mobile: `variant${label}Mobile` };
}

function escXml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function wrap(text, maxChars) {
  if (!text) return ["—"];
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (candidate.length > maxChars) { if (line) lines.push(line); line = word; }
    else line = candidate;
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

function truncateUrl(url, max = 48) {
  if (!url) return "—";
  return url.length <= max ? url : url.slice(0, max - 1) + "…";
}

function screenshotOrZone(dataUrl, x, y, w, h, label, sub) {
  if (!dataUrl) return ssZone(x, y, w, h, label, sub);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#F0F4FA" stroke="#C0CFEA" stroke-width="1.5"/>
<svg x="${x}" y="${y}" width="${w}" height="${h}" overflow="hidden">
  <image href="${dataUrl}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMinYMin slice"/>
</svg>`;
}

export function computeSVGZones(t) {
  const W = 1200;
  const HYP_WRAP = 56;
  const LEAD = 18;
  const ifLines   = wrap(t.if      || "—", HYP_WRAP);
  const thenLines = wrap(t.then    || "—", HYP_WRAP);
  const becLines  = wrap(t.because || "—", HYP_WRAP);
  const blkH = (lines) => 12 + 10 + lines.length * LEAD + 14;
  const hypContentH = 22 + 12 + blkH(ifLines) + 10 + blkH(thenLines) + 10 + blkH(becLines) + 20;
  const metaInnerH  = Math.max(320, hypContentH);
  const metaH = 44 + metaInnerH + 16;
  const headerH  = 90;
  const controlH = 500;
  const variantH = 500;
  const footerH  = 44;
  const controlY = headerH + metaH;
  const variants = t.variants ?? ["B"];
  const variantsStartY = controlY + controlH;
  const totalH = variantsStartY + variants.length * variantH + footerH;

  const zones = [
    { key: "controlDesktop", label: "Control — Desktop", x: 16,  y: controlY + 62, w: 734, h: controlH - 80 },
    { key: "controlMobile",  label: "Control — Mobile",  x: 762, y: controlY + 62, w: 422, h: controlH - 80 },
    ...variants.flatMap((label, i) => {
      const vY = variantsStartY + i * variantH;
      const keys = variantKeys(label);
      return [
        { key: keys.desktop, label: `Variant ${label} — Desktop`, x: 16,  y: vY + 62, w: 734, h: variantH - 80 },
        { key: keys.mobile,  label: `Variant ${label} — Mobile`,  x: 762, y: vY + 62, w: 422, h: variantH - 80 },
      ];
    }),
  ];
  return { W, totalH, zones };
}

export function generateSVG(t, screenshots = {}, overlaysByVariant = {}) {
  const score = Number(pieScore(t));
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const W = 1200;
  const HYP_WRAP = 56;
  const LEAD = 18;

  const ifLines   = wrap(t.if      || "—", HYP_WRAP);
  const thenLines = wrap(t.then    || "—", HYP_WRAP);
  const becLines  = wrap(t.because || "—", HYP_WRAP);

  const blkH = (lines) => 12 + 10 + lines.length * LEAD + 14;
  const ifH   = blkH(ifLines);
  const thenH = blkH(thenLines);
  const becH  = blkH(becLines);

  const hypContentH = 22 + 12 + ifH + 10 + thenH + 10 + becH + 20;
  const metaInnerH  = Math.max(320, hypContentH);
  const META_TOP_BAR = 44;
  const metaH = META_TOP_BAR + metaInnerH + 16;

  const headerH  = 90;
  const metaY    = headerH;
  const controlH = 500;
  const variantH = 500;
  const footerH  = 44;
  const controlY = metaY + metaH;
  const variants = t.variants ?? ["B"];
  const variantsStartY = controlY + controlH;
  const footerY  = variantsStartY + variants.length * variantH;
  const totalH   = footerY + footerH;

  const cardPadTop = META_TOP_BAR + 10;
  const cardH = metaH - META_TOP_BAR - 16;

  // Column layout: Test Info | Hypothesis | Metrics | Overlay Legend
  const c1x = 16,  c1y = metaY + cardPadTop, c1w = 310, c1h = cardH, c1tx = 30;
  const c2x = 338, c2y = metaY + cardPadTop, c2w = 390, c2h = cardH, c2tx = 354;
  const c3x = 740, c3y = metaY + cardPadTop, c3w = 210, c3h = cardH, c3tx = 754;
  const c4x = 962, c4y = metaY + cardPadTop, c4w = 222, c4h = cardH, c4tx = 976;

  const hypStartY = c2y + 22 + 12;
  const ifY   = hypStartY;
  const thenY = ifY   + ifH   + 10;
  const becY  = thenY + thenH + 10;

  const secondaryList = (t.secondaryMetrics || []).slice(0, 5);

  const IF_COLOR      = "#1B3A6B";
  const THEN_COLOR    = "#2A8C8C";
  const BECAUSE_COLOR = "#C9A84C";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}">
  <defs><style>text{font-family:Inter,Arial,sans-serif;}</style></defs>

  <!-- ══ HEADER ══ -->
  <rect x="0" y="0" width="${W}" height="${headerH}" fill="#1B3A6B"/>
  <rect x="28" y="22" width="10" height="44" rx="2" fill="#C9A84C" opacity="0.9"/>
  <rect x="42" y="16" width="10" height="50" rx="2" fill="#2A8C8C" opacity="0.9"/>
  <rect x="56" y="10" width="10" height="56" rx="2" fill="#FFF" opacity="0.9"/>
  <text x="76" y="48" font-size="20" fill="#FFF"><tspan font-weight="400">Metrics</tspan><tspan font-weight="700" fill="#C9A84C">Edge</tspan></text>
  <text x="76" y="65" font-size="9" fill="#8BA4C8" font-weight="600" letter-spacing="2">TEST DOCUMENTATION</text>
  <text x="${W/2}" y="36" text-anchor="middle" font-size="21" fill="#FFF" font-weight="700">${escXml(t.testName || "Untitled Test")}</text>
  <text x="${W/2}" y="58" text-anchor="middle" font-size="11" fill="#8BA4C8">${escXml(t.pageUrl || "URL not specified")}  ·  ${escXml(t.testType || "—")}  ·  ${escXml(t.audience || "All users")}  ·  ${today}</text>
  ${(() => {
    const lbl = scoreLabel(score).toUpperCase().split(" ");
    return `<rect x="${W-124}" y="10" width="106" height="70" rx="8" fill="${scoreBg(score)}" stroke="${scoreBorder(score)}" stroke-width="1.5"/>
  <text x="${W-71}" y="34" text-anchor="middle" font-size="26" fill="${scoreColor(score)}" font-weight="800">${pieScore(t)}</text>
  <text x="${W-71}" y="48" text-anchor="middle" font-size="9" fill="${scoreColor(score)}" font-weight="700" letter-spacing="1">${lbl[0]}</text>
  <text x="${W-71}" y="59" text-anchor="middle" font-size="9" fill="${scoreColor(score)}" font-weight="700" letter-spacing="1">${lbl[1] || ""}</text>
  <text x="${W-71}" y="71" text-anchor="middle" font-size="8" fill="#888">PIE SCORE</text>`;
  })()}

  <!-- ══ META ══ -->
  <rect x="0" y="${metaY}" width="${W}" height="${metaH}" fill="#FFF" stroke="#DDE3ED" stroke-width="1"/>
  <rect x="0" y="${metaY}" width="${W}" height="${META_TOP_BAR}" fill="#F0F4FA"/>
  <text x="20" y="${metaY+27}" font-size="11" fill="#1B3A6B" font-weight="700" letter-spacing="2">TEST OVERVIEW</text>

  <!-- C1: Test Info -->
  <rect x="${c1x}" y="${c1y}" width="${c1w}" height="${c1h}" rx="6" fill="#F7F8FA" stroke="#DDE3ED" stroke-width="1"/>
  <text x="${c1tx}" y="${c1y+20}" font-size="10" fill="#1B3A6B" font-weight="700" letter-spacing="1.5">TEST INFO</text>
  <line x1="${c1tx}" y1="${c1y+28}" x2="${c1x+c1w-12}" y2="${c1y+28}" stroke="#DDE3ED" stroke-width="1"/>

  <text x="${c1tx}" y="${c1y+48}" font-size="10" fill="#888">Test Name</text>
  <text x="${c1tx}" y="${c1y+65}" font-size="13" fill="#0F1923" font-weight="600">${escXml(t.testName || "—")}</text>

  <text x="${c1tx}" y="${c1y+90}" font-size="10" fill="#888">Page / URL</text>
  ${(() => {
    const url = t.pageUrl || "";
    const isLink = /^https?:\/\//i.test(url);
    const display = escXml(truncateUrl(url, 38) || "—");
    const textEl = `<text x="${c1tx}" y="${c1y+107}" font-size="11" fill="${url ? "#1B3A6B" : "#888"}" font-weight="500"${isLink ? ' text-decoration="underline"' : ""}>${display}</text>`;
    return isLink ? `<a href="${escXml(url)}" target="_blank">${textEl}</a>` : textEl;
  })()}

  <text x="${c1tx}" y="${c1y+132}" font-size="10" fill="#888">Audience</text>
  <text x="${c1tx}" y="${c1y+149}" font-size="13" fill="#0F1923" font-weight="500">${escXml(t.audience || "—")}</text>

  <text x="${c1tx}" y="${c1y+174}" font-size="10" fill="#888">Test Type</text>
  <text x="${c1tx}" y="${c1y+191}" font-size="13" fill="#0F1923" font-weight="500">${escXml(t.testType || "—")}</text>

  <text x="${c1tx}" y="${c1y+216}" font-size="10" fill="#888">PIE Score</text>
  ${pill(c1tx, c1y+223, 58, 26, 4, scoreBg(score), scoreBorder(score), pieScore(t), scoreColor(score), 14)}
  <text x="${c1tx+70}" y="${c1y+240}" font-size="11" fill="#C9A84C" font-weight="700">P ${t.potential}</text>
  <text x="${c1tx+104}" y="${c1y+240}" font-size="11" fill="#1B3A6B" font-weight="700">I ${t.importance}</text>
  <text x="${c1tx+138}" y="${c1y+240}" font-size="11" fill="#2A8C8C" font-weight="700">E ${t.ease}</text>

  <text x="${c1tx}" y="${c1y+268}" font-size="10" fill="#888">Date</text>
  <text x="${c1tx}" y="${c1y+285}" font-size="13" fill="#0F1923" font-weight="500">${today}</text>

  <!-- C2: Hypothesis -->
  <rect x="${c2x}" y="${c2y}" width="${c2w}" height="${c2h}" rx="6" fill="#F7F8FA" stroke="#DDE3ED" stroke-width="1"/>
  <text x="${c2tx}" y="${c2y+20}" font-size="10" fill="#1B3A6B" font-weight="700" letter-spacing="1.5">HYPOTHESIS</text>
  <line x1="${c2tx}" y1="${c2y+28}" x2="${c2x+c2w-14}" y2="${c2y+28}" stroke="#DDE3ED" stroke-width="1"/>

  <rect x="${c2x+10}" y="${ifY}" width="3" height="${ifH}" rx="1.5" fill="${IF_COLOR}"/>
  <text x="${c2tx}" y="${ifY+12}" font-size="10" fill="${IF_COLOR}" font-weight="700" letter-spacing="1">IF — THE CHANGE</text>
  ${svgLines(ifLines, c2tx, ifY+26, 12, "#0F1923", "500", LEAD)}

  <rect x="${c2x+10}" y="${thenY}" width="3" height="${thenH}" rx="1.5" fill="${THEN_COLOR}"/>
  <text x="${c2tx}" y="${thenY+12}" font-size="10" fill="${THEN_COLOR}" font-weight="700" letter-spacing="1">THEN — EXPECTED OUTCOME</text>
  ${svgLines(thenLines, c2tx, thenY+26, 12, "#0F1923", "500", LEAD)}

  <rect x="${c2x+10}" y="${becY}" width="3" height="${becH}" rx="1.5" fill="${BECAUSE_COLOR}"/>
  <text x="${c2tx}" y="${becY+12}" font-size="10" fill="${BECAUSE_COLOR}" font-weight="700" letter-spacing="1">BECAUSE — RATIONALE</text>
  ${svgLines(becLines, c2tx, becY+26, 12, "#0F1923", "500", LEAD)}

  <!-- C3: Metrics -->
  <rect x="${c3x}" y="${c3y}" width="${c3w}" height="${c3h}" rx="6" fill="#F7F8FA" stroke="#DDE3ED" stroke-width="1"/>
  <text x="${c3tx}" y="${c3y+20}" font-size="10" fill="#1B3A6B" font-weight="700" letter-spacing="1.5">METRICS</text>
  <line x1="${c3tx}" y1="${c3y+28}" x2="${c3x+c3w-14}" y2="${c3y+28}" stroke="#DDE3ED" stroke-width="1"/>

  <text x="${c3tx}" y="${c3y+50}" font-size="10" fill="#888">PRIMARY KPI</text>
  <rect x="${c3tx}" y="${c3y+58}" width="10" height="10" rx="2" fill="#1B3A6B"/>
  <text x="${c3tx+15}" y="${c3y+68}" font-size="13" fill="#0F1923" font-weight="600">${escXml(t.primaryMetric || "—")}</text>

  <text x="${c3tx}" y="${c3y+96}" font-size="10" fill="#888">SECONDARY</text>
  ${secondaryList.map((m, i) => `<rect x="${c3tx}" y="${c3y+106+i*24}" width="7" height="7" rx="1.5" fill="#AAB8CC"/>
  <text x="${c3tx+13}" y="${c3y+114+i*24}" font-size="12" fill="#444">${escXml(m)}</text>`).join("\n")}

  <!-- C4: Overlay Legend -->
  <rect x="${c4x}" y="${c4y}" width="${c4w}" height="${c4h}" rx="6" fill="#F7F8FA" stroke="#DDE3ED" stroke-width="1"/>
  <text x="${c4tx}" y="${c4y+20}" font-size="10" fill="#1B3A6B" font-weight="700" letter-spacing="1.5">OVERLAY LEGEND</text>
  <line x1="${c4tx}" y1="${c4y+28}" x2="${c4x+c4w-14}" y2="${c4y+28}" stroke="#DDE3ED" stroke-width="1"/>
  ${OVERLAY_TYPES.map((o, i) => `<rect x="${c4tx}" y="${c4y+42+i*28}" width="12" height="12" rx="3" fill="${o.color}"/>
  <text x="${c4tx+20}" y="${c4y+53+i*28}" font-size="12" fill="#333">${escXml(o.label)}</text>`).join("\n")}

  <!-- ══ CONTROL ══ -->
  <rect x="0" y="${controlY}" width="${W}" height="${controlH}" fill="#FFF" stroke="#DDE3ED" stroke-width="1"/>
  <rect x="0" y="${controlY}" width="${W}" height="36" fill="#1B3A6B"/>
  <text x="20" y="${controlY+23}" font-size="10" fill="#FFF" font-weight="700" letter-spacing="2">CONTROL — VARIANT A</text>
  <rect x="${W-34}" y="${controlY+9}" width="20" height="18" rx="4" fill="#FFF" opacity="0.15"/>
  <text x="${W-24}" y="${controlY+22}" text-anchor="middle" font-size="11" fill="#FFF" font-weight="700">A</text>
  <text x="20" y="${controlY+54}" font-size="9" fill="#888" font-weight="700" letter-spacing="1.5">DESKTOP</text>
  ${screenshotOrZone(screenshots.controlDesktop, 16, controlY+62, 734, controlH-80, "CONTROL — DESKTOP", "Full-page screenshot")}
  <text x="766" y="${controlY+54}" font-size="9" fill="#888" font-weight="700" letter-spacing="1.5">MOBILE</text>
  ${screenshotOrZone(screenshots.controlMobile, 762, controlY+62, 422, controlH-80, "CONTROL — MOBILE", "Mobile viewport screenshot")}

  <!-- ══ VARIANTS ══ -->
  ${variants.map((label, i) => {
    const vY = variantsStartY + i * variantH;
    const color = VARIANT_COLORS[label] ?? "#C9A84C";
    const keys = variantKeys(label);
    const placements = overlaysByVariant[label] ?? [];
    const noteLines_fn = (p) => p.note ? wrap(p.note, 28) : [];
    return `
  <rect x="0" y="${vY}" width="${W}" height="${variantH}" fill="#FFF" stroke="#DDE3ED" stroke-width="1"/>
  <rect x="0" y="${vY}" width="${W}" height="36" fill="${color}"/>
  <text x="20" y="${vY+23}" font-size="10" fill="#FFF" font-weight="700" letter-spacing="2">VARIANT — VARIANT ${escXml(label)}</text>
  <rect x="${W-34}" y="${vY+9}" width="20" height="18" rx="4" fill="#FFF" opacity="0.15"/>
  <text x="${W-24}" y="${vY+22}" text-anchor="middle" font-size="11" fill="#FFF" font-weight="700">${escXml(label)}</text>
  <text x="20" y="${vY+54}" font-size="9" fill="#888" font-weight="700" letter-spacing="1.5">DESKTOP</text>
  ${screenshotOrZone(screenshots[keys.desktop], 16, vY+62, 734, variantH-80, `VARIANT ${label} — DESKTOP`, "Full-page screenshot with changes")}
  <text x="766" y="${vY+54}" font-size="9" fill="#888" font-weight="700" letter-spacing="1.5">MOBILE</text>
  ${screenshotOrZone(screenshots[keys.mobile], 762, vY+62, 422, variantH-80, `VARIANT ${label} — MOBILE`, "Mobile viewport with changes")}
  ${placements.map(p => {
    const ox = Math.round(p.relX * W);
    const oy = Math.round(p.relY * totalH);
    const noteLines = noteLines_fn(p);
    const calloutW = 170;
    const calloutH = noteLines.length > 0 ? noteLines.length * 14 + 20 : 0;
    const calloutX = ox + 18;
    const calloutY = oy - calloutH / 2;
    return [
      `<circle cx="${ox}" cy="${oy}" r="13" fill="${p.color}" opacity="0.92" stroke="white" stroke-width="2.5"/>`,
      `<text x="${ox}" y="${oy+4}" text-anchor="middle" font-size="10" fill="white" font-weight="800" font-family="Inter,Arial,sans-serif">${escXml(p.label[0])}</text>`,
      noteLines.length > 0 ? [
        `<line x1="${ox+13}" y1="${oy}" x2="${calloutX}" y2="${oy}" stroke="${p.color}" stroke-width="1.5" opacity="0.7"/>`,
        `<rect x="${calloutX}" y="${calloutY}" width="${calloutW}" height="${calloutH}" rx="5" fill="${p.color}" opacity="0.9"/>`,
        `<text x="${calloutX+8}" y="${calloutY+13}" font-size="8" fill="white" font-weight="700" font-family="Inter,Arial,sans-serif" opacity="0.75">${escXml(p.label.toUpperCase())}</text>`,
        ...noteLines.map((l, ni) => `<text x="${calloutX+8}" y="${calloutY+13+(ni+1)*13}" font-size="10" fill="white" font-weight="500" font-family="Inter,Arial,sans-serif">${escXml(l)}</text>`),
      ].join("\n") : "",
    ].join("\n");
  }).join("\n")}`;
  }).join("\n")}

  <!-- ══ FOOTER ══ -->
  <rect x="0" y="${footerY}" width="${W}" height="${footerH}" fill="#1B3A6B"/>
  <text x="20" y="${footerY+27}" font-size="9" fill="#8BA4C8">COLORADO STATE UNIVERSITY GLOBAL  —  CRO TEST DOCUMENTATION  —  MetricsEdge</text>
  <text x="${W-20}" y="${footerY+27}" text-anchor="end" font-size="9" fill="#8BA4C8">${today}  —  CONFIDENTIAL</text>

</svg>`;
}
