// ── CSV helpers ───────────────────────────────────────────────────────────────
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

export function parseCSVToObjects(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(l => {
    const vals = parseLine(l);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? "").trim().replace(/^"|"$/g, ""); });
    return obj;
  }).filter(r => Object.values(r).some(v => v));
}

// Returns the primary dimension value from a GA4 row — handles both export types.
// "Page path and screen class" → URL path join (preferred).
// "Page title and screen class" → title join (fallback).
export function ga4Dimension(row) {
  return row["Page path and screen class"] || row["Page path"] ||
         row["Page title and screen class"] || row["Page title"] || "";
}

// Returns the join mode based on what column is present in the GA4 data.
export function ga4JoinMode(rows) {
  if (!rows.length) return "none";
  const first = rows[0];
  if (first["Page path and screen class"] || first["Page path"]) return "path";
  return "title";
}

// GA4 export has metadata rows before the header — auto-detect header line
// by finding the first row that contains at least 2 known GA4 column names.
const GA4_HEADER_MARKERS = ["page title", "page path", "views", "active users", "engagement rate", "bounce rate"];

export function parseGA4CSVToObjects(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const headerIdx = lines.findIndex(l => {
    const lower = l.toLowerCase();
    return GA4_HEADER_MARKERS.filter(m => lower.includes(m)).length >= 2;
  });
  if (headerIdx === -1) return [];
  const dataLines = lines.slice(headerIdx).filter(l => l.trim());
  if (dataLines.length < 2) return [];
  return parseCSVToObjects(dataLines.join("\n")).filter(r => {
    const dim = ga4Dimension(r);
    return dim && dim !== "(other)" && dim !== "(not set)";
  });
}

// ── Normalizers ───────────────────────────────────────────────────────────────
// Normalizes a full URL to `host+path` — strips protocol, www, query string,
// fragment, and trailing slash so https://www.csuglobal.edu/programs/ and
// https://csuglobal.edu/programs both become "csuglobal.edu/programs".
function normUrl(url) {
  try {
    const u = new URL((url || "").trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/$/, "");
    return `${host}${path}`;
  } catch {
    // Fallback for relative paths or malformed URLs
    return (url || "").toLowerCase().replace(/^https?:\/\/(www\.)?/, "").split("?")[0].split("#")[0].replace(/\/$/, "");
  }
}

function normTitle(t) {
  return (t || "").trim().toLowerCase();
}

// ── On-page alignment helpers ─────────────────────────────────────────────────
const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with","from",
  "is","are","was","were","be","been","have","has","do","does","did","will",
  "would","could","should","may","can","not","no","so","if","up","out","this",
  "that","your","our","their","its","we","you","they","it","my","by","as","get",
  "all","more","how","what","when","where","who","which",
]);

