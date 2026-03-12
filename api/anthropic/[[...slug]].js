export const config = {
  api: { bodyParser: { sizeLimit: "4mb" } },
};

export default async function handler(req, res) {
  const slug = Array.isArray(req.query.slug) ? req.query.slug.join("/") : (req.query.slug || "");
  const targetUrl = `https://api.anthropic.com/${slug}`;

  const fetchOptions = {
    method: req.method,
    headers: {
      "x-api-key":          process.env.VITE_ANTHROPIC_API_KEY,
      "anthropic-version":  "2023-06-01",
      "content-type":       "application/json",
    },
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    fetchOptions.body = JSON.stringify(req.body);
  }

  const response = await fetch(targetUrl, fetchOptions);
  const data = await response.json();
  res.status(response.status).json(data);
}
