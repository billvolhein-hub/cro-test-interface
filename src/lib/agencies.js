import { supabase } from "./supabase";

export async function fetchAgencies() {
  const { data, error } = await supabase.from("agencies").select("*").order("created_at");
  if (error) throw error;
  return data.map(rowToAgency);
}

export async function fetchAgencyBySlug(slug) {
  const { data, error } = await supabase.from("agencies").select("*").eq("slug", slug).single();
  if (error) return null;
  return rowToAgency(data);
}

export async function createAgency({ name, slug, adminPassword, brand }) {
  const { data, error } = await supabase
    .from("agencies")
    .insert({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      admin_password: adminPassword,
      brand: brand ?? { bgColor: "#1B3A6B", accentColor: "#C9A84C", textColor: "#ffffff" },
      created_at: Date.now(),
    })
    .select()
    .single();
  if (error) throw error;
  return rowToAgency(data);
}

export async function updateAgency(id, fields) {
  const row = {};
  if (fields.name          !== undefined) row.name           = fields.name.trim();
  if (fields.slug          !== undefined) row.slug           = fields.slug.trim().toLowerCase();
  if (fields.adminPassword !== undefined) row.admin_password = fields.adminPassword;
  if (fields.brand         !== undefined) row.brand          = fields.brand;
  const { error } = await supabase.from("agencies").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteAgency(id) {
  const { error } = await supabase.from("agencies").delete().eq("id", id);
  if (error) throw error;
}

// ── Platform config (super admin password, etc.) ──────────────────────────────

export async function fetchPlatformConfig() {
  const { data } = await supabase.from("platform_config").select("*");
  if (!data) return {};
  return Object.fromEntries(data.map(r => [r.key, r.value]));
}

export async function setPlatformConfig(key, value) {
  const { error } = await supabase
    .from("platform_config")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw error;
}

// ── Agency logo upload ─────────────────────────────────────────────────────────

export async function uploadAgencyLogo(agencyId, file) {
  const ext  = file.name.split(".").pop();
  const path = `${agencyId}/logo.${ext}`;
  const { error } = await supabase.storage
    .from("agency-logos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from("agency-logos").getPublicUrl(path);
  // Bust cache so the browser reloads the new image
  return `${data.publicUrl}?t=${Date.now()}`;
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
