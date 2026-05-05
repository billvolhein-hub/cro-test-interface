import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAgencies, createAgency, updateAgency, deleteAgency, fetchPlatformConfig, setPlatformConfig, uploadAgencyLogo } from "../lib/agencies";
import { BG, BORDER, CARD, MUTED, TEXT, ACCENT } from "../lib/constants";
import TechDocsModal from "../components/TechDocsModal";
import SuperAdminKanban from "../components/SuperAdminKanban";
import SuperAdminAnalytics from "../components/SuperAdminAnalytics";

const FIELD = { padding: "9px 12px", borderRadius: 7, border: `1.5px solid ${BORDER}`, fontFamily: "'Inter',sans-serif", fontSize: 13, color: TEXT, outline: "none", background: "#fff", width: "100%", boxSizing: "border-box" };
const BTN   = (bg, color = "#fff") => ({ padding: "8px 18px", borderRadius: 7, border: "none", background: bg, color, fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" });

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function SuperAdminPage({ agencies: initial, onAgenciesChange }) {
  const navigate   = useNavigate();
  const [agencies, setAgencies] = useState(initial ?? []);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [confirm,  setConfirm]  = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  // Platform password management
  const [pwDraft,   setPwDraft]   = useState("");
  const [pwSaving,  setPwSaving]  = useState(false);
  const [pwSaved,   setPwSaved]   = useState(false);
  const [pwVisible, setPwVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDocs,     setShowDocs]     = useState(false);

  useEffect(() => {
    fetchPlatformConfig().then(cfg => {
      if (cfg.super_admin_password) setPwDraft(cfg.super_admin_password);
    }).catch(() => {});
  }, []);

  const savePlatformPassword = async () => {
    if (!pwDraft.trim()) return;
    setPwSaving(true);
    try {
      await setPlatformConfig("super_admin_password", pwDraft.trim());
      localStorage.setItem("me_superadmin_auth", pwDraft.trim());
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 3000);
    } catch (e) {
      alert(e.message);
    } finally {
      setPwSaving(false);
    }
  };

  const defaultForm = { name: "", slug: "", adminPassword: "", websiteUrl: "", bgColor: "#1B3A6B", accentColor: "#C9A84C", textColor: "#ffffff", logoUrl: "" };
  const [form,        setForm]        = useState(defaultForm);
  const [logoFile,    setLogoFile]    = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [extracting,  setExtracting]  = useState(false);
  const logoInputRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => {
    setForm(defaultForm);
    setLogoFile(null);
    setLogoPreview("");
    setEditing(null);
    setShowForm(true);
    setError("");
  };

  const openEdit = (ag) => {
    setForm({
      name:          ag.name,
      slug:          ag.slug,
      adminPassword: ag.adminPassword,
      websiteUrl:    "",
      bgColor:       ag.brand.bgColor     ?? "#1B3A6B",
      accentColor:   ag.brand.accentColor ?? "#C9A84C",
      textColor:     ag.brand.textColor   ?? "#ffffff",
      logoUrl:       ag.brand.logoUrl     ?? "",
    });
    setLogoFile(null);
    setLogoPreview(ag.brand.logoUrl ?? "");
    setEditing(ag.id);
    setShowForm(true);
    setError("");
  };

  const handleLogoFile = (file) => {
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const extractBrandColors = async () => {
    const url = form.websiteUrl.trim();
    if (!url) return;
    setExtracting(true);
    try {
      const ssRes = await fetch(`/api/screenshot?url=${encodeURIComponent(url)}`);
      if (!ssRes.ok) throw new Error("Screenshot failed");
      const { dataUrl } = await ssRes.json();
      if (!dataUrl) throw new Error("No screenshot returned");

      const [header, base64] = dataUrl.split(",");
      const mediaType = header.replace("data:", "").replace(";base64", "");

      const res = await fetch("/api/anthropic/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 256,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: 'Extract the 3 primary brand colors from this website screenshot. Return ONLY valid JSON with no explanation: {"bgColor":"#hex","accentColor":"#hex","textColor":"#hex"}. bgColor = header/nav background color, accentColor = primary CTA button or highlight color, textColor = text color that appears on top of bgColor.' },
            ],
          }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text ?? "";
      const match = text.match(/\{[\s\S]*?\}/);
      if (match) {
        const colors = JSON.parse(match[0]);
        if (colors.bgColor)     set("bgColor",     colors.bgColor);
        if (colors.accentColor) set("accentColor", colors.accentColor);
        if (colors.textColor)   set("textColor",   colors.textColor);
      }
    } catch {
      setError("Could not extract colors — check the URL or set them manually.");
      setTimeout(() => setError(""), 4000);
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.adminPassword.trim()) {
      setError("Name and password are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const brand = {
        bgColor:     form.bgColor,
        accentColor: form.accentColor,
        textColor:   form.textColor,
        logoUrl:     form.logoUrl || "",
      };

      if (editing) {
        // Upload logo first if a new file was chosen
        if (logoFile) {
          brand.logoUrl = await uploadAgencyLogo(editing, logoFile);
        }
        await updateAgency(editing, { name: form.name, slug: form.slug, adminPassword: form.adminPassword, brand });
        setAgencies(prev => prev.map(a => a.id === editing ? { ...a, name: form.name, slug: form.slug, adminPassword: form.adminPassword, brand } : a));
      } else {
        // Create agency first to get an ID, then upload logo
        const created = await createAgency({ name: form.name, slug: form.slug, adminPassword: form.adminPassword, brand });
        if (logoFile) {
          brand.logoUrl = await uploadAgencyLogo(created.id, logoFile);
          await updateAgency(created.id, { brand });
          created.brand = brand;
        }
        setAgencies(prev => [...prev, created]);
      }

      setShowForm(false);
      onAgenciesChange?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteAgency(id);
      setAgencies(prev => prev.filter(a => a.id !== id));
      setConfirm(null);
    } catch (e) {
      alert(e.message);
    }
  };

  const impersonate = (ag) => {
    sessionStorage.setItem("me_superadmin_impersonating", ag.slug);
    localStorage.setItem(`me_agency_auth_${ag.slug}`, ag.adminPassword);
    navigate(`/${ag.slug}`);
  };

  const displayLogo = logoPreview || form.logoUrl;

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "12px 28px", display: "flex", alignItems: "center", gap: 16, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        <img src="/platform-logo.avif" alt="Platform" style={{ height: 36, objectFit: "contain", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase" }}>Platform Admin</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Agency Management</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setShowDocs(true)}
            title="Technical Docs"
            style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 12px", cursor: "pointer", color: MUTED, fontSize: 12, fontWeight: 700, fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
            <span>{"</>"}</span> Docs
          </button>
          <button
            onClick={() => setShowSettings(s => !s)}
            title="Platform Settings"
            style={{ background: showSettings ? "#F1F5F9" : "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 10px", cursor: "pointer", color: MUTED, fontSize: 14 }}>
            ⚙
          </button>
          <button onClick={openCreate} style={{ ...BTN(ACCENT), padding: "8px 16px" }}>+ New Agency</button>
        </div>
      </div>

      {/* Platform Settings panel */}
      {showSettings && (
        <div style={{ background: "#1E293B", borderBottom: "1px solid #334155", padding: "16px 28px", display: "flex", alignItems: "flex-end", gap: 24 }}>
          <div style={{ flex: 1, maxWidth: 360 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>Platform Admin Password</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  type={pwVisible ? "text" : "password"}
                  value={pwDraft}
                  onChange={e => setPwDraft(e.target.value)}
                  placeholder="Set platform password…"
                  style={{ width: "100%", boxSizing: "border-box", padding: "8px 36px 8px 10px", borderRadius: 6, border: "1.5px solid #334155", background: "#0F172A", fontFamily: "'Inter',sans-serif", fontSize: 13, color: "#E2E8F0", outline: "none" }}
                />
                <button onClick={() => setPwVisible(v => !v)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: 11 }}>
                  {pwVisible ? "Hide" : "Show"}
                </button>
              </div>
              <button
                onClick={savePlatformPassword}
                disabled={pwSaving || !pwDraft.trim()}
                style={{ ...BTN(pwSaved ? "#15803D" : ACCENT), padding: "8px 16px", opacity: pwSaving ? 0.7 : 1 }}>
                {pwSaved ? "Saved ✓" : pwSaving ? "…" : "Save"}
              </button>
            </div>
            <div style={{ fontSize: 10, color: "#475569", marginTop: 5 }}>Stored in DB — takes effect on next login</div>
          </div>
        </div>
      )}

      {/* Impersonation banner */}
      {sessionStorage.getItem("me_superadmin_impersonating") && (
        <div style={{ background: "#FEF9C3", borderBottom: "1px solid #FDE68A", padding: "8px 28px", fontSize: 12, color: "#92400E", fontWeight: 600, display: "flex", alignItems: "center", gap: 12 }}>
          <span>⚠ Impersonating: <b>{sessionStorage.getItem("me_superadmin_impersonating")}</b></span>
          <button onClick={() => { sessionStorage.removeItem("me_superadmin_impersonating"); window.location.reload(); }} style={{ ...BTN("#92400E"), padding: "3px 10px", fontSize: 11 }}>Stop Impersonating</button>
        </div>
      )}

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {/* Analytics Dashboard */}
        <div style={{ marginBottom: 28 }}>
          <SuperAdminAnalytics />
        </div>

        {/* Agency list */}
        {agencies.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: MUTED, fontSize: 14 }}>No agencies yet. Create your first one.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {agencies.map(ag => {
              const bg     = ag.brand.bgColor     ?? "#1B3A6B";
              const accent = ag.brand.accentColor ?? "#C9A84C";
              return (
                <div key={ag.id} style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: bg, border: `2px solid ${accent}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {ag.brand.logoUrl
                      ? <img src={ag.brand.logoUrl} alt={ag.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      : <span style={{ fontSize: 16, fontWeight: 900, color: ag.brand.textColor ?? "#fff" }}>{ag.name[0]}</span>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{ag.name}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                      <span style={{ background: "#F1F5F9", padding: "1px 7px", borderRadius: 4, fontWeight: 600 }}>/{ag.slug}</span>
                      <span style={{ marginLeft: 10 }}>Created {new Date(ag.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button onClick={() => impersonate(ag)} style={BTN("#0F172A")} title="View this agency's dashboard">👁 View</button>
                    <button onClick={() => openEdit(ag)} style={BTN("#3B82F6")}>Edit</button>
                    <button onClick={() => setConfirm(ag.id)} style={BTN("#DC2626")}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Projects Kanban */}
        <div style={{ marginTop: 28 }}>
          <SuperAdminKanban />
        </div>

        {/* Create / Edit form */}
        {showForm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24, overflowY: "auto" }}>
            <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 14, padding: "32px 36px", width: "100%", maxWidth: 500, boxShadow: "0 8px 40px rgba(0,0,0,.18)", margin: "auto" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: TEXT, marginBottom: 24 }}>
                {editing ? "Edit Agency" : "New Agency"}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Agency Name */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 5 }}>Agency Name *</label>
                  <input
                    style={FIELD}
                    value={form.name}
                    onChange={e => { set("name", e.target.value); if (!editing) set("slug", slugify(e.target.value)); }}
                    placeholder="Acme Agency"
                  />
                  {form.slug && (
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                      URL: <span style={{ fontWeight: 600, color: TEXT }}>yourdomain.com/{form.slug}</span>
                    </div>
                  )}
                </div>

                {/* Admin Password */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 5 }}>Admin Password *</label>
                  <input style={FIELD} type="text" value={form.adminPassword} onChange={e => set("adminPassword", e.target.value)} placeholder="Set a secure password" />
                </div>

                {/* Website URL → extract brand colors */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 5 }}>Website URL</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      style={{ ...FIELD, flex: 1 }}
                      value={form.websiteUrl}
                      onChange={e => set("websiteUrl", e.target.value)}
                      onKeyDown={e => e.key === "Enter" && extractBrandColors()}
                      placeholder="https://acmeagency.com"
                    />
                    <button
                      onClick={extractBrandColors}
                      disabled={extracting || !form.websiteUrl.trim()}
                      title="Screenshot the site and extract brand colors with AI"
                      style={{ ...BTN(extracting ? MUTED : "#7C3AED"), padding: "8px 14px", flexShrink: 0, opacity: !form.websiteUrl.trim() ? 0.5 : 1, whiteSpace: "nowrap" }}>
                      {extracting ? "Scanning…" : "✨ Extract Colors"}
                    </button>
                  </div>
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>Screenshots your site and uses AI to detect brand colors automatically.</div>
                </div>

                {/* Brand colors */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 8 }}>Brand Colors</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    {[["bgColor", "Header BG"], ["accentColor", "Accent"], ["textColor", "Text"]].map(([k, label]) => (
                      <div key={k} style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>{label}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input type="color" value={form[k]} onChange={e => set(k, e.target.value)} style={{ width: 32, height: 32, border: "none", padding: 0, borderRadius: 6, cursor: "pointer", flexShrink: 0 }} />
                          <input style={{ ...FIELD, fontFamily: "monospace", fontSize: 12 }} value={form[k]} onChange={e => set(k, e.target.value)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Logo upload */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 8 }}>Agency Logo</label>
                  <input ref={logoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleLogoFile(e.target.files[0])} />
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Preview */}
                    <div
                      onClick={() => logoInputRef.current?.click()}
                      style={{ width: 64, height: 64, borderRadius: 10, background: form.bgColor, border: `2px dashed ${displayLogo ? form.accentColor : BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", flexShrink: 0 }}>
                      {displayLogo
                        ? <img src={displayLogo} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        : <span style={{ fontSize: 10, color: MUTED, textAlign: "center", lineHeight: 1.3 }}>Click to<br/>upload</span>
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <button
                        onClick={() => logoInputRef.current?.click()}
                        style={{ ...BTN("#F1F5F9", TEXT), width: "100%", marginBottom: 6 }}>
                        {displayLogo ? "Replace Logo" : "Upload Logo"}
                      </button>
                      {displayLogo && (
                        <button
                          onClick={() => { setLogoFile(null); setLogoPreview(""); set("logoUrl", ""); }}
                          style={{ ...BTN("#FEF2F2", "#DC2626"), width: "100%", fontSize: 11 }}>
                          Remove Logo
                        </button>
                      )}
                      <div style={{ fontSize: 10, color: MUTED, marginTop: 6 }}>PNG, JPG, SVG — stored in cloud storage</div>
                    </div>
                  </div>
                </div>

                {/* Brand preview */}
                <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${BORDER}` }}>
                  <div style={{ background: form.bgColor, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    {displayLogo
                      ? <img src={displayLogo} alt="" style={{ height: 28, objectFit: "contain" }} />
                      : <div style={{ width: 28, height: 28, borderRadius: 6, background: form.accentColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 13, fontWeight: 900, color: form.textColor }}>{form.name[0] ?? "A"}</span>
                        </div>
                    }
                    <span style={{ fontSize: 14, fontWeight: 700, color: form.textColor }}>{form.name || "Agency Name"}</span>
                  </div>
                  <div style={{ background: "#F8FAFC", padding: "6px 14px", fontSize: 10, color: MUTED }}>Brand preview</div>
                </div>

                {error && <div style={{ fontSize: 12, color: "#DC2626", fontWeight: 600 }}>{error}</div>}

                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button onClick={() => setShowForm(false)} style={{ ...BTN("#F1F5F9", TEXT), flex: 1 }}>Cancel</button>
                  <button onClick={handleSave} disabled={saving} style={{ ...BTN(ACCENT), flex: 2, opacity: saving ? 0.7 : 1 }}>
                    {saving ? "Saving…" : editing ? "Save Changes" : "Create Agency"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation */}
        {confirm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
            <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 14, padding: "32px 36px", maxWidth: 400, textAlign: "center" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#DC2626", marginBottom: 10 }}>Delete Agency?</div>
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 24 }}>This is permanent. All clients and tests belonging to this agency will need to be reassigned first.</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirm(null)} style={{ ...BTN("#F1F5F9", TEXT), flex: 1 }}>Cancel</button>
                <button onClick={() => handleDelete(confirm)} style={{ ...BTN("#DC2626"), flex: 1 }}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <TechDocsModal open={showDocs} onClose={() => setShowDocs(false)} />
    </div>
  );
}
