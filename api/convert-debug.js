import crypto from "crypto";

export default async function handler(req, res) {
  const appId     = process.env.CONVERT_API_KEY;
  const appSecret = process.env.CONVERT_API_SECRET;
  const accountId = process.env.VITE_CONVERT_ACCOUNT_ID ?? req.query.accountId;

  if (!appId || !appSecret) {
    return res.status(500).json({ error: "Missing CONVERT_API_KEY or CONVERT_API_SECRET" });
  }

  const results = {};

  // Test a sequence of URLs to find where things break
  const testUrls = [
    `https://api.convert.com/api/v2/accounts/${accountId}`,
    `https://api.convert.com/api/v2/accounts/${accountId}/projects`,
  ];

  for (const url of testUrls) {
    const expires    = Math.floor(Date.now() / 1000) + 300;
    const signString = [appId, expires, url, ""].join("\n");
    const signature  = crypto.createHmac("sha256", appSecret).update(signString).digest("hex");

    try {
      const r = await fetch(url, {
        headers: {
          "Convert-Application-ID": appId,
          "Expires":                String(expires),
          "Authorization":          `Convert-HMAC-SHA256 Signature=${signature}`,
          "Accept":                 "application/json",
        },
      });
      const body = await r.json().catch(() => null);
      results[url] = { status: r.status, body };
    } catch (e) {
      results[url] = { error: e.message };
    }
  }

  res.json({ accountId, apiKeyPrefix: appId.slice(0, 8), results });
}
