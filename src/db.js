const BUCKET = "screenshots";

async function db(payload) {
  const res = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Database error");
  return data;
}

async function upload(payload) {
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Upload error");
  return data;
}

export async function loadScreenshots(testId) {
  const data = await db({
    table: "tests",
    action: "select",
    select: "screenshots",
    filters: { id: testId },
    single: true,
  });
  return data?.screenshots ?? {};
}

export async function saveScreenshots(testId, screenshots) {
  const urls = {};

  for (const [zone, value] of Object.entries(screenshots)) {
    if (!value) continue;
    if (value.startsWith("data:")) {
      const ext = value.startsWith("data:image/png") ? "png" : "jpg";
      const { publicUrl } = await upload({
        action: "upload",
        bucket: BUCKET,
        path: `${testId}/${zone}.${ext}`,
        dataUrl: value,
        contentType: ext === "png" ? "image/png" : "image/jpeg",
      });
      urls[zone] = publicUrl;
    } else {
      urls[zone] = value; // already a public URL — keep as-is
    }
  }

  await db({ table: "tests", action: "update", data: { screenshots: urls }, filters: { id: testId } });
}

export async function removeScreenshots(testId) {
  const files = await upload({ action: "list", bucket: BUCKET, prefix: testId });
  if (files?.length) {
    const paths = files.map(f => `${testId}/${f.name}`);
    await upload({ action: "remove", bucket: BUCKET, paths });
  }
  await db({ table: "tests", action: "update", data: { screenshots: {} }, filters: { id: testId } });
}
