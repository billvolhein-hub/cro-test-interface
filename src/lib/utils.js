export const pieScore   = (t) => ((Number(t.potential) + Number(t.importance) + Number(t.ease)) / 3).toFixed(1);
export const scoreColor  = (s) => s >= 7.5 ? "#16A34A" : s >= 5 ? "#D97706" : "#DC2626";
export const scoreBg     = (s) => s >= 7.5 ? "#F0FDF4" : s >= 5 ? "#FFFBEB" : "#FEF2F2";
export const scoreBorder = (s) => s >= 7.5 ? "#BBF7D0" : s >= 5 ? "#FDE68A" : "#FECACA";
export const scoreLabel  = (s) => s >= 7.5 ? "High Priority" : s >= 5 ? "Medium Priority" : "Low Priority";

export const fmtDate = (ts) =>
  ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

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

export const makePdfFromSvg = async (svgString, filename) => {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url  = URL.createObjectURL(blob);

  await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const W = img.naturalWidth  || 1200;
      const H = img.naturalHeight || 800;
      const canvas = document.createElement("canvas");
      canvas.width  = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const ptW = W * 0.75;
      const ptH = H * 0.75;

      import("jspdf").then(({ jsPDF }) => {
        const pdf = new jsPDF({
          orientation: ptW > ptH ? "landscape" : "portrait",
          unit: "pt",
          format: [ptW, ptH],
        });
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, ptW, ptH);
        pdf.save(filename);
        resolve();
      }).catch(reject);
    };
    img.onerror = reject;
    img.src = url;
  });
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

  const res = await fetch("/anthropic/v1/messages", {
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