function stem(w) {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed"))  return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("ly"))  return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

function tokenize(text) {
  return [...new Set(
    (text || "").toLowerCase()
      .split(/[\s\-–\/|,.:;!?()"'&+#@%*=<>[\]{}]+/)
      .filter(w => w.length >= 2 && !STOP_WORDS.has(w))
      .map(stem)
  )];
}

// Jaccard similarity between two token arrays (already unique)
function jaccard(a, b) {
  if (!a.length && !b.length) return null;
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const intersection = b.filter(w => setA.has(w)).length;
  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : 0;
}

export function parseCtr(ctr) {
  if (typeof ctr === "number") return ctr;
  const s = String(ctr || "0").replace("%", "");
  return parseFloat(s) / 100 || 0;
}

function parseNum(v) {
  if (typeof v === "number") return v;
  return parseFloat(String(v || "0").replace(/,/g, "")) || 0;
}

// Parses GA4 duration fields which are exported as "MM:SS" or "H:MM:SS"
function parseDuration(v) {
  if (typeof v === "number") return v;
  const s = String(v || "").trim();
  const parts = s.split(":").map(p => parseFloat(p) || 0);
  if (parts.length === 2) return parts[0] * 60 + parts[1];   // MM:SS
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]; // H:MM:SS
  return parseFloat(s.replace(/,/g, "")) || 0;
}

function parseRate(v) {
  if (typeof v === "number") return v > 1 ? v / 100 : v;
  const s = String(v || "0").replace("%", "").replace(/,/g, "");
  const n = parseFloat(s) || 0;
  return n > 1 ? n / 100 : n;
}

// ── CTR benchmark ─────────────────────────────────────────────────────────────
export function ctrBenchmark(pos) {
  const p = parseFloat(pos) || 0;
  if (p <= 0)  return 0;
  if (p <= 1)  return 0.28;
  if (p <= 2)  return 0.15;
  if (p <= 3)  return 0.11;
  if (p <= 4)  return 0.08;
  if (p <= 5)  return 0.06;
  if (p <= 6)  return 0.05;
  if (p <= 10) return 0.03;
  if (p <= 20) return 0.01;
  return 0.005;
}

// ── Segment tagging ───────────────────────────────────────────────────────────
export const DEFAULT_SEGMENT_RULES = [
  { name: "Landing Page", pattern: "/lp/" },
  { name: "Blog",         pattern: "/blog/|/resources/|/news/" },
  { name: "Program",      pattern: "/programs/|/academic-programs/|/degree/|/courses/" },
  { name: "Product",      pattern: "/internet/|/tv/|/phone/|/shop" },
  { name: "Support",      pattern: "/support/|/help/|/faq/" },
  { name: "Location",     pattern: "/locations/|/local/" },
  { name: "Utility",      pattern: "\\.(?:json|js|css|xml)(?:$|\\?)|/(?:_next|static)/" },
];

function segmentUrl(url, rules) {
  const u = url || "";
  const activeRules = rules && rules.length > 0 ? rules : DEFAULT_SEGMENT_RULES;
  for (const rule of activeRules) {
    try { if (new RegExp(rule.pattern, "i").test(u)) return rule.name.toLowerCase(); }
    catch { /* invalid regex — skip */ }
  }
  return "other";
}

// ── Min-max normalize ─────────────────────────────────────────────────────────
function normalize(val, min, max) {
  if (max === min) return 0;
  return Math.min(1, Math.max(0, (val - min) / (max - min)));
}

// ── Per-URL SF issue detection (from internal_all columns) ────────────────────
function hasSfIssues(sfRow) {
  const title = sfRow["Title 1"] || "";
  const h1    = sfRow["H1-1"]   || "";
  const meta  = sfRow["Meta Description 1"] || "";
  if (!title.trim())                              return true;
  if (title.length < 30 || title.length > 60)    return true;
  if (!h1.trim())                                 return true;
  if (meta && (meta.length < 70 || meta.length > 155)) return true;
  return false;
}

// ── GSC column resolution ─────────────────────────────────────────────────────
// Handles both standard exports ("Clicks") and comparison exports
// ("Last 3 months Clicks", "Last 28 days Clicks", etc.)
function gscUrl(row) {
  return row["Top pages"] || row["Page"] || row["Landing page"] || "";
}

function gscCol(row, metric) {
  // Direct match first (standard export)
  if (row[metric] != null && row[metric] !== "") return row[metric];
  // Comparison export: find a column ending with the metric name, prefer "Last …"
  const keys = Object.keys(row);
  const lastKey = keys.find(k => k.startsWith("Last ") && k.endsWith(` ${metric}`));
  if (lastKey) return row[lastKey];
  // Any key ending with the metric
  const anyKey = keys.find(k => k.endsWith(` ${metric}`));
  if (anyKey) return row[anyKey];
  return "";
}

// ── Main merge function ───────────────────────────────────────────────────────
export function mergeReportData({ sfRows = [], sfIssueRows = [], gscPages = [], gscQueries = [], ga4Rows = [], segmentRules = null, ahrefsData = null }) {

  // Build per-page backlink index from Ahrefs data.
  // best-by-external-links → ahrefsData.data.bestpages.pages
  //   fields: url_to, links_to_target, refdomains_target
  // all-backlinks → ahrefsData.data.backlinks.backlinks
  //   fields: url_to, name_source, domain_rating_source, is_dofollow, anchor
  const ahrefsByUrl = {};
  const rawPages     = ahrefsData?.data?.bestpages?.pages     ?? [];
  const rawBacklinks = ahrefsData?.data?.backlinks?.backlinks ?? [];

  if (rawPages.length > 0) {
    for (const pg of rawPages) {
      if (!pg.url_to) continue;
      const key = normUrl(pg.url_to);
      ahrefsByUrl[key] = { count: pg.links_to_target ?? 0, domains: { size: pg.refdomains_target ?? 0 } };
    }
  } else {
    for (const bl of rawBacklinks) {
      if (!bl.url_to) continue;
      const key = normUrl(bl.url_to);
      if (!ahrefsByUrl[key]) ahrefsByUrl[key] = { count: 0, domains: new Set() };
      ahrefsByUrl[key].count++;
      if (bl.name_source) ahrefsByUrl[key].domains.add(bl.name_source);
    }
  }
  const hasAhrefs = rawPages.length > 0 || rawBacklinks.length > 0;

  // Index GSC by normalized URL
  const gscByUrl = {};
  for (const row of gscPages) {
    const key = normUrl(gscUrl(row));
    if (key && !gscByUrl[key]) gscByUrl[key] = row;
  }

  // Detect GA4 join mode and index accordingly
  const joinMode = ga4JoinMode(ga4Rows);
  const ga4Index = {};
  for (const row of ga4Rows) {
    let key;
    if (joinMode === "path") {
      // Normalize path: lowercase, strip trailing slash, strip query string
      const raw = row["Page path and screen class"] || row["Page path"] || "";
      key = raw.toLowerCase().split("?")[0].replace(/\/$/, "") || "/";
    } else {
      key = normTitle(ga4Dimension(row));
    }
    if (!key) continue;
    if (!ga4Index[key]) {
      ga4Index[key] = { ...row };
    } else {
      const ex = ga4Index[key];
      const exViews = parseNum(ex["Views"]);
      const newViews = parseNum(row["Views"]);
      const total = exViews + newViews;
      const wavg = (a, b) => total > 0 ? (parseRate(a) * exViews + parseRate(b) * newViews) / total : 0;
      ga4Index[key] = {
        ...ex,
        "Views":             total,
        "Key events":        parseNum(ex["Key events"])        + parseNum(row["Key events"]),
        "Event count":       parseNum(ex["Event count"])       + parseNum(row["Event count"]),
        "Active users":      parseNum(ex["Active users"])      + parseNum(row["Active users"]),
        "Sessions":          parseNum(ex["Sessions"])          + parseNum(row["Sessions"]),
        "Engaged sessions":  parseNum(ex["Engaged sessions"])  + parseNum(row["Engaged sessions"]),
        "Bounce rate":       wavg(ex["Bounce rate"],           row["Bounce rate"]),
        "Engagement rate":   wavg(ex["Engagement rate"],       row["Engagement rate"]),
        "Average engagement time per active user": (() => {
          const exT = parseDuration(ex["Average engagement time per active user"]);
          const newT = parseDuration(row["Average engagement time per active user"]);
          return total > 0 ? (exT * exViews + newT * newViews) / total : 0;
        })(),
      };
    }
  }

  // Merge SF + GSC + GA4
  const merged = [];
  for (const sfRow of sfRows) {
    const addr     = sfRow["Address"] || "";
    const urlNorm  = normUrl(addr);
    const titleNorm = normTitle(sfRow["Title 1"] || "");

    const gscRow = gscByUrl[urlNorm] || null;

    // GA4 join: by path (preferred) or title (fallback)
    let ga4Key;
    if (joinMode === "path") {
      try { ga4Key = new URL(addr).pathname.toLowerCase().split("?")[0].replace(/\/$/, "") || "/"; }
      catch { ga4Key = ""; }
    } else {
      ga4Key = titleNorm;
    }
    const ga4Row = ga4Key ? (ga4Index[ga4Key] || null) : null;

    const hasGsc = !!gscRow;
    const hasGa  = !!ga4Row;
    const data_coverage = hasGsc && hasGa ? "full" : hasGsc ? "sf+gsc" : hasGa ? "sf+ga" : "sf-only";
    const _sources = ["sf", ...(hasGsc ? ["gsc"] : []), ...(hasGa ? ["ga"] : [])];

    const ctr         = hasGsc ? parseCtr(gscCol(gscRow, "CTR"))         : 0;
    const impressions  = hasGsc ? parseNum(gscCol(gscRow, "Impressions")) : 0;
    const clicks       = hasGsc ? parseNum(gscCol(gscRow, "Clicks"))      : 0;
    const position     = hasGsc ? parseNum(gscCol(gscRow, "Position"))    : 0;

    const views              = hasGa ? parseNum(ga4Row["Views"])          : 0;
    const key_events         = hasGa ? parseNum(ga4Row["Key events"])     : 0;
    const event_count        = hasGa ? parseNum(ga4Row["Event count"])    : 0;
    const sessions           = hasGa ? parseNum(ga4Row["Sessions"])       : 0;
    const engaged_sessions   = hasGa ? parseNum(ga4Row["Engaged sessions"]): 0;
    const avg_engagement_time = hasGa
      ? parseDuration(ga4Row["Average engagement time per active user"])   : 0;

    // Engagement rate: prefer explicit column, fall back to engaged/sessions
    let engagement_rate = hasGa ? parseRate(ga4Row["Engagement rate"]) : 0;
    if (!engagement_rate && sessions > 0 && engaged_sessions > 0)
      engagement_rate = Math.min(1, engaged_sessions / sessions);

    // Bounce rate: prefer explicit column, fall back to 1 - engagement_rate
    let bounce_rate = hasGa ? parseRate(ga4Row["Bounce rate"]) : 0;
    if (!bounce_rate && engagement_rate > 0)
      bounce_rate = Math.max(0, 1 - engagement_rate);

    const inlinks       = parseNum(sfRow["Unique Inlinks"] || sfRow["Inlinks"] || "0");
    const word_count    = parseNum(sfRow["Word Count"] || "0");
    const response_time = parseNum(sfRow["Response Time"] || "0");
    const h1            = sfRow["H1-1"] || "";
    const has_sf_issues = hasSfIssues(sfRow);
    const segment       = segmentUrl(addr, segmentRules);

    // Ahrefs per-page backlink data
    const ahrefsEntry    = ahrefsByUrl[urlNorm] ?? null;
    const ext_backlinks  = ahrefsEntry?.count        ?? 0;
    const ext_refdomains = ahrefsEntry?.domains.size ?? 0;

    // On-page alignment scoring (Title ↔ H1 ↔ Meta Description)
    const titleToks = tokenize(sfRow["Title 1"] || "");
    const h1Toks    = tokenize(sfRow["H1-1"] || "");
    const metaToks  = tokenize(sfRow["Meta Description 1"] || "");
    const sim_title_h1   = jaccard(titleToks, h1Toks);
    const sim_title_meta = jaccard(titleToks, metaToks);
    const sim_h1_meta    = jaccard(h1Toks, metaToks);
    const alignment_field_count = [titleToks.length > 0, h1Toks.length > 0, metaToks.length > 0].filter(Boolean).length;
    const alignment_score = alignment_field_count >= 2
      ? ((sim_title_h1 ?? 0) * 2 + (sim_title_meta ?? 0) + (sim_h1_meta ?? 0)) / 4
      : null;

    merged.push({
      // Original columns from each source (all preserved)
      ...sfRow,
      ...(hasGsc ? gscRow : {}),
      ...(hasGa  ? ga4Row  : {}),
      // Derived meta
      _url_norm:    urlNorm,
      _title_norm:  titleNorm,
      _sources,
      data_coverage,
      segment,
      // Parsed numeric convenience fields
      ctr, impressions, clicks, position,
      views, key_events, bounce_rate, engagement_rate, avg_engagement_time, event_count,
      inlinks, word_count, response_time, h1, has_sf_issues,
      sim_title_h1, sim_title_meta, sim_h1_meta, alignment_score, alignment_field_count,
      ext_backlinks, ext_refdomains,
    });
  }

  // Normalization ranges (scoped to dataset)
  const maxImpressions  = Math.max(...merged.map(r => r.impressions), 1);
  const maxKeyEvents    = Math.max(...merged.map(r => r.key_events), 1);
  const maxExtRefdoms   = hasAhrefs ? Math.max(...merged.map(r => r.ext_refdomains), 1) : 1;

  // Add derived fields
  for (const row of merged) {
    row.ctr_benchmark = ctrBenchmark(row.position);
    row.ctr_gap       = row.ctr_benchmark - row.ctr;

    const extAuthBonus = hasAhrefs ? Math.round(normalize(row.ext_refdomains, 0, maxExtRefdoms) * 10) : 0;
    row.page_score = Math.min(100, Math.round(
      normalize(row.impressions, 0, maxImpressions) * 20 +
      normalize(row.ctr, 0, 0.30) * 20 +
      row.engagement_rate * 20 +
      normalize(row.key_events, 0, maxKeyEvents) * 20 +
      (row.has_sf_issues ? 0 : 20)
    ) + extAuthBonus);

    row.low_alignment = row.alignment_score != null && row.alignment_score < 0.30;

    row.orphan_flag              = row.views > 100 && row.inlinks < 3;
    row.thin_traffic_flag        = row.word_count > 0 && row.word_count < 300 && row.clicks > 50;
    row.cliff_flag               = row.position >= 8 && row.position <= 15 && row.impressions > 200 && !row.has_sf_issues;
    row.engaged_no_convert_flag  = row.avg_engagement_time > 30 && row.views > 0;
    row.impression_black_hole_flag = row.impressions > 500 && row.ctr < 0.005;
    row.deep_no_traffic_flag     = row.word_count > 1000 && row.impressions < 50;
    row.ranking_velocity_flag    = row.position >= 11 && row.position <= 25 && row.avg_engagement_time > 60 && row.views > 0;
    row.freshness_risk_flag      = row.position >= 1 && row.position <= 15 && row.impressions > 100 && row.word_count > 0 && row.word_count < 600;
    // Ahrefs-enhanced flags (only set when Ahrefs data is present)
    row.ext_orphan_flag          = hasAhrefs && row.ext_refdomains > 0 && row.inlinks < 3; // external authority, no internal support
  }

  const insights = buildInsights(merged, hasAhrefs, gscQueries);

  const segmentCounts = {};
  for (const r of merged) segmentCounts[r.segment] = (segmentCounts[r.segment] || 0) + 1;

  // Debug — first matched GSC row + first GSC/GA4 rows (raw data for diagnostics)
  const firstMatchedSfUrl = merged.find(r => r.data_coverage === "full" || r.data_coverage === "sf+gsc");
  const firstGscRow = gscPages[0] || null;
  const firstGa4Row = ga4Rows[0] || null;

  const debugSfKeys  = sfRows.slice(0, 3).map(r => ({
    raw:  r["Address"] || "(no Address column)",
    norm: normUrl(r["Address"] || ""),
  }));
  const debugGscKeys = gscPages.slice(0, 3).map(r => ({
    cols: Object.keys(r).join(" | "),
    raw:  gscUrl(r) || "(no URL column — tried: Top pages, Page, Landing page)",
    norm: normUrl(gscUrl(r)),
    clicks: gscCol(r, "Clicks"), impressions: gscCol(r, "Impressions"),
    ctr: gscCol(r, "CTR"), position: gscCol(r, "Position"),
  }));
  const debugGa4Keys = ga4Rows.slice(0, 3).map(r => {
    const raw = r["Page path and screen class"] || r["Page path"] || "(no path column)";
    return {
      cols: Object.keys(r).join(" | "),
      raw,
      norm: raw.toLowerCase().split("?")[0].replace(/\/$/, "") || "/",
      views: r["Views"],
      engagement: r["Engagement rate"],
      bounce: r["Bounce rate"],
      sessions: r["Sessions"],
      engaged_sessions: r["Engaged sessions"],
    };
  });

  const meta = {
    sf_row_count:    sfRows.length,
    gsc_row_count:   gscPages.length,
    ga_row_count:    ga4Rows.length,
    matched_3way:    merged.filter(r => r.data_coverage === "full").length,
    matched_sf_gsc:  merged.filter(r => r.data_coverage === "sf+gsc").length,
    matched_sf_ga:   merged.filter(r => r.data_coverage === "sf+ga").length,
    matched_sf_only: merged.filter(r => r.data_coverage === "sf-only").length,
    segments: segmentCounts,
    // KPI aggregates — stored in meta so they survive the saved-data path
    total_impressions: merged.reduce((s, r) => s + (r.impressions || 0), 0),
    total_clicks:      merged.reduce((s, r) => s + (r.clicks     || 0), 0),
    total_views:       merged.reduce((s, r) => s + (r.views      || 0), 0),
    total_key_events:  merged.reduce((s, r) => s + (r.key_events || 0), 0),
    avg_page_score:    Math.round(merged.reduce((s, r) => s + (r.page_score || 0), 0) / Math.max(merged.length, 1)),
    gsc_query_count:   gscQueries.length,
    _debug: { sfKeys: debugSfKeys, gscKeys: debugGscKeys, ga4Keys: debugGa4Keys },
  };

  return { meta, merged_rows: merged, insights };
}

// ── Re-apply segments to cached merged rows (no re-upload needed) ─────────────
// Takes the already-merged rows stored in report.merged_rows, reassigns each
// row's segment field using the new rules, and rebuilds all insights.
export function reapplySegments(mergedRows, newRules, existingMeta, gscQueries = []) {
  const resegged = mergedRows.map(row => ({
    ...row,
    segment: segmentUrl(row["Address"] || "", newRules),
  }));
  const segmentCounts = {};
  for (const r of resegged) segmentCounts[r.segment] = (segmentCounts[r.segment] || 0) + 1;
  const hasAhrefs = resegged.some(r => r.ext_refdomains > 0);
  const insights = buildInsights(resegged, hasAhrefs, gscQueries);
  return {
    meta:        { ...(existingMeta || {}), segments: segmentCounts },
    merged_rows: resegged,
    insights,
  };
}

// ── Intent detection ──────────────────────────────────────────────────────────
const TRANSACTIONAL_WORDS = new Set([
  "buy","purchase","order","hire","apply","enroll","register","subscribe",
  "book","schedule","contact","quote","demo","trial","download","get",
]);
const COMMERCIAL_WORDS = new Set([
  "best","top","vs","versus","compare","comparison","review","reviews",
  "alternative","alternatives","price","pricing","cost","costs","cheap",
  "affordable","discount","deal","deals","services","service","agency","agencies",
  "company","companies","provider","degree","program","certificate","course",
  "tuition","admission","admissions","salary","career","careers","job","jobs",
  "certification","training","worth","should","how",
]);

function detectIntent(query) {
  const words = query.toLowerCase().split(/\W+/).filter(Boolean);
  if (words.some(w => TRANSACTIONAL_WORDS.has(w))) return "transactional";
  if (words.some(w => COMMERCIAL_WORDS.has(w))) return "commercial";
  return "informational";
}

function parseQueryRow(row) {
  const query = (row["Top queries"] || row["Query"] || row["query"] || "").trim();
  // GSC exports use either plain field names or period-prefixed ones
  // e.g. "Clicks" vs "Last 3 months Clicks" / "Last 28 days Clicks"
  const pick = (...keys) => {
    for (const k of keys) if (row[k] != null) return row[k];
    // Fallback: find any key that ends with the last word (e.g. "Clicks")
    const last = keys[keys.length - 1];
    const match = Object.keys(row).find(k => k.toLowerCase().endsWith(last.toLowerCase()));
    return match ? row[match] : 0;
  };
  return {
    query,
    impressions: parseNum(pick("Impressions", "impressions")),
    clicks:      parseNum(pick("Clicks",      "clicks")),
    ctr:         parseRate(pick("CTR",        "ctr")),
    position:    parseNum(pick("Position",    "position")),
  };
}

// ── Insight builders ──────────────────────────────────────────────────────────
function buildInsights(merged, hasAhrefs = false, gscQueries = []) {
  return {
    ctr_opportunity: {
      id: "ctr-opportunity",
      title: "CTR Opportunity Gap",
      description: "Pages underperforming their expected click-through rate given their search position.",
      priority: "high",
      recommendation: "Rewrite title tag and meta description to better match search intent. Test keyword variants.",
      pages: merged.filter(r => r.ctr_gap > 0.03 && r.impressions > 100)
        .sort((a, b) => b.ctr_gap - a.ctr_gap),
    },

    thin_traffic: {
      id: "thin-traffic",
      title: "Thin Content Driving Real Traffic",
      description: "Pages with fewer than 300 words receiving over 50 clicks — fragile and at risk.",
      priority: "high",
      recommendation: "Expand page content to 600+ words. These pages are one algorithm update away from traffic loss.",
      pages: merged.filter(r => r.word_count > 0 && r.word_count < 300 && r.clicks > 50)
        .sort((a, b) => b.clicks - a.clicks),
    },

    ranking_not_converting: {
      id: "ranking-not-converting",
      title: "Ranking But Not Engaging",
      description: "Pages with search traffic but high bounce rates and zero conversions.",
      priority: "high",
      recommendation: "Page has search traffic but visitors leave immediately. Check intent alignment and page layout.",
      pages: merged.filter(r => r.clicks > 50 && r.bounce_rate > 0.60 && r.key_events === 0)
        .sort((a, b) => b.clicks - a.clicks),
    },

    position_cliff: {
      id: "position-cliff",
      title: "Position Cliff Pages",
      description: "Clean pages ranking 8–15 with meaningful impressions — just below page 1.",
      priority: "medium",
      recommendation: hasAhrefs
        ? "One targeted push could move these to page 1. Pages with more referring domains already have the authority — focus on on-page improvements. Pages with few referring domains need link building first."
        : "One content or authority push could move these to page 1. Prioritize for link building or on-page optimization.",
      pages: merged.filter(r => r.cliff_flag)
        .sort((a, b) => hasAhrefs
          ? (b.ext_refdomains - a.ext_refdomains) || (b.impressions - a.impressions)
          : b.impressions - a.impressions),
    },

    orphan_pages: {
      id: "orphan-pages",
      title: "High-Value Orphan Pages",
      description: hasAhrefs
        ? "Pages earning traffic with fewer than 3 internal links. Pages with external referring domains are the most critical — the site is ignoring pages that other sites actively link to."
        : "Pages earning traffic with fewer than 3 internal links pointing to them.",
      priority: "medium",
      recommendation: hasAhrefs
        ? "Add internal links from relevant high-authority pages. Pages with external referring domains are especially urgent — external authority is flowing in but the site provides no onward path."
        : "Add internal links from high-authority pages. These pages earn traffic with no site support.",
      pages: merged.filter(r => r.orphan_flag)
        .sort((a, b) => hasAhrefs
          ? (b.ext_refdomains - a.ext_refdomains) || (b.views - a.views)
          : b.views - a.views),
    },

    engaged_no_convert: (() => {
      const hasKeyEvents = merged.some(r => r.key_events > 0);
      const pages = merged
        .filter(r => r.avg_engagement_time > 30 && r.views > 0 && (!hasKeyEvents || r.key_events < 50))
        .sort((a, b) => b.avg_engagement_time - a.avg_engagement_time);
      const desc = hasKeyEvents
        ? "Pages where users spend real time reading but never trigger a key event — attention without action."
        : "Pages where users spend significant time reading. No key events are tracked in GA4 — consider configuring conversion events to measure what happens after engagement.";
      return {
        id: "engaged-no-convert",
        title: "Engaged but Not Converting",
        description: desc,
        priority: "high",
        recommendation: "The content is holding attention but the conversion path is broken. Review CTA placement, form visibility, and next-step clarity. These pages are close — one good CTA change could move the needle.",
        pages,
      };
    })(),

    impression_black_hole: {
      id: "impression-black-hole",
      title: "High Impressions, Near-Zero CTR",
      description: "Pages appearing constantly in search results but almost nobody clicks — high visibility, zero pull-through.",
      priority: "high",
      recommendation: "These pages are seen and skipped. Title tags and meta descriptions need a complete rewrite. Test benefit-driven, specific copy that matches what searchers actually want.",
      pages: merged.filter(r => r.impression_black_hole_flag).sort((a, b) => b.impressions - a.impressions),
    },

    deep_no_traffic: {
      id: "deep-no-traffic",
      title: "Deep Content, No Traffic",
      description: hasAhrefs
        ? "Long-form pages (1000+ words) with minimal search impressions. Pages with external referring domains are likely an indexing or canonicalization issue — the authority exists but search isn't rewarding it."
        : "Long-form pages (1000+ words) with minimal search impressions — significant content investment with no SEO return.",
      priority: "medium",
      recommendation: hasAhrefs
        ? "For pages with external referring domains: investigate indexing, canonical tags, and crawlability first — the authority is there. For pages with no external links: audit keyword targeting and confirm real search demand before investing more."
        : "These pages have substantial content but aren't ranking. Audit for keyword targeting, crawlability, and internal links. Confirm the topic has real search demand before investing more.",
      pages: merged.filter(r => r.deep_no_traffic_flag)
        .sort((a, b) => hasAhrefs
          ? (b.ext_refdomains - a.ext_refdomains) || (b.word_count - a.word_count)
          : b.word_count - a.word_count),
    },

    intent_mismatch: {
      id: "intent-mismatch",
      title: "On-Page Content Alignment",
      description: "Ranking pages where Title, H1, and Meta Description have weak word overlap — scattered messaging on pages that already have search visibility.",
      priority: "medium",
      recommendation: "These pages already rank in search but their on-page messaging is unfocused. Aligning Title, H1, and Meta around a single keyword intent could strengthen rankings and improve CTR.",
      pages: merged.filter(r => r.low_alignment && r.position > 0).sort((a, b) => (a.alignment_score ?? 1) - (b.alignment_score ?? 1)),
    },

    segment_health: buildSegmentHealth(merged),

    full_funnel: {
      id: "full-funnel",
      title: "Page Health Score",
      description: "Pages scored 0–100 across search reach, CTR, engagement, conversion, and technical health.",
      priority: "high",
      recommendation: "Pages with the lowest scores have compounding problems across multiple channels. Fix in order.",
      pages: [...merged].sort((a, b) => a.page_score - b.page_score),
    },

    ranking_velocity: {
      id: "ranking-velocity",
      title: "Ranking Velocity Opportunities",
      description: "Pages sitting on page 2–3 where users who do land spend significant time — strong engagement signals that Google hasn't rewarded with page 1 placement yet.",
      priority: "high",
      recommendation: "These pages satisfy intent when visitors arrive but can't break through to page 1. Add internal links from high-authority pages, tighten title/H1 alignment, and consider a targeted backlink push. The engagement data proves the content is good — it just needs a visibility boost.",
      pages: merged.filter(r => r.ranking_velocity_flag)
        .sort((a, b) => b.avg_engagement_time - a.avg_engagement_time),
    },

    content_freshness_risk: {
      id: "content-freshness-risk",
      title: "Content Freshness Risk",
      description: "Pages currently ranking in positions 1–15 with fewer than 600 words. They're earning traffic now but are exposed to quality-signal algorithm updates.",
      priority: "medium",
      recommendation: "Expand these pages to 800+ words before traffic drops. Add supporting sections: FAQs, comparisons, updated statistics, or a related content block. Thin pages that rank are the easiest to lose and the easiest to protect with a content investment.",
      pages: merged.filter(r => r.freshness_risk_flag)
        .sort((a, b) => b.impressions - a.impressions),
    },

    keyword_intent_gap: (() => {
      const rows = gscQueries
        .map(parseQueryRow)
        .filter(q => q.query && q.impressions >= 50)
        .map(q => ({ ...q, intent: detectIntent(q.query) }))
        .filter(q => q.intent !== "informational")
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 100);
      const transCount = rows.filter(r => r.intent === "transactional").length;
      const commCount  = rows.filter(r => r.intent === "commercial").length;
      return {
        id: "keyword-intent-gap",
        title: "Keyword Intent vs Conversion",
        description: `${transCount} transactional and ${commCount} commercial queries are driving impressions. These searches signal purchase or decision intent — verify the landing pages actually deliver a conversion path.`,
        priority: "high",
        recommendation: "For high-impression commercial queries ranking below position 5: rewrite title tags to match buyer language. For queries ranking on page 2: these are the fastest conversion wins — one push to page 1 unlocks high-intent clicks.",
        pages: rows,
      };
    })(),

    query_expansion_gap: (() => {
      const pageIndex = merged.map(p => ({
        Address: p.Address,
        tokens: new Set([
          ...tokenize(p["Title 1"] || ""),
          ...tokenize(p.h1 || ""),
          ...tokenize(p["Meta Description 1"] || ""),
        ]),
      }));
      const rows = gscQueries
        .map(parseQueryRow)
        .filter(q => q.query && q.impressions >= 100 && q.position > 10)
        .map(q => {
          const qTokens = tokenize(q.query);
          if (!qTokens.length) return null;
          let bestScore = 0, bestUrl = null;
          for (const page of pageIndex) {
            if (!page.tokens.size) continue;
            const matches = qTokens.filter(t => page.tokens.has(t)).length;
            const score = matches / qTokens.length;
            if (score > bestScore) { bestScore = score; bestUrl = page.Address; }
          }
          const match_score = Math.round(bestScore * 100);
          const gap_type = match_score < 25 ? "no content" : match_score < 55 ? "weak match" : "needs optimization";
          return { ...q, match_score, best_match_url: bestUrl, gap_type };
        })
        .filter(Boolean)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 100);
      return {
        id: "query-expansion-gap",
        title: "Query Expansion Gaps",
        description: `${rows.length} high-impression queries where the site ranks outside page 1 and has no strong page match. Each row is unmet search demand.`,
        priority: "high",
        recommendation: "'No content' gaps need a new page. 'Weak match' gaps need an existing page retargeted or expanded. 'Needs optimization' gaps are the fastest wins — content exists but title/H1 targeting is off.",
        pages: rows,
      };
    })(),
  };
}

