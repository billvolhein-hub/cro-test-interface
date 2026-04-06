import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ACCENT, CARD, BORDER, TEXT, MUTED } from "../lib/constants";
import { useBreakpoint } from "../lib/useBreakpoint";
import { useAgency, useAgencyUpdater } from "../context/AgencyContext";
import { uploadAgencyLogo } from "../lib/agencies";

export default function AppHeader({ right }) {
  const navigate      = useNavigate();
  const { isMobile }  = useBreakpoint();
  const agency        = useAgency();
  const onUpdateAgency = useAgencyUpdater();
  const [showBrand, setShowBrand] = useState(false);

  const brand  = agency?.brand ?? {};
  const bg     = brand.bgColor    ?? null;
  const accent = brand.accentColor ?? ACCENT;
  const color  = brand.textColor  ?? TEXT;
  const homePath = agency ? `/${agency.slug}` : "/";

  if (agency && bg) {
    // Agency-branded header
    return (
      <>
        <div style={{ borderBottom: "1px solid rgba(255,255,255,.12)", padding: isMobile ? "10px 16px" : "12px 28px", display: "flex", alignItems: "center", gap: isMobile ? 10 : 16, background: bg, boxShadow: "0 1px 6px rgba(0,0,0,.18)" }}>
          <div onClick={() => navigate(homePath)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1, minWidth: 0 }}>
            {brand.logoUrl
              ? <img src={brand.logoUrl} alt={agency.name} style={{ maxHeight: isMobile ? 28 : 36, maxWidth: isMobile ? 100 : 160, objectFit: "contain", flexShrink: 0 }} />
              : (
                <div style={{ width: isMobile ? 28 : 36, height: isMobile ? 28 : 36, borderRadius: 8, background: accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: isMobile ? 13 : 16, fontWeight: 900, color }}>{agency.name[0]}</span>
                </div>
              )
            }
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {agency.name}
              </div>
              {!isMobile && (
                <div style={{ fontSize: 10, fontWeight: 600, color: `${color}99`, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 1 }}>
                  Client Headquarters
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", flexShrink: 0 }}>
            {onUpdateAgency && (
              <button
                onClick={() => setShowBrand(true)}
                title="Brand Settings"
                style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 6, padding: "5px 8px", cursor: "pointer", color, fontSize: 14, display: "flex", alignItems: "center", lineHeight: 1 }}
              >
                ⚙
              </button>
            )}
            {right}
          </div>
        </div>
        {showBrand && (
          <BrandSettingsModal
            agency={agency}
            onUpdateAgency={onUpdateAgency}
            onClose={() => setShowBrand(false)}
          />
        )}
      </>
    );
  }

  // Default MetricsEdge header (no agency context)
  return (
    <div style={{ borderBottom: `1px solid ${BORDER}`, padding: isMobile ? "10px 16px" : "14px 28px", display: "flex", alignItems: "center", gap: isMobile ? 10 : 16, background: CARD, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
      <div onClick={() => navigate(homePath)} style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 16, cursor: "pointer" }}>
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
              Client Headquarters
            </div>
          )}
        </div>
      </div>
      {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
    </div>
  );
}

// ── Brand Settings Modal ──────────────────────────────────────────────────────

