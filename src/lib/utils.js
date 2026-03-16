export const pieScore   = (t) => ((Number(t.potential) + Number(t.importance) + Number(t.ease)) / 3).toFixed(1);
export const scoreColor  = (s) => s >= 7.5 ? "#16A34A" : s >= 5 ? "#D97706" : "#DC2626";
export const scoreBg     = (s) => s >= 7.5 ? "#F0FDF4" : s >= 5 ? "#FFFBEB" : "#FEF2F2";
export const scoreBorder = (s) => s >= 7.5 ? "#BBF7D0" : s >= 5 ? "#FDE68A" : "#FECACA";
export const scoreLabel  = (s) => s >= 7.5 ? "High Priority" : s >= 5 ? "Medium Priority" : "Low Priority";

export const fmtDate = (ts) =>
  ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export const toSlug = (str) =>
  (str || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ── CSV import helpers ─────────────────────────────────────────────────────────
function parseCSVRow(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// Auto-detects comma vs. tab separator and returns fields for one line.
function parseLine(line) {
  const tabCount   = (line.match(/\t/g)  || []).length;
  const commaCount = (line.match(/,/g)   || []).length;
  if (tabCount > 0 && tabCount >= commaCount) {
    return line.split("\t").map(s => s.replace(/^"|"$/g, "").trim());
  }
  return parseCSVRow(line);
}

// Parses header + first data row. Returns a flat object keyed by lowercased header names.
export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return null;
  const headers = parseLine(lines[0]);
  const values  = parseLine(lines[1]);
  const row = {};
  headers.forEach((h, i) => { row[h.trim().toLowerCase()] = (values[i] || "").trim(); });
  return row;
}

// Parses header + N data rows. Returns an array of row objects.
export function parseCSVMulti(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h.trim().toLowerCase()] = (values[i] || "").trim(); });
    return row;
  });
}

// Maps a parsed CSV row (from parseCSV) onto test fields, ignoring unrecognised columns.
export function mapCSVToTest(row) {
  const get = (...keys) => {
    for (const k of keys) {
      const v = row[k];
      if (v !== undefined && v !== "") return v;
    }
    return undefined;
  };

  const result = {};

  const testName = get("test name", "testname", "name", "test");
  if (testName !== undefined) result.testName = testName;

  const pageUrl = get("page url", "pageurl", "url", "page", "page / url");
  if (pageUrl !== undefined) result.pageUrl = pageUrl;

  const testType = get("test type", "testtype", "type");
  if (testType !== undefined) result.testType = testType;

  const audience = get("audience", "segment", "audience / segment");
  if (audience !== undefined) result.audience = audience;

  const primary = get("primary metric", "primarymetric", "primary");
  if (primary !== undefined) result.primaryMetric = primary;

  const secondary = get("secondary metrics", "secondarymetrics", "secondary");
  if (secondary !== undefined)
    result.secondaryMetrics = secondary.split(",").map(s => s.trim()).filter(Boolean);

  const ifVal = get("if", "if — the change", "if - the change", "change", "if (the change)");
  if (ifVal !== undefined) result.if = ifVal;

  const thenVal = get("then", "then — expected outcome", "then - expected outcome", "outcome", "expected outcome", "then (expected outcome)");
  if (thenVal !== undefined) result.then = thenVal;

  const because = get("because", "because — the rationale", "because - the rationale", "rationale", "because (the rationale)");
  if (because !== undefined) result.because = because;

  const potential = get("potential", "potential (1-10)");
  if (potential !== undefined) { const n = Number(potential); if (n >= 1 && n <= 10) result.potential = n; }

  const importance = get("importance", "importance (1-10)");
  if (importance !== undefined) { const n = Number(importance); if (n >= 1 && n <= 10) result.importance = n; }

  const ease = get("ease", "ease (1-10)");
  if (ease !== undefined) { const n = Number(ease); if (n >= 1 && n <= 10) result.ease = n; }

  const clientName = get("client", "client name", "clientname");
  if (clientName !== undefined) result.clientName = clientName;

  const VALID_STATUSES = ["backlog", "under review", "promoted to test", "test running", "test complete"];
  const status = get("status", "test status");
  if (status !== undefined) {
    const normalised = status.trim().toLowerCase();
    const match = ["Backlog", "Under Review", "Promoted to Test", "Test Running", "Test Complete"]
      .find(s => s.toLowerCase() === normalised);
    if (match) result.status = match;
    void VALID_STATUSES; // suppress unused warning
  }

  return result;
}

