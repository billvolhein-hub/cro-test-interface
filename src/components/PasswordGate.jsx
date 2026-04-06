import { useState } from "react";
import { ACCENT, BG, BORDER, CARD, MUTED, TEXT } from "../lib/constants";

// ── Super Admin Gate ──────────────────────────────────────────────────────────
// Protects the platform-level agency management dashboard.
// Password from VITE_SUPER_ADMIN_PASSWORD env var.

const SUPER_PW  = import.meta.env.VITE_SUPER_ADMIN_PASSWORD ?? "";
const SUPER_KEY = "me_superadmin_auth";

export function SuperAdminGate({ children }) {
  const [authed, setAuthed] = useState(() =>
    !SUPER_PW || localStorage.getItem(SUPER_KEY) === SUPER_PW
  );
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  if (authed) return children;

  const attempt = () => {
    if (input === SUPER_PW) {
      localStorage.setItem(SUPER_KEY, SUPER_PW);
      setAuthed(true);
    } else {
      setError(true);
      setInput("");
    }
  };

  return (
    <GateScreen
      title="Platform Admin"
      subtitle="Enter your super admin password"
      logo={
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20, gap: 6 }}>
          <svg width="52" height="52" viewBox="0 0 36 36" fill="none">
            <rect x="2"  y="10" width="8" height="22" rx="2" fill="#C9A84C"/>
            <rect x="14" y="5"  width="8" height="27" rx="2" fill="#2A8C8C"/>
            <rect x="26" y="1"  width="8" height="31" rx="2" fill="#1B3A6B"/>
          </svg>
          <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, letterSpacing: 2, textTransform: "uppercase" }}>White-Label Platform</div>
        </div>
      }
      input={input} setInput={setInput} error={error} setError={setError} onSubmit={attempt}
    />
  );
}

// ── Agency Gate ───────────────────────────────────────────────────────────────
// Wraps agency admin routes. Password comes from the agency's DB record.
// If the super admin is impersonating this agency, bypasses the gate.

export function AgencyGate({ agency, children }) {
  const pw  = agency?.adminPassword ?? "";
  const key = `me_agency_auth_${agency?.slug}`;

  // Super admin impersonation bypass
  const impersonating = localStorage.getItem("me_superadmin_impersonating") === agency?.slug;

  const [authed, setAuthed] = useState(() =>
    impersonating || !pw || localStorage.getItem(key) === pw
  );
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  if (authed) return children;

  const attempt = () => {
    if (input === pw) {
      localStorage.setItem(key, pw);
      setAuthed(true);
    } else {
      setError(true);
      setInput("");
    }
  };

  const brand = agency?.brand ?? {};
  const bg    = brand.bgColor   ?? "#1B3A6B";
  const text  = brand.textColor ?? "#ffffff";
  const accent = brand.accentColor ?? "#C9A84C";

  return (
    <GateScreen
      title={agency?.name ?? "Agency Login"}
      subtitle="Enter your admin password to continue"
      brandBg={accent}
      brandText="#fff"
      logo={
        brand.logoUrl
          ? <img src={brand.logoUrl} alt={agency?.name} style={{ height: 52, objectFit: "contain", marginBottom: 20 }} />
          : (
            <div style={{ width: 52, height: 52, borderRadius: 14, background: bg, border: "2px solid rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M3 21h18M5 21V7l7-4 7 4v14" stroke={text} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="9" y="13" width="6" height="8" rx="1" stroke={text} strokeWidth="1.6"/>
              </svg>
            </div>
          )
      }
      input={input} setInput={setInput} error={error} setError={setError} onSubmit={attempt}
    />
  );
}

// ── Admin Gate (legacy — kept for portal route compatibility) ─────────────────
const ADMIN_PW  = import.meta.env.VITE_ADMIN_PASSWORD ?? "";
const ADMIN_KEY = "me_admin_auth";

export function AdminGate({ children }) {
  const [authed, setAuthed] = useState(() =>
    !ADMIN_PW || localStorage.getItem(ADMIN_KEY) === ADMIN_PW
  );
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  if (authed) return children;

  const attempt = () => {
    if (input === ADMIN_PW) {
      localStorage.setItem(ADMIN_KEY, ADMIN_PW);
      setAuthed(true);
    } else {
      setError(true);
      setInput("");
    }
  };

  return (
    <GateScreen
      title={<span style={{ color: TEXT }}>MetricsEdge</span>}
      logo={
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20, gap: 6 }}>
          <svg width="52" height="52" viewBox="0 0 36 36" fill="none">
            <rect x="2"  y="10" width="8" height="22" rx="2" fill="#C9A84C"/>
            <rect x="14" y="5"  width="8" height="27" rx="2" fill="#2A8C8C"/>
            <rect x="26" y="1"  width="8" height="31" rx="2" fill="#1B3A6B"/>
          </svg>
          <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, letterSpacing: 2, textTransform: "uppercase" }}>Client Headquarters</div>
        </div>
      }
      subtitle="Enter your admin password to continue"
      input={input} setInput={setInput} error={error} setError={setError} onSubmit={attempt}
    />
  );
}

