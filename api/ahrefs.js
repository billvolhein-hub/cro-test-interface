export default async function handler(req, res) {
  const { endpoint, ...params } = req.query;

  if (!endpoint) return res.status(400).json({ error: "endpoint required" });

  const key = process.env.AHREFS_API_KEY;
  if (!key) return res.status(500).json({ error: "AHREFS_API_KEY not configured" });

  const qs = new URLSearchParams(params).toString();
  const url = `https://api.ahrefs.com/v3/site-explorer/${endpoint}${qs ? "?" + qs : ""}`;

  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