// Rounded-rect clip path (polyfill for ctx.roundRect)
function clipRounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

// screenshots: { controlDesktop, controlMobile, variantDesktop, … } — public URLs
// zones: array of { key, x, y, w, h } from computeSVGZones
export const makePdfFromSvg = async (svgString, filename) => {
  // Remove the Inter font reference — it's served from Google Fonts (cross-origin)
  // and causes canvas taint even via canvg.
  const cleanSvg = svgString.replace(/Inter,\s*/g, "");

  const { Canvg, presets } = await import("canvg");

  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(cleanSvg, "image/svg+xml");
  const W = parseInt(svgDoc.documentElement.getAttribute("width")  || "1200", 10);
  const H = parseInt(svgDoc.documentElement.getAttribute("height") || "800",  10);

  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);

  // canvg renders SVG entirely via Canvas 2D — no browser image-loading taint.
  // It loads <image> elements (Supabase URLs) with CORS, preserving overlay z-order.
  const cv = Canvg.fromString(ctx, cleanSvg, {
    ...presets.offscreen(),
    ignoreMouse: true,
    ignoreAnimation: true,
  });
  await cv.render();

  const ptW = W * 0.75;
  const ptH = H * 0.75;
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: ptW > ptH ? "landscape" : "portrait",
    unit: "pt",
    format: [ptW, ptH],
  });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, ptW, ptH);
  pdf.save(filename);
};

// ── AI hypothesis generation ────────────────────────────────────────────────
export async function generateHypothesis(statement, context = {}) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("VITE_ANTHROPIC_API_KEY is not set in your .env file.");

  const contextLines = [
    context.testName   && `Test name: ${context.testName}`,
    context.pageUrl    && `Page URL: ${context.pageUrl}`,
    context.testType   && `Test type: ${context.testType}`,
    context.audience   && `Audience: ${context.audience}`,
  ].filter(Boolean).join("\n");

  const prompt = `You are a CRO (conversion rate optimisation) strategist. Convert the following plain-language test idea into a structured hypothesis with three distinct components.

${contextLines ? `Test context:\n${contextLines}\n` : ""}Plain-language idea: "${statement}"

Return ONLY valid JSON in exactly this shape — no markdown, no commentary:
{
  "if": "...",
  "then": "...",
  "because": "..."
}

Rules:
- "if" describes the specific change being made (start with "we …" or the change itself, do not include the word IF)
- "then" describes the measurable expected outcome (do not include the word THEN)
- "because" explains the evidence or rationale supporting the hypothesis (do not include the word BECAUSE)
- Be specific and concise — each field should be 1–2 sentences
- Use present tense`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  const raw = data.content?.[0]?.text?.trim() ?? "";
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const parsed = JSON.parse(text);
  if (!parsed.if || !parsed.then || !parsed.because) throw new Error("Unexpected response shape from API.");
  return parsed;
}

