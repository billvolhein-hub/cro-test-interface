import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import ClientsModal from "../components/ClientsModal";
import { pieScore, fmtDate } from "../lib/utils";
import ClientNotesFeed from "../components/ClientNotesFeed";
import { ACCENT, BG, CARD, BORDER, TEXT, MUTED, TEAL } from "../lib/constants";
import { useBreakpoint } from "../lib/useBreakpoint";

export default function HomePage({ agencySlug = "", tests, onCreateTest, onCreateTests, onDeleteTest, onUpdateTest, clients, onCreateClient, onCreateClients, onUpdateClient, onDeleteClient, onSaveScreenshot, onSaveScreenshots }) {
  const navigate = useNavigate();
  const ap = (path) => `/${agencySlug}${path}`;
  const { isMobile } = useBreakpoint();

  const [activeClientId,   setActiveClientId]   = useState("all");
  const [clientsModalOpen, setClientsModalOpen] = useState(false);
  const [notesFeedOpen,    setNotesFeedOpen]    = useState(true);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const allTests = tests;
  const backlog   = allTests.filter(t => (t.status || "Backlog") === "Backlog").length;
  const inWork    = allTests.filter(t => ["Under Review", "Promoted to Test"].includes(t.status)).length;
  const live      = allTests.filter(t => t.status === "Test Running").length;
  const complete  = allTests.filter(t => t.status === "Test Complete").length;
  const highPie   = allTests.filter(t => Number(pieScore(t)) >= 6).length;

  const withSiteReport    = clients.filter(c => c.crawlReport?.domain).length;
  const withBacklinks     = clients.filter(c => c.crawlReport?.ahrefs).length;
  const withSEOIssues     = clients.filter(c => c.crawlReport?.issues?.length > 0).length;
  const totalPagesCrawled = clients.reduce((sum, c) => sum + (c.crawlReport?.pages?.length ?? 0), 0);

  const liveTests = allTests.filter(t => t.status === "Test Running");

  const filteredNoteTests = activeClientId === "all"
    ? tests
    : tests.filter(t => (t.clientId ?? clients[0]?.id) === activeClientId);

  // ── Sub-components ────────────────────────────────────────────────────────────
  const TestBadge = ({ label, count, color, bg, border }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: bg, border: `1.5px solid ${border}`, borderRadius: 10, padding: isMobile ? "10px 14px" : "12px 20px", minWidth: isMobile ? 64 : 80, gap: 4 }}>
      <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
      <div style={{ fontSize: isMobile ? 9 : 10, fontWeight: 700, color, letterSpacing: 0.8, textTransform: "uppercase", textAlign: "center", lineHeight: 1.3 }}>{label}</div>
    </div>
  );

  const SeoBadge = ({ label, count, total, color, bg, border, icon }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: bg, border: `1.5px solid ${border}`, borderRadius: 10, padding: isMobile ? "10px 14px" : "12px 18px", flex: "1 1 auto" }}>
      <div style={{ fontSize: isMobile ? 18 : 22, lineHeight: 1 }}>{icon}</div>
      <div>
        <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color, lineHeight: 1 }}>
          {count}
          {total !== undefined && <span style={{ fontSize: isMobile ? 11 : 13, fontWeight: 500, color: `${color}99`, marginLeft: 4 }}>/ {total}</span>}
        </div>
        <div style={{ fontSize: isMobile ? 9 : 10, fontWeight: 700, color, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter',sans-serif", color: TEXT }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0;}`}</style>

      <AppHeader />

      {/* ── Agency Overview ───────────────────────────────────────────────────── */}
      {clients.length > 0 && (
        <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 12, padding: isMobile ? "16px" : "20px 24px", marginBottom: 24, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>

          {/* Testing row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>🧪 Testing</div>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>{allTests.length} total</div>
          </div>
          <div style={{ display: "flex", gap: isMobile ? 8 : 10, flexWrap: "wrap", marginBottom: 20 }}>
            <TestBadge label="Backlog"  count={backlog}  color="#1B3A6B" bg="#EEF2FF" border="#C7D2FE" />
            <TestBadge label="In Work"  count={inWork}   color="#B45309" bg="#FFFBEB" border="#FDE68A" />
            <TestBadge label="Live"     count={live}     color="#0E7490" bg="#ECFEFF" border="#A5F3FC" />
            <TestBadge label="Complete" count={complete} color="#15803D" bg="#F0FDF4" border="#BBF7D0" />
            {highPie > 0 && <TestBadge label="High PIE ★" count={highPie} color="#B45309" bg="#FFFBEB" border="#FDE68A" />}
          </div>

          {/* SEO row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>🔍 SEO</div>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>{clients.length} client{clients.length !== 1 ? "s" : ""}</div>
          </div>
          <div style={{ display: "flex", gap: isMobile ? 8 : 10, flexWrap: "wrap" }}>
            <SeoBadge icon="📊" label="Site Reports"   count={withSiteReport}  total={clients.length} color="#2A8C8C" bg="#F0FAFA" border="#A8D8D8" />
            <SeoBadge icon="🔗" label="Backlink Intel"  count={withBacklinks}   total={clients.length} color="#6D28D9" bg="#F5F3FF" border="#DDD6FE" />
            <SeoBadge icon="⚠️" label="Issues Reports"  count={withSEOIssues}   total={clients.length} color="#B45309" bg="#FFFBEB" border="#FDE68A" />
            {totalPagesCrawled > 0 && <SeoBadge icon="🗂" label="Pages Crawled" count={totalPagesCrawled.toLocaleString()} color="#0E7490" bg="#ECFEFF" border="#A5F3FC" />}
          </div>

        </div>
      )}

      <div style={{ padding: isMobile ? "0 16px 36px" : "0 28px 48px", overflowX: "hidden" }}>

        {/* ── Client Management ──────────────────────────────────────────────── */}
        <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 12, padding: isMobile ? "16px" : "20px 24px", marginBottom: 24, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase" }}>Clients</div>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
            <button
              onClick={() => setClientsModalOpen(true)}
              style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 700, fontFamily: "'Inter',sans-serif", cursor: "pointer", background: "none", border: `1.5px solid ${BORDER}`, color: MUTED }}>
              Manage Clients
            </button>
          </div>
          {clients.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: MUTED }}>
              <div style={{ fontSize: 13, marginBottom: 12 }}>No clients yet.</div>
              <button onClick={() => setClientsModalOpen(true)}
                style={{ background: ACCENT, color: "#fff", border: "none", padding: "8px 18px", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                Add First Client
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {clients.map(c => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", borderRadius: 20, overflow: "hidden", border: `1.5px solid ${activeClientId === c.id ? ACCENT : BORDER}`, transition: "all .15s" }}>
                  <button
                    onClick={() => setActiveClientId(prev => prev === c.id ? "all" : c.id)}
                    style={{ padding: isMobile ? "6px 12px" : "7px 14px", fontSize: 13, fontWeight: 600, fontFamily: "'Inter',sans-serif", cursor: "pointer", border: "none", background: activeClientId === c.id ? ACCENT : "#fff", color: activeClientId === c.id ? "#fff" : MUTED, transition: "all .15s" }}>
                    {c.name}
                  </button>
                  <button
                    onClick={() => navigate(ap(`/clients/${c.id}`))}
                    title={`${c.name} portfolio`}
                    style={{ padding: isMobile ? "6px 10px" : "7px 11px", fontSize: 11, fontFamily: "'Inter',sans-serif", cursor: "pointer", border: "none", borderLeft: `1px solid ${activeClientId === c.id ? "rgba(255,255,255,.3)" : BORDER}`, background: activeClientId === c.id ? "#142d54" : "#F7F8FA", color: activeClientId === c.id ? "rgba(255,255,255,.8)" : MUTED, transition: "all .15s" }}>
                    ↗
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Testing ────────────────────────────────────────────────────────── */}
        <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 12, padding: isMobile ? "16px" : "20px 24px", marginBottom: 24, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>

          {/* Client Notes */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: notesFeedOpen ? 16 : 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase" }}>🧪 Testing</div>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
          </div>
          <ClientNotesFeed
            tests={filteredNoteTests}
            clients={clients}
            clientId={activeClientId === "all" ? null : activeClientId}
            collapsed={!notesFeedOpen}
            onToggle={() => setNotesFeedOpen(v => !v)}
            onUpdateTest={onUpdateTest}
          />

          {/* Live Tests */}
          {liveTests.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#0E7490", letterSpacing: 1.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>🔴 Live Tests</div>
                <div style={{ flex: 1, height: 1, background: "#A5F3FC" }} />
                <div style={{ fontSize: 11, fontWeight: 600, color: "#0E7490" }}>{liveTests.length} running</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {liveTests.map(t => {
                  const clientName = clients.find(c => c.id === t.clientId)?.name ?? "Unknown Client";
                  const goals = t.results?.goals ?? [];
                  const order = t.results?.variantOrder ?? [];
                  return (
                    <div
                      key={t.id}
                      onClick={() => navigate(ap(`/tests/${t.id}`))}
                      style={{ background: "#F0FEFF", border: "1.5px solid #A5F3FC", borderRadius: 10, padding: isMobile ? "12px 14px" : "14px 18px", cursor: "pointer", transition: "border-color .15s, box-shadow .15s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#0E7490"; e.currentTarget.style.boxShadow = "0 2px 10px rgba(14,116,144,.1)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#A5F3FC"; e.currentTarget.style.boxShadow = "none"; }}>

                      {/* Row: client chip + test name + date */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: goals.length > 0 ? 10 : 0, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#0E7490", background: "#ECFEFF", border: "1px solid #A5F3FC", borderRadius: 20, padding: "2px 10px", whiteSpace: "nowrap" }}>
                          {clientName}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {t.testName || "Untitled Test"}
                        </span>
                        {t.testType && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, background: "#F7F8FA", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2px 8px", whiteSpace: "nowrap" }}>
                            {t.testType}
                          </span>
                        )}
                        {t.updatedAt && (
                          <span style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>
                            {fmtDate(t.updatedAt)}
                          </span>
                        )}
                      </div>

                      {/* Results: one row per goal */}
                      {goals.map((goal, gi) => {
                        const baseline = goal.rows.find(r => r.variant === order[0]);
                        const variants = goal.rows.filter(r => r.variant !== order[0]);
                        if (!baseline && variants.length === 0) return null;
                        return (
                          <div key={gi} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap" }}>{goal.name}</span>
                            {baseline && (
                              <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", background: "#fff", border: "1px solid #CBD5E1", borderRadius: 4, padding: "2px 8px" }}>
                                {baseline.variant} {baseline.rate.toFixed(2)}%
                              </span>
                            )}
                            {variants.map(v => {
                              const up = v.change >= 0;
                              return (
                                <span key={v.variant} style={{ fontSize: 11, fontWeight: 700, color: up ? "#15803D" : "#DC2626", background: up ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${up ? "#BBF7D0" : "#FECACA"}`, borderRadius: 4, padding: "2px 8px" }}>
                                  {v.variant} {v.rate.toFixed(2)}% <span style={{ opacity: 0.8 }}>({up ? "+" : ""}{v.change.toFixed(1)}%)</span>
                                </span>
                              );
                            })}
                            {goal.rows.length > 0 && (
                              <span style={{ fontSize: 10, color: MUTED }}>
                                {goal.rows.reduce((s, r) => s + (r.conversions ?? 0), 0).toLocaleString()} conversions
                              </span>
                            )}
                          </div>
                        );
                      })}

                      {goals.length === 0 && (
                        <div style={{ fontSize: 12, color: MUTED, fontStyle: "italic" }}>No results synced yet</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

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
