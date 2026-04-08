export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

const ALLOWED_BUCKETS = ["screenshots", "agency-logos"];

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { action, bucket, ...payload } = req.body ?? {};
    if (!bucket || !ALLOWED_BUCKETS.includes(bucket)) {
      return res.status(400).json({ error: "Bucket not allowed" });
    }

    if (action === "upload") {
      const { path, dataUrl, contentType } = payload;
      if (!path || !dataUrl) return res.status(400).json({ error: "Missing path or dataUrl" });
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
      const buf = Buffer.from(base64, "base64");
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, buf, { upsert: true, contentType: contentType ?? "application/octet-stream" });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return res.status(200).json({ publicUrl: data.publicUrl });

    } else if (action === "list") {
      const { data, error } = await supabase.storage.from(bucket).list(payload.prefix ?? "");
      if (error) throw error;
      return res.status(200).json(data ?? []);

    } else if (action === "remove") {
      if (payload.paths?.length) {
        const { error } = await supabase.storage.from(bucket).remove(payload.paths);
        if (error) throw error;
      }
      return res.status(200).json({ ok: true });

    } else {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    res.status(500).json({ error: err.message ?? String(err) });
  }
}
