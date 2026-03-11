import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import ClientsModal from "../components/ClientsModal";
import { pieScore, scoreColor, scoreBg, scoreBorder, fmtDate, parseCSVMulti, mapCSVToTest } from "../lib/utils";
import { PIE_CRITERIA, TEST_STATUSES, DEFAULT_STATUS, ACCENT, BG, CARD, BORDER, TEXT, MUTED, DIM, TEAL } from "../lib/constants";

const statusStyle = (val) => TEST_STATUSES.find(s => s.value === val) || TEST_STATUSES[0];

// Defined inside component (see below) so it captures live `clients` from scope.

export default function HomePage({ tests, onCreateTest, onCreateTests, onDeleteTest, clients, onCreateClient, onCreateClients, onUpdateClient, onDeleteClient }) {
  const navigate = useNavigate();
  const [confirmDelete,    setConfirmDelete]    = useState(null);
  const [importResult,     setImportResult]     = useState(null);
  const [importError,      setImportError]      = useState("");
  const [activeClientId,   setActiveClientId]   = useState("all");
  const [clientsModalOpen, setClientsModalOpen] = useState(false);
  const [expandedClients,  setExpandedClients]  = useState(new Set());
  const [selectedIds,      setSelectedIds]      = useState(new Set());
  const [bulkConfirm,      setBulkConfirm]      = useState(false);

  const PAGE_SIZE = 6;

  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const activeClientName = clients.find(c => c.id === activeClientId)?.name ?? null;
  const selectAllForClient = () => {
    const scope = activeClientId === "all"
      ? sorted
      : sorted.filter(t => resolveClientId(t) === activeClientId);
    setSelectedIds(new Set(scope.map(t => t.id)));
  };
  const clearSelection = () => { setSelectedIds(new Set()); setBulkConfirm(false); };
  const bulkDelete = () => {
    selectedIds.forEach(id => onDeleteTest(id));
    clearSelection();
  };
  const toggleExpand = (cid) => setExpandedClients(prev => {
    const next = new Set(prev);
    next.has(cid) ? next.delete(cid) : next.add(cid);
    return next;
  });
  const csvRef = useRef(null);

  const blankTest = () => ({
    id: Date.now(), clientId: null, status: DEFAULT_STATUS,
    testName: "", pageUrl: "", testType: "", audience: "",
    primaryMetric: "", secondaryMetrics: [], if: "", then: "", because: "",
    potential: 5, importance: 5, ease: 5,
    createdAt: Date.now(), updatedAt: Date.now(),
  });

  // Tests with no clientId fall back to the first client (covers pre-existing localStorage data)
  const resolveClientId = (t) => t.clientId ?? clients[0]?.id ?? null;
  const filtered = (activeClientId === "all" || !clients.find(c => c.id === activeClientId))
    ? tests
    : tests.filter(t => resolveClientId(t) === activeClientId);
  const sorted = [...filtered].sort((a, b) => Number(pieScore(b)) - Number(pieScore(a)));

  const handleNew = async () => {
    const t = blankTest();
    const saved = await onCreateTest(t);
    navigate(`/tests/${saved.id}/edit`);
  };

  const handleMassImport = (file) => {
    if (!file) return;
    setImportError("");
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const rows = parseCSVMulti(ev.target.result);
      if (rows.length === 0) {
        setImportError("CSV must have a header row and at least one data row.");
        if (csvRef.current) csvRef.current.value = "";
        return;
      }

      // Pass 1: parse valid rows
      const validRows = rows.map(row => mapCSVToTest(row)).filter(f => Object.keys(f).length > 0);
      const skipped = rows.length - validRows.length;

      // Pass 2: collect unique new client names not already in state
      const existingClients = [...clients];
      const newClientNames = [];
      validRows.forEach(fields => {
        if (!fields.clientName) return;
        const name = fields.clientName.trim();
        const alreadyExists = existingClients.some(c => c.name.toLowerCase() === name.toLowerCase());
        const alreadyQueued = newClientNames.some(n => n.toLowerCase() === name.toLowerCase());
        if (!alreadyExists && !alreadyQueued) newClientNames.push(name);
      });

      // Pass 3: batch-create new clients in Supabase (IDs assigned by DB)
      let newClients = [];
      if (newClientNames.length > 0) {
        newClients = await onCreateClients(newClientNames);
      }

      // Pass 4: resolve tests using DB-assigned client IDs
      const allClients = [...existingClients, ...newClients];
      const defaultClientId = allClients[0]?.id ?? null;
      const testsToCreate = validRows.map((fields) => {
        let clientId = defaultClientId;
        if (fields.clientName) {
          const name = fields.clientName.trim();
          const match = allClients.find(c => c.name.toLowerCase() === name.toLowerCase());
          if (match) clientId = match.id;
        }
        const { clientName: _drop, ...testFields } = fields;
        return { ...blankTest(), ...testFields, clientId, createdAt: Date.now() };
      });

      if (testsToCreate.length === 0) {
        setImportError("No rows matched any recognised column headers.");
      } else {
        await onCreateTests(testsToCreate);
        setImportResult({ count: testsToCreate.length, skipped });
        setTimeout(() => setImportResult(null), 5000);
      }
      if (csvRef.current) csvRef.current.value = "";
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter',sans-serif", color: TEXT }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .test-card{background:#fff;border:1.5px solid ${BORDER};border-radius:10px;padding:20px;cursor:pointer;transition:border-color .15s,box-shadow .15s;position:relative;}
        .test-card:hover{border-color:${ACCENT};box-shadow:0 4px 16px rgba(27,58,107,.1);}
        .test-card.selected{border-color:${ACCENT};background:#F5F8FF;box-shadow:0 0 0 3px #1B3A6B22;}
        .test-card.high-pie{border-color:#F59E0B;background:linear-gradient(135deg,#fff 85%,#FFFBEB 100%);}
        .test-card.high-pie:hover{border-color:#D97706;box-shadow:0 4px 16px rgba(245,158,11,.18);}
        .test-card.high-pie.selected{border-color:${ACCENT};background:#F5F8FF;}
        .sel-cb{position:absolute;top:12px;left:12px;width:18px;height:18px;border-radius:4px;border:2px solid ${BORDER};background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .12s;flex-shrink:0;}
        .sel-cb:hover{border-color:${ACCENT};}
        .sel-cb.checked{background:${ACCENT};border-color:${ACCENT};}
        .test-card:hover .sel-cb{border-color:${ACCENT};}
        .del-btn{background:none;border:none;color:${DIM};cursor:pointer;font-size:18px;line-height:1;padding:2px 6px;border-radius:4px;transition:color .1s,background .1s;}
        .del-btn:hover{color:#DC2626;background:#FEF2F2;}
        .new-btn{background:${ACCENT};color:#fff;border:none;padding:11px 22px;border-radius:7px;font-family:'Inter',sans-serif;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;}
        .new-btn:hover{background:#142d54;}
        .imp-btn{background:#fff;color:${ACCENT};border:1.5px solid ${ACCENT};padding:10px 18px;border-radius:7px;font-family:'Inter',sans-serif;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;}
        .imp-btn:hover{background:#F0F4FA;}
      `}</style>

      <AppHeader right={
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="imp-btn" onClick={() => { setImportError(""); csvRef.current?.click(); }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2M8 1v8M5 6l3 3 3-3" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Import CSV
          </button>
          <input ref={csvRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
            onChange={(e) => handleMassImport(e.target.files[0])} />
          <button className="new-btn" onClick={handleNew}>
            <span style={{ fontSize: 20, lineHeight: 1, marginTop: -1 }}>+</span> New Test
          </button>
        </div>
      } />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 28px 36px" }}>

        {/* Client filter bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {[{ id: "all", name: "All Clients" }, ...clients].map((c) => (
            <button key={c.id} onClick={() => setActiveClientId(c.id)}
              style={{ padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, fontFamily: "'Inter',sans-serif", cursor: "pointer", border: "1.5px solid", transition: "all .15s", borderColor: activeClientId === c.id ? ACCENT : BORDER, background: activeClientId === c.id ? ACCENT : "#fff", color: activeClientId === c.id ? "#fff" : MUTED }}>
              {c.name}
            </button>
          ))}
          <button onClick={() => setClientsModalOpen(true)}
            style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 700, fontFamily: "'Inter',sans-serif", cursor: "pointer", background: "none", border: `1.5px solid ${BORDER}`, color: MUTED }}>
            Manage Clients
          </button>
        </div>

        {/* Client title bar */}
        <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: "16px 22px", marginBottom: 24, display: "flex", alignItems: "center", gap: 16, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: activeClientId === "all" ? BG : "#EEF2FF", border: `1.5px solid ${activeClientId === "all" ? BORDER : "#C7D2FE"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="6" width="14" height="9" rx="1.5" stroke={activeClientId === "all" ? MUTED : "#6D28D9"} strokeWidth="1.4"/>
              <path d="M5 6V4.5a3 3 0 016 0V6" stroke={activeClientId === "all" ? MUTED : "#6D28D9"} strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, lineHeight: 1.2 }}>
              {activeClientId === "all" ? "All Clients" : (activeClientName || "Client")}
            </div>
            <div style={{ fontSize: 12, color: MUTED, fontWeight: 500, marginTop: 2 }}>
              {sorted.length} test{sorted.length !== 1 ? "s" : ""}
              {activeClientId === "all" && clients.length > 0 && ` across ${clients.length} client${clients.length !== 1 ? "s" : ""}`}
            </div>
          </div>
          {(() => {
            const scored = sorted.filter(t => t.potential || t.importance || t.ease);
            if (scored.length === 0) return null;
            const avg = (scored.reduce((sum, t) => sum + Number(pieScore(t)), 0) / scored.length).toFixed(1);
            return (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 }}>
                <div style={{ background: scoreBg(avg), border: `1.5px solid ${scoreBorder(avg)}`, color: scoreColor(avg), borderRadius: 8, padding: "6px 14px", fontSize: 20, fontWeight: 800, lineHeight: 1 }}>
                  {avg}
                </div>
                <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" }}>Avg PIE</div>
              </div>
            );
          })()}
          {activeClientId !== "all" && (
            <button onClick={() => setActiveClientId("all")}
              style={{ background: "none", border: `1.5px solid ${BORDER}`, color: MUTED, padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif", flexShrink: 0 }}>
              ← All Clients
            </button>
          )}
        </div>

        {/* Import feedback */}
        {importResult && (
          <div style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: 8, padding: "12px 18px", marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>✓</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#15803D" }}>
              Imported {importResult.count} test{importResult.count !== 1 ? "s" : ""}
              {importResult.skipped > 0 ? ` — ${importResult.skipped} row${importResult.skipped !== 1 ? "s" : ""} skipped (no recognised headers)` : ""}
            </span>
          </div>
        )}
        {importError && (
          <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 8, padding: "12px 18px", marginBottom: 24 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#DC2626" }}>{importError}</span>
          </div>
        )}

        {tests.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: MUTED }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No tests yet</div>
            <div style={{ fontSize: 14, marginBottom: 24 }}>Create a new test or import from a CSV spreadsheet.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="new-btn" onClick={handleNew} style={{ display: "inline-flex" }}>+ New Test</button>
              <button className="imp-btn" onClick={() => csvRef.current?.click()} style={{ display: "inline-flex" }}>Import CSV</button>
            </div>
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: MUTED }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No tests for this client</div>
            <div style={{ fontSize: 13 }}>Try selecting a different client or <button onClick={() => setActiveClientId("all")} style={{ background: "none", border: "none", color: ACCENT, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif", fontSize: 13, padding: 0 }}>view all</button>.</div>
          </div>
        ) : (() => {
          // Build ordered groups: one per client present in `sorted`
          const groups = [];
          const seen = new Map();
          sorted.forEach(t => {
            const cid = resolveClientId(t);
            if (!seen.has(cid)) { seen.set(cid, []); groups.push(cid); }
            seen.get(cid).push(t);
          });

          const renderCard = (t) => {
            const s = Number(pieScore(t));
            const st = statusStyle(t.status || DEFAULT_STATUS);
            const isSelected = selectedIds.has(t.id);
            const isHighPie = s >= 6.0;
            return (
              <div key={t.id} className={`test-card${isSelected ? " selected" : ""}${isHighPie ? " high-pie" : ""}`}
                onClick={() => selectedIds.size > 0 ? toggleSelect(t.id, { stopPropagation: () => {} }) : navigate(`/tests/${t.id}`)}>
                {/* Checkbox */}
                <div className={`sel-cb${isSelected ? " checked" : ""}`}
                  onClick={e => toggleSelect(t.id, e)}>
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14, paddingLeft: 26 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, lineHeight: 1.3, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.testName || <span style={{ color: DIM, fontWeight: 400 }}>Untitled Test</span>}
                    </div>
                    {t.pageUrl && (
                      <div style={{ fontSize: 11, color: TEAL, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.pageUrl}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    {isHighPie && (
                      <div title="High priority — PIE ≥ 6.0" style={{ fontSize: 15, lineHeight: 1, color: "#F59E0B" }}>★</div>
                    )}
                    <div style={{ background: scoreBg(s), border: `1.5px solid ${scoreBorder(s)}`, borderRadius: 6, padding: "4px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: scoreColor(s), lineHeight: 1 }}>{pieScore(t)}</div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: scoreColor(s), letterSpacing: 0.5 }}>PIE</div>
                    </div>
                    <button className="del-btn" onClick={(e) => { e.stopPropagation(); setConfirmDelete(t.id); }} title="Delete test">×</button>
                  </div>
                </div>

                <div style={{ paddingLeft: 26, marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, border: `1px solid ${st.border}`, borderRadius: 20, padding: "3px 10px", display: "inline-block" }}>
                    {t.status || DEFAULT_STATUS}
                  </span>
                </div>

                {t.if && (
                  <div style={{ paddingLeft: 26, fontSize: 12, color: MUTED, lineHeight: 1.6, marginBottom: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    <span style={{ fontWeight: 700, color: ACCENT }}>If </span>{t.if}
                  </div>
                )}

                <div style={{ paddingLeft: 26, display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {t.testType      && <span style={{ fontSize: 11, fontWeight: 600, color: ACCENT, background: "#F0F4FA", border: `1px solid #C0CFEA`, borderRadius: 4, padding: "2px 8px" }}>{t.testType}</span>}
                  {t.audience      && <span style={{ fontSize: 11, fontWeight: 600, color: MUTED,  background: BG,       border: `1px solid ${BORDER}`,   borderRadius: 4, padding: "2px 8px" }}>{t.audience}</span>}
                  {t.primaryMetric && <span style={{ fontSize: 11, fontWeight: 600, color: TEAL,  background: "#F0FAFA", border: `1px solid #A8D8D8`,   borderRadius: 4, padding: "2px 8px" }}>{t.primaryMetric}</span>}
                </div>

                <div style={{ paddingLeft: 26, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    {PIE_CRITERIA.map(c => (
                      <div key={c.key} style={{ fontSize: 11, fontWeight: 700, color: c.color }}>{c.label[0]}{t[c.key]}</div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: DIM, fontWeight: 500 }}>
                    {t.updatedAt ? `Updated ${fmtDate(t.updatedAt)}` : fmtDate(t.createdAt)}
                  </div>
                </div>
              </div>
            );
          };

          return groups.map(cid => {
            const group = seen.get(cid);
            const clientName = clients.find(c => c.id === cid)?.name;
            const isExpanded = expandedClients.has(cid);
            const visible = isExpanded ? group : group.slice(0, PAGE_SIZE);
            const hidden = group.length - PAGE_SIZE;
            const showHeader = activeClientId === "all" && groups.length > 1;

            return (
              <div key={cid} style={{ marginBottom: showHeader ? 32 : 0 }}>
                {showHeader && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#6D28D9" }}>{clientName || "Unassigned"}</span>
                    <span style={{ fontSize: 12, color: DIM, fontWeight: 500 }}>{group.length} test{group.length !== 1 ? "s" : ""}</span>
                    <div style={{ flex: 1, height: 1, background: BORDER }} />
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                  {visible.map(renderCard)}
                </div>
                {hidden > 0 && !isExpanded && (
                  <button onClick={() => toggleExpand(cid)}
                    style={{ marginTop: 14, width: "100%", background: "none", border: `1.5px dashed ${BORDER}`, color: MUTED, padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                    Show {hidden} more {clientName ? `${clientName} ` : ""}test{hidden !== 1 ? "s" : ""}
                  </button>
                )}
                {isExpanded && group.length > PAGE_SIZE && (
                  <button onClick={() => toggleExpand(cid)}
                    style={{ marginTop: 14, width: "100%", background: "none", border: `1.5px dashed ${BORDER}`, color: MUTED, padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                    Show less
                  </button>
                )}
              </div>
            );
          });
        })()}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 900, background: TEXT, borderRadius: 10, padding: "12px 20px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 8px 32px rgba(0,0,0,.35)", minWidth: 340, maxWidth: "90vw" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", flex: 1 }}>
            {selectedIds.size} test{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <button onClick={selectAllForClient}
            style={{ background: "none", border: "1px solid rgba(255,255,255,.25)", color: "rgba(255,255,255,.8)", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif", whiteSpace: "nowrap" }}>
            Select all {sorted.length}{activeClientName ? ` · ${activeClientName}` : ""}
          </button>
          {bulkConfirm ? (
            <>
              <span style={{ fontSize: 12, color: "#FCA5A5", fontWeight: 600, whiteSpace: "nowrap" }}>Delete {selectedIds.size}?</span>
              <button onClick={bulkDelete}
                style={{ background: "#DC2626", color: "#fff", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                Confirm
              </button>
              <button onClick={() => setBulkConfirm(false)}
                style={{ background: "none", border: "1px solid rgba(255,255,255,.25)", color: "rgba(255,255,255,.8)", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setBulkConfirm(true)}
              style={{ background: "#DC2626", color: "#fff", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif", whiteSpace: "nowrap" }}>
              Delete selected
            </button>
          )}
          <button onClick={clearSelection}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", fontSize: 20, lineHeight: 1, cursor: "pointer", padding: "0 4px" }}>
            ×
          </button>
        </div>
      )}

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

      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,25,35,.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: CARD, borderRadius: 10, padding: 28, maxWidth: 360, width: "100%", boxShadow: "0 16px 48px rgba(0,0,0,.25)", margin: "0 16px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 8 }}>Delete this test?</div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 24 }}>
              "{tests.find(t => t.id === confirmDelete)?.testName || "Untitled Test"}" will be permanently removed.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { onDeleteTest(confirmDelete); setConfirmDelete(null); }}
                style={{ flex: 1, background: "#DC2626", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                Delete
              </button>
              <button onClick={() => setConfirmDelete(null)}
                style={{ flex: 1, background: BG, color: MUTED, border: `1.5px solid ${BORDER}`, padding: "10px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
