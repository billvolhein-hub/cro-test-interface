import { useState, useRef, useEffect } from "react";
import { BG, CARD, BORDER, TEXT, MUTED, DIM, ACCENT, TEAL, GOLD } from "../lib/constants";

const COLUMNS = [
  { id: "backlog",     label: "Backlog",     color: "#1B3A6B", bg: "#EEF2FF", border: "#C7D2FE" },
  { id: "in-progress", label: "In Progress", color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  { id: "review",      label: "Review",      color: "#6D28D9", bg: "#F5F3FF", border: "#DDD6FE" },
  { id: "done",        label: "Done",        color: "#15803D", bg: "#F0FDF4", border: "#BBF7D0" },
];

const PRIORITIES = ["High", "Medium", "Low"];
const LABELS = ["Feature", "Bug", "Design", "Content", "Infra", "Research"];

const PRIORITY = {
  High:   { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", dot: "#DC2626" },
  Medium: { color: "#B45309", bg: "#FFFBEB", border: "#FDE68A", dot: "#F59E0B" },
  Low:    { color: "#6B7280", bg: "#F3F4F6", border: "#E5E7EB", dot: "#9CA3AF" },
};

const LABEL_STYLE = {
  Feature:  { color: "#1B3A6B", bg: "#EEF2FF",  border: "#C7D2FE" },
  Bug:      { color: "#DC2626", bg: "#FEF2F2",  border: "#FECACA" },
  Design:   { color: "#6D28D9", bg: "#F5F3FF",  border: "#DDD6FE" },
  Content:  { color: "#0E7490", bg: "#ECFEFF",  border: "#A5F3FC" },
  Infra:    { color: "#B45309", bg: "#FFFBEB",  border: "#FDE68A" },
  Research: { color: "#15803D", bg: "#F0FDF4",  border: "#BBF7D0" },
};

const DB_KEY = "super_admin_kanban";

async function dbFetch(payload) {
  const res = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function CardEditModal({ card, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    title:       card.title,
    description: card.description ?? "",
    priority:    card.priority    ?? "Medium",
    label:       card.label       ?? "",
    columnId:    card.columnId,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(15,25,35,.55)", backdropFilter: "blur(3px)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: CARD, borderRadius: 12, width: "100%", maxWidth: 480, boxShadow: "0 16px 48px rgba(0,0,0,.24)", fontFamily: "'Inter',sans-serif" }}>

        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>Edit Card</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: DIM, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Title */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>Title *</div>
            <input
              value={form.title}
              onChange={e => set("title", e.target.value)}
              autoFocus
              style={{ width: "100%", padding: "9px 10px", border: `1.5px solid ${BORDER}`, borderRadius: 7, fontFamily: "'Inter',sans-serif", fontSize: 13, color: TEXT, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {/* Description */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>Description</div>
            <textarea
              value={form.description}
              onChange={e => set("description", e.target.value)}
              rows={3}
              placeholder="Optional notes, context, or acceptance criteria…"
              style={{ width: "100%", padding: "9px 10px", border: `1.5px solid ${BORDER}`, borderRadius: 7, fontFamily: "'Inter',sans-serif", fontSize: 13, color: TEXT, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.55 }}
            />
          </div>

          {/* Column + Priority */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>Column</div>
              <select
                value={form.columnId}
                onChange={e => set("columnId", e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: `1.5px solid ${BORDER}`, borderRadius: 7, fontFamily: "'Inter',sans-serif", fontSize: 13, color: TEXT, outline: "none", background: "#fff" }}>
                {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>Priority</div>
              <select
                value={form.priority}
                onChange={e => set("priority", e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: `1.5px solid ${BORDER}`, borderRadius: 7, fontFamily: "'Inter',sans-serif", fontSize: 13, color: PRIORITY[form.priority]?.color ?? TEXT, outline: "none", background: PRIORITY[form.priority]?.bg ?? "#fff" }}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Label */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Label</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button
                onClick={() => set("label", "")}
                style={{ padding: "3px 10px", borderRadius: 5, border: `1.5px solid ${form.label === "" ? ACCENT : BORDER}`, background: form.label === "" ? "#EEF2FF" : "#fff", color: form.label === "" ? ACCENT : MUTED, fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                None
              </button>
              {LABELS.map(l => {
                const s = LABEL_STYLE[l] ?? {};
                const active = form.label === l;
                return (
                  <button key={l} onClick={() => set("label", l)}
                    style={{ padding: "3px 10px", borderRadius: 5, border: `1.5px solid ${active ? s.border : BORDER}`, background: active ? s.bg : "#fff", color: active ? s.color : MUTED, fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    {l}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
            <button
              onClick={() => onDelete(card.id)}
              style={{ padding: "8px 14px", borderRadius: 7, border: "none", background: "#FEF2F2", color: "#DC2626", fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Delete
            </button>
            <div style={{ flex: 1 }} />
            <button onClick={onClose}
              style={{ padding: "8px 16px", borderRadius: 7, border: `1.5px solid ${BORDER}`, background: "none", color: MUTED, fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Cancel
            </button>
            <button
              onClick={() => form.title.trim() && onSave({ ...card, ...form, title: form.title.trim() })}
              disabled={!form.title.trim()}
              style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: form.title.trim() ? ACCENT : DIM, color: "#fff", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, cursor: form.title.trim() ? "pointer" : "not-allowed" }}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({ col, cards, isDragOver, onDragOver, onDragLeave, onDrop, onDragStart, onAddCard, onEditCard, addingToThis, addTitle, setAddTitle, onQuickAdd, onCancelAdd }) {
  const addRef = useRef(null);

  useEffect(() => {
    if (addingToThis) setTimeout(() => addRef.current?.focus(), 50);
  }, [addingToThis]);

  return (
    <div
      onDragOver={e => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={e => { e.preventDefault(); onDrop(); }}
      style={{ flex: "1 1 0", minWidth: 200, display: "flex", flexDirection: "column", background: isDragOver ? col.bg : "#F8FAFC", border: `1.5px solid ${isDragOver ? col.border : BORDER}`, borderRadius: 10, transition: "border-color .15s, background .15s", overflow: "hidden" }}>

      {/* Column header */}
      <div style={{ padding: "12px 14px 10px", borderBottom: `1px solid ${BORDER}`, background: isDragOver ? col.bg : CARD }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
          <div style={{ fontSize: 12, fontWeight: 700, color: col.color, flex: 1, textTransform: "uppercase", letterSpacing: 0.8 }}>{col.label}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: col.color, background: col.bg, border: `1px solid ${col.border}`, borderRadius: 10, padding: "1px 7px", minWidth: 20, textAlign: "center" }}>{cards.length}</div>
        </div>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, padding: "10px 10px 6px", display: "flex", flexDirection: "column", gap: 7, overflowY: "auto", minHeight: 80 }}>
        {cards.map(card => {
          const p = PRIORITY[card.priority] ?? PRIORITY.Medium;
          const l = card.label ? (LABEL_STYLE[card.label] ?? {}) : null;
          return (
            <div
              key={card.id}
              draggable
              role="button"
              tabIndex={0}
              onDragStart={e => onDragStart(e, card.id)}
              onClick={() => onEditCard(card)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEditCard(card); } }}
              style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderLeft: `3px solid ${p.dot}`, borderRadius: 8, padding: "10px 12px", cursor: "grab", transition: "box-shadow .12s, border-color .12s", userSelect: "none" }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,.1)"; e.currentTarget.style.borderColor = p.dot; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.borderLeftColor = p.dot; }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, lineHeight: 1.4, marginBottom: card.description || card.label || card.priority ? 7 : 0 }}>
                {card.title}
              </div>
              {card.description && (
                <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.45, marginBottom: 7, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {card.description}
                </div>
              )}
              {(card.label || card.priority) && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {card.priority && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: p.color, background: p.bg, border: `1px solid ${p.border}`, borderRadius: 3, padding: "1px 5px" }}>
                      {card.priority}
                    </span>
                  )}
                  {card.label && l && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: l.color, background: l.bg, border: `1px solid ${l.border}`, borderRadius: 3, padding: "1px 5px" }}>
                      {card.label}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Quick-add input */}
        {addingToThis && (
          <div style={{ background: CARD, border: `1.5px solid ${ACCENT}`, borderRadius: 8, padding: 8 }}>
            <textarea
              ref={addRef}
              value={addTitle}
              onChange={e => setAddTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onQuickAdd(); }
                if (e.key === "Escape") onCancelAdd();
              }}
              placeholder="Card title…"
              rows={2}
              style={{ width: "100%", border: "none", outline: "none", fontFamily: "'Inter',sans-serif", fontSize: 13, color: TEXT, resize: "none", background: "transparent", lineHeight: 1.45, boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button onClick={onQuickAdd}
                style={{ padding: "4px 12px", borderRadius: 5, border: "none", background: ACCENT, color: "#fff", fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Add
              </button>
              <button onClick={onCancelAdd}
                style={{ padding: "4px 10px", borderRadius: 5, border: `1px solid ${BORDER}`, background: "none", color: MUTED, fontFamily: "'Inter',sans-serif", fontSize: 11, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer: add button */}
      <div style={{ padding: "6px 10px 10px" }}>
        <button
          onClick={onAddCard}
          style={{ width: "100%", padding: "7px 0", borderRadius: 7, border: `1.5px dashed ${BORDER}`, background: "none", color: MUTED, fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "border-color .15s, color .15s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = col.color; e.currentTarget.style.color = col.color; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = MUTED; }}>
          + Add card
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SuperAdminKanban() {
  const [cards,     setCards]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [open,      setOpen]      = useState(true);
  const [dragOver,  setDragOver]  = useState(null);
  const [addingTo,  setAddingTo]  = useState(null);
  const [addTitle,  setAddTitle]  = useState("");
  const [editCard,  setEditCard]  = useState(null);
  const [confirmClearDone, setConfirmClearDone] = useState(false);
  const draggingId = useRef(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const data = await dbFetch({
        table: "platform_config",
        action: "select",
        filters: { key: DB_KEY },
      });
      const row = Array.isArray(data) ? data[0] : null;
      if (row?.value) setCards(JSON.parse(row.value));
    } catch {}
    setLoading(false);
  };

  const persist = (nextCards) => {
    dbFetch({
      table: "platform_config",
      action: "upsert",
      data: { key: DB_KEY, value: JSON.stringify(nextCards) },
      onConflict: "key",
    }).catch(() => {});
  };

  const update = (nextCards) => {
    setCards(nextCards);
    persist(nextCards);
  };

  // Drag handlers
  const onDragStart = (e, cardId) => {
    draggingId.current = cardId;
    e.dataTransfer.effectAllowed = "move";
  };

  const onDrop = (colId) => {
    if (!draggingId.current) return;
    update(cards.map(c => c.id === draggingId.current ? { ...c, columnId: colId, updatedAt: Date.now() } : c));
    draggingId.current = null;
    setDragOver(null);
  };

  // Quick add
  const quickAdd = (colId) => {
    if (!addTitle.trim()) { setAddingTo(null); setAddTitle(""); return; }
    const card = {
      id:          crypto.randomUUID(),
      columnId:    colId,
      title:       addTitle.trim(),
      description: "",
      priority:    "Medium",
      label:       "",
      createdAt:   Date.now(),
      updatedAt:   Date.now(),
    };
    update([...cards, card]);
    setAddTitle("");
    setAddingTo(null);
  };

  // Edit / delete
  const saveEdit = (updated) => {
    update(cards.map(c => c.id === updated.id ? { ...updated, updatedAt: Date.now() } : c));
    setEditCard(null);
  };

  const deleteCard = (id) => {
    update(cards.filter(c => c.id !== id));
    setEditCard(null);
  };

  const clearDone = () => {
    update(cards.filter(c => c.columnId !== "done"));
    setConfirmClearDone(false);
  };

  const doneCount = cards.filter(c => c.columnId === "done").length;
  const totalCount = cards.length;

  return (
    <>
      <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.05)", overflow: "hidden" }}>

        {/* Section header */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpen(v => !v)}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(v => !v); } }}
          style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", borderBottom: open ? `1px solid ${BORDER}` : "none" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>🗂 Projects</div>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
          <div style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>{totalCount} card{totalCount !== 1 ? "s" : ""}</div>
          {doneCount > 0 && open && (
            <button
              onClick={e => { e.stopPropagation(); setConfirmClearDone(true); }}
              style={{ padding: "3px 10px", borderRadius: 5, border: `1px solid ${BORDER}`, background: "none", color: "#15803D", fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              Clear done ({doneCount})
            </button>
          )}
          <div style={{ fontSize: 12, color: MUTED, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", lineHeight: 1 }}>▾</div>
        </div>

        {open && (
          <div style={{ padding: 16 }}>
            {loading ? (
              <div style={{ padding: "32px 0", textAlign: "center", fontSize: 13, color: MUTED }}>Loading…</div>
            ) : (
              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
                {COLUMNS.map(col => (
                  <KanbanColumn
                    key={col.id}
                    col={col}
                    cards={cards.filter(c => c.columnId === col.id)}
                    isDragOver={dragOver === col.id}
                    onDragOver={() => setDragOver(col.id)}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={() => onDrop(col.id)}
                    onDragStart={onDragStart}
                    onAddCard={() => { setAddingTo(col.id); setAddTitle(""); }}
                    onEditCard={setEditCard}
                    addingToThis={addingTo === col.id}
                    addTitle={addTitle}
                    setAddTitle={setAddTitle}
                    onQuickAdd={() => quickAdd(col.id)}
                    onCancelAdd={() => { setAddingTo(null); setAddTitle(""); }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editCard && (
        <CardEditModal
          card={editCard}
          onSave={saveEdit}
          onDelete={deleteCard}
          onClose={() => setEditCard(null)}
        />
      )}

      {/* Clear done confirmation */}
      {confirmClearDone && (
        <div onClick={() => setConfirmClearDone(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,25,35,.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: CARD, borderRadius: 12, padding: "28px 32px", maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "0 12px 40px rgba(0,0,0,.2)", fontFamily: "'Inter',sans-serif" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: TEXT, marginBottom: 8 }}>Clear {doneCount} done card{doneCount !== 1 ? "s" : ""}?</div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 22 }}>This permanently removes all cards in the Done column. This cannot be undone.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmClearDone(false)}
                style={{ flex: 1, padding: "9px 0", borderRadius: 7, border: `1.5px solid ${BORDER}`, background: "none", color: MUTED, fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={clearDone}
                style={{ flex: 1, padding: "9px 0", borderRadius: 7, border: "none", background: "#15803D", color: "#fff", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Clear Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
