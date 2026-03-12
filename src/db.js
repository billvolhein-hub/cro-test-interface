import { supabase } from "./lib/supabase";

const BUCKET = "screenshots";

// Returns { controlDesktop, controlMobile, variantDesktop, variantMobile, ... } (public URLs)
export async function loadScreenshots(testId) {
  const { data, error } = await supabase
    .from("tests")
    .select("screenshots")
    .eq("id", testId)
    .single();
  if (error || !data) return {};
  return data.screenshots ?? {};
}

// Accepts screenshots object where values may be data URLs or existing public URLs.
// Uploads any data URLs to Supabase Storage and saves URL map back to tests.screenshots.
export async function saveScreenshots(testId, screenshots) {
  const urls = {};

  for (const [zone, value] of Object.entries(screenshots)) {
    if (!value) continue;

    if (value.startsWith("data:")) {
      // Convert data URL → blob and upload
      const res = await fetch(value);
      const blob = await res.blob();
      const ext = blob.type.includes("png") ? "png" : "jpg";
      const path = `${testId}/${zone}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { upsert: true, contentType: blob.type });

      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(path);
        urls[zone] = publicUrl;
      }
    } else {
      // Already a public URL — keep as-is
      urls[zone] = value;
    }
  }

  await supabase
    .from("tests")
    .update({ screenshots: urls })
    .eq("id", testId);
}

// Removes all screenshots for a deleted test
export async function removeScreenshots(testId) {
  const { data: files } = await supabase.storage.from(BUCKET).list(testId);
  if (files?.length) {
    const paths = files.map((f) => `${testId}/${f.name}`);
    await supabase.storage.from(BUCKET).remove(paths);
  }
  await supabase.from("tests").update({ screenshots: {} }).eq("id", testId);
}