function buildSegmentHealth(merged) {
  const bySegment = {};
  for (const r of merged) {
    if (!bySegment[r.segment]) bySegment[r.segment] = [];
    bySegment[r.segment].push(r);
  }

  const avg = (rows, fn) => rows.length ? rows.reduce((s, r) => s + (fn(r) || 0), 0) / rows.length : 0;
  // Returns null when no rows have the metric — distinguishes "no data" from 0
  const avgNullable = (rows, fn) => {
    const vals = rows.map(fn).filter(v => v != null && v > 0);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };
  const sum = (rows, fn) => rows.reduce((s, r) => s + (fn(r) || 0), 0);

  const rows = Object.entries(bySegment).map(([segment, pages]) => ({
    segment,
    page_count:           pages.length,
    avg_position:         avg(pages, r => r.position),
    avg_bounce_rate:      avgNullable(pages, r => r.bounce_rate),
    avg_engagement_rate:  avgNullable(pages, r => r.engagement_rate),
    avg_engagement_time:  avgNullable(pages, r => r.avg_engagement_time),
    total_views:          sum(pages, r => r.views),
    total_key_events:     sum(pages, r => r.key_events),
    total_clicks:         sum(pages, r => r.clicks),
    total_impressions:    sum(pages, r => r.impressions),
    avg_page_score:     avg(pages, r => r.page_score),
    sf_issue_pages:       pages.filter(r => r.has_sf_issues).length,
  })).sort((a, b) => a.avg_page_score - b.avg_page_score);

  const worst = rows[0];
  const engNote = worst?.avg_engagement_time != null
    ? ` and ${Math.round(worst.avg_engagement_time)}s avg engagement time`
    : "";
  const rec = worst
    ? `The "${worst.segment}" segment has the lowest page score (${worst.avg_page_score.toFixed(0)}), with ${worst.sf_issue_pages} pages flagged for technical issues${engNote}. Prioritize this segment.`
    : "All segments are performing within acceptable ranges.";

  const hasEngagementData = rows.some(r => r.avg_engagement_time != null);

  return {
    id: "segment-health",
    title: "Segment Performance Comparison",
    description: "Aggregate health metrics broken down by URL segment type.",
    priority: "low",
    recommendation: rec,
    pages: rows,
    hasEngagementData,
  };
}
