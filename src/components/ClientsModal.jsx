import { useState } from "react";
import { ACCENT, BG, CARD, BORDER, TEXT, MUTED, DIM } from "../lib/constants";

export default function ClientsModal({ clients, tests, onCreateClient, onUpdateClient, onDeleteClient, onClose }) {
  const [editingId,      setEditingId]      = useState(null);
  const [editName,       setEditName]       = useState("");
  const [newName,        setNewName]        = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const startEdit = (c) => { setEditingId(c.id); setEditName(c.name); setConfirmDeleteId(null); };
  const cancelEdit = () => { setEditingId(null); setEditName(""); };
  const saveEdit = () => {
    if (editName.trim()) onUpdateClient(editingId, editName.trim());
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

            return (
              <div key={c.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                {/* Main row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 24px" }}>
                  {isEditing ? (
                    <>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                        autoFocus
                        style={{ flex: 1, border: `1.5px solid ${ACCENT}`, borderRadius: 6, padding: "6px 10px", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 500, color: TEXT, outline: "none", boxShadow: `0 0 0 3px #1B3A6B22` }}
                      />
                      <button onClick={saveEdit} style={{ background: ACCENT, color: "#fff", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Save</button>
                      <button onClick={cancelEdit} style={{ background: "none", color: MUTED, border: `1.5px solid ${BORDER}`, padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{c.name}</span>
                        <span style={{ fontSize: 11, color: DIM, marginLeft: 8 }}>{count} test{count !== 1 ? "s" : ""}</span>
                      </div>
                      <button
                        onClick={() => startEdit(c)}
                        title="Rename"
                        style={{ background: "none", border: `1.5px solid ${BORDER}`, color: MUTED, padding: "5px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                        Rename
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
