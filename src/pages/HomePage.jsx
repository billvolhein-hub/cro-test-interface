import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import ClientsModal from "../components/ClientsModal";
import { pieScore, fmtDate } from "../lib/utils";
import ClientNotesFeed from "../components/ClientNotesFeed";
import { ACCENT, BG, CARD, BORDER, TEXT, MUTED } from "../lib/constants";
import { useBreakpoint } from "../lib/useBreakpoint";

// ── DR colour scale ──────────────────────────────────────────────────────────
function drColor(dr) {
  if (dr >= 70) return { color: "#15803D", bg: "#F0FDF4", border: "#BBF7D0" };
  if (dr >= 40) return { color: "#0E7490", bg: "#ECFEFF", border: "#A5F3FC" };
  if (dr >= 20) return { color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" };
  return { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" };
}

function fmtK(n) {
  if (!n && n !== 0) return "—";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function HomePage({ agencySlug = "", tests, onCreateTest, onCreateTests, onDeleteTest, onUpdateTest, clients, onCreateClient, onCreateClients, onUpdateClient, onDeleteClient, onSaveScreenshot, onSaveScreenshots }) {
  const navigate = useNavigate();
  const ap = (path) => `/${agencySlug}${path}`;
  const { isMobile } = useBreakpoint();

  const [clientsModalOpen,  setClientsModalOpen]  = useState(false);
  const [notesFeedOpen,     setNotesFeedOpen]     = useState(true);
  const [seoExpanded,       setSeoExpanded]       = useState(false);
  const [testingOpen,       setTestingOpen]       = useState(true);
  const [seoOpen,           setSeoOpen]           = useState(true);

  // ── Testing derived data ──────────────────────────────────────────────────
  const backlog   = tests.filter(t => (t.status || "Backlog") === "Backlog").length;
  const inWork    = tests.filter(t => ["Under Review", "Promoted to Test"].includes(t.status)).length;
  const live      = tests.filter(t => t.status === "Test Running").length;
  const complete  = tests.filter(t => t.status === "Test Complete").length;
  const highPie   = tests.filter(t => Number(pieScore(t)) >= 6).length;
  const liveTests = tests.filter(t => t.status === "Test Running");

  // ── SEO derived data ──────────────────────────────────────────────────────
  const clientsWithSEO = clients.filter(c => c.crawlReport?.domain || c.crawlReport?.ahrefs);
  const clientsWithIssues = clients.filter(c => c.crawlReport?.issues?.byPrioritySorted?.length > 0);

  // Aggregate issue counts across all clients
  const totalHighIssues = clients.reduce((sum, c) => sum + (c.crawlReport?.issues?.byPriority?.High ?? 0), 0);
  const totalMedIssues  = clients.reduce((sum, c) => sum + (c.crawlReport?.issues?.byPriority?.Medium ?? 0), 0);

  // Aggregate pages crawled (from internal stats or nodes array)
  const totalPages = clients.reduce((sum, c) => {
    const r = c.crawlReport;
    return sum + (r?.internal?.htmlPages ?? r?.nodes?.length ?? 0);
  }, 0);

  // Average DR across clients that have it
  const drClients = clients.filter(c => c.crawlReport?.ahrefs?.data?.dr?.domain_rating != null);
  const avgDR = drClients.length
    ? Math.round(drClients.reduce((s, c) => s + c.crawlReport.ahrefs.data.dr.domain_rating, 0) / drClients.length)
    : null;

  // Total live backlinks across all clients
  const totalBacklinks = clients.reduce((sum, c) => sum + (c.crawlReport?.ahrefs?.data?.metrics?.live ?? 0), 0);
  const totalRefDomains = clients.reduce((sum, c) => sum + (c.crawlReport?.ahrefs?.data?.metrics?.live_refdomains ?? 0), 0);

  // Per-client SEO rows (all clients, sorted: with data first)
  const seoRows = [...clients].sort((a, b) => {
    const aHas = !!(a.crawlReport?.domain || a.crawlReport?.ahrefs);
    const bHas = !!(b.crawlReport?.domain || b.crawlReport?.ahrefs);
    return Number(bHas) - Number(aHas);
  });
  const SEO_PREVIEW = 4;
  const visibleRows = seoExpanded ? seoRows : seoRows.slice(0, SEO_PREVIEW);

  // ── Sub-components ────────────────────────────────────────────────────────
  const TestBadge = ({ label, count, color, bg, border }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: bg, border: `1.5px solid ${border}`, borderRadius: 10, padding: isMobile ? "10px 14px" : "12px 20px", minWidth: isMobile ? 64 : 80, gap: 4 }}>
      <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
      <div style={{ fontSize: isMobile ? 9 : 10, fontWeight: 700, color, letterSpacing: 0.8, textTransform: "uppercase", textAlign: "center", lineHeight: 1.3 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter',sans-serif", color: TEXT }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0;}`}</style>

      <AppHeader />

      <div style={{ padding: isMobile ? "0 16px 48px" : "0 28px 56px", overflowX: "hidden" }}>

        {/* ── Client Management ─────────────────────────────────────────────── */}
        <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 12, padding: isMobile ? "16px" : "20px 24px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: clients.length > 0 ? 16 : 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase" }}>Clients</div>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginRight: 4 }}>{clients.length} client{clients.length !== 1 ? "s" : ""}</span>
            <button onClick={() => setClientsModalOpen(true)}
              style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 700, fontFamily: "'Inter',sans-serif", cursor: "pointer", background: "none", border: `1.5px solid ${BORDER}`, color: MUTED }}>
              Manage
            </button>
          </div>
          {clients.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 12 }}>No clients yet.</div>
              <button onClick={() => setClientsModalOpen(true)}
                style={{ background: ACCENT, color: "#fff", border: "none", padding: "8px 18px", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                Add First Client
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {clients.map(c => {
                const clientTests = tests.filter(t => t.clientId === c.id);
                const clientLive  = clientTests.filter(t => t.status === "Test Running").length;
                const clientWork  = clientTests.filter(t => ["Under Review","Promoted to Test"].includes(t.status)).length;
                const hasSEO      = !!(c.crawlReport?.domain);
                return (
                  <button key={c.id} onClick={() => navigate(ap(`/clients/${c.id}`))}
                    style={{ background: "#fff", border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer", fontFamily: "'Inter',sans-serif", textAlign: "left", transition: "border-color .15s, box-shadow .15s", display: "flex", flexDirection: "column", gap: 8 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.boxShadow = "0 2px 10px rgba(27,58,107,.1)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = "none"; }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                      <span style={{ fontSize: 13, color: MUTED, flexShrink: 0 }}>↗</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#0E7490", background: "#ECFEFF", border: "1px solid #A5F3FC", borderRadius: 4, padding: "1px 6px" }}>
                        {clientTests.length} test{clientTests.length !== 1 ? "s" : ""}
                      </span>
                      {clientLive > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#DC2626", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 4, padding: "1px 6px" }}>{clientLive} live</span>}
                      {clientWork > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 4, padding: "1px 6px" }}>{clientWork} in work</span>}
                      {hasSEO && <span style={{ fontSize: 10, fontWeight: 700, color: "#2A8C8C", background: "#F0FAFA", border: "1px solid #A8D8D8", borderRadius: 4, padding: "1px 6px" }}>SEO ✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Testing ───────────────────────────────────────────────────────── */}
        <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 12, padding: isMobile ? "16px" : "20px 24px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: testingOpen ? 14 : 0, cursor: "pointer" }} onClick={() => setTestingOpen(v => !v)}>
            <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>🧪 Testing</div>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>{tests.length} total</div>
            <div style={{ fontSize: 12, color: MUTED, transform: testingOpen ? "rotate(180deg)" : "none", transition: "transform .2s", lineHeight: 1 }}>▾</div>
          </div>
          {testingOpen && <>
            <div style={{ display: "flex", gap: isMobile ? 8 : 10, flexWrap: "wrap", marginBottom: 24 }}>
              <TestBadge label="Backlog"  count={backlog}  color="#1B3A6B" bg="#EEF2FF" border="#C7D2FE" />
              <TestBadge label="In Work"  count={inWork}   color="#B45309" bg="#FFFBEB" border="#FDE68A" />
              <TestBadge label="Live"     count={live}     color="#0E7490" bg="#ECFEFF" border="#A5F3FC" />
              <TestBadge label="Complete" count={complete} color="#15803D" bg="#F0FDF4" border="#BBF7D0" />
              {highPie > 0 && <TestBadge label="High PIE ★" count={highPie} color="#B45309" bg="#FFFBEB" border="#FDE68A" />}
            </div>

            {/* Client Notes */}
            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 20, marginBottom: liveTests.length > 0 ? 20 : 0 }}>
              <ClientNotesFeed
                tests={tests}
                clients={clients}
                clientId={null}
                collapsed={!notesFeedOpen}
                onToggle={() => setNotesFeedOpen(v => !v)}
                onUpdateTest={onUpdateTest}
              />
            </div>

          {/* Live Tests */}
            {liveTests.length > 0 && (
              <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#0E7490", letterSpacing: 1.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>🔴 Live Tests</div>
                  <div style={{ flex: 1, height: 1, background: "#A5F3FC" }} />
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#0E7490" }}>{liveTests.length} running</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {liveTests.map(t => {
                    const clientName = clients.find(c => c.id === t.clientId)?.name ?? "Unknown";
                    const goals = t.results?.goals ?? [];
                    const order = t.results?.variantOrder ?? [];
                    return (
                      <div key={t.id} onClick={() => navigate(ap(`/tests/${t.id}`))}
                        style={{ background: "#F0FEFF", border: "1.5px solid #A5F3FC", borderRadius: 10, padding: isMobile ? "12px 14px" : "14px 18px", cursor: "pointer", transition: "border-color .15s, box-shadow .15s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "#0E7490"; e.currentTarget.style.boxShadow = "0 2px 10px rgba(14,116,144,.1)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "#A5F3FC"; e.currentTarget.style.boxShadow = "none"; }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: goals.length > 0 ? 10 : 0, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#0E7490", background: "#ECFEFF", border: "1px solid #A5F3FC", borderRadius: 20, padding: "2px 10px", whiteSpace: "nowrap" }}>{clientName}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.testName || "Untitled Test"}</span>
                          {t.testType && <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, background: "#F7F8FA", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2px 8px", whiteSpace: "nowrap" }}>{t.testType}</span>}
                          {t.updatedAt && <span style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>{fmtDate(t.updatedAt)}</span>}
                        </div>
                        {goals.map((goal, gi) => {
                          const baseline = goal.rows.find(r => r.variant === order[0]);
                          const variants = goal.rows.filter(r => r.variant !== order[0]);
                          if (!baseline && variants.length === 0) return null;
                          return (
                            <div key={gi} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap" }}>{goal.name}</span>
                              {baseline && <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", background: "#fff", border: "1px solid #CBD5E1", borderRadius: 4, padding: "2px 8px" }}>{baseline.variant} {baseline.rate.toFixed(2)}%</span>}
                              {variants.map(v => {
                                const up = v.change >= 0;
                                return (
                                  <span key={v.variant} style={{ fontSize: 11, fontWeight: 700, color: up ? "#15803D" : "#DC2626", background: up ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${up ? "#BBF7D0" : "#FECACA"}`, borderRadius: 4, padding: "2px 8px" }}>
                                    {v.variant} {v.rate.toFixed(2)}% ({up ? "+" : ""}{v.change.toFixed(1)}%)
                                  </span>
                                );
                              })}
                              {goal.rows.length > 0 && <span style={{ fontSize: 10, color: MUTED }}>{goal.rows.reduce((s, r) => s + (r.conversions ?? 0), 0).toLocaleString()} conv.</span>}
                            </div>
                          );
                        })}
                        {goals.length === 0 && <div style={{ fontSize: 12, color: MUTED, fontStyle: "italic" }}>No results synced yet</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>}
        </div>

        {/* ── SEO Intelligence ──────────────────────────────────────────────── */}
        {clients.length > 0 && (
          <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 12, padding: isMobile ? "16px" : "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>

            {/* Section header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: seoOpen ? 18 : 0, cursor: "pointer" }} onClick={() => setSeoOpen(v => !v)}>
              <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>🔍 SEO Intelligence</div>
              <div style={{ flex: 1, height: 1, background: BORDER }} />
              <div style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>{clientsWithSEO.length}/{clients.length} reporting</div>
              <div style={{ fontSize: 12, color: MUTED, transform: seoOpen ? "rotate(180deg)" : "none", transition: "transform .2s", lineHeight: 1 }}>▾</div>
            </div>

            {seoOpen && <>{/* Aggregate summary strip */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>

              {/* Avg DR */}
              <div style={{ background: avgDR != null ? drColor(avgDR).bg : "#F7F8FA", border: `1.5px solid ${avgDR != null ? drColor(avgDR).border : BORDER}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Avg Domain Rating</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: avgDR != null ? drColor(avgDR).color : MUTED, lineHeight: 1 }}>
                  {avgDR != null ? avgDR : "—"}
                </div>
                {drClients.length > 0 && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>across {drClients.length} client{drClients.length !== 1 ? "s" : ""}</div>}
              </div>

              {/* Total backlinks */}
              <div style={{ background: "#F5F3FF", border: "1.5px solid #DDD6FE", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Total Backlinks</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#6D28D9", lineHeight: 1 }}>{fmtK(totalBacklinks)}</div>
                {totalRefDomains > 0 && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{fmtK(totalRefDomains)} referring domains</div>}
              </div>

              {/* High priority issues */}
              <div style={{ background: totalHighIssues > 0 ? "#FEF2F2" : "#F0FDF4", border: `1.5px solid ${totalHighIssues > 0 ? "#FECACA" : "#BBF7D0"}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>High Priority Issues</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: totalHighIssues > 0 ? "#DC2626" : "#15803D", lineHeight: 1 }}>{totalHighIssues}</div>
                {totalMedIssues > 0 && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{totalMedIssues} medium</div>}
              </div>

              {/* Pages crawled */}
              <div style={{ background: "#ECFEFF", border: "1.5px solid #A5F3FC", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Pages Crawled</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#0E7490", lineHeight: 1 }}>{fmtK(totalPages)}</div>
                {clientsWithSEO.length > 0 && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>across {clientsWithSEO.length} site{clientsWithSEO.length !== 1 ? "s" : ""}</div>}
              </div>

            </div>

            {/* Per-client SEO rows */}
            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {visibleRows.map(c => {
                  const r   = c.crawlReport ?? {};
                  const ahrefs = r.ahrefs?.data ?? null;
                  const dr  = ahrefs?.dr?.domain_rating;
                  const bl  = ahrefs?.metrics?.live;
                  const rd  = ahrefs?.metrics?.live_refdomains;
                  const hi  = r.issues?.byPriority?.High ?? 0;
                  const med = r.issues?.byPriority?.Medium ?? 0;
                  const lo  = r.issues?.byPriority?.Low ?? 0;
                  const pages = r.internal?.htmlPages ?? r.nodes?.length ?? 0;
                  const avgRt = r.internal?.avgRt;
                  const indexable = r.internal?.indexable;
                  const thin = r.internal?.wordCount?.["Thin (<300)"] ?? 0;
                  const hasData = !!(r.domain || r.ahrefs);

                  // Top high-priority issue
                  const topIssue = r.issues?.byPrioritySorted?.find(i => i.priority === "High");

                  return (
                    <div key={c.id}
                      onClick={() => navigate(ap(`/clients/${c.id}`))}
                      style={{ background: hasData ? "#fff" : "#F9FAFB", border: `1.5px solid ${hasData ? BORDER : "#E5E7EB"}`, borderRadius: 10, padding: isMobile ? "12px 14px" : "14px 18px", cursor: "pointer", transition: "border-color .15s, box-shadow .15s", opacity: hasData ? 1 : 0.6 }}
                      onMouseEnter={e => { if (hasData) { e.currentTarget.style.borderColor = "#2A8C8C"; e.currentTarget.style.boxShadow = "0 2px 10px rgba(42,140,140,.08)"; }}}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = hasData ? BORDER : "#E5E7EB"; e.currentTarget.style.boxShadow = "none"; }}>

                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: isMobile ? "wrap" : "nowrap" }}>

                        {/* Client name + domain */}
                        <div style={{ minWidth: isMobile ? "100%" : 160, flex: isMobile ? "none" : "0 0 160px" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{c.name}</div>
                          {r.domain
                            ? <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{r.domain}</div>
                            : <div style={{ fontSize: 11, color: "#9CA3AF", fontStyle: "italic", marginTop: 2 }}>No report</div>}
                        </div>

                        {/* DR badge */}
                        {dr != null ? (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: drColor(dr).bg, border: `1.5px solid ${drColor(dr).border}`, borderRadius: 8, padding: "6px 12px", flexShrink: 0 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: drColor(dr).color, lineHeight: 1 }}>{Math.round(dr)}</div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: drColor(dr).color, textTransform: "uppercase", letterSpacing: 0.6 }}>DR</div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "#F7F8FA", border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: "6px 12px", flexShrink: 0, opacity: 0.5 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: MUTED, lineHeight: 1 }}>—</div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6 }}>DR</div>
                          </div>
                        )}

                        {/* Metrics grid */}
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>

                          {/* Backlinks row */}
                          {(bl != null || rd != null) && (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: "#6D28D9", background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 4, padding: "2px 8px" }}>
                                🔗 {fmtK(bl)} links
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: "#6D28D9", background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 4, padding: "2px 8px" }}>
                                {fmtK(rd)} domains
                              </span>
                            </div>
                          )}

                          {/* Issues row */}
                          {(hi > 0 || med > 0 || lo > 0) && (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                              {hi > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 4, padding: "2px 8px" }}>🔴 {hi} High</span>}
                              {med > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 4, padding: "2px 8px" }}>⚠️ {med} Med</span>}
                              {lo > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 4, padding: "2px 8px" }}>{lo} Low</span>}
                              {topIssue && (
                                <span style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>
                                  · {topIssue.name} ({topIssue.urls} URLs)
                                </span>
                              )}
                            </div>
                          )}

                          {/* Crawl health row */}
                          {pages > 0 && (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: "#0E7490", background: "#ECFEFF", border: "1px solid #A5F3FC", borderRadius: 4, padding: "2px 8px" }}>
                                {fmtK(pages)} pages
                              </span>
                              {indexable != null && (
                                <span style={{ fontSize: 11, fontWeight: 600, color: "#15803D", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 4, padding: "2px 8px" }}>
                                  {indexable} indexable
                                </span>
                              )}
                              {avgRt && (
                                <span style={{ fontSize: 11, fontWeight: 600, color: Number(avgRt) > 2 ? "#DC2626" : Number(avgRt) > 1 ? "#B45309" : "#15803D", background: Number(avgRt) > 2 ? "#FEF2F2" : Number(avgRt) > 1 ? "#FFFBEB" : "#F0FDF4", border: `1px solid ${Number(avgRt) > 2 ? "#FECACA" : Number(avgRt) > 1 ? "#FDE68A" : "#BBF7D0"}`, borderRadius: 4, padding: "2px 8px" }}>
                                  ⚡ {avgRt}s avg
                                </span>
                              )}
                              {thin > 0 && (
                                <span style={{ fontSize: 11, fontWeight: 600, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 4, padding: "2px 8px" }}>
                                  {thin} thin pages
                                </span>
                              )}
                            </div>
                          )}

                          {!hasData && (
                            <div style={{ fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>No SEO data — run a site report from the client portfolio</div>
                          )}
                        </div>

                        {/* Arrow */}
                        <div style={{ fontSize: 16, color: MUTED, flexShrink: 0, alignSelf: "center" }}>↗</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Show more / less */}
              {seoRows.length > SEO_PREVIEW && (
                <button
                  onClick={e => { e.stopPropagation(); setSeoExpanded(v => !v); }}
                  style={{ marginTop: 12, width: "100%", background: "none", border: `1.5px dashed ${BORDER}`, color: MUTED, padding: "9px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                  {seoExpanded ? "Show less" : `+ ${seoRows.length - SEO_PREVIEW} more client${seoRows.length - SEO_PREVIEW !== 1 ? "s" : ""}`}
                </button>
              )}
            </div>
          </>}

          </div>
        )}

      </div>

      {clientsModalOpen && (
        <ClientsModal
          clients={clients}
          tests={tests}
          onCreateClient={onCreateClient}
          onUpdateClient={onUpdateClient}
          onDeleteClient={onDeleteClient}
          onClose={() => setClientsModalOpen(false)}
        />
      )}
    </div>
  );
}
