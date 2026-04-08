// All database access goes through /api/db (server-side, service_role key).
// The anon key is never used for data operations.

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

// ── Clients ───────────────────────────────────────────────────────────────────

export async function fetchClients(agencyId) {
  const data = await db({
    table: "clients",
    action: "select",
    order: { col: "created_at", asc: true },
    ...(agencyId ? { filters: { agency_id: agencyId } } : {}),
  });
  return data.map(rowToClient);
}

export async function createClient(name, agencyId) {
  const data = await db({
    table: "clients",
    action: "insert",
    data: { name: name.trim(), created_at: Date.now(), agency_id: agencyId ?? null },
    single: true,
  });
  return rowToClient(data);
}

export async function createClients(names, agencyId) {
  const now = Date.now();
  const rows = names.map((name, i) => ({ name: name.trim(), created_at: now + i, agency_id: agencyId ?? null }));
  const data = await db({ table: "clients", action: "insert", data: rows });
  return data.map(rowToClient);
}

export async function updateClient(id, name) {
  await db({ table: "clients", action: "update", data: { name: name.trim() }, filters: { id } });
}

export async function updateClientBrand(id, brand) {
  await db({ table: "clients", action: "update", data: { brand }, filters: { id } });
}

export async function updateClientCrawlReport(id, crawlReport) {
  await db({ table: "clients", action: "update", data: { crawl_report: crawlReport }, filters: { id } });
}

export async function deleteClient(id) {
  await db({ table: "clients", action: "delete", filters: { id } });
}

export async function updateClientPortalPassword(id, password) {
  await db({ table: "clients", action: "update", data: { portal_password: password || null }, filters: { id } });
}

export async function regeneratePortalToken(id) {
  const data = await db({
    table: "clients",
    action: "update",
    data: { portal_token: crypto.randomUUID() },
    filters: { id },
    select: "portal_token",
    single: true,
  });
  return data.portal_token;
}

function rowToClient(row) {
  return {
    id:             row.id,
    name:           row.name,
    createdAt:      row.created_at,
    agencyId:       row.agency_id ?? null,
    brand:          row.brand ?? {},
    crawlReport:    row.crawl_report ?? null,
    portalToken:    row.portal_token ?? null,
    portalPassword: row.portal_password ?? null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

export async function fetchTests() {
  const data = await db({ table: "tests", action: "select", order: { col: "created_at", asc: true } });
  return data.map(rowToTest);
}

export async function createTest(t) {
  const { id: _id, ...rest } = t;
  const data = await db({ table: "tests", action: "insert", data: testToRow(rest), single: true });
  return rowToTest(data);
}

export async function createTests(arr) {
  const rows = arr.map(({ id: _id, ...rest }) => testToRow(rest));
  const data = await db({ table: "tests", action: "insert", data: rows });
  return data.map(rowToTest);
}

export async function updateTestField(id, field, value) {
  const col = fieldToCol(field);
  await db({ table: "tests", action: "update", data: { [col]: value, updated_at: Date.now() }, filters: { id } });
}

export async function replaceTest(t) {
  const { id, ...rest } = t;
  await db({ table: "tests", action: "update", data: { ...testToRow(rest), updated_at: Date.now() }, filters: { id } });
}

export async function deleteTest(id) {
  await db({ table: "tests", action: "delete", filters: { id } });
}

function fieldToCol(field) {
  if (field === "if")               return "if_text";
  if (field === "then")             return "then_text";
  if (field === "because")          return "because_text";
  if (field === "clientId")         return "client_id";
  if (field === "testName")         return "test_name";
  if (field === "pageUrl")          return "page_url";
  if (field === "testType")         return "test_type";
  if (field === "primaryMetric")    return "primary_metric";
  if (field === "secondaryMetrics") return "secondary_metrics";
  if (field === "updatedAt")        return "updated_at";
  if (field === "createdAt")        return "created_at";
  if (field === "variants")         return "variants";
  if (field === "overlays")         return "overlays";
  if (field === "results")          return "results";
  return field;
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
