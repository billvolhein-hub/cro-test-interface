const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

// Dynamically load the Google Identity Services script
function loadGIS() {
  return new Promise((resolve) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

// Request an OAuth access token via the GIS token model (no redirect, popup flow)
export async function getGSCToken() {
  await loadGIS();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (response) => {
        if (response.error) reject(new Error(response.error_description || response.error));
        else resolve(response.access_token);
      },
    });
    client.requestAccessToken({ prompt: "select_account" });
  });
}

// List all verified GSC properties for this account
export async function listGSCSites(token) {
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GSC sites error ${res.status}`);
  const data = await res.json();
  return (data.siteEntry || []).map((s) => s.siteUrl);
}

// Pick the best matching site URL for a given page URL
export function matchSite(sites, pageUrl) {
  try {
    const origin = new URL(pageUrl).origin;
    // Prefer sc-domain: entry, then https origin, then any prefix match
    return (
      sites.find((s) => s === `sc-domain:${new URL(pageUrl).hostname}`) ||
      sites.find((s) => s.startsWith(origin)) ||
      sites.find((s) => pageUrl.startsWith(s)) ||
      sites[0] ||
      null
    );
  } catch {
    return sites[0] || null;
  }
}

// Fetch 90-day search analytics for a site, optionally filtered to a specific page URL
export async function fetchGSCData(token, siteUrl, pageUrl) {
  const end = new Date();
  const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().split("T")[0];

  const body = {
    startDate: fmt(start),
    endDate: fmt(end),
    dimensions: ["query"],
    rowLimit: 100,
  };

  if (pageUrl) {
    body.dimensionFilterGroups = [{
      filters: [{ dimension: "page", operator: "equals", expression: pageUrl }],
    }];
  }

  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) throw new Error(`GSC analytics error ${res.status}`);
  const data = await res.json();
  return data.rows || [];
}

// Convert GSC API rows into a CSV-style text string matching what a manual export would look like
export function gscRowsToText(rows, siteUrl, pageUrl) {
  const lines = [
    `# Google Search Console — ${siteUrl}`,
    pageUrl ? `# Filtered to page: ${pageUrl}` : "",
    `# Date range: last 90 days`,
    "",
    "Query,Clicks,Impressions,CTR,Position",
    ...rows.map((r) =>
      [
        `"${r.keys[0]}"`,
        r.clicks,
        r.impressions,
        `${(r.ctr * 100).toFixed(2)}%`,
        r.position.toFixed(1),
      ].join(",")
    ),
  ].filter((l) => l !== "");

  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
  const avgCtr = rows.length ? ((rows.reduce((s, r) => s + r.ctr, 0) / rows.length) * 100).toFixed(2) : 0;
  const avgPos = rows.length ? (rows.reduce((s, r) => s + r.position, 0) / rows.length).toFixed(1) : 0;

  lines.push("");
  lines.push(`# Summary: ${rows.length} queries, ${totalClicks} clicks, ${totalImpressions} impressions, avg CTR ${avgCtr}%, avg position ${avgPos}`);

  return lines.join("\n");
}
