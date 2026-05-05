import { useState } from "react";
import { ACCENT, TEAL, GOLD, BG, CARD, BORDER, TEXT, MUTED, DIM } from "../lib/constants";
import { useBreakpoint } from "../lib/useBreakpoint";

const NAV = [
  { id: "overview",   icon: "🚀", label: "Getting Started" },
  { id: "clients",    icon: "👥", label: "Managing Clients" },
  { id: "pipeline",   icon: "🧪", label: "Testing Pipeline" },
  { id: "tests",      icon: "✏️",  label: "Creating Tests" },
  { id: "ai",         icon: "✨", label: "AI Ideation" },
  { id: "seo",        icon: "🔍", label: "SEO Intelligence" },
  { id: "portals",    icon: "🔗", label: "Client Portals" },
  { id: "brand",      icon: "🎨", label: "Brand Settings" },
  { id: "reports",    icon: "📊", label: "Reports & Export" },
];

function H2({ children }) {
  return <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, marginBottom: 6 }}>{children}</div>;
}
function H3({ children, color = TEXT }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 8, marginTop: 18 }}>{children}</div>;
}
function P({ children }) {
  return <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.65, marginBottom: 10 }}>{children}</div>;
}
function Li({ children }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
      <span style={{ color: TEAL, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>›</span>
      <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}
function Tip({ children }) {
  return (
    <div style={{ background: "#ECFEFF", border: "1px solid #A5F3FC", borderRadius: 8, padding: "10px 14px", marginTop: 12, marginBottom: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#0E7490", textTransform: "uppercase", letterSpacing: 0.8 }}>Tip  </span>
      <span style={{ fontSize: 12, color: "#0E7490", lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}
function Note({ children }) {
  return (
    <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px", marginTop: 12, marginBottom: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#B45309", textTransform: "uppercase", letterSpacing: 0.8 }}>Note  </span>
      <span style={{ fontSize: 12, color: "#B45309", lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}
function Badge({ label, color, bg, border }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 700, color, background: bg, border: `1px solid ${border}`, borderRadius: 4, padding: "2px 8px", marginRight: 4 }}>
      {label}
    </span>
  );
}
function Step({ n, title, children }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
      <div style={{ width: 26, height: 26, borderRadius: "50%", background: ACCENT, color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{n}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
}

const CONTENT = {
  overview: (
    <div>
      <H2>Getting Started with MetricsEdge</H2>
      <P>MetricsEdge is a CRO (Conversion Rate Optimization) platform for managing A/B test pipelines, SEO intelligence, and client reporting — all in one place.</P>

      <H3 color={ACCENT}>Platform Structure</H3>
      <P>The platform has two access levels:</P>
      <Li><strong>Platform Admin</strong> — accessible at the root URL. Manages agency accounts. Only you and your team should have this password.</Li>
      <Li><strong>Agency Dashboard</strong> — your agency's workspace at <code style={{ background: "#F1F5F9", padding: "1px 5px", borderRadius: 3, fontSize: 12 }}>yourdomain.com/your-agency-slug</code>. Protected by your agency password.</Li>

      <H3 color={ACCENT}>Navigating the Agency Dashboard</H3>
      <P>Your agency dashboard has three main sections on the home screen:</P>
      <Li><strong>Clients</strong> — all your client accounts with test counts and live status at a glance.</Li>
      <Li><strong>🧪 Testing</strong> — your full testing pipeline: status badges, live test results, and client notes feed.</Li>
      <Li><strong>🔍 SEO Intelligence</strong> — aggregate SEO metrics across all your clients: domain ratings, backlinks, issues, and crawl health.</Li>

      <H3 color={ACCENT}>The Client View</H3>
      <P>Click any client tile to open their portfolio. Each client has two tabs:</P>
      <Li><strong>Testing tab</strong> — Kanban-style pipeline (Backlog → In Work → Live → Complete), notes feed, and portal settings.</Li>
      <Li><strong>SEO tab</strong> — per-domain crawl data, Ahrefs metrics, GA/GSC uploads, and cross-signal analysis.</Li>

      <Tip>Sections on the home screen collapse and expand — click any section header to toggle. The app remembers your last state.</Tip>

      <H3 color={ACCENT}>Top Header Actions</H3>
      <Li><strong>⚙ Gear icon</strong> — opens Brand Settings to customize your header color and logo.</Li>
      <Li><strong>? Help</strong> — you're here now!</Li>

      <H3 color={ACCENT}>Browser Tab Titles</H3>
      <P>Each page updates the browser tab title automatically so you can orient quickly when switching between tabs:</P>
      <Li>Platform Admin → "Platform Admin — MetricsEdge"</Li>
      <Li>Agency dashboard → "{"{Agency Name}"} — MetricsEdge"</Li>
      <Li>Client page → "{"{Client Name}"} — MetricsEdge"</Li>
      <Li>Test detail → "{"{Test Name}"} — MetricsEdge"</Li>
      <Li>Client portal → "{"{Client Name}"} Portal — MetricsEdge"</Li>

      <H3 color={ACCENT}>Error Recovery</H3>
      <P>If a page fails to load (network issue, unexpected error), MetricsEdge shows a clear error message with a <strong>Try again</strong> button instead of a blank screen. Click it to recover without a full page refresh.</P>
    </div>
  ),

  clients: (
    <div>
      <H2>Managing Clients</H2>
      <P>Each client is a company you run CRO work for. Clients have their own test pipelines, SEO data, and optional client-facing portals.</P>

      <H3 color={ACCENT}>Adding Clients</H3>
      <Step n="1" title="Open the Clients modal">Click the <strong>Manage</strong> button in the Clients section of your dashboard.</Step>
      <Step n="2" title="Add a single client">Type the client name and click Add Client.</Step>
      <Step n="3" title="Bulk add (optional)">Switch to the Bulk tab and paste a newline-separated list of names to create multiple clients at once.</Step>

      <H3 color={ACCENT}>Client Settings</H3>
      <Li><strong>Name</strong> — the client's display name shown everywhere in the platform.</Li>
      <Li><strong>Brand</strong> — customize the client portal's header color, logo, and tagline. These only affect the client-facing portal view.</Li>
      <Li><strong>Custom User-Agent</strong> — if the client's website blocks automated browsers, enter a custom UA string so Puppeteer screenshots work correctly.</Li>
      <Li><strong>Domains</strong> — add one or more domains to enable SEO intelligence for this client. Managed from the client's SEO tab.</Li>

      <H3 color={ACCENT}>Deleting a Client</H3>
      <P>Deleting a client removes them from your roster. Any tests assigned to that client will be reassigned to the next available client automatically. This action cannot be undone.</P>

      <Note>If you delete a client, reassign their tests first to keep your pipeline clean. Navigate to each test and use the client dropdown to reassign before deleting.</Note>

      <H3 color={ACCENT}>Client Cards on the Dashboard</H3>
      <P>Each client tile shows at a glance:</P>
      <Li>Total test count</Li>
      <Li>Number of live tests (if any)</Li>
      <Li>Number of tests "in work" (under review or promoted)</Li>
      <Li><Badge label="SEO ✓" color="#2A8C8C" bg="#F0FAFA" border="#A8D8D8" /> if they have at least one domain with crawl data</Li>
    </div>
  ),

  pipeline: (
    <div>
      <H2>Testing Pipeline</H2>
      <P>Every test moves through a five-stage pipeline from idea to insight. You control the status from the test detail view or by dragging in the client Kanban board.</P>

      <H3 color={ACCENT}>The Five Stages</H3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {[
          { s: "Backlog", color: "#1B3A6B", bg: "#EEF2FF", border: "#C7D2FE", desc: "Captured idea — hypothesis may be rough, not yet in active work." },
          { s: "Under Review", color: "#B45309", bg: "#FFFBEB", border: "#FDE68A", desc: "Being analyzed. Hypothesis is being refined and stakeholders are aligned." },
          { s: "Promoted to Test", color: "#6D28D9", bg: "#F5F3FF", border: "#DDD6FE", desc: "Approved and being built in your A/B testing tool (e.g. Convert, VWO, Optimizely)." },
          { s: "Test Running", color: "#0E7490", bg: "#ECFEFF", border: "#A5F3FC", desc: "Live A/B test is active and collecting data." },
          { s: "Test Complete", color: "#15803D", bg: "#F0FDF4", border: "#BBF7D0", desc: "Test has concluded. Results recorded, findings documented." },
        ].map(({ s, color, bg, border, desc }) => (
          <div key={s} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Badge label={s} color={color} bg={bg} border={border} />
            <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.5, flex: 1 }}>{desc}</span>
          </div>
        ))}
      </div>

      <H3 color={ACCENT}>PIE Scoring</H3>
      <P>PIE is a prioritization framework. Every test gets three scores from 1–10:</P>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: GOLD, minWidth: 90 }}>Potential</span>
          <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>How much conversion uplift can this test realistically deliver? 1 = marginal, 10 = transformational.</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT, minWidth: 90 }}>Importance</span>
          <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>How much traffic and strategic value does this page carry? 1 = low-traffic, 10 = core acquisition page.</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: TEAL, minWidth: 90 }}>Ease</span>
          <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>How easy is it to build and launch? 1 = complex dev work, 10 = a simple copy change in Convert.</span>
        </div>
      </div>
      <P>The <strong>PIE Score</strong> = average of P + I + E. Tests scoring ≥7 are high-priority (green badge), ≥5 are medium (amber), and below 5 are low (red).</P>

      <Tip>Use PIE to rank your backlog. When multiple tests compete for dev time, highest PIE score wins. AI Ideation automatically suggests PIE scores based on your data — you can always override them.</Tip>

      <H3 color={ACCENT}>The Hypothesis Framework</H3>
      <P>Every test uses a structured three-part hypothesis:</P>
      <div style={{ borderLeft: `3px solid ${ACCENT}`, paddingLeft: 12, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, letterSpacing: 0.8 }}>IF — </span>
        <span style={{ fontSize: 13, color: MUTED }}>a specific, measurable change to one element</span>
      </div>
      <div style={{ borderLeft: `3px solid ${TEAL}`, paddingLeft: 12, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: TEAL, letterSpacing: 0.8 }}>THEN — </span>
        <span style={{ fontSize: 13, color: MUTED }}>the measurable outcome we expect to improve</span>
      </div>
      <div style={{ borderLeft: `3px solid ${GOLD}`, paddingLeft: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: 0.8 }}>BECAUSE — </span>
        <span style={{ fontSize: 13, color: MUTED }}>the data evidence and behavioral principle explaining why it will work</span>
      </div>
      <P>This structure keeps tests focused on one change at a time and ensures every test has a clear rationale grounded in data.</P>
    </div>
  ),

  tests: (
    <div>
      <H2>Creating & Managing Tests</H2>

      <H3 color={ACCENT}>Creating a New Test</H3>
      <P>Click <strong>+ New Test</strong> from the dashboard or any client page. You'll choose between two modes:</P>
      <Li><strong>Blank Test</strong> — opens an empty form. Great for tests you've already planned out.</Li>
      <Li><strong>✨ AI Ideation</strong> — upload your page data and let Claude generate 3 data-driven test recommendations. See the AI Ideation section for details.</Li>

      <H3 color={ACCENT}>Test Edit Form</H3>
      <P>Every test has these fields:</P>
      <Li><strong>Test Name</strong> — a short, descriptive name (e.g. "Homepage Hero CTA Contrast Test")</Li>
      <Li><strong>Client</strong> — which client this test belongs to</Li>
      <Li><strong>Status</strong> — current pipeline stage</Li>
      <Li><strong>Page URL</strong> — the page being tested</Li>
      <Li><strong>IF / THEN / BECAUSE</strong> — the hypothesis (see Testing Pipeline section)</Li>
      <Li><strong>PIE Scores</strong> — Potential, Importance, Ease (each 1–10)</Li>
      <Li><strong>Test Type</strong> — A/B, A/B/n, Multivariate, Split URL, or Redirect</Li>
      <Li><strong>Audience</strong> — All users, New users, Returning users, Organic search, Paid search, Mobile users, Desktop users, Direct traffic</Li>
      <Li><strong>Primary Metric</strong> — the one metric that determines a winner</Li>
      <Li><strong>Secondary Metrics</strong> — supporting metrics to monitor</Li>
      <Li><strong>Variants</strong> — add variant labels (B, C, D...). Control is always A.</Li>

      <H3 color={ACCENT}>Build Hypothesis with AI</H3>
      <P>On any test detail page, click <strong>Build Hypothesis</strong> (or <strong>Edit</strong> if one already exists) to open the inline hypothesis builder. You can generate IF/THEN/BECAUSE in two ways:</P>
      <Li><strong>Statement input</strong> — type a plain-language description of your test idea and click Generate. Claude converts it into a structured hypothesis.</Li>
      <Li><strong>📄 Attach document</strong> — upload a PDF, DOCX, or TXT file (strategy brief, audit, research notes). Claude reads the document alongside your statement to write a more grounded hypothesis. You can generate with just a document and no statement text.</Li>

      <H3 color={ACCENT}>Generate Visualizations</H3>
      <P>For manually created tests, click <strong>Generate Visualizations</strong> (purple button in the action row) to automatically build out the screenshot and overlay template:</P>
      <Li>MetricsEdge screenshots the page URL using Puppeteer</Li>
      <Li>Claude analyzes the screenshot alongside your hypothesis and places 1–3 overlay annotations on the exact elements described in your IF statement</Li>
      <Li>The full screenshot populates the Control zones; a cropped view focused on the annotated area populates the Variant zones</Li>
      <Li>Requires a page URL to be set on the test. Button is hidden in the client portal.</Li>

      <H3 color={ACCENT}>Screenshot Zones</H3>
      <P>Each test has four screenshot zones: Control Desktop, Control Mobile, Variant B Desktop, Variant B Mobile.</P>
      <Li>Upload screenshots manually by clicking the zone and selecting a file</Li>
      <Li>Or use <strong>Generate Visualizations</strong> to capture and populate all zones automatically with AI</Li>
      <Li>Screenshots are stored locally in your browser's IndexedDB — they don't sync to the database</Li>

      <H3 color={ACCENT}>Overlays</H3>
      <P>Overlays are visual annotations placed on top of screenshots to communicate planned changes.</P>
      <Li>Click on a screenshot zone to place an overlay pin, or use Generate Visualizations to place them automatically</Li>
      <Li>Choose an overlay type: <strong>CTA Highlight</strong>, <strong>Copy Change</strong>, <strong>Removed</strong>, <strong>Add/Blur</strong>, <strong>Layout Shift</strong>, <strong>Sticky Element</strong>, <strong>Brand Accent</strong>, <strong>Annotation</strong>, or <strong>Client Note</strong></Li>
      <Li>Each overlay has an optional note field — use it to describe exactly what changes</Li>

      <H3 color={ACCENT}>Recording Results</H3>
      <P>Once a test is running or complete, add results from the test detail view:</P>
      <Step n="1" title="Set variant order">Define which variants ran (Control first, then B, C...)</Step>
      <Step n="2" title="Add a goal">Name the goal (e.g. "Form Submissions") and enter the number of sessions + conversions for each variant.</Step>
      <Step n="3" title="Review rates">Conversion rates and lift % calculate automatically.</Step>

      <H3 color={ACCENT}>Findings</H3>
      <P>The Findings field is a rich text area for documenting what you learned from the test — regardless of whether it won or lost. Good findings answer: what did we learn? What's the next test idea this opens up?</P>

      <H3 color={ACCENT}>Client Notes</H3>
      <P>Notes are threaded comments on a test. Agency admins can add notes visible to both the team and the client portal. Clients can add their own notes from the portal. Use notes for: stakeholder alignment, QA feedback, result interpretations, and next steps.</P>
    </div>
  ),

  ai: (
    <div>
      <H2>AI Ideation</H2>
      <P>AI Ideation uses Claude to analyze your page data and generate 3 prioritized, data-driven test recommendations — complete with hypothesis, PIE scores, and predicted success probability.</P>

      <H3 color={ACCENT}>What You Need</H3>
      <Li><strong>Page URL</strong> — the URL of the page you want to test (must be publicly accessible)</Li>
      <Li><strong>Google Analytics CSV</strong> — 90-day export from GA4. Export from Reports → Pages & Screens or Landing Pages → download as CSV. Can be a .zip file. <em>(Optional if uploading a document)</em></Li>
      <Li><strong>Search Console CSV</strong> — 90-day Performance report from GSC. Export from Search results → Full export. Can be a .zip file. <em>(Optional if uploading a document)</em></Li>
      <Li><strong>Document</strong> — upload a PDF, DOCX, or TXT file as an alternative or supplement to GA/GSC data. Strategy briefs, audit reports, heatmap summaries, research notes — anything Claude can read to understand the page and goal. Max 10 MB.</Li>

      <H3 color={ACCENT}>How It Works</H3>
      <Step n="1" title="Screenshot capture">MetricsEdge automatically takes a full-page screenshot of your URL using Puppeteer. This is used to visually analyze the page layout and identify UX friction points.</Step>
      <Step n="2" title="Data analysis">Claude reads all uploaded data — GA traffic patterns, GSC keyword intent, and/or your uploaded document — and cross-references it with the visual screenshot.</Step>
      <Step n="3" title="Recommendations">Claude generates exactly 3 recommendations, each targeting a different conversion lever: Value Proposition, Friction Removal, Trust, Motivation/Urgency, Relevance, Visual Hierarchy, or Navigation.</Step>
      <Step n="4" title="Build tests">Select one or more recommendations and click Build — tests are created with all fields pre-populated, screenshots attached, and overlays positioned.</Step>

      <H3 color={ACCENT}>Understanding Recommendations</H3>
      <P>Each recommendation includes:</P>
      <Li><strong>Predicted Success %</strong> — Claude's confidence score (1–100) based on evidence strength × traffic volume × implementation cleanliness</Li>
      <Li><strong>Conversion Lever</strong> — which psychological/UX mechanism the test targets (A–G)</Li>
      <Li><strong>Behavioral Principle</strong> — the specific cognitive bias or behavioral concept (e.g. cognitive ease, loss aversion, authority bias)</Li>
      <Li><strong>Data Evidence</strong> — the specific metric from your GA/GSC data that justifies this test</Li>
      <Li><strong>PIE Scores</strong> — pre-scored based on evidence strength and traffic volume</Li>
      <Li><strong>Overlays</strong> — visual pins showing exactly what element on the page to change</Li>

      <H3 color={ACCENT}>Custom Instructions</H3>
      <P>The optional Instructions field lets you guide Claude's analysis. Examples:</P>
      <Li>"Focus on mobile checkout friction only"</Li>
      <Li>"Avoid any recommendations involving pop-ups — client has rejected these"</Li>
      <Li>"The client is launching a new brand in Q3 — prioritize tests that will still apply post-rebrand"</Li>
      <Li>"The main conversion goal is program inquiry forms, not phone calls"</Li>

      <Tip>You can select multiple recommendations at once. Building 2–3 tests from one AI session is common — it batches all the analyses into your pipeline at once.</Tip>

      <Note>Screenshots require the page to be publicly accessible. For password-protected staging sites, use a Custom User-Agent or upload screenshots manually instead.</Note>
    </div>
  ),

  seo: (
    <div>
      <H2>SEO Intelligence</H2>
      <P>The SEO tab on each client page gives you a comprehensive view of their technical health, backlink profile, and content performance — all consolidated from multiple data sources.</P>

      <H3 color={ACCENT}>Multi-Domain Support</H3>
      <P>Clients can have multiple domains tracked simultaneously (e.g. main site + a subdomain). Switch between domains using the domain selector at the top of the SEO tab. Each domain gets its own independent crawl and Ahrefs data.</P>
      <Li>Click <strong>+ Add Domain</strong> to start tracking a new domain</Li>
      <Li>Data is stored per-domain and aggregated in the dashboard overview</Li>

      <H3 color={ACCENT}>Running a Crawl Report</H3>
      <Step n="1" title="Crawl the site">Use Screaming Frog, Sitebulb, or a similar crawler. Export the "Internal HTML" report as CSV.</Step>
      <Step n="2" title="Export issues">Also export the "All Issues" or "Issues" report as a separate CSV.</Step>
      <Step n="3" title="Upload">In the SEO tab, find the Crawl Report section and upload each CSV. Data processes instantly.</Step>

      <P>The crawl report shows you:</P>
      <Li><strong>Pages crawled</strong> — total URLs and HTML page count</Li>
      <Li><strong>Avg response time</strong> — color-coded: green (&lt;1s), amber (1–2s), red (&gt;2s)</Li>
      <Li><strong>Word count distribution</strong> — how many pages have thin content (&lt;300 words)</Li>
      <Li><strong>Issue priority breakdown</strong> — High (critical), Medium (warnings), Low (notices) with URL counts</Li>
      <Li><strong>Top issues list</strong> — sorted by priority with issue name and affected URL count</Li>

      <H3 color={ACCENT}>Ahrefs Data</H3>
      <P>The Ahrefs section pulls live data from the Ahrefs API for the selected domain:</P>
      <Li><strong>Domain Rating (DR)</strong> — overall backlink authority score (0–100)</Li>
      <Li><strong>Backlinks</strong> — total live backlinks and referring domains</Li>
      <Li><strong>Broken Link Reclamation</strong> — pages returning 404s that still have inbound backlinks — these are link reclamation opportunities</Li>
      <Li><strong>Ranking Velocity</strong> — keywords gaining or losing rankings rapidly</Li>
      <Li><strong>Content Freshness Risk</strong> — high-traffic pages that haven't been updated recently</Li>
      <Li><strong>Top Pages</strong> — by organic traffic, by external links, by referring domains</Li>
      <Li><strong>Anchor Text Distribution</strong> — the variety and health of your anchor text profile</Li>

      <H3 color={ACCENT}>Cross-Signal Analysis</H3>
      <P>The Cross-Signal Report combines your crawl data, Google Analytics, and Search Console into a unified view. To use it, upload GA4 and GSC exports alongside your crawl data.</P>
      <P>The report identifies:</P>
      <Li>High-traffic pages with thin content (crawl + GA)</Li>
      <Li>Crawled pages not appearing in GSC (indexation gaps)</Li>
      <Li>Queries driving traffic that don't match page content (intent mismatch)</Li>
      <Li>Quick-win opportunities ranked by potential impact</Li>

      <H3 color={ACCENT}>Dashboard SEO Summary</H3>
      <P>The home dashboard aggregates SEO data across all clients. The four stat cards show:</P>
      <Li><strong>Avg Domain Rating</strong> — averaged across all domains with Ahrefs data</Li>
      <Li><strong>Total Backlinks</strong> — summed across all client domains</Li>
      <Li><strong>High Priority Issues</strong> — total critical issues across all sites</Li>
      <Li><strong>Pages Crawled</strong> — total across all crawled sites</Li>
    </div>
  ),

  portals: (
    <div>
      <H2>Client Portals</H2>
      <P>Every client gets a unique, shareable portal URL where they can view their test pipeline, results, and add notes — without accessing your agency dashboard.</P>

      <H3 color={ACCENT}>Setting Up a Portal</H3>
      <Step n="1" title="Open the client page">Click the client's tile from your dashboard.</Step>
      <Step n="2" title="Find Portal Settings">In the Testing tab, scroll to the Portal Settings section.</Step>
      <Step n="3" title="Copy the portal URL">The URL looks like: yourdomain.com/portal/[unique-token]. Share this with your client.</Step>

      <H3 color={ACCENT}>Password Protection</H3>
      <P>By default, the portal is accessible to anyone with the link. To add a password:</P>
      <Li>Enter a password in the Portal Password field and save</Li>
      <Li>Clients will see a password prompt before accessing the portal</Li>
      <Li>To remove the password, clear the field and save</Li>
      <Note>Passwords are stored as plain text and are meant as a lightweight access control, not high-security authentication. Don't reuse sensitive passwords here.</Note>

      <H3 color={ACCENT}>Regenerating the Token</H3>
      <P>Click <strong>Regenerate Token</strong> to issue a new portal URL. The old URL immediately stops working. Use this if you've shared the URL with someone who should no longer have access.</P>

      <H3 color={ACCENT}>What Clients See in the Portal</H3>
      <Li>Their test pipeline organized by status</Li>
      <Li>Test hypotheses (IF/THEN/BECAUSE) and results</Li>
      <Li>Client-facing notes on each test</Li>
      <Li>A place to add their own notes/comments</Li>
      <Li>Your agency's branding (or the client's own branding if configured)</Li>

      <H3 color={ACCENT}>What Clients Cannot Do in the Portal</H3>
      <Li>Create, edit, or delete tests</Li>
      <Li>Access other clients' data</Li>
      <Li>See agency-internal notes (only notes marked for clients)</Li>
      <Li>Access the agency admin dashboard</Li>

      <H3 color={ACCENT}>Customizing the Portal Brand</H3>
      <P>The portal header shows your agency's branding by default. To white-label it for the client, go to the client's settings in the Clients modal and configure their custom brand colors and logo. The portal will then show the client's branding instead of yours.</P>

      <Tip>Share the portal link in your kickoff or first-week onboarding. Clients who can see their pipeline in real-time ask better questions and stay more engaged in the CRO process.</Tip>
    </div>
  ),

  brand: (
    <div>
      <H2>Brand Settings</H2>
      <P>MetricsEdge is fully white-labeled. Customize the look of your agency dashboard and client portals to match your brand identity.</P>

      <H3 color={ACCENT}>Agency Brand (Your Dashboard)</H3>
      <P>Click the <strong>⚙</strong> gear icon in the top-right of your dashboard header to open Brand Settings.</P>
      <Li><strong>Agency Name</strong> — displayed in the header and on all reports</Li>
      <Li><strong>Header Background Color</strong> — the main header bar color</Li>
      <Li><strong>Accent Color</strong> — used for buttons and interactive elements</Li>
      <Li><strong>Text Color</strong> — text color on top of your header background</Li>
      <Li><strong>Logo</strong> — upload a PNG, JPG, SVG, or WebP logo. Stored in cloud storage. Replaces the agency name initial in the header.</Li>

      <H3 color={ACCENT}>AI Color Extraction</H3>
      <P>When creating or editing an agency in the Platform Admin, you can enter your website URL and click <strong>✨ Extract Colors</strong>. MetricsEdge will screenshot your site and use AI to automatically detect your brand's primary colors.</P>

      <H3 color={ACCENT}>Client Brand (Portal Customization)</H3>
      <P>Each client can have their own brand configuration. This controls how the portal looks when clients access their URL. Configure it from the Clients modal when editing a client.</P>
      <Li><strong>Header Background</strong> — portal header color for this client</Li>
      <Li><strong>Accent Color</strong> — interactive element color in the portal</Li>
      <Li><strong>Text Color</strong> — header text color</Li>
      <Li><strong>Logo</strong> — client's logo shown in their portal header</Li>
      <Li><strong>Tagline</strong> — a short line shown below the client name in the portal header</Li>

      <H3 color={ACCENT}>Custom User-Agent</H3>
      <P>Some websites use bot detection that blocks Puppeteer (the automated browser used for AI Ideation screenshots). You can set a custom browser User-Agent string per client to work around this:</P>
      <Li>Find the Custom User-Agent field when editing a client</Li>
      <Li>Enter a realistic browser UA string (e.g. a Chrome/macOS UA)</Li>
      <Li>This UA will be used for all automated screenshots of that client's site</Li>

      <Tip>When setting up a new agency client, match their brand colors in the portal settings before sharing the portal URL. First impressions matter.</Tip>
    </div>
  ),

  reports: (
    <div>
      <H2>Reports & Export</H2>
      <P>MetricsEdge can generate professional client-ready reports and exports in multiple formats.</P>

      <H3 color={ACCENT}>Report Builder</H3>
      <P>The Report Builder generates a comprehensive report for a client. Access it from the client's page.</P>
      <P>Report contents:</P>
      <Li>Executive summary of the testing pipeline</Li>
      <Li>Individual test hypotheses, PIE scores, and results</Li>
      <Li>SEO metrics summary: DR, backlinks, issues, crawl health</Li>
      <Li>Ahrefs data: backlink profile, top pages, anchor text</Li>
      <Li>Test findings and learnings</Li>

      <H3 color={ACCENT}>Export Formats</H3>
      <Li><strong>PDF</strong> — best for client presentations and sharing via email</Li>
      <Li><strong>DOCX</strong> — editable Word document for collaborative editing</Li>
      <Li><strong>Excel</strong> — spreadsheet format for data-heavy reporting</Li>

      <H3 color={ACCENT}>Testing Calendar Export</H3>
      <P>From the client's Testing tab, you can export a <strong>.ics calendar file</strong> containing all active and scheduled tests. Import this into any calendar app (Google Calendar, Outlook, Apple Calendar) to track test timelines alongside your other work.</P>

      <H3 color={ACCENT}>Site Directory Tree</H3>
      <P>The Directory Tree modal shows a visual force-graph of the site's URL structure based on crawl data. Access it from the SEO tab. It helps identify content silos, internal linking gaps, and orphaned pages.</P>

      <Note>Screenshots are stored in your browser's local storage (IndexedDB). They don't sync across devices or to the cloud. If you clear your browser data, screenshots will be lost. For important screenshots, save copies externally.</Note>

      <Tip>For weekly or monthly client reports, schedule a regular session to update test statuses, enter the latest results, and run the Report Builder. The report reflects the current state of all tests and SEO data at the time of generation.</Tip>
    </div>
  ),
};

