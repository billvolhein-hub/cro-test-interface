import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import ClientsModal from "../components/ClientsModal";
import { pieScore, scoreColor, scoreBg, scoreBorder, fmtDate, parseCSVMulti, mapCSVToTest } from "../lib/utils";
import ClientNotesFeed from "../components/ClientNotesFeed";
import { PIE_CRITERIA, TEST_STATUSES, DEFAULT_STATUS, ACCENT, BG, CARD, BORDER, TEXT, MUTED, DIM, TEAL } from "../lib/constants";
import { useBreakpoint } from "../lib/useBreakpoint";

const statusStyle = (val) => TEST_STATUSES.find(s => s.value === val) || TEST_STATUSES[0];

// Defined inside component (see below) so it captures live `clients` from scope.

export default function HomePage({ tests, onCreateTest, onCreateTests, onDeleteTest, clients, onCreateClient, onCreateClients, onUpdateClient, onDeleteClient }) {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useBreakpoint();
  const [confirmDelete,    setConfirmDelete]    = useState(null);
  const [importResult,     setImportResult]     = useState(null);
  const [importError,      setImportError]      = useState("");
  const [activeClientId,   setActiveClientId]   = useState("all");
  const [clientsModalOpen, setClientsModalOpen] = useState(false);
  const [expandedCols,     setExpandedCols]     = useState(new Set());
  const [selectedIds,      setSelectedIds]      = useState(new Set());
  const [bulkConfirm,      setBulkConfirm]      = useState(false);
  const [draggingId,       setDraggingId]       = useState(null);
  const [dragOverStatus,   setDragOverStatus]   = useState(null);
  const [expandedCards,    setExpandedCards]    = useState(new Set());
  const [notesFeedOpen,    setNotesFeedOpen]    = useState(true);

  const toggleCard = (id, e) => { e.stopPropagation(); setExpandedCards(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };

  const selectClient = (clientId) => {
    setActiveClientId(clientId);
  };

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
  const toggleExpand = (key) => setExpandedCols(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
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
        .sel-cb{width:16px;height:16px;border-radius:4px;border:2px solid ${BORDER};background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .12s;flex-shrink:0;}
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

      <AppHeader />
      <input ref={csvRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
        onChange={(e) => handleMassImport(e.target.files[0])} />

      <div style={{ padding: isMobile ? "16px 16px 28px" : "28px 28px 36px", overflowX: "hidden" }}>

        {/* Client filter bar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {[{ id: "all", name: "All Clients" }, ...clients].map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", borderRadius: 20, overflow: "hidden", border: "1.5px solid", transition: "all .15s", borderColor: activeClientId === c.id ? ACCENT : BORDER }}>
                <button onClick={() => selectClient(c.id)}
                  style={{ padding: isMobile ? "5px 10px" : "6px 14px", fontSize: isMobile ? 12 : 13, fontWeight: 600, fontFamily: "'Inter',sans-serif", cursor: "pointer", border: "none", transition: "all .15s", background: activeClientId === c.id ? ACCENT : "#fff", color: activeClientId === c.id ? "#fff" : MUTED }}>
                  {c.name}
                </button>
                {c.id !== "all" && (
                  <button onClick={() => navigate(`/clients/${c.id}`)} title={`${c.name} portfolio`}
                    style={{ padding: isMobile ? "5px 8px" : "6px 10px", fontSize: 11, fontFamily: "'Inter',sans-serif", cursor: "pointer", border: "none", borderLeft: `1px solid ${activeClientId === c.id ? "rgba(255,255,255,.3)" : BORDER}`, background: activeClientId === c.id ? "#142d54" : "#F7F8FA", color: activeClientId === c.id ? "rgba(255,255,255,.8)" : MUTED, transition: "all .15s" }}>
                    ↗
                  </button>
                )}
              </div>
            ))}
            <button onClick={() => setClientsModalOpen(true)}
              style={{ marginLeft: isMobile ? 0 : "auto", padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 700, fontFamily: "'Inter',sans-serif", cursor: "pointer", background: "none", border: `1.5px solid ${BORDER}`, color: MUTED }}>
              Manage Clients
            </button>
          </div>
        </div>

        {/* Client title bar */}
        <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: isMobile ? "14px 16px" : "16px 22px", marginBottom: 24, display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 12 : 16, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          {/* Icon + title */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: activeClientId === "all" ? BG : "#EEF2FF", border: `1.5px solid ${activeClientId === "all" ? BORDER : "#C7D2FE"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="6" width="14" height="9" rx="1.5" stroke={activeClientId === "all" ? MUTED : "#6D28D9"} strokeWidth="1.4"/>
                <path d="M5 6V4.5a3 3 0 016 0V6" stroke={activeClientId === "all" ? MUTED : "#6D28D9"} strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: TEXT, lineHeight: 1.2 }}>
                {activeClientId === "all" ? "All Clients" : (activeClientName || "Client")}
              </div>
              <div style={{ fontSize: 12, color: MUTED, fontWeight: 500, marginTop: 2 }}>
                {sorted.length} test{sorted.length !== 1 ? "s" : ""}
                {activeClientId === "all" && clients.length > 0 && ` across ${clients.length} client${clients.length !== 1 ? "s" : ""}`}
              </div>
            </div>
            {/* AVG PIE badge — inline with title on both mobile and desktop */}
            {(() => {
              const scored = sorted.filter(t => t.potential || t.importance || t.ease);
              if (scored.length === 0) return null;
              const avg = (scored.reduce((sum, t) => sum + Number(pieScore(t)), 0) / scored.length).toFixed(1);
              return (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 }}>
                  <div style={{ background: scoreBg(avg), border: `1.5px solid ${scoreBorder(avg)}`, color: scoreColor(avg), borderRadius: 8, padding: isMobile ? "4px 10px" : "6px 14px", fontSize: isMobile ? 16 : 20, fontWeight: 800, lineHeight: 1 }}>{avg}</div>
                  <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" }}>Avg PIE</div>
                </div>
              );
            })()}
          </div>
          {/* Action buttons */}
          {activeClientId === "all" ? (
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button className="imp-btn" onClick={() => { setImportError(""); csvRef.current?.click(); }} style={isMobile ? { flex: 1, justifyContent: "center" } : {}}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2M8 1v8M5 6l3 3 3-3" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Import CSV
              </button>
              <button className="new-btn" onClick={handleNew} style={isMobile ? { flex: 1, justifyContent: "center" } : {}}>
                <span style={{ fontSize: 20, lineHeight: 1, marginTop: -1 }}>+</span> New Test
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button onClick={() => navigate(`/clients/${activeClientId}`)}
                style={{ background: ACCENT, color: "#fff", border: "none", padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif", flex: isMobile ? 1 : undefined }}>
                Portfolio →
              </button>
              <button onClick={() => selectClient("all")}
                style={{ background: "none", border: `1.5px solid ${BORDER}`, color: MUTED, padding: "7px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                ← All
              </button>
            </div>
          )}
        </div>

        {/* Client Notes feed */}
        <ClientNotesFeed
          tests={activeClientId === "all" ? tests : tests.filter(t => (t.clientId ?? clients[0]?.id) === activeClientId)}
          clients={clients}
          clientId={activeClientId === "all" ? null : activeClientId}
          collapsed={!notesFeedOpen}
          onToggle={() => setNotesFeedOpen(v => !v)}
        />

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
            <div style={{ fontSize: 13 }}>Try selecting a different client or <button onClick={() => selectClient("all")} style={{ background: "none", border: "none", color: ACCENT, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif", fontSize: 13, padding: 0 }}>view all</button>.</div>
          </div>
        ) : (() => {
          const renderCard = (t) => {
            const s = Number(pieScore(t));
            const st = statusStyle(t.status || DEFAULT_STATUS);
            const isSelected = selectedIds.has(t.id);
            const isHighPie = s >= 6.0;
            const isDragging = draggingId === t.id;
            const isExpanded = activeClientId !== "all" || expandedCards.has(t.id);
            return (
              <div key={t.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDraggingId(t.id); }}
                onDragEnd={() => { setDraggingId(null); setDragOverStatus(null); }}
                onDragOver={(e) => e.preventDefault()}
                className={`test-card${isSelected ? " selected" : ""}${isHighPie ? " high-pie" : ""}`}
                style={{ opacity: isDragging ? 0.4 : 1, cursor: "grab", padding: "10px 12px" }}
                onClick={() => selectedIds.size > 0 ? toggleSelect(t.id, { stopPropagation: () => {} }) : navigate(`/tests/${t.id}`)}>

                {/* Always-visible collapsed row */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* Checkbox */}
                  <div className={`sel-cb${isSelected ? " checked" : ""}`} style={{ position: "static", flexShrink: 0 }}
                    onClick={e => toggleSelect(t.id, e)}>
                    {isSelected && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>

                  {/* Name */}
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {isHighPie && <span title="PIE ≥ 6.0" style={{ color: "#F59E0B", marginRight: 4 }}>★</span>}
                    {t.testName || <span style={{ color: DIM, fontWeight: 400 }}>Untitled</span>}
                  </div>

                  {/* PIE badge */}
                  <div style={{ background: scoreBg(s), border: `1.5px solid ${scoreBorder(s)}`, borderRadius: 5, padding: "2px 8px", textAlign: "center", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: scoreColor(s), lineHeight: 1.2 }}>{pieScore(t)}</div>
                    <div style={{ fontSize: 8, fontWeight: 700, color: scoreColor(s), letterSpacing: 0.4 }}>PIE</div>
                  </div>

                  {/* Expand / delete */}
                  <button onClick={e => toggleCard(t.id, e)} title={isExpanded ? "Collapse" : "Expand"}
                    style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 12, lineHeight: 1, padding: "2px 4px", flexShrink: 0, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▾</button>
                  <button className="del-btn" onClick={(e) => { e.stopPropagation(); setConfirmDelete(t.id); }} title="Delete" style={{ fontSize: 14, padding: "1px 5px" }}>×</button>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
                    {t.pageUrl && (
                      <div style={{ fontSize: 11, color: TEAL, fontWeight: 500, marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.pageUrl}</div>
                    )}
                    {t.if && (
                      <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        <span style={{ fontWeight: 700, color: ACCENT }}>If </span>{t.if}
                      </div>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                      {t.testType      && <span style={{ fontSize: 11, fontWeight: 600, color: ACCENT, background: "#F0F4FA", border: `1px solid #C0CFEA`, borderRadius: 4, padding: "2px 7px" }}>{t.testType}</span>}
                      {t.audience      && <span style={{ fontSize: 11, fontWeight: 600, color: MUTED,  background: BG,       border: `1px solid ${BORDER}`,   borderRadius: 4, padding: "2px 7px" }}>{t.audience}</span>}
                      {t.primaryMetric && <span style={{ fontSize: 11, fontWeight: 600, color: TEAL,  background: "#F0FAFA", border: `1px solid #A8D8D8`,   borderRadius: 4, padding: "2px 7px" }}>{t.primaryMetric}</span>}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        {PIE_CRITERIA.map(c => (
                          <div key={c.key} style={{ fontSize: 11, fontWeight: 700, color: c.color }}>{c.label[0]}{t[c.key]}</div>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: DIM }}>{t.updatedAt ? `Updated ${fmtDate(t.updatedAt)}` : fmtDate(t.createdAt)}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          };

          // Kanban column definitions — merges statuses into display lanes
          const LANES = [
            { key: "backlog",  label: "Backlog",    statuses: ["Backlog"],                          dropStatus: "Backlog",         color: "#1B3A6B", bg: "#EEF2FF", border: "#C7D2FE" },
            { key: "inwork",   label: "In Work",    statuses: ["Under Review", "Promoted to Test"], dropStatus: "Under Review",    color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
            { key: "live",     label: "Live Tests",  statuses: ["Test Running"],                    dropStatus: "Test Running",    color: "#0E7490", bg: "#ECFEFF", border: "#A5F3FC" },
          ];

          const completed = sorted.filter(t => t.status === "Test Complete");

          const handleDrop = (dropStatus) => {
            if (draggingId === null) return;
            const t = tests.find(x => x.id === draggingId);
            if (t && (t.status || DEFAULT_STATUS) !== dropStatus) {
              onUpdateTest(draggingId, "status", dropStatus);
            }
            setDraggingId(null);
            setDragOverStatus(null);
          };

          const renderLane = (lane) => {
            const col = sorted.filter(t => lane.statuses.includes(t.status || DEFAULT_STATUS));
            const isExpanded = expandedCols.has(lane.key);
            const visible = isExpanded ? col : col.slice(0, PAGE_SIZE);
            const hidden = col.length - PAGE_SIZE;
            const isDropTarget = dragOverStatus === lane.key && draggingId !== null;
            return (
              <div key={lane.key}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverStatus(lane.key); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStatus(null); }}
                onDrop={() => handleDrop(lane.dropStatus)}
                style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", borderRadius: 10, transition: "background .15s", background: isDropTarget ? lane.bg : "transparent", outline: isDropTarget ? `2px dashed ${lane.border}` : "2px dashed transparent", outlineOffset: 2 }}>
                {/* Column header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "10px 14px", background: lane.bg, border: `1.5px solid ${isDropTarget ? lane.color : lane.border}`, borderRadius: 8, transition: "border-color .15s" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: lane.color, letterSpacing: 1, textTransform: "uppercase", flex: 1 }}>{lane.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: lane.color, background: "#fff", border: `1px solid ${lane.border}`, borderRadius: 10, padding: "1px 8px", minWidth: 22, textAlign: "center" }}>{col.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {visible.map(renderCard)}
                </div>
                {hidden > 0 && !isExpanded && (
                  <button onClick={() => toggleExpand(lane.key)} style={{ marginTop: 10, width: "100%", background: "none", border: `1.5px dashed ${lane.border}`, color: lane.color, padding: "9px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                    + {hidden} more
                  </button>
                )}
                {isExpanded && col.length > PAGE_SIZE && (
                  <button onClick={() => toggleExpand(lane.key)} style={{ marginTop: 10, width: "100%", background: "none", border: `1.5px dashed ${lane.border}`, color: lane.color, padding: "9px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                    Show less
                  </button>
                )}
                {col.length === 0 && (
                  <div style={{ padding: "32px 0", textAlign: "center", color: isDropTarget ? lane.color : DIM, fontSize: 12, border: `1.5px dashed ${isDropTarget ? lane.color : BORDER}`, borderRadius: 8, transition: "all .15s" }}>
                    {isDropTarget ? "Drop to move here" : "No tests"}
                  </div>
                )}
              </div>
            );
          };

          return (
            <>
              {/* Kanban board */}
              <div style={{ overflowX: isMobile ? "auto" : "visible", margin: isMobile ? "0 -16px" : 0, padding: isMobile ? "0 16px 8px" : 0 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: completed.length > 0 ? 32 : 0, minWidth: isMobile ? "fit-content" : undefined }}>
                  {LANES.map(renderLane)}
                </div>
              </div>

              {/* Test Complete section */}
              {completed.length > 0 && (
                <div style={{ borderTop: `2px solid #BBF7D0`, paddingTop: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#15803D", letterSpacing: 1.2, textTransform: "uppercase" }}>✓ Test Complete</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#15803D", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "1px 8px" }}>{completed.length}</span>
                    <div style={{ flex: 1, height: 1, background: "#BBF7D0" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                    {completed.map(renderCard)}
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 900, background: TEXT, borderRadius: 10, padding: isMobile ? "10px 14px" : "12px 20px", display: "flex", alignItems: "center", gap: isMobile ? 8 : 14, boxShadow: "0 8px 32px rgba(0,0,0,.35)", minWidth: isMobile ? "calc(100vw - 32px)" : 340, maxWidth: "90vw" }}>
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
