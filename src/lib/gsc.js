const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

// OAuth 2.0 implicit flow via popup — no GIS library needed.
// redirect_uri must be added to the OAuth client's Authorized Redirect URIs in Google Cloud Console.
export function getGSCToken() {
  const redirectUri = `${window.location.origin}/auth/callback`;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "token",
    scope: SCOPE,
    prompt: "select_account",
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  return new Promise((resolve, reject) => {
    const popup = window.open(authUrl, "gsc-oauth", "width=520,height=660,left=200,top=100");
    if (!popup) {
      reject(new Error("Popup blocked — please allow popups for this site."));
      return;
    }

    const interval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(interval);
          reject(new Error("Authentication cancelled."));
          return;
        }
        // Once the popup lands back on our origin we can read the hash
        if (popup.location.pathname === "/auth/callback") {
          const hash = popup.location.hash;
          clearInterval(interval);
          popup.close();
          const p = new URLSearchParams(hash.substring(1));
          const token = p.get("access_token");
          if (token) resolve(token);
          else reject(new Error(p.get("error_description") || p.get("error") || "No token received."));
        }
      } catch {
        // Cross-origin error while popup is on Google's domain — expected, keep polling
      }
    }, 200);

    setTimeout(() => {
      clearInterval(interval);
      if (!popup.closed) popup.close();
      reject(new Error("Authentication timed out."));
    }, 5 * 60 * 1000);
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
