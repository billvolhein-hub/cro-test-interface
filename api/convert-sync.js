import crypto from "crypto";

export const config = { api: { bodyParser: true } };

function hmac(secret, message) {
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

async function convertCall(appId, appSecret, url, method = "GET", body = null) {
  const bodyStr    = body != null ? JSON.stringify(body) : "";
  const expires    = Math.floor(Date.now() / 1000) + 300;
  const signString = [appId, expires, url, bodyStr].join("\n");
  const signature  = hmac(appSecret, signString);

  const opts = {
    method,
    headers: {
      "Convert-Application-ID": appId,
      "Expires":                String(expires),
      "Authorization":          `Convert-HMAC-SHA256 Signature=${signature}`,
      "Content-Type":           "application/json",
      "Accept":                 "application/json",
    },
  };
  if (bodyStr) opts.body = bodyStr;

  const res  = await fetch(url, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

export default async function handler(req, res) {
  const appId     = process.env.VITE_CONVERT_API_KEY;
  const appSecret = process.env.VITE_CONVERT_API_SECRET;
  const accountId = process.env.VITE_CONVERT_ACCOUNT_ID;
  const projectId = process.env.VITE_CONVERT_PROJECT_ID;

  if (!appId || !appSecret || !accountId || !projectId) {
    return res.status(500).json({ error: "Missing Convert env vars on server" });
  }

  const { experienceId } = req.query;
  if (!experienceId) return res.status(400).json({ error: "Missing experienceId" });

  const base = `https://api.convert.com/api/v2/accounts/${accountId}/projects/${projectId}`;

  // ── Aggregated report ──────────────────────────────────────────────────────
  const report = await convertCall(
    appId, appSecret,
    `${base}/experiences/${experienceId}/aggregated_report`,
    "POST", {}
  );

  if (report.status !== 200) {
    return res.status(report.status).json({ error: report.data?.error ?? report.data ?? "Convert API error" });
  }

  const inner = report.data?.data ?? report.data;

  // ── Goal names ─────────────────────────────────────────────────────────────
  const goalNames = {};
  const goalIds = [...new Set((inner.reportData ?? []).map(r => String(r.goal_id)))];
  await Promise.all(goalIds.map(async (gid) => {
    try {
      const g = await convertCall(appId, appSecret, `${base}/goals/${gid}`);
      if (g.status === 200) {
        const d = g.data?.data ?? g.data;
        const name = d?.name ?? d?.label ?? d?.title;
        if (name) goalNames[gid] = name;
      }
    } catch { /* non-fatal */ }
  }));

  // ── Experience details ─────────────────────────────────────────────────────
  let startDate = "", endDate = "";
  try {
    const exp = await convertCall(appId, appSecret, `${base}/experiences/${experienceId}`);
    if (exp.status === 200) {
      const d   = exp.data?.data ?? exp.data;
      const fmt = (v) => {
        if (!v) return "";
        const dt = new Date(typeof v === "number" ? v * 1000 : v);
        return isNaN(dt) ? "" : dt.toISOString().slice(0, 10);
      };
      startDate = fmt(d?.start_time);
      endDate   = fmt(d?.end_time);
    }
  } catch { /* non-fatal */ }

  // Include a sample of the raw variation conversion_data for debugging field names
  const sampleVariation = inner?.reportData?.[0]?.variations?.[0] ?? null;
  res.json({ inner, goalNames, startDate, endDate, _debug_sample_variation: sampleVariation });
}
