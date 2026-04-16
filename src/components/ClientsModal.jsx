import { useState } from "react";
import { ACCENT, BG, CARD, BORDER, TEXT, MUTED, DIM } from "../lib/constants";

export default function ClientsModal({ clients, tests, onCreateClient, onUpdateClient, onUpdateClientCustomUA, onSaveCrawlReport, onDeleteClient, onClose }) {
  const [editingId,       setEditingId]       = useState(null);
  const [editName,        setEditName]        = useState("");
  const [editUA,          setEditUA]          = useState("");
  const [newName,         setNewName]         = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [newDomain,       setNewDomain]       = useState("");

  const startEdit = (c) => { setEditingId(c.id); setEditName(c.name); setEditUA(c.customUA ?? ""); setNewDomain(""); setConfirmDeleteId(null); };
  const cancelEdit = () => { setEditingId(null); setEditName(""); setEditUA(""); setNewDomain(""); };
  const saveEdit = () => {
    if (editName.trim()) onUpdateClient(editingId, editName.trim());
    onUpdateClientCustomUA?.(editingId, editUA.trim());
    cancelEdit();
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    onCreateClient(newName.trim());
    setNewName("");
  };

  const handleDelete = (id) => {
    onDeleteClient(id);
    setConfirmDeleteId(null);
    if (editingId === id) cancelEdit();
  };

  const parseDomain = (raw) =>
    raw.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();

  const handleAddDomain = (c) => {
    const d = parseDomain(newDomain);
    if (!d) return;
    const existing = c.crawlReports ?? {};
    if (!existing[d]) {
      onSaveCrawlReport?.(c.id, { ...existing, [d]: { domain: d } });
    }
    setNewDomain("");
  };

  const handleRemoveDomain = (c, domain) => {
    const updated = { ...(c.crawlReports ?? {}) };
    delete updated[domain];
    onSaveCrawlReport?.(c.id, updated);
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,25,35,.6)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: CARD, borderRadius: 12, width: "100%", maxWidth: 480, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,.35)" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center" }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: TEXT }}>Manage Clients</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: MUTED, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>

        {/* Client list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {clients.length === 0 && (
            <div style={{ padding: "20px 24px", fontSize: 13, color: DIM, textAlign: "center" }}>No clients yet. Add one below.</div>
          )}
          {clients.map((c) => {
            const count = tests.filter((t) => t.clientId === c.id).length;
            const isEditing = editingId === c.id;
            const isConfirming = confirmDeleteId === c.id;
            const domains = c.domains ?? [];

            return (
              <div key={c.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                {/* Main row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 24px" }}>
                  {isEditing ? (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>

                      {/* Client name */}
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                        autoFocus
                        placeholder="Client name"
                        style={{ width: "100%", border: `1.5px solid ${ACCENT}`, borderRadius: 6, padding: "6px 10px", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 500, color: TEXT, outline: "none", boxShadow: `0 0 0 3px #1B3A6B22`, boxSizing: "border-box" }}
                      />

                      {/* Tracked Domains */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Tracked Domains</div>
                        {domains.length === 0 && (
                          <div style={{ fontSize: 12, color: DIM, marginBottom: 6, fontStyle: "italic" }}>No domains yet.</div>
                        )}
                        {domains.map(d => (
                          <div key={d} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <span style={{ flex: 1, fontSize: 12, color: TEXT, fontFamily: "monospace", background: "#F3F4F6", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "3px 8px" }}>{d}</span>
                            <button
                              onClick={() => handleRemoveDomain(c, d)}
                              title={`Remove ${d}`}
                              style={{ background: "none", border: "none", color: "#DC2626", fontSize: 16, lineHeight: 1, padding: "2px 4px", cursor: "pointer", borderRadius: 4, flexShrink: 0 }}>
                              ×
                            </button>
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                          <input
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleAddDomain(c); if (e.key === "Escape") setNewDomain(""); }}
                            placeholder="e.g. example.com"
                            style={{ flex: 1, border: `1.5px solid ${BORDER}`, borderRadius: 6, padding: "5px 8px", fontFamily: "monospace, 'Inter', sans-serif", fontSize: 12, color: TEXT, outline: "none", boxSizing: "border-box", background: "#fff" }}
                          />
                          <button
                            onClick={() => handleAddDomain(c)}
                            style={{ background: "#0E7490", color: "#fff", border: "none", padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif", flexShrink: 0 }}>
                            + Add
                          </button>
                        </div>
                      </div>

                      {/* Custom User-Agent */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Custom User-Agent (optional)</div>
                        <input
                          value={editUA}
                          onChange={(e) => setEditUA(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                          placeholder="e.g. metricsedge-bot"
                          style={{ width: "100%", border: `1.5px solid ${BORDER}`, borderRadius: 6, padding: "6px 10px", fontFamily: "'Inter', monospace, sans-serif", fontSize: 12, color: TEXT, outline: "none", boxSizing: "border-box", background: "#F9FAFB" }}
                        />
                        <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>Used for screenshots and AI ideation on sites that block crawlers by user-agent.</div>
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={saveEdit} style={{ background: ACCENT, color: "#fff", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Save</button>
                        <button onClick={cancelEdit} style={{ background: "none", color: MUTED, border: `1.5px solid ${BORDER}`, padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{c.name}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, color: DIM }}>{count} test{count !== 1 ? "s" : ""}</span>
                          {domains.length > 0 && (
                            <span style={{ fontSize: 10, fontWeight: 600, color: "#0E7490", background: "#ECFEFF", border: "1px solid #A5F3FC", borderRadius: 4, padding: "1px 6px" }}>
                              {domains.length} domain{domains.length !== 1 ? "s" : ""}
                            </span>
                          )}
                          {c.customUA && (
                            <span style={{ fontSize: 10, fontWeight: 600, color: "#6D28D9", background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 4, padding: "1px 6px" }}>
                              custom UA
                            </span>
                          )}
                        </div>
                        {domains.length > 0 && (
                          <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{domains.join(" · ")}</div>
                        )}
                      </div>
                      <button
                        onClick={() => startEdit(c)}
                        title="Edit"
                        style={{ background: "none", border: `1.5px solid ${BORDER}`, color: MUTED, padding: "5px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                        Edit
                      </button>
                      <button
                        onClick={() => { setConfirmDeleteId(isConfirming ? null : c.id); cancelEdit(); }}
                        title="Delete"
                        style={{ background: "none", border: "none", color: DIM, fontSize: 18, lineHeight: 1, padding: "2px 6px", borderRadius: 4, cursor: "pointer" }}>
                        ×
                      </button>
                    </>
                  )}
                </div>

                {/* Inline delete confirmation */}
                {isConfirming && (
                  <div style={{ padding: "10px 24px 14px", background: "#FEF2F2", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ flex: 1, fontSize: 12, color: "#DC2626", fontWeight: 500 }}>
                      {count > 0
                        ? `${count} test${count !== 1 ? "s" : ""} will be reassigned to another client.`
                        : "Are you sure you want to delete this client?"}
                    </span>
                    <button
                      onClick={() => handleDelete(c.id)}
                      style={{ background: "#DC2626", color: "#fff", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      style={{ background: "none", color: MUTED, border: `1.5px solid ${BORDER}`, padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add new client */}
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${BORDER}`, background: BG, borderRadius: "0 0 12px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Add Client</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="Client name…"
              style={{ flex: 1, border: `1.5px solid ${BORDER}`, borderRadius: 6, padding: "8px 12px", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 500, color: TEXT, outline: "none", background: "#fff", transition: "border-color .15s" }}
              onFocus={(e) => { e.target.style.borderColor = ACCENT; }}
              onBlur={(e) => { e.target.style.borderColor = BORDER; }}
            />
            <button
              onClick={handleAdd}
              style={{ background: ACCENT, color: "#fff", border: "none", padding: "8px 18px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif", flexShrink: 0 }}>
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
