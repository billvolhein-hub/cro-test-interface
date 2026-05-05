import { useState } from "react";
import { ACCENT, TEAL, GOLD, BG, CARD, BORDER, TEXT, MUTED, DIM } from "../lib/constants";
import { useBreakpoint } from "../lib/useBreakpoint";

const NAV = [
  { id: "architecture",  icon: "🏗️", label: "Architecture" },
  { id: "data-models",   icon: "🗄️", label: "Data Models" },
  { id: "api-routes",    icon: "⚡",  label: "API Routes" },
  { id: "database",      icon: "🔧",  label: "Database Schema" },
  { id: "ai",            icon: "🤖",  label: "AI Integration" },
  { id: "environment",   icon: "🌍",  label: "Environment & Deploy" },
];

function H2({ children }) {
  return <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, marginBottom: 6 }}>{children}</div>;
}
function H3({ children, color = TEXT }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color, marginTop: 20, marginBottom: 8 }}>{children}</div>;
}
function P({ children }) {
  return <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.65, marginBottom: 10 }}>{children}</div>;
}
function Li({ children }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 5 }}>
      <span style={{ color: TEAL, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>›</span>
      <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}
function Code({ children, block }) {
  if (block) {
    return (
      <pre style={{ background: "#0F172A", color: "#E2E8F0", borderRadius: 8, padding: "14px 16px", fontSize: 12, lineHeight: 1.6, overflowX: "auto", marginTop: 8, marginBottom: 12, fontFamily: "monospace" }}>
        {children}
      </pre>
    );
  }
  return <code style={{ background: "#F1F5F9", color: "#1E293B", padding: "1px 5px", borderRadius: 3, fontSize: 12, fontFamily: "monospace" }}>{children}</code>;
}
function Table({ headers, rows }) {
  return (
    <div style={{ overflowX: "auto", marginTop: 8, marginBottom: 16 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, fontFamily: "'Inter',sans-serif" }}>
        <thead>
          <tr style={{ background: "#F8FAFC" }}>
            {headers.map(h => (
              <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: MUTED, borderBottom: `1.5px solid ${BORDER}`, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "7px 12px", color: j === 0 ? TEXT : MUTED, verticalAlign: "top" }}>
                  {j === 0 ? <Code>{cell}</Code> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Note({ children }) {
  return (
    <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px", marginTop: 10, marginBottom: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#B45309", textTransform: "uppercase", letterSpacing: 0.8 }}>Note  </span>
      <span style={{ fontSize: 12, color: "#B45309", lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

const CONTENT = {
  architecture: (
    <div>
      <H2>System Architecture</H2>
      <P>MetricsEdge is a React single-page application deployed on Vercel, with a Supabase Postgres backend accessed exclusively through Vercel Serverless Functions.</P>

      <H3 color={ACCENT}>Stack Overview</H3>
      <Li><strong>Frontend:</strong> React 18 SPA built with Vite 5. Zero CSS framework — 100% inline styles throughout.</Li>
      <Li><strong>Routing:</strong> react-router-dom v7 with client-side routing. A Vercel rewrite sends all non-API paths to <Code>/index.html</Code>.</Li>
      <Li><strong>Backend:</strong> Vercel Serverless Functions (<Code>/api/*.js</Code>) — Node.js, CommonJS.</Li>
      <Li><strong>Database:</strong> Supabase (Postgres). All access via <Code>/api/db</Code> proxy using the service_role key. The anon key is never exposed to the browser.</Li>
      <Li><strong>Storage:</strong> Supabase Storage (<Code>agency-logos</Code> bucket) via <Code>/api/upload</Code>.</Li>
      <Li><strong>AI:</strong> Anthropic API proxied via <Code>/api/anthropic/v1/messages</Code>.</Li>
      <Li><strong>Screenshots:</strong> Puppeteer + <Code>@sparticuz/chromium</Code> via <Code>/api/screenshot</Code>.</Li>
      <Li><strong>Local Storage:</strong> Test screenshots stored in browser IndexedDB (not synced to server).</Li>

      <H3 color={ACCENT}>URL Routing Tree</H3>
      <Code block>{`/                               Platform Admin (manage agencies)
/:agencySlug/                   Agency dashboard (HomePage)
/:agencySlug/clients/:id        Client portfolio (ClientPage)
/:agencySlug/tests/:id          Test detail view (TestDetailsPage)
/:agencySlug/tests/:id/edit     Test editor (TestDefinitionPage)
/portal/:portalToken            Client portal (ClientPage, portal mode)
/portal/:portalToken/tests/:slug  Test in portal (TestDetailsPage, portal mode)`}</Code>

      <H3 color={ACCENT}>Component Hierarchy</H3>
      <Code block>{`App
├── SuperAdminShell → SuperAdminPage
│                     ├── SuperAdminAnalytics (charts dashboard — own fetch)
│                     ├── SuperAdminKanban    (projects board — own load/save)
│                     └── TechDocsModal       (this modal)
├── AgencyWrapper (fetches agency record)
│   └── AgencyGate (password check)
│       └── AgencyContext.Provider
│           └── AgencyApp (all state + handlers)
│               ├── AppHeader (gear + ? Help buttons)
│               │   └── HelpCenterModal (agency help center)
│               ├── HomePage
│               ├── ClientPage
│               ├── TestDetailsPage
│               └── TestDefinitionPage
└── PortalShell → PortalGate → PortalContext.Provider
    ├── ClientPage (isPortal = true)
    └── TestDetailsPage (isPortal = true)`}</Code>

      <H3 color={ACCENT}>State Management</H3>
      <P>There is no Redux or Zustand. All state is lifted to <Code>AgencyApp</Code> and flows down via props. Update handlers (e.g. <Code>onCreateTest</Code>, <Code>onUpdateTest</Code>) are passed down from <Code>AgencyApp</Code> to all child pages.</P>
      <Li><Code>AgencyContext</Code> provides <Code>agency</Code> and <Code>onUpdateAgency</Code> to any descendant.</Li>
      <Li><Code>PortalContext</Code> provides <Code>isPortal: true</Code> to portal views.</Li>
      <Li>Screenshots are stored in browser IndexedDB only — not in Supabase.</Li>

      <H3 color={ACCENT}>Security Model</H3>
      <Li><Code>SuperAdminGate</Code>: checks <Code>localStorage["me_superadmin_auth"]</Code> against <Code>platform_config.super_admin_password</Code></Li>
      <Li><Code>AgencyGate</Code>: checks <Code>localStorage["me_agency_auth_{"{slug}"}"]</Code> against <Code>agency.admin_password</Code></Li>
      <Li><Code>PortalGate</Code>: checks <Code>sessionStorage["portal_auth_{"{clientId}"}"]</Code> against <Code>client.portal_password</Code></Li>
      <Li>Impersonation: super admin sets <Code>sessionStorage["me_superadmin_impersonating"]</Code> to bypass the agency gate</Li>
      <Note>Auth is lightweight password-check only — not JWT/OAuth. Suitable for a trusted-team internal tool.</Note>

      <H3 color={ACCENT}>SuperAdminKanban — Projects Board</H3>
      <P>A self-contained Kanban board in SuperAdminPage for tracking platform development work. It owns its own data loading and saving — no props required.</P>
      <Li><strong>Columns:</strong> Backlog → In Progress → Review → Done</Li>
      <Li><strong>Card fields:</strong> title, description, priority (High/Medium/Low), label (Feature/Bug/Design/Content/Infra/Research), columnId, createdAt, updatedAt</Li>
      <Li><strong>Drag and drop:</strong> HTML5 Drag and Drop API — <Code>draggable</Code>, <Code>onDragStart</Code>, <Code>onDragOver</Code>, <Code>onDrop</Code></Li>
      <Li><strong>Persistence:</strong> full cards array JSON-serialized into <Code>platform_config</Code> key <Code>super_admin_kanban</Code> via upsert on every change</Li>
      <Li><strong>IDs:</strong> <Code>crypto.randomUUID()</Code> for new cards</Li>

      <H3 color={ACCENT}>SuperAdminAnalytics — Platform Dashboard</H3>
      <P>A self-contained analytics dashboard rendered above the agency list in SuperAdminPage. Fetches all agencies, clients, and tests independently on mount — no props required.</P>
      <Li><strong>Data fetch:</strong> <Code>Promise.all([fetchAgencies(), fetchClients(), fetchTests()])</Code> — no agencyId filter, returns all platform data</Li>
      <Li><strong>Date range:</strong> 7d / 30d / 90d / All selector in section header. Applies to velocity chart and test type mix. Pipeline, leaderboard, and PIE charts are always all-time.</Li>
      <Li><strong>Charts library:</strong> Recharts — <Code>LineChart</Code>, <Code>BarChart</Code> (<Code>layout="vertical"</Code>), <Code>PieChart</Code>, <Code>ResponsiveContainer</Code></Li>
      <Li><strong>KPI Strip:</strong> Agencies, Clients, Total Tests, Live Now (Test Running), Avg PIE score</Li>
      <Li><strong>Velocity buckets:</strong> 7d = daily, 30d = 4 weekly, 90d = 13 weekly, All = 12 monthly</Li>
      <Li><strong>Agency leaderboard:</strong> counts tests per agency by joining agency → clients → tests via <Code>clientId</Code></Li>
      <Li><strong>Platform Health:</strong> SEO coverage = clients with at least one <Code>crawlReport</Code> domain; portal adoption = clients with a non-null <Code>portalToken</Code></Li>
    </div>
  ),

  "data-models": (
    <div>
      <H2>Data Models</H2>
      <P>All data is stored in Supabase. The JavaScript layer maps snake_case column names to camelCase properties via <Code>rowTo*()</Code> transform functions in <Code>src/lib/api.js</Code> and <Code>src/lib/agencies.js</Code>.</P>

      <H3 color={ACCENT}>Agency Shape (JS)</H3>
      <Code block>{`{
  id: number,
  name: string,
  slug: string,           // unique URL slug (/slug/)
  brand: {
    bgColor: string,      // hex
    accentColor: string,  // hex
    textColor: string,    // hex
    logoUrl: string,      // Supabase Storage public URL
  },
  adminPassword: string,
  createdAt: number,      // Unix ms
}`}</Code>

      <H3 color={ACCENT}>Client Shape (JS)</H3>
      <Code block>{`{
  id: number,
  name: string,
  agencyId: number | null,
  brand: {
    bgColor, accentColor, textColor, logoUrl,
    tagline: string,        // portal header tagline
    custom_ua: string,      // custom Puppeteer User-Agent
  },
  customUA: string | null,  // shortcut from brand.custom_ua
  crawlReports: {           // domain-keyed map
    "example.com": { domain, internal, issues, ahrefs }
  },
  domains: string[],        // keys of crawlReports
  crawlReport: object,      // first domain (legacy compat)
  portalToken: string,      // UUID for portal URL
  portalPassword: string | null,
  createdAt: number,
}`}</Code>

      <H3 color={ACCENT}>CrawlReport Shape (per domain)</H3>
      <Code block>{`{
  domain: "example.com",
  internal: {
    totalCrawled: number,
    htmlPages: number,
    avgRt: string,          // e.g. "1.23" seconds
    wordCount: {
      "Thin (<300)": number,
      "Short (300-600)": number,
      // etc.
    }
  },
  issues: {
    byPriority: { High: number, Medium: number, Low: number },
    byPrioritySorted: [{
      name: string,
      priority: "High" | "Medium" | "Low",
      urls: number,
      description: string,
    }]
  },
  ahrefs: {
    data: {
      dr: { domain_rating: number },
      metrics: { live: number, live_refdomains: number },
      // + top pages, anchors, broken links, etc.
    }
  }
}`}</Code>

      <H3 color={ACCENT}>Test Shape (JS)</H3>
      <Code block>{`{
  id: number,
  clientId: number,
  testName: string,
  status: "Backlog" | "Under Review" | "Promoted to Test"
        | "Test Running" | "Test Complete",
  if: string,             // maps to DB column if_text
  then: string,           // maps to then_text
  because: string,        // maps to because_text
  potential: number,      // PIE 1-10
  importance: number,     // PIE 1-10
  ease: number,           // PIE 1-10
  testType: string,       // "A/B" | "A/B/n" | "Multivariate" | ...
  audience: string,
  pageUrl: string,
  primaryMetric: string,
  secondaryMetrics: string[],
  findings: string,
  variants: string[],     // e.g. ["B"] or ["B","C"]
  overlays: {
    B: [{ id, label, color, note, relX, relY }]
  },
  results: {
    variantOrder: string[],
    goals: [{
      name: string,
      rows: [{ variant, conversions, sessions, rate, change }]
    }],
    aiPrediction: {
      probability: number,
      evidence: string,
      lever: string,       // "A" through "G"
      principle: string,
    }
  } | null,
  createdAt: number,
  updatedAt: number | null,
}`}</Code>

      <H3 color={ACCENT}>crawlReports Format Migration</H3>
      <P>The <Code>crawl_report</Code> column supports two historical formats. Always use <Code>normalizeCrawlReports(raw)</Code> from <Code>api.js</Code> when reading or writing:</P>
      <Li><strong>Old (legacy):</strong> flat object with <Code>domain</Code> key — <Code>{"{ domain: \"x.com\", internal: {...} }"}</Code></Li>
      <Li><strong>New (current):</strong> domain-keyed map — <Code>{"{ \"x.com\": { domain, internal, ... } }"}</Code></Li>
      <P><Code>rowToClient()</Code> calls <Code>normalizeCrawlReports()</Code> automatically, so the JS client object always has the new shape.</P>
    </div>
  ),

  "api-routes": (
    <div>
      <H2>API Routes</H2>
      <P>All backend logic lives in <Code>/api/*.js</Code>. Each file exports a default <Code>handler(req, res)</Code> function (Vercel Serverless Functions, Node.js runtime).</P>

      <H3 color={ACCENT}>POST /api/db — Database Proxy</H3>
      <P>The primary data access layer. All frontend DB operations go through this endpoint using the Supabase service_role key.</P>
      <Code block>{`// Request body
{
  table: "agencies" | "clients" | "tests" | "platform_config",
  action: "select" | "insert" | "update" | "delete" | "upsert",
  data: { ... },          // for insert/update/upsert
  filters: { col: val },  // chained as .eq(col, val)
  order: { col, asc },    // for select
  select: "*",            // columns (default "*")
  single: true,           // .single() modifier
  onConflict: "key",      // for upsert
}

// Response
200: data (array, object, or null)
400: { error: "Missing table or action" }
500: { error: "..." }`}</Code>

      <H3 color={ACCENT}>POST /api/upload — Storage Upload</H3>
      <Code block>{`// Request
{
  action: "upload",
  bucket: "agency-logos",
  path: "{agencyId}/logo.{ext}",
  dataUrl: "data:image/png;base64,...",
  contentType: "image/png"
}

// Response
{ publicUrl: "https://..." }`}</Code>

      <H3 color={ACCENT}>GET /api/screenshot — Puppeteer Screenshot</H3>
      <Code block>{`// Query params
?url=https://example.com    // required
&ua=Mozilla/5.0...          // optional custom User-Agent

// Response
{ dataUrl: "data:image/jpeg;base64,..." }

// Vercel config: memory 1024MB, maxDuration 45s`}</Code>

      <H3 color={ACCENT}>POST /api/ahrefs — Ahrefs Data Proxy</H3>
      <P>Proxies requests to the Ahrefs Data API v3. Uses <Code>AHREFS_API_KEY</Code> environment variable. Returns structured backlink and metrics data per endpoint called.</P>

      <H3 color={ACCENT}>POST /api/anthropic/v1/messages — AI Proxy</H3>
      <P>Proxies Claude API calls, injecting <Code>ANTHROPIC_API_KEY</Code> server-side. The request body is forwarded directly to the Anthropic Messages API.</P>
      <Code block>{`// Request (standard Anthropic Messages format)
{
  model: "claude-opus-4-6",
  max_tokens: 4096,
  temperature: 1,
  system: "...",
  messages: [{ role: "user", content: [...] }]
}

// Models used in this app:
// claude-opus-4-6              → AI Ideation (complex reasoning)
// claude-haiku-4-5-20251001    → Brand color extraction (fast/cheap)`}</Code>

      <H3 color={ACCENT}>POST /api/convert-sync — Convert.com Sync</H3>
      <P>Fetches test results from the Convert.com A/B testing platform using <Code>CONVERT_ACCOUNT_ID</Code>, <Code>CONVERT_PROJECT_ID</Code>, and a Convert API key. Returns variant-level conversion data for import.</P>

      <H3 color={ACCENT}>Frontend DB Call Pattern</H3>
      <Code block>{`// src/lib/api.js and src/lib/agencies.js
async function db(payload) {
  const res = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Database error");
  return data;
}`}</Code>

      <H3 color={ACCENT}>Adding a New API Route</H3>
      <Li>Create <Code>/api/newroute.js</Code> with <Code>export default async function handler(req, res) {"{ ... }"}</Code></Li>
      <Li>Add to <Code>vercel.json</Code> <Code>functions</Code> config if you need custom memory/timeout</Li>
      <Li>Frontend calls via <Code>fetch("/api/newroute", ...)</Code></Li>
    </div>
  ),

  database: (
    <div>
      <H2>Database Schema</H2>
      <P>Four tables in Supabase (Postgres). Timestamps are Unix milliseconds (int8), not ISO strings.</P>

      <H3 color={ACCENT}>agencies</H3>
      <Table
        headers={["Column", "Type", "Notes"]}
        rows={[
          ["id", "int8 PK", "Auto-increment"],
          ["name", "text", "Agency display name"],
          ["slug", "text UNIQUE", "URL path segment (e.g. 'acme-agency')"],
          ["admin_password", "text", "Plain text password for AgencyGate"],
          ["brand", "jsonb", "{ bgColor, accentColor, textColor, logoUrl }"],
          ["created_at", "int8", "Unix ms"],
        ]}
      />

      <H3 color={ACCENT}>clients</H3>
      <Table
        headers={["Column", "Type", "Notes"]}
        rows={[
          ["id", "int8 PK", "Auto-increment"],
          ["name", "text", "Client name"],
          ["agency_id", "int8 FK", "→ agencies.id"],
          ["brand", "jsonb", "{ bgColor, accentColor, textColor, logoUrl, tagline, custom_ua }"],
          ["crawl_report", "jsonb", "Domain-keyed crawl/SEO data map"],
          ["portal_token", "uuid", "Shareable portal URL token"],
          ["portal_password", "text NULL", "Optional portal password"],
          ["created_at", "int8", "Unix ms"],
        ]}
      />

      <H3 color={ACCENT}>tests</H3>
      <Table
        headers={["Column", "Type", "Notes"]}
        rows={[
          ["id", "int8 PK", ""],
          ["client_id", "int8 FK", "→ clients.id"],
          ["test_name", "text", ""],
          ["status", "text", "Pipeline status string"],
          ["if_text", "text", "IF hypothesis clause"],
          ["then_text", "text", "THEN hypothesis clause"],
          ["because_text", "text", "BECAUSE hypothesis clause"],
          ["potential", "int", "PIE score 1-10"],
          ["importance", "int", "PIE score 1-10"],
          ["ease", "int", "PIE score 1-10"],
          ["test_type", "text", "A/B, A/B/n, Multivariate, etc."],
          ["audience", "text", "Target audience segment"],
          ["page_url", "text", ""],
          ["primary_metric", "text", ""],
          ["secondary_metrics", "jsonb", "string[]"],
          ["findings", "text", "Post-test learnings"],
          ["variants", "jsonb", 'string[] e.g. ["B"] or ["B","C"]'],
          ["overlays", "jsonb", "{ B: [{id,label,color,note,relX,relY}] }"],
          ["results", "jsonb", "{ variantOrder, goals, aiPrediction } | null"],
          ["screenshots", "jsonb", "Legacy — use IndexedDB instead"],
          ["created_at", "int8", "Unix ms"],
          ["updated_at", "int8 NULL", "Unix ms"],
        ]}
      />

      <H3 color={ACCENT}>platform_config</H3>
      <Table
        headers={["Column", "Type", "Notes"]}
        rows={[
          ["key", "text PK", "Config key"],
          ["value", "text", "Config value"],
        ]}
      />
      <P>Current keys used:</P>
      <Li><Code>super_admin_password</Code> — platform admin password (plain string)</Li>
      <Li><Code>super_admin_kanban</Code> — projects kanban cards array (JSON-serialized)</Li>
      <Note>When reading from <Code>platform_config</Code> for a key that may not exist yet, do NOT use <Code>single: true</Code> — Supabase throws PGRST116 if no row is found. Use a normal array select and check <Code>rows[0]?.value</Code> instead.</Note>

      <H3 color={ACCENT}>Supabase Storage</H3>
      <Li><strong>Bucket:</strong> <Code>agency-logos</Code> (public)</Li>
      <Li><strong>Path pattern:</strong> <Code>{"{agencyId}/logo.{ext}"}</Code></Li>
      <Li>Uploaded via <Code>/api/upload</Code>, public URL returned and stored in <Code>agencies.brand.logoUrl</Code></Li>

      <H3 color={ACCENT}>IndexedDB (Browser-only)</H3>
      <P>Test screenshots are stored in the browser's IndexedDB, not in Supabase.</P>
      <Li><strong>DB name:</strong> <Code>hypothesis-screenshots</Code></Li>
      <Li><strong>Store:</strong> <Code>screenshots</Code></Li>
      <Li><strong>Key:</strong> test ID (number)</Li>
      <Li><strong>Value:</strong> <Code>{"{ controlDesktop: \"data:image/...\", variantDesktop: ... }"}</Code></Li>
      <Note>Screenshots are browser-local only. They do not sync across devices. Clearing browser data deletes them.</Note>
    </div>
  ),

  ai: (
    <div>
      <H2>AI Integration</H2>
      <P>Four AI features use the Anthropic API via the <Code>/api/anthropic/v1/messages</Code> proxy: AI Ideation, Build Hypothesis, Generate Visualizations, and Brand Color Extraction.</P>

      <H3 color={ACCENT}>AI Ideation — Model & Config</H3>
      <Li><strong>Model:</strong> <Code>claude-opus-4-6</Code></Li>
      <Li><strong>Temperature:</strong> 1 (high creativity for diverse recommendations)</Li>
      <Li><strong>Max tokens:</strong> 4096</Li>
      <Li><strong>Input:</strong> multimodal — screenshot image + GA CSV + GSC CSV + optional instructions + optional document (any combination). GA+GSC optional when document provided.</Li>
      <Li><strong>Document upload:</strong> PDF sent as <Code>type: "document"</Code> content block (native Anthropic support); DOCX text-extracted via JSZip; TXT/MD read directly. Max 10 MB.</Li>
      <Li><strong>canAnalyze condition:</strong> <Code>isValidUrl(url) && (docFile || (gaFile && gscFile))</Code></Li>
      <Li><strong>Output:</strong> strict JSON schema with 3 recommendations</Li>

      <H3 color={ACCENT}>Build Hypothesis — Document Context</H3>
      <P><Code>generateHypothesis(statement, context, docContent = null)</Code> in <Code>src/lib/utils.js</Code>. Accepts an optional third argument for document context:</P>
      <Code block>{`// docContent shapes:
{ type: "pdf",  base64: "..." }   // → Anthropic document content block
{ type: "text", text: "..." }     // → prepended as === DOCUMENT CONTEXT === in prompt
null                               // → plain text prompt only (original behavior)

// PDF message shape:
messages: [{ role: "user", content: [
  { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
  { type: "text", text: instructions },
]}]`}</Code>
      <Li>Generate button enabled when statement typed OR doc attached — either is sufficient without the other</Li>
      <Li>Model: <Code>claude-haiku-4-5-20251001</Code> (fast, max_tokens: 512)</Li>

      <H3 color={ACCENT}>Generate Visualizations — AI Overlay Placement</H3>
      <P>Triggered from the purple "Generate Visualizations" button on TestDetailsPage. Runs when the test has a <Code>pageUrl</Code>. Agency-only (hidden in portal mode).</P>
      <Li><strong>Step 1:</strong> Puppeteer screenshots <Code>test.pageUrl</Code> via <Code>/api/screenshot</Code> (uses client <Code>customUA</Code> if set)</Li>
      <Li><strong>Step 2:</strong> Claude Haiku receives screenshot + IF/THEN/BECAUSE → returns 1–3 overlay annotations with <Code>type</Code>, <Code>note</Code>, <Code>xFrac</Code>, <Code>yFrac</Code></Li>
      <Li><strong>Step 3:</strong> Full screenshot → <Code>controlDesktop</Code> + <Code>controlMobile</Code>; 55% crop centered on overlay centroid → <Code>variantDesktop</Code> + <Code>variantMobile</Code></Li>
      <Li><strong>Step 4:</strong> Overlays mapped into SVG coordinates and saved to test record via <Code>onUpdateTest</Code></Li>
      <Li><strong>Critical:</strong> All 4 zones saved with a single <Code>onSaveScreenshots(id, zonesObj)</Code> call — NOT 4 individual <Code>onSaveScreenshot</Code> calls, which suffer a stale-closure race condition where only the last write survives</Li>

      <H3 color={ACCENT}>The 7 Conversion Levers</H3>
      <P>The system prompt forces each of the 3 recommendations to target a different lever from this list:</P>
      <Table
        headers={["Letter", "Lever", "What it tests"]}
        rows={[
          ["A", "Value Proposition", "Headline, subheadline, or unique selling proposition clarity"],
          ["B", "Friction Removal", "Reduce cognitive load, form complexity, or decision fatigue"],
          ["C", "Trust & Anxiety", "Social proof, credentials, testimonials, guarantees, security signals"],
          ["D", "Motivation & Urgency", "Loss aversion, scarcity, FOMO, emotional triggers, benefit framing"],
          ["E", "Relevance & Message Match", "Audience segmentation, traffic-source alignment, personalisation"],
          ["F", "Visual Hierarchy & Attention", "CTA placement, eye-flow, contrast, whitespace, above-fold composition"],
          ["G", "Navigation & Findability", "Menu structure, internal links, search, page depth to conversion"],
        ]}
      />

      <H3 color={ACCENT}>Recommendation JSON Schema</H3>
      <Code block>{`{
  "recommendations": [{
    "lever": "B",
    "behaviouralPrinciple": "Cognitive ease",
    "dataEvidence": "Specific metric from GA/GSC",
    "testName": "Short name (max 60 chars)",
    "successProbability": 72,         // 1-100 integer
    "if": "specific, measurable change",
    "then": "measurable outcome",
    "because": "data evidence + behavioural principle",
    "testType": "A/B",
    "audience": "All users",
    "primaryMetric": "Form submissions",
    "secondaryMetrics": ["CTA clicks"],
    "potential": 7,                   // PIE 1-10
    "importance": 8,                  // PIE 1-10
    "ease": 6,                        // PIE 1-10
    "overlays": [{
      "type": "CTA Highlight",
      "note": "Brief annotation max 60 chars",
      "xFrac": 0.5,                   // 0-1 fraction of screenshot width
      "yFrac": 0.3                    // 0-1 fraction of screenshot height
    }]
  }]
}`}</Code>

      <H3 color={ACCENT}>Screenshot Processing</H3>
      <P>For each recommendation, the captured screenshot is cropped to a 55% height slice centered on the average overlay position. This gives a focused "before" view of the relevant page area, which is stored as the variant zone screenshot.</P>
      <Code block>{`// cropImageToArea(dataUrl, centerX, centerY)
// → crops to 55% of image height, centered on (centerX, centerY) in 0-1 coords
// → returns new dataUrl as image/jpeg at 0.88 quality`}</Code>

      <H3 color={ACCENT}>Overlay Positioning</H3>
      <P>Overlay x/y fractions from Claude are converted to absolute SVG coordinates using the screenshot zone layout computed by <Code>computeSVGZones()</Code> in <Code>src/lib/svg.js</Code>. The variant zone's x/y/w/h are used as the reference frame.</P>

      <H3 color={ACCENT}>Brand Color Extraction</H3>
      <Li><strong>Model:</strong> <Code>claude-haiku-4-5-20251001</Code> (fast, cost-effective)</Li>
      <Li><strong>Input:</strong> screenshot of website homepage</Li>
      <Li><strong>Output:</strong> <Code>{"{ bgColor, accentColor, textColor }"}</Code> hex values</Li>
      <Li>Used in SuperAdminPage when creating/editing an agency with a website URL</Li>
    </div>
  ),

  environment: (
    <div>
      <H2>Environment & Deployment</H2>

      <H3 color={ACCENT}>Environment Variables</H3>
      <Table
        headers={["Variable", "Where", "Purpose"]}
        rows={[
          ["SUPABASE_URL", "Server-only", "Supabase project URL"],
          ["SUPABASE_SERVICE_ROLE_KEY", "Server-only", "Full DB access (never in browser)"],
          ["VITE_SUPABASE_URL", "Browser", "Same URL — no key exposed"],
          ["ANTHROPIC_API_KEY", "Server-only", "Claude API authentication"],
          ["AHREFS_API_KEY", "Server-only", "Ahrefs Data API v3"],
          ["CONVERT_ACCOUNT_ID", "Server-only", "Convert.com account ID"],
          ["CONVERT_PROJECT_ID", "Server-only", "Convert.com project ID"],
          ["VITE_GOOGLE_CLIENT_ID", "Browser", "Google OAuth client (future use)"],
        ]}
      />
      <Note>Variables prefixed with VITE_ are bundled into the frontend. Never add SUPABASE_SERVICE_ROLE_KEY or ANTHROPIC_API_KEY with a VITE_ prefix.</Note>

      <H3 color={ACCENT}>vercel.json Configuration</H3>
      <Code block>{`{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "functions": {
    "api/screenshot.js": { "memory": 1024, "maxDuration": 45 },
    "api/ahrefs.js":     { "maxDuration": 15 },
    "api/db.js":         { "maxDuration": 15 },
    "api/upload.js":     { "memory": 1024, "maxDuration": 30 }
  },
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}`}</Code>

      <H3 color={ACCENT}>Local Development</H3>
      <Code block>{`# Install dependencies
npm install

# Start dev server (Vite HMR on port 5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview`}</Code>
      <P>In development, Vite proxies <Code>/api/*</Code> requests to your local Vercel dev server. The <Code>.env</Code> file provides all environment variables locally.</P>

      <H3 color={ACCENT}>Deploying to Vercel</H3>
      <Li>Connect the repo to Vercel via the Vercel dashboard or CLI</Li>
      <Li>Set all environment variables in Project Settings → Environment Variables</Li>
      <Li>Deployments trigger automatically on push to <Code>main</Code></Li>
      <Li>Use <Code>vercel --prod</Code> via CLI for a manual production deploy</Li>

      <H3 color={ACCENT}>Supabase Setup Checklist</H3>
      <Li>Create tables: <Code>agencies</Code>, <Code>clients</Code>, <Code>tests</Code>, <Code>platform_config</Code></Li>
      <Li>Create storage bucket: <Code>agency-logos</Code> (public)</Li>
      <Li>Set RLS to disabled (access controlled at API layer via service_role key)</Li>
      <Li>Copy the project URL and service_role key to environment variables</Li>

      <H3 color={ACCENT}>Adding a New Page / Route</H3>
      <Code block>{`// 1. Create the page component in src/pages/NewPage.jsx
// 2. Add the route in AgencyApp routes (AgencyWrapper.jsx):
<Route path="/new-path"
  element={<NewPage agencySlug={slug} {...sharedProps} />}
/>
// 3. Add navigation link from AppHeader or relevant page`}</Code>
    </div>
  ),
};

export default function TechDocsModal({ open, onClose }) {
  const { isMobile } = useBreakpoint();
  const [active, setActive] = useState("architecture");

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,25,35,.55)", backdropFilter: "blur(3px)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? 8 : 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: CARD, borderRadius: 14, width: "100%", maxWidth: 960, height: isMobile ? "96vh" : "88vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,.28)", fontFamily: "'Inter',sans-serif", overflow: "hidden" }}
      >
        {/* Header */}
        <div style={{ padding: "18px 24px 14px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 14, flexShrink: 0, background: "#0F172A" }}>
          <div style={{ fontSize: 20 }}>{"</>"}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#E2E8F0" }}>Technical Reference</div>
            <div style={{ fontSize: 11, color: "#64748B", marginTop: 1 }}>Architecture · Data Models · API Routes · Database · AI · Deployment</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.1)", border: "none", borderRadius: 6, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#E2E8F0", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {/* Sidebar */}
          {!isMobile && (
            <div style={{ width: 200, borderRight: `1px solid ${BORDER}`, padding: "12px 8px", overflowY: "auto", flexShrink: 0, background: "#F8FAFC" }}>
              {NAV.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  style={{ width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 7, border: "none", background: active === item.id ? "#EEF2FF" : "none", color: active === item.id ? ACCENT : MUTED, fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: active === item.id ? 700 : 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}
                >
                  <span style={{ fontSize: 15 }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Mobile tab bar */}
          {isMobile && (
            <div style={{ borderBottom: `1px solid ${BORDER}`, overflowX: "auto", display: "flex", gap: 4, padding: "8px 12px", flexShrink: 0, background: BG, width: "100%" }}>
              {NAV.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: active === item.id ? "#0F172A" : "none", color: active === item.id ? "#fff" : MUTED, fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "20px 16px" : "28px 32px" }}>
            {CONTENT[active]}
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: DIM }}>MetricsEdge Technical Reference · {NAV.findIndex(n => n.id === active) + 1} of {NAV.length}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { const i = NAV.findIndex(n => n.id === active); if (i > 0) setActive(NAV[i - 1].id); }}
              disabled={active === NAV[0].id}
              style={{ padding: "6px 14px", borderRadius: 6, border: `1.5px solid ${BORDER}`, background: "none", color: active === NAV[0].id ? DIM : MUTED, fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 600, cursor: active === NAV[0].id ? "default" : "pointer" }}>
              ← Prev
            </button>
            <button
              onClick={() => { const i = NAV.findIndex(n => n.id === active); if (i < NAV.length - 1) setActive(NAV[i + 1].id); }}
              disabled={active === NAV[NAV.length - 1].id}
              style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: active === NAV[NAV.length - 1].id ? DIM : "#0F172A", color: "#fff", fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 700, cursor: active === NAV[NAV.length - 1].id ? "default" : "pointer" }}>
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
