import crypto from "crypto";

export const config = {
  api: { bodyParser: { sizeLimit: "4mb" } },
};

function hmacSha256Hex(secret, message) {
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

export default async function handler(req, res) {
  const appId     = process.env.CONVERT_API_KEY;
  const appSecret = process.env.CONVERT_API_SECRET;

  if (!appId || !appSecret) {
    return res.status(500).json({ error: "Missing CONVERT_API_KEY or CONVERT_API_SECRET on server" });
  }

  const slug = Array.isArray(req.query.slug)
    ? req.query.slug.join("/")
    : (req.query.slug || "");

  const targetUrl = `https://api.convert.com/${slug}`;

  const body    = (req.method !== "GET" && req.method !== "HEAD") ? req.body : null;
  const bodyStr = body ? JSON.stringify(body) : "";
  const expires = Math.floor(Date.now() / 1000) + 300;
  const signString = [appId, expires, targetUrl, bodyStr].join("\n");
  const signature  = hmacSha256Hex(appSecret, signString);

  const fetchOptions = {
    method:  req.method,
    headers: {
      "Convert-Application-ID": appId,
      "Expires":                String(expires),
      "Authorization":          `Convert-HMAC-SHA256 Signature=${signature}`,
      "Content-Type":           "application/json",
      "Accept":                 "application/json",
    },
  };
  if (body) fetchOptions.body = bodyStr;

  const response = await fetch(targetUrl, fetchOptions);
  const data = await response.json().catch(() => ({}));
  res.status(response.status).json(data);
}