// ── Portal Gate ───────────────────────────────────────────────────────────────
export function PortalGate({ client, children }) {
  const pw  = client?.portalPassword ?? "";
  const key = `me_portal_auth_${client?.portalToken}`;

  const [authed, setAuthed] = useState(() =>
    !pw || localStorage.getItem(key) === pw
  );
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  if (!pw && !authed) { setAuthed(true); return children; }
  if (authed) return children;

  const attempt = () => {
    if (input === pw) {
      localStorage.setItem(key, pw);
      setAuthed(true);
    } else {
      setError(true);
      setInput("");
    }
  };

  const brand  = client?.brand ?? {};
  const bg     = brand.bgColor   ?? "#1B3A6B";
  const text   = brand.textColor ?? "#ffffff";

  return (
    <GateScreen
      title={client?.name ?? "Client Portal"}
      brandBg={bg} brandText={text}
      logo={
        brand.logoUrl
          ? <img src={brand.logoUrl} alt={client?.name} style={{ height: 48, objectFit: "contain", marginBottom: 20 }} />
          : (
            <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, border: "2px solid rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke={text} strokeWidth="1.8"/>
                <path d="M7 11V7a5 5 0 0110 0v4" stroke={text} strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
          )
      }
      subtitle="This portal is password protected"
      input={input} setInput={setInput} error={error} setError={setError} onSubmit={attempt}
    />
  );
}

// ── Shared gate UI ────────────────────────────────────────────────────────────
function GateScreen({ title, subtitle, logo, input, setInput, error, setError, onSubmit, brandBg, brandText }) {
  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380, background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 16, padding: "40px 36px", boxShadow: "0 4px 24px rgba(0,0,0,.08)", textAlign: "center" }}>
        {logo}
        <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>{title}</div>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 28 }}>{subtitle}</div>
        <input
          type="password"
          value={input}
          onChange={e => { setInput(e.target.value); setError(false); }}
          onKeyDown={e => e.key === "Enter" && onSubmit()}
          placeholder="Password"
          autoFocus
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${error ? "#FECACA" : BORDER}`, background: error ? "#FFF8F8" : "#fff", fontFamily: "'Inter',sans-serif", fontSize: 14, color: TEXT, outline: "none", marginBottom: 8 }}
        />
        {error && <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 10, fontWeight: 600 }}>Incorrect password. Try again.</div>}
        <button
          onClick={onSubmit}
          style={{ width: "100%", padding: "11px 0", borderRadius: 8, border: "none", background: brandBg ?? ACCENT, color: brandText ?? "#fff", fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          Enter
        </button>
      </div>
    </div>
  );
}
