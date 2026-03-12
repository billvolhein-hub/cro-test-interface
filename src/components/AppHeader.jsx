import { useNavigate } from "react-router-dom";
import { ACCENT, CARD, BORDER, TEXT, MUTED } from "../lib/constants";
import { useBreakpoint } from "../lib/useBreakpoint";

export default function AppHeader({ right }) {
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  return (
    <div style={{ borderBottom: `1px solid ${BORDER}`, padding: isMobile ? "10px 16px" : "14px 28px", display: "flex", alignItems: "center", gap: isMobile ? 10 : 16, background: CARD, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
      <div onClick={() => navigate("/")} style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 16, cursor: "pointer" }}>
        <svg width={isMobile ? 28 : 36} height={isMobile ? 28 : 36} viewBox="0 0 36 36" fill="none">
          <rect x="2"  y="10" width="8" height="22" rx="2" fill="#C9A84C"/>
          <rect x="14" y="5"  width="8" height="27" rx="2" fill="#2A8C8C"/>
          <rect x="26" y="1"  width="8" height="31" rx="2" fill="#1B3A6B"/>
        </svg>
        <div>
          <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, color: TEXT, lineHeight: 1.1 }}>
            <span style={{ fontWeight: 400 }}>Metrics</span>
            <span style={{ color: ACCENT }}>Edge</span>
          </div>
          {!isMobile && (
            <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 1 }}>
              Test Builder
            </div>
          )}
        </div>
      </div>
      {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
    </div>
  );
}

export function PortalHeader({ client, right }) {
  const { isMobile } = useBreakpoint();
  const brand = client?.brand ?? {};
  const bg = brand.bgColor || "#1B3A6B";
  return (
    <div style={{ borderBottom: `1px solid rgba(255,255,255,.1)`, padding: isMobile ? "10px 16px" : "12px 28px", display: "flex", alignItems: "center", gap: isMobile ? 10 : 16, background: bg, boxShadow: "0 1px 6px rgba(0,0,0,.18)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
        {brand.logoUrl && (
          <img src={brand.logoUrl} alt={client.name} style={{ maxHeight: isMobile ? 28 : 36, maxWidth: isMobile ? 100 : 140, objectFit: "contain", flexShrink: 0 }} />
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 700, color: brand.textColor || "#fff", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client?.name}</div>
          {brand.tagline && !isMobile && <div style={{ fontSize: 10, color: `${brand.textColor || "#fff"}99`, marginTop: 2, letterSpacing: 0.5 }}>{brand.tagline}</div>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {right}
        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.45 }}>
            <svg width="18" height="18" viewBox="0 0 36 36" fill="none">
              <rect x="2"  y="10" width="8" height="22" rx="2" fill="#C9A84C"/>
              <rect x="14" y="5"  width="8" height="27" rx="2" fill="#2A8C8C"/>
              <rect x="26" y="1"  width="8" height="31" rx="2" fill="#fff"/>
            </svg>
            <span style={{ fontSize: 10, fontWeight: 600, color: brand.textColor || "#fff", letterSpacing: 1, textTransform: "uppercase" }}>MetricsEdge</span>
          </div>
        )}
      </div>
    </div>
  );
}
