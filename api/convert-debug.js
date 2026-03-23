import crypto from "crypto";

export default async function handler(req, res) {
  const appId     = process.env.CONVERT_API_KEY     ?? process.env.VITE_CONVERT_API_KEY;
  const appSecret = process.env.CONVERT_API_SECRET  ?? process.env.VITE_CONVERT_API_SECRET;
  const accountId = process.env.VITE_CONVERT_ACCOUNT_ID ?? req.query.accountId;

  const allConvertKeys = Object.keys(process.env).filter(k => k.toLowerCase().includes("convert"));

  if (!appId || !appSecret) {
    return res.status(500).json({
      error: "Missing CONVERT_API_KEY or CONVERT_API_SECRET",
      convert_keys_visible: allConvertKeys,
      CONVERT_API_KEY: process.env.CONVERT_API_KEY ?? "UNDEFINED",
      CONVERT_API_SECRET: process.env.CONVERT_API_SECRET ? "SET" : "UNDEFINED",
    });
  }

  const results = {};

  const projectId = process.env.VITE_CONVERT_PROJECT_ID;
  const expId     = req.query.expId || "100136426";

  const tests = [
    { method: "GET",  url: `https://api.convert.com/api/v2/accounts/${accountId}/projects/${projectId}/experiences`, body: null },
    { method: "POST", url: `https://api.convert.com/api/v2/accounts/${accountId}/projects/${projectId}/experiences/${expId}/aggregated_report`, body: {} },
    { method: "GET",  url: `https://api.convert.com/api/v2/accounts/${accountId}/projects/${projectId}/experiences/${expId}`, body: null },
  ];

  for (const t of tests) {
    const bodyStr    = t.body != null ? JSON.stringify(t.body) : "";
    const expires    = Math.floor(Date.now() / 1000) + 300;
    const signString = [appId, expires, t.url, bodyStr].join("\n");
    const signature  = crypto.createHmac("sha256", appSecret).update(signString).digest("hex");

    try {
      const fetchOpts = {
        method:  t.method,
        headers: {
          "Convert-Application-ID": appId,
          "Expires":                String(expires),
          "Authorization":          `Convert-HMAC-SHA256 Signature=${signature}`,
          "Content-Type":           "application/json",
          "Accept":                 "application/json",
        },
      };
      if (bodyStr) fetchOpts.body = bodyStr;

      const r    = await fetch(t.url, fetchOpts);
      const text = await r.text();
      let body;
      try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
      results[`${t.method} ${t.url}`] = { status: r.status, body };
    } catch (e) {
      results[`${t.method} ${t.url}`] = { error: e.message };
    }
  }

  res.json({ accountId, apiKeyPrefix: appId.slice(0, 8), results });
}
