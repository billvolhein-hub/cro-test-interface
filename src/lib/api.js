import { supabase } from "./supabase";

// ── Clients ──────────────────────────────────────────────────────────────────

export async function fetchClients(agencyId) {
  let query = supabase.from("clients").select("*").order("created_at");
  if (agencyId) query = query.eq("agency_id", agencyId);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(rowToClient);
}

export async function createClient(name, agencyId) {
  const { data, error } = await supabase
    .from("clients")
    .insert({ name: name.trim(), created_at: Date.now(), agency_id: agencyId ?? null })
    .select()
    .single();
  if (error) throw error;
  return rowToClient(data);
}

export async function createClients(names, agencyId) {
  const now = Date.now();
  const rows = names.map((name, i) => ({ name: name.trim(), created_at: now + i, agency_id: agencyId ?? null }));
  const { data, error } = await supabase.from("clients").insert(rows).select();
  if (error) throw error;
  return data.map(rowToClient);
}

export async function updateClient(id, name) {
  const { error } = await supabase.from("clients").update({ name: name.trim() }).eq("id", id);
  if (error) throw error;
}

export async function updateClientBrand(id, brand) {
  const { error } = await supabase.from("clients").update({ brand }).eq("id", id);
  if (error) throw error;
}

export async function updateClientCrawlReport(id, crawlReport) {
  const { error } = await supabase.from("clients").update({ crawl_report: crawlReport }).eq("id", id);
  if (error) throw error;
}

export async function deleteClient(id) {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

export async function updateClientPortalPassword(id, password) {
  const { error } = await supabase.from("clients").update({ portal_password: password || null }).eq("id", id);
  if (error) throw error;
}

export async function regeneratePortalToken(id) {
  const { data, error } = await supabase
    .from("clients")
    .update({ portal_token: crypto.randomUUID() })
    .eq("id", id)
    .select("portal_token")
    .single();
  if (error) throw error;
  return data.portal_token;
}

function rowToClient(row) {
  return { id: row.id, name: row.name, createdAt: row.created_at, agencyId: row.agency_id ?? null, brand: row.brand ?? {}, crawlReport: row.crawl_report ?? null, portalToken: row.portal_token ?? null, portalPassword: row.portal_password ?? null };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

export async function fetchTests() {
  const { data, error } = await supabase.from("tests").select("*").order("created_at");
  if (error) throw error;
  return data.map(rowToTest);
}

export async function createTest(t) {
  const { id: _id, ...rest } = t;
  const row = testToRow(rest);
  const { data, error } = await supabase.from("tests").insert(row).select().single();
  if (error) throw error;
  return rowToTest(data);
}

export async function createTests(arr) {
  const rows = arr.map(({ id: _id, ...rest }) => testToRow(rest));
  const { data, error } = await supabase.from("tests").insert(rows).select();
  if (error) throw error;
  return data.map(rowToTest);
}

export async function updateTestField(id, field, value) {
  const col = fieldToCol(field);
  const { error } = await supabase
    .from("tests")
    .update({ [col]: value, updated_at: Date.now() })
    .eq("id", id);
  if (error) throw error;
}

export async function replaceTest(t) {
  const { id, ...rest } = t;
  const row = { ...testToRow(rest), updated_at: Date.now() };
  const { error } = await supabase.from("tests").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteTest(id) {
  const { error } = await supabase.from("tests").delete().eq("id", id);
  if (error) throw error;
}

// Map app field names → DB column names (reserved words need aliasing)
function fieldToCol(field) {
  if (field === "if")      return "if_text";
  if (field === "then")    return "then_text";
  if (field === "because") return "because_text";
  if (field === "clientId") return "client_id";
  if (field === "testName") return "test_name";
  if (field === "pageUrl")  return "page_url";
  if (field === "testType") return "test_type";
  if (field === "primaryMetric")    return "primary_metric";
  if (field === "secondaryMetrics") return "secondary_metrics";
  if (field === "updatedAt") return "updated_at";
  if (field === "createdAt") return "created_at";
  if (field === "variants") return "variants";
  if (field === "overlays") return "overlays";
  if (field === "results") return "results";
  return field; // potential, importance, ease, status, audience, findings
}

function testToRow(t) {
  return {
    client_id:         t.clientId ?? null,
    test_name:         t.testName ?? null,
    status:            t.status ?? "Backlog",
    if_text:           t.if ?? null,
    then_text:         t.then ?? null,
    because_text:      t.because ?? null,
    potential:         t.potential ?? 5,
    importance:        t.importance ?? 5,
    ease:              t.ease ?? 5,
    test_type:         t.testType ?? null,
    audience:          t.audience ?? null,
    page_url:          t.pageUrl ?? null,
    primary_metric:    t.primaryMetric ?? null,
    secondary_metrics: t.secondaryMetrics ?? [],
    findings:          t.findings ?? null,
    variants:          t.variants ?? ["B"],
    overlays:          t.overlays ?? {},
    results:           t.results ?? null,
    screenshots:       t.screenshots ?? {},
    created_at:        t.createdAt ?? Date.now(),
    updated_at:        t.updatedAt ?? null,
  };
}

function rowToTest(row) {
  return {
    id:               row.id,
    clientId:         row.client_id,
    testName:         row.test_name,
    status:           row.status,
    if:               row.if_text,
    then:             row.then_text,
    because:          row.because_text,
    potential:        row.potential,
    importance:       row.importance,
    ease:             row.ease,
    testType:         row.test_type,
    audience:         row.audience,
    pageUrl:          row.page_url,
    primaryMetric:    row.primary_metric,
    secondaryMetrics: row.secondary_metrics ?? [],
    findings:         row.findings ?? "",
    variants:         row.variants ?? ["B"],
    overlays:         row.overlays ?? {},
    results:          row.results ?? null,
    screenshots:      row.screenshots ?? {},
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  };
}
