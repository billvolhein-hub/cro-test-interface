import { useNavigate } from "react-router-dom";
import { fmtDate, toSlug } from "../lib/utils";
import { usePortal } from "../context/PortalContext";
import { BORDER, CARD, MUTED, TEXT } from "../lib/constants";

const NOTE_COLOR = "#7C3AED";
const NOTE_BG    = "#F5F3FF";
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

export default function ClientNotesFeed({ tests, clients, clientId, collapsed, onToggle }) {
  const navigate  = useNavigate();
  const { isPortal } = usePortal();
  const notes = collectClientNotes(tests, clientId);

  if (notes.length === 0) return null;

  return (
    <div style={{ background: CARD, border: `1.5px solid ${NOTE_BORDER}`, borderRadius: 10, marginBottom: 24, overflow: "hidden", boxShadow: "0 1px 4px rgba(124,58,237,.08)" }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", cursor: onToggle ? "pointer" : "default", background: NOTE_BG, borderBottom: collapsed ? "none" : `1px solid ${NOTE_BORDER}` }}
      >
        <div style={{ width: 20, height: 20, borderRadius: 6, background: NOTE_COLOR, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2 2h8v7l-4 2-4-2V2z" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round"/>
            <path d="M4 5h4M4 7h2" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: NOTE_COLOR, letterSpacing: 0.5 }}>
          Client Notes
          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: "#9F7AEA", background: "#EDE9FE", borderRadius: 10, padding: "1px 8px" }}>{notes.length}</span>
        </div>
        {onToggle && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform .2s", color: NOTE_COLOR }}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      {/* Feed */}
      {!collapsed && (
        <div style={{ maxHeight: 340, overflowY: "auto" }}>
          {notes.map(({ test, overlay }) => {
            const client = clients?.find(c => c.id === test.clientId);
            const testUrl = isPortal
              ? `/portal/${toSlug(client?.name)}/tests/${toSlug(test.testName)}?template=1`
              : `/tests/${test.id}?template=1`;
            return (
              <div
                key={overlay.id}
                style={{ display: "flex", gap: 12, padding: "12px 18px", borderBottom: `1px solid ${NOTE_BORDER}`, alignItems: "flex-start" }}
              >
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: NOTE_COLOR, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                    <path d="M2 2h8v7l-4 2-4-2V2z" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round"/>
                    <path d="M4 5h4M4 7h2" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.5, marginBottom: 5 }}>{overlay.note}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => navigate(testUrl)}
                      style={{ fontSize: 11, fontWeight: 600, color: NOTE_COLOR, background: "#EDE9FE", border: "none", borderRadius: 5, padding: "2px 8px", cursor: "pointer", fontFamily: "'Inter',sans-serif", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {test.testName || "Untitled Test"}
                    </button>
                    {client && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: NOTE_COLOR, background: "#EDE9FE", borderRadius: 4, padding: "1px 6px" }}>{client.name}</span>
                    )}
                    <span style={{ fontSize: 10, color: MUTED, marginLeft: "auto" }}>{timeAgo(overlay.id)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