function BrandSettingsModal({ agency, onUpdateAgency, onClose }) {
  const brand = agency?.brand ?? {};
  const [form, setForm] = useState({
    name:        agency.name ?? "",
    logoUrl:     brand.logoUrl     ?? "",
    bgColor:     brand.bgColor     ?? "#1B3A6B",
    accentColor: brand.accentColor ?? "#2A8C8C",
    textColor:   brand.textColor   ?? "#FFFFFF",
  });
  const [saving,     setSaving]     = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [uploadErr,  setUploadErr]  = useState(null);
  const [dragOver,   setDragOver]   = useState(false);
  const fileInputRef = useRef(null);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    setUploadErr(null);
    try {
      const url = await uploadAgencyLogo(agency.id, file);
      set("logoUrl", url);
    } catch (e) {
      setUploadErr(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    await onUpdateAgency({
      name: form.name.trim(),
      brand: {
        ...brand,
        logoUrl:     form.logoUrl || null,
        bgColor:     form.bgColor,
        accentColor: form.accentColor,
        textColor:   form.textColor,
      },
    });
    setSaving(false);
    onClose();
  };

  const previewBg     = form.bgColor;
  const previewAccent = form.accentColor;
  const previewText   = form.textColor;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 480, boxShadow: "0 8px 32px rgba(0,0,0,.22)", fontFamily: "'Inter',sans-serif", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B" }}>Brand Settings</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94A3B8", lineHeight: 1 }}>✕</button>
        </div>

        {/* Live preview */}
        <div style={{ padding: "12px 24px 0" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Preview</div>
          <div style={{ borderRadius: 8, background: previewBg, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 1px 4px rgba(0,0,0,.12)" }}>
            {form.logoUrl
              ? <img src={form.logoUrl} alt="" style={{ maxHeight: 32, maxWidth: 120, objectFit: "contain" }} onError={e => { e.target.style.display = "none"; }} />
              : (
                <div style={{ width: 32, height: 32, borderRadius: 6, background: previewAccent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 900, color: previewText }}>{(form.name || "A")[0]}</span>
                </div>
              )
            }
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: previewText, lineHeight: 1.1 }}>{form.name || "Agency Name"}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: `${previewText}99`, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 1 }}>Client Headquarters</div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: "16px 24px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Agency Name">
            <input value={form.name} onChange={e => set("name", e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Logo">
            {/* Upload drop zone */}
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              style={{
                border: `2px dashed ${dragOver ? ACCENT : "#CBD5E1"}`,
                borderRadius: 8, padding: "14px 16px", background: dragOver ? "#EFF6FF" : "#F8FAFC",
                cursor: uploading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 12,
                transition: "border-color .15s, background .15s",
              }}
            >
              {form.logoUrl
                ? <img src={form.logoUrl} alt="" style={{ height: 36, maxWidth: 100, objectFit: "contain", borderRadius: 4, flexShrink: 0 }} />
                : <div style={{ width: 36, height: 36, borderRadius: 6, background: "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>🖼</div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
                  {uploading ? "Uploading…" : "Click or drag to upload"}
                </div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>PNG, JPG, SVG, WebP</div>
                {uploadErr && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 2 }}>{uploadErr}</div>}
              </div>
              {form.logoUrl && !uploading && (
                <button
                  onClick={e => { e.stopPropagation(); set("logoUrl", ""); }}
                  style={{ background: "#FEE2E2", border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 11, color: "#DC2626", fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
                >
                  Remove
                </button>
              )}
            </div>
            <input
              ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => handleFile(e.target.files[0])}
            />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <ColorField label="Header BG"    value={form.bgColor}     onChange={v => set("bgColor", v)} />
            <ColorField label="Accent"       value={form.accentColor} onChange={v => set("accentColor", v)} />
            <ColorField label="Text"         value={form.textColor}   onChange={v => set("textColor", v)} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "0 24px 20px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 7, border: "1px solid #E2E8F0", background: "#fff", color: "#475569", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving || uploading} style={{ padding: "8px 22px", borderRadius: 7, border: "none", background: ACCENT, color: "#fff", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, cursor: (saving || uploading) ? "not-allowed" : "pointer", opacity: (saving || uploading) ? 0.7 : 1 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5 }}>
        {label}{hint && <span style={{ fontWeight: 400, color: "#94A3B8", marginLeft: 6 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 5 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 8px", background: "#F8FAFC" }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ width: 24, height: 24, border: "none", padding: 0, background: "none", cursor: "pointer", borderRadius: 3 }} />
        <input value={value} onChange={e => onChange(e.target.value)} style={{ border: "none", background: "none", fontSize: 12, color: "#334155", fontFamily: "monospace", width: 0, flex: 1, outline: "none" }} />
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", border: "1px solid #E2E8F0", borderRadius: 6, padding: "7px 10px", fontSize: 13, color: "#334155", fontFamily: "'Inter',sans-serif", outline: "none", background: "#F8FAFC", boxSizing: "border-box" };

// ─────────────────────────────────────────────────────────────────────────────

export function PortalHeader({ client, right }) {
  const { isMobile } = useBreakpoint();
  const brand = client?.brand ?? {};
  const bg    = brand.bgColor || "#1B3A6B";
  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,.1)", padding: isMobile ? "10px 16px" : "12px 28px", display: "flex", alignItems: "center", gap: isMobile ? 10 : 16, background: bg, boxShadow: "0 1px 6px rgba(0,0,0,.18)" }}>
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
      </div>
    </div>
  );
}
