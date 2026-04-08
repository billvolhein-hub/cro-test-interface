import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Accept up to 10 MB for base64-encoded images
export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

const ALLOWED_BUCKETS = ["screenshots", "agency-logos"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, bucket, ...payload } = req.body ?? {};
  if (!bucket || !ALLOWED_BUCKETS.includes(bucket)) {
    return res.status(400).json({ error: "Bucket not allowed" });
  }

  try {
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
    }

    if (action === "list") {
      const { prefix } = payload;
      const { data, error } = await supabase.storage.from(bucket).list(prefix ?? "");
      if (error) throw error;
      return res.status(200).json(data ?? []);
    }

    if (action === "remove") {
      const { paths } = payload;
      if (!paths?.length) return res.status(200).json({ ok: true });
      const { error } = await supabase.storage.from(bucket).remove(paths);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