export default function HelpCenterModal({ open, onClose }) {
  const { isMobile } = useBreakpoint();
  const [active, setActive] = useState("overview");

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,25,35,.55)", backdropFilter: "blur(3px)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? 8 : 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: CARD, borderRadius: 14, width: "100%", maxWidth: 900, height: isMobile ? "96vh" : "88vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,.28)", fontFamily: "'Inter',sans-serif", overflow: "hidden" }}
      >
        {/* Header */}
        <div style={{ padding: "18px 24px 14px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 14, flexShrink: 0, background: ACCENT }}>
          <div style={{ fontSize: 22 }}>?</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>Help Center</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.7)", marginTop: 1 }}>Everything you need to use MetricsEdge</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 6, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {/* Sidebar */}
          {!isMobile && (
            <div style={{ width: 200, borderRight: `1px solid ${BORDER}`, padding: "12px 8px", overflowY: "auto", flexShrink: 0, background: BG }}>
              {NAV.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  style={{ width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 7, border: "none", background: active === item.id ? "#E8F0FE" : "none", color: active === item.id ? ACCENT : MUTED, fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: active === item.id ? 700 : 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}
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
                  style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: active === item.id ? ACCENT : "none", color: active === item.id ? "#fff" : MUTED, fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}
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
          <div style={{ fontSize: 11, color: DIM }}>MetricsEdge Help Center · {NAV.findIndex(n => n.id === active) + 1} of {NAV.length} sections</div>
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
              style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: active === NAV[NAV.length - 1].id ? DIM : ACCENT, color: "#fff", fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 700, cursor: active === NAV[NAV.length - 1].id ? "default" : "pointer" }}>
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
