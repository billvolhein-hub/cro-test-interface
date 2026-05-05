
// ── Helpers ───────────────────────────────────────────────────────────────────

function pieScore(t) {
  const p = Number(t.potential  ?? 5);
  const i = Number(t.importance ?? 5);
  const e = Number(t.ease       ?? 5);
  return Number(((p + i + e) / 3).toFixed(1));
}

function hypothesis(t) {
  const parts = [];
  if (t.if)      parts.push(`IF ${t.if}`);
  if (t.then)    parts.push(`THEN ${t.then}`);
  if (t.because) parts.push(`BECAUSE ${t.because}`);
  return parts.join(" — ");
}

function variantDesc(t) {
  return (t.variants ?? ["B"]).map(v => `Variant ${v}`).join(", ");
}

function stripHtml(html) {
  return (html ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 500);
}

function hexToArgb(hex) {
  // Convert #RRGGBB → FFRRGGBB for ExcelJS
  return "FF" + hex.replace("#", "").toUpperCase();
}

// ── Styling helpers ───────────────────────────────────────────────────────────

function applyHeaderRow(ws, headers, brandBg, brandText) {
  const bgArgb   = hexToArgb(brandBg);
  const textArgb = hexToArgb(brandText);

  const row = ws.addRow(headers);
  row.height = 22;
  row.eachCell(cell => {
    cell.font      = { bold: true, color: { argb: textArgb }, size: 10, name: "Calibri" };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
    cell.alignment = { vertical: "middle", wrapText: false };
    cell.border    = {
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });
  return row;
}

function styleDataCell(cell) {
  cell.font      = { size: 10, name: "Calibri" };
  cell.alignment = { vertical: "top", wrapText: true };
}

function addDropdown(ws, col, fromRow, toRow, values) {
  // col is 1-based index
  for (let r = fromRow; r <= toRow; r++) {
    const cell = ws.getCell(r, col);
    cell.dataValidation = {
      type:         "list",
      allowBlank:   true,
      formulae:     [`"${values.join(",")}"`],
      showErrorMessage: false,
    };
  }
}

// ── Sheet 1: Test Ideation ────────────────────────────────────────────────────

const IDEATION_HEADERS = [
  "Status", "Page", "Test Name", "Hypothesis", "Test Type",
  "Primary Metric", "Secondary Metric", "Control", "Variant",
  "Test Duration", "Audience Type", "Tool", "Owner", "P.I.E. Score", "Notes",
];

const IDEATION_WIDTHS = [16, 42, 36, 70, 16, 26, 26, 12, 40, 14, 18, 16, 16, 12, 24];

const IDEATION_STATUSES  = ["Backlog", "Under Review", "Promoted to Test"];
const CALENDAR_STATUSES  = ["Under Review", "Promoted to Test", "Test Running", "Test Complete"];

function ideationStatus(s) {
  if (s === "Under Review")     return "Under Review";
  if (s === "Promoted to Test") return "Promoted to Experiment";
  return "Backlog";
}

function buildIdeationSheet(wb, tests, brand) {
  const ws = wb.addWorksheet("Test Ideation");

  // Freeze header row
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // Column widths
  IDEATION_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Header
  applyHeaderRow(ws, IDEATION_HEADERS, brand.headerBg, brand.headerText);

  // Data rows
  const rows = tests.filter(t => IDEATION_STATUSES.includes(t.status));
  rows.forEach(t => {
    const row = ws.addRow([
      ideationStatus(t.status),
      t.pageUrl ?? "",
      t.testName ?? "",
      hypothesis(t),
      t.testType ?? "",
      t.primaryMetric ?? "",
      (t.secondaryMetrics ?? []).join(", "),
      "/",
      variantDesc(t),
      "",
      t.audience ?? "",
      "Convert.com",
      "",
      pieScore(t),
      "",
    ]);
    row.height = 40;
    row.eachCell(cell => styleDataCell(cell));
  });

  // Dropdowns (columns are 1-based; apply to all potential data rows)
  const maxRow = Math.max(rows.length + 1, 100);
  addDropdown(ws,  1, 2, maxRow, ["Backlog", "Under Review", "Promoted to Experiment"]);
  addDropdown(ws,  5, 2, maxRow, ["A/B", "A/B/n", "Split URL", "Full Experience", "Multivariate"]);
  addDropdown(ws, 11, 2, maxRow, ["All users", "New Users", "Returning users", "Mobile Only", "Desktop Only", "iOS/Android App", "Media Campaign", "DMA"]);
  addDropdown(ws, 12, 2, maxRow, ["Convert.com", "Optimizely", "Unbounce", "VWO"]);
  addDropdown(ws, 13, 2, maxRow, ["MetricsEdge", brand.ownerName ?? "Client", "Collaboration"]);

  return ws;
}

// ── Sheet 2: Testing Calendar ─────────────────────────────────────────────────

const CALENDAR_HEADERS = [
  "Status", "Date", "PIE Score", "Test Name", "Page / Campaign",
  "Hypothesis Statement", "Primary Metric", "Secondary Metric",
  "Variant Description", "Tool / Platform", "Owner",
  "Start Date", "End Date", "Result / Outcome", "Next Step / Learning",
];

const CALENDAR_WIDTHS = [14, 12, 10, 36, 42, 70, 26, 26, 40, 16, 16, 12, 12, 36, 60];

function calendarStatus(s) {
  if (s === "Test Running")      return "Active";
  if (s === "Test Complete")     return "Complete";
  if (s === "Promoted to Test")  return "Planned";
  return "Planned";
}

function outcomeLabel(t) {
  if (t.status !== "Test Complete" || !t.results) return "No Result";
  const firstGoal = t.results.goals?.[0];
  if (!firstGoal) return "No Result";
  const winner = firstGoal.rows.find(r => r.confidence >= 95 && r.change > 0);
  return winner ? "Winner" : "Inconclusive";
}

function buildCalendarSheet(wb, tests, brand) {
  const ws = wb.addWorksheet("Testing Calendar");

  ws.views = [{ state: "frozen", ySplit: 1 }];
  CALENDAR_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  applyHeaderRow(ws, CALENDAR_HEADERS, brand.headerBg, brand.headerText);

  const rows = tests.filter(t => CALENDAR_STATUSES.includes(t.status));
  rows.forEach(t => {
    const startDate = t.results?.startDate ?? "";
    const endDate   = t.results?.endDate   ?? "";
    const row = ws.addRow([
      calendarStatus(t.status),
      startDate,
      pieScore(t),
      t.testName ?? "",
      t.pageUrl ?? "",
      hypothesis(t),
      t.primaryMetric ?? "",
      (t.secondaryMetrics ?? []).join(", "),
      variantDesc(t),
      "Convert.com",
      "",
      startDate,
      endDate || (t.status === "Test Running" ? "Present" : ""),
      outcomeLabel(t),
      stripHtml(t.findings),
    ]);
    row.height = 40;
    row.eachCell(cell => styleDataCell(cell));
  });

  const maxRow = Math.max(rows.length + 1, 100);
  addDropdown(ws,  1, 2, maxRow, ["Planned", "Active", "Complete", "On Hold", "In Queue"]);
  addDropdown(ws, 10, 2, maxRow, ["Convert.com", "Optimizely", "Unbounce", "VWO"]);
  addDropdown(ws, 11, 2, maxRow, ["MetricsEdge", brand.ownerName ?? "Client", "Collaboration"]);
  addDropdown(ws, 14, 2, maxRow, ["Winner", "Inconclusive", "No Result"]);

  return ws;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function exportTestingCalendar(clientName, tests, brand = {}) {
  const ExcelJS = (await import("exceljs")).default;
  // Use the client's dark background color for headers
  const headerBg   = brand.bgColor    ?? "#1B3A6B";
  const headerText = brand.textColor  ?? "#FFFFFF";

  const resolvedBrand = { headerBg, headerText, ownerName: brand.ownerName };

  const wb = new ExcelJS.Workbook();
  wb.creator  = "CRO Test Interface";
  wb.created  = new Date();

  buildIdeationSheet(wb, tests, resolvedBrand);
  buildCalendarSheet(wb, tests, resolvedBrand);

  // Write to buffer and trigger download
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const slug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const date = new Date().toISOString().slice(0, 10);
  link.href     = url;
  link.download = `${slug}-testing-calendar-${date}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
