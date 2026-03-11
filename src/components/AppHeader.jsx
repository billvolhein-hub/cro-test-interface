import { ACCENT, CARD, BORDER, TEXT, MUTED } from "../lib/constants";

export default function AppHeader({ right }) {
  return (
    <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "14px 28px", display: "flex", alignItems: "center", gap: 16, background: CARD, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect x="2"  y="10" width="8" height="22" rx="2" fill="#C9A84C"/>
        <rect x="14" y="5"  width="8" height="27" rx="2" fill="#2A8C8C"/>
        <rect x="26" y="1"  width="8" height="31" rx="2" fill="#1B3A6B"/>
      </svg>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, lineHeight: 1.1 }}>
          <span style={{ fontWeight: 400 }}>Metrics</span>
          <span style={{ color: ACCENT }}>Edge</span>
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 1 }}>
          Test Builder
        </div>
      </div>
      {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
    </div>
  );
}
