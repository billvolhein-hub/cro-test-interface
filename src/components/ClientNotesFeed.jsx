import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { fmtDate, toSlug } from "../lib/utils";
import { usePortal } from "../context/PortalContext";
import { BORDER, CARD, MUTED, TEXT, ACCENT, TEAL } from "../lib/constants";

const NOTE_COLOR  = "#7C3AED";
const NOTE_BG     = "#F5F3FF";
const NOTE_BORDER = "#DDD6FE";

export function collectClientNotes(tests, clientId) {
  const notes = [];
  const pool = clientId != null ? tests.filter(t => t.clientId === clientId) : tests;
  for (const test of pool) {
    for (const [variant, overlays] of Object.entries(test.overlays ?? {})) {
      for (const overlay of overlays ?? []) {
        if (overlay.isClientNote && overlay.note) {
          notes.push({ test, variant, overlay, ts: overlay.id });
        }
      }
    }
  }
  return notes.sort((a, b) => b.ts - a.ts);
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7)  return `${d}d ago`;
  return fmtDate(ts);
}

export default function ClientNotesFeed({ tests, clients, clientId, collapsed, onToggle, onUpdateTest }) {
  const navigate  = useNavigate();
  const { isPortal } = usePortal();
  const [showResolved, setShowResolved] = useState(false);

  const allNotes      = collectClientNotes(tests, clientId);
  const unresolved    = allNotes.filter(n => !n.overlay.resolved);
  const resolved      = allNotes.filter(n =>  n.overlay.resolved);
  const visibleNotes  = showResolved ? allNotes : unresolved;

  if (allNotes.length === 0) return null;

  const resolveNote = (test, overlayId, isResolved) => {
    if (!onUpdateTest) return;
    const updated = {};
    for (const [variant, overlays] of Object.entries(test.overlays ?? {})) {
      updated[variant] = (overlays ?? []).map(o =>
        o.id === overlayId ? { ...o, resolved: isResolved } : o
      );
    }
    onUpdateTest(test.id, "overlays", updated);
  };

  return (
    <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 10, marginBottom: 24, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", cursor: onToggle ? "pointer" : "default", background: NOTE_BG, borderBottom: collapsed ? "none" : `1px solid ${BORDER}` }}
      >
        <div style={{ width: 20, height: 20, borderRadius: 6, background: NOTE_COLOR, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2 2h8v7l-4 2-4-2V2z" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round"/>
            <path d="M4 5h4M4 7h2" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: NOTE_COLOR, letterSpacing: 0.5 }}>
          Client Notes
          {unresolved.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: "#fff", background: NOTE_COLOR, borderRadius: 10, padding: "1px 8px" }}>{unresolved.length}</span>
          )}
          {resolved.length > 0 && unresolved.length === 0 && (
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: NOTE_COLOR, background: "#EDE9FE", borderRadius: 10, padding: "1px 8px" }}>All resolved</span>
          )}
        </div>
        {onToggle && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform .2s", color: MUTED }}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      {/* Feed */}
      {!collapsed && (
        <>
          {visibleNotes.length === 0 ? (
            <div style={{ padding: "18px", textAlign: "center", color: MUTED, fontSize: 13 }}>
              All notes resolved.
            </div>
          ) : (
            <div style={{ maxHeight: 340, overflowY: "auto" }}>
              {visibleNotes.map(({ test, overlay }) => {
                const client = clients?.find(c => c.id === test.clientId);
                const testUrl = isPortal
                  ? `/portal/${client?.portalToken}/tests/${toSlug(test.testName)}?template=1`
                  : `/tests/${test.id}?template=1`;
                const isResolved = !!overlay.resolved;
                return (
                  <div
                    key={overlay.id}
                    style={{ display: "flex", gap: 12, padding: "12px 18px", borderBottom: `1px solid ${BORDER}`, alignItems: "flex-start", opacity: isResolved ? 0.55 : 1 }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: isResolved ? "#9CA3AF" : ACCENT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      {isResolved ? (
                        <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                          <path d="M2 2h8v7l-4 2-4-2V2z" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round"/>
                          <path d="M4 5h4M4 7h2" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.5, marginBottom: 5, textDecoration: isResolved ? "line-through" : "none", color: isResolved ? MUTED : TEXT }}>{overlay.note}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <button
                          onClick={() => navigate(testUrl)}
                          style={{ fontSize: 11, fontWeight: 600, color: ACCENT, background: "#EEF2FF", border: "none", borderRadius: 5, padding: "2px 8px", cursor: "pointer", fontFamily: "'Inter',sans-serif", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {test.testName || "Untitled Test"}
                        </button>
                        {client && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: TEAL, borderRadius: 4, padding: "1px 7px" }}>{client.name}</span>
                        )}
                        <span style={{ fontSize: 10, color: MUTED }}>{timeAgo(overlay.id)}</span>
                        {onUpdateTest && (
                          <button
                            onClick={() => resolveNote(test, overlay.id, !isResolved)}
                            style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, color: isResolved ? NOTE_COLOR : "#16A34A", background: isResolved ? "#EDE9FE" : "#F0FDF4", border: `1px solid ${isResolved ? NOTE_BORDER : "#BBF7D0"}`, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}
                          >
                            {isResolved ? "↩ Unresolve" : "✓ Resolve"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Resolved toggle */}
          {resolved.length > 0 && (
            <div style={{ padding: "8px 18px", borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "center" }}>
              <button
                onClick={() => setShowResolved(v => !v)}
                style={{ fontSize: 11, fontWeight: 600, color: MUTED, background: "none", border: "none", cursor: "pointer", fontFamily: "'Inter',sans-serif", padding: "2px 0" }}
              >
                {showResolved ? `Hide resolved (${resolved.length})` : `Show resolved (${resolved.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