export async function generateFindings(results, testContext = {}) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("VITE_ANTHROPIC_API_KEY is not set in your .env file.");

  const goalLines = results.goals.map(goal => {
    const control = goal.rows.find(r => r.variant === results.variantOrder[0]);
    const variants = goal.rows.filter(r => r.variant !== results.variantOrder[0]);
    const variantLines = variants.map(v =>
      `  - ${v.variant}: ${v.rate.toFixed(2)}% (${v.change >= 0 ? "+" : ""}${v.change.toFixed(2)}% change, ${v.confidence.toFixed(1)}% confidence)`
    ).join("\n");
    return `Goal: ${goal.name}\n  Control (${control?.variant}): ${control?.rate.toFixed(2)}%\n${variantLines}`;
  }).join("\n\n");

  const prompt = `You are a senior CRO analyst writing a professional test findings report. Based on the A/B test results below, write a clear, insightful findings summary.

Test: ${testContext.testName || "A/B Test"}
${testContext.pageUrl ? `Page: ${testContext.pageUrl}` : ""}
Period: ${results.startDate} to ${results.endDate}
Total visitors: ${results.variantOrder.reduce((s, v) => { const r = results.goals[0]?.rows.find(x => x.variant === v); return s + (r?.visitors ?? 0); }, 0).toLocaleString()}
Variants tested: ${results.variantOrder.join(", ")}

Results by goal:
${goalLines}

Statistical significance guide: ≥95% = statistically significant, 80–94% = trending, <80% = inconclusive.

Write the findings as HTML using only these tags: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>.
Structure:
1. <h2>Summary</h2> — 2–3 sentence executive summary of what was tested and the headline result
2. <h2>Results by Goal</h2> — for each goal, use <h3> for the goal name, then describe results including direction, magnitude, and whether they are statistically significant
3. <h2>Recommendation</h2> — clear action recommendation based on the data

Rules:
- Be precise — cite specific percentages and confidence levels
- Distinguish clearly between statistically significant results and inconclusive ones
- Do not use the word "significant" unless confidence is ≥95%
- Return ONLY the HTML, no markdown fences, no commentary`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  const html = data.content?.[0]?.text?.trim() ?? "";
  if (!html) throw new Error("Empty response from API.");
  return html;
}

