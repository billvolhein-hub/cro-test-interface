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

export async function fetchAgencies() {
  const data = await db({ table: "agencies", action: "select", order: { col: "created_at", asc: true } });
  return data.map(rowToAgency);
}

export async function fetchAgencyBySlug(slug) {
  try {
    const data = await db({ table: "agencies", action: "select", filters: { slug }, single: true });
    return rowToAgency(data);
  } catch {
    return null;
  }
}

export async function createAgency({ name, slug, adminPassword, brand }) {
  const data = await db({
    table: "agencies",
    action: "insert",
    data: {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      admin_password: adminPassword,
      brand: brand ?? { bgColor: "#1B3A6B", accentColor: "#C9A84C", textColor: "#ffffff" },
      created_at: Date.now(),
    },
    single: true,
  });
  return rowToAgency(data);
}

export async function updateAgency(id, fields) {
  const row = {};
  if (fields.name          !== undefined) row.name           = fields.name.trim();
  if (fields.slug          !== undefined) row.slug           = fields.slug.trim().toLowerCase();
  if (fields.adminPassword !== undefined) row.admin_password = fields.adminPassword;
  if (fields.brand         !== undefined) row.brand          = fields.brand;
  await db({ table: "agencies", action: "update", data: row, filters: { id } });
}

export async function deleteAgency(id) {
  await db({ table: "agencies", action: "delete", filters: { id } });
}

// ── Platform config ────────────────────────────────────────────────────────────

export async function fetchPlatformConfig() {
  const data = await db({ table: "platform_config", action: "select" });
  if (!data) return {};
  return Object.fromEntries(data.map(r => [r.key, r.value]));
}

export async function setPlatformConfig(key, value) {
  await db({ table: "platform_config", action: "upsert", data: { key, value }, onConflict: "key" });
}

// ── Agency logo upload ─────────────────────────────────────────────────────────

export async function uploadAgencyLogo(agencyId, file) {
  const ext  = file.name.split(".").pop();
  const path = `${agencyId}/logo.${ext}`;

  // Convert File → base64 data URL to send over JSON
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const { publicUrl } = await upload({
    action: "upload",
    bucket: "agency-logos",
    path,
    dataUrl,
    contentType: file.type,
  });

  // Bust cache so the browser reloads the new image
  return `${publicUrl}?t=${Date.now()}`;
}

function rowToAgency(row) {
  return {
    id:            row.id,
    name:          row.name,
    slug:          row.slug,
    brand:         row.brand ?? {},
    adminPassword: row.admin_password ?? "",
    createdAt:     row.created_at,
  };
}
