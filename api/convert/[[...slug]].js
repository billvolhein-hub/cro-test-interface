export const config = {
  api: { bodyParser: { sizeLimit: "4mb" } },
};

export default async function handler(req, res) {
  const slug = Array.isArray(req.query.slug) ? req.query.slug.join("/") : (req.query.slug || "");
  const targetUrl = `https://api.convert.com/${slug}`;

  const forwardHeaders = {
    "content-type": "application/json",
    "accept":       "application/json",
  };

  // Forward HMAC auth headers computed by the client
  for (const h of ["authorization", "convert-application-id", "expires"]) {
    if (req.headers[h]) forwardHeaders[h] = req.headers[h];
  }

  const fetchOptions = {
    method: req.method,
    headers: forwardHeaders,
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    fetchOptions.body = JSON.stringify(req.body);
  }

  const response = await fetch(targetUrl, fetchOptions);
  const data = await response.json().catch(() => ({}));
  res.status(response.status).json(data);
}