// ── Convert.com API ───────────────────────────────────────────────────────────

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function convertHeaders(appId, appSecret, targetUrl, body) {
  const expires = Math.floor(Date.now() / 1000) + 300; // 5 min window
  const bodyStr = body ? JSON.stringify(body) : "";
  const signString = [appId, expires, targetUrl, bodyStr].join("\n");
  const signature = await hmacSha256Hex(appSecret, signString);
  return {
    "Convert-Application-ID": appId,
    "Expires": String(expires),
    "Authorization": `Convert-HMAC-SHA256 Signature=${signature}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

function parseConvertReport(reportData, goalNames, variationsData, experienceId) {
  // variationsData: array of { id, name, is_baseline }
  // reportData: array of { goal_id, variations: [{ id, visitors, conversion_data }] }

  const varById = Object.fromEntries(variationsData.map(v => [v.id, v.name]));

  // Baseline first, then challengers
  const variantOrder = [
    ...variationsData.filter(v => v.is_baseline),
    ...variationsData.filter(v => !v.is_baseline),
  ].map(v => v.name);

  const goals = reportData.map(goalEntry => {
    const goalId   = goalEntry.goal_id;
    const goalName = goalNames[String(goalId)] ?? `Goal ${goalId}`;

    const rows = goalEntry.variations.map(v => {
      const cd = v.conversion_data;
      const name        = varById[v.id] ?? String(v.id);
      const isBaseline  = variationsData.find(x => x.id === v.id)?.is_baseline ?? false;
      const visitors    = Number(v.visitors ?? 0);
      const conversions = Number(cd.conversions ?? 0);
      const rate        = Number(cd.conversion_rate ?? 0);          // already %
      const change      = isBaseline ? 0 : Number(cd.conversion_rate_change ?? 0) * 100; // decimal → %
      const confidence  = Number(cd.confidence ?? 0);               // already %
      return { variant: name, visitors, conversions, rate, change, confidence };
    });

    // Ensure baseline is first
    rows.sort((a, b) => {
      const ai = variantOrder.indexOf(a.variant);
      const bi = variantOrder.indexOf(b.variant);
      return ai - bi;
    });

    return { name: goalName, rows };
  });

  return { variantOrder, goals };
}

export async function fetchConvertResults(experienceId) {
  const appId     = import.meta.env.VITE_CONVERT_API_KEY;
  const appSecret = import.meta.env.VITE_CONVERT_API_SECRET;
  const accountId = import.meta.env.VITE_CONVERT_ACCOUNT_ID;
  const projectId = import.meta.env.VITE_CONVERT_PROJECT_ID;

  if (!appId || !appSecret)
    throw new Error("Add VITE_CONVERT_API_KEY and VITE_CONVERT_API_SECRET to your .env file.");
  if (!accountId || !projectId)
    throw new Error("Add VITE_CONVERT_ACCOUNT_ID and VITE_CONVERT_PROJECT_ID to your .env file.");

  const base = `https://api.convert.com/api/v2/accounts/${accountId}/projects/${projectId}`;
  const proxyBase = `/api/convert/api/v2/accounts/${accountId}/projects/${projectId}`;

  // ── 1. Fetch goal names from the experience (most reliable) + project goals fallback ──
  let goalNames = {};

  // Primary: fetch experience details which includes its configured goals
  try {
    const expTarget = `${base}/experiences/${experienceId}`;
    const expHeaders = await convertHeaders(appId, appSecret, expTarget, null);
    const expRes = await fetch(`${proxyBase}/experiences/${experienceId}`, { headers: expHeaders });
    if (expRes.ok) {
      const ed = await expRes.json();
      console.log("[Convert] experience response:", JSON.stringify(ed).slice(0, 2000));
      const expData = ed?.data ?? ed;
      const goals = expData?.goals ?? expData?.data?.goals ?? [];
      if (Array.isArray(goals) && goals.length) {
        goalNames = Object.fromEntries(goals.map(g => [String(g.id), g.name ?? g.label ?? `Goal ${g.id}`]));
      }
    }
  } catch { /* non-fatal */ }

  // Fallback: project-level goals list (catches any goals not on the experience object)
  try {
    const goalsTarget = `${base}/goals`;
    const goalsHeaders = await convertHeaders(appId, appSecret, goalsTarget, null);
    const goalsRes = await fetch(`${proxyBase}/goals`, { headers: goalsHeaders });
    if (goalsRes.ok) {
      const gd = await goalsRes.json();
      console.log("[Convert] goals response:", JSON.stringify(gd).slice(0, 2000));
      const list = gd?.data ?? gd ?? [];
      if (Array.isArray(list)) {
        for (const g of list) {
          if (!goalNames[String(g.id)]) goalNames[String(g.id)] = g.name ?? g.label ?? `Goal ${g.id}`;
        }
      }
    }
  } catch { /* non-fatal */ }

  console.log("[Convert] resolved goalNames:", goalNames);

  // ── 2. Fetch aggregated report ────────────────────────────────────────────
  const reportTarget = `${base}/experiences/${experienceId}/aggregated_report`;
  const reportBody   = {};
  const reportHeaders = await convertHeaders(appId, appSecret, reportTarget, reportBody);

  const reportRes = await fetch(
    `${proxyBase}/experiences/${experienceId}/aggregated_report`,
    { method: "POST", headers: reportHeaders, body: JSON.stringify(reportBody) }
  );

  if (!reportRes.ok) {
    const err = await reportRes.json().catch(() => ({}));
    throw new Error(err?.message ?? err?.error ?? `Convert API ${reportRes.status}`);
  }

  const raw = await reportRes.json();
  const inner = raw?.data ?? raw;

  if (!inner?.reportData || !inner?.variations_data) {
    throw Object.assign(
      new Error("Unexpected response shape — could not find goal/variant data."),
      { raw }
    );
  }

  const { variantOrder, goals } = parseConvertReport(
    inner.reportData, goalNames, inner.variations_data, experienceId
  );

  return {
    convertExperienceId: String(experienceId),
    testId:    String(experienceId),
    testName:  "",
    startDate: "",
    endDate:   "",
    syncedAt:  new Date().toISOString(),
    variantOrder,
    goals,
  };
}
