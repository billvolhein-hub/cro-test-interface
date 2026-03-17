import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppHeader, { PortalHeader } from "../components/AppHeader";
import { usePortal } from "../context/PortalContext";
import { pieScore, scoreColor, scoreBg, scoreBorder, fmtDate, toSlug } from "../lib/utils";
import { TEST_STATUSES, PIE_CRITERIA, DEFAULT_STATUS, ACCENT, TEAL, GOLD, BG, CARD, BORDER, TEXT, MUTED, DIM } from "../lib/constants";
import ClientNotesFeed from "../components/ClientNotesFeed";
import CrawlReport from "../components/CrawlReport";
import { useBreakpoint } from "../lib/useBreakpoint";

const PIPELINE = [
  { label: "Backlog",  statuses: ["Backlog"],                          color: "#1B3A6B", bg: "#EEF2FF", border: "#C7D2FE" },
  { label: "In Work",  statuses: ["Under Review", "Promoted to Test"], color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  { label: "Live",     statuses: ["Test Running"],                     color: "#0E7490", bg: "#ECFEFF", border: "#A5F3FC" },
  { label: "Complete", statuses: ["Test Complete"],                    color: "#15803D", bg: "#F0FDF4", border: "#BBF7D0" },
];

const DEFAULT_BRAND = {
  bgColor:    "#1B3A6B",
  accentColor:"#C9A84C",
  textColor:  "#ffffff",
  bgImageUrl: "",
  logoUrl:    "",
  tagline:    "",
};

function mergeBrand(saved) {
  return { ...DEFAULT_BRAND, ...(saved || {}) };
}

export default function ClientPage({ clients, tests, onUpdateTest, onUpdateClientBrand }) {
  const { id, clientSlug } = useParams();
  const navigate = useNavigate();
  const { isPortal } = usePortal();
  const { isMobile } = useBreakpoint();
  const client = isPortal
    ? clients.find(c => toSlug(c.name) === clientSlug)
    : clients.find(c => c.id === Number(id));
  const clientId = client?.id;

  const brand = mergeBrand(client?.brand);

  const [editing, setEditing]   = useState(false);
  const [draft,   setDraft]     = useState(brand);
  const [saving,  setSaving]    = useState(false);
  const [saveErr, setSaveErr]   = useState(null);
  const logoRef  = useRef(null);
  const bgImgRef = useRef(null);

  if (!client) { navigate("/"); return null; }

  const clientTests = tests
    .filter(t => (t.clientId ?? clients[0]?.id) === clientId)
    .sort((a, b) => Number(pieScore(b)) - Number(pieScore(a)));

  const scored = clientTests.filter(t => t.potential || t.importance || t.ease);
  const avgPie = scored.length
    ? (scored.reduce((s, t) => s + Number(pieScore(t)), 0) / scored.length).toFixed(1)
    : null;
  const highPieCount = clientTests.filter(t => Number(pieScore(t)) >= 6).length;

  const pipelineGroups = PIPELINE.map(p => ({
    ...p,
    tests: clientTests.filter(t => p.statuses.includes(t.status || DEFAULT_STATUS)),
  }));

  const openEdit = () => { setDraft(mergeBrand(client.brand)); setEditing(true); };
  const cancelEdit = () => setEditing(false);

  const saveBrand = async () => {
    setSaving(true);
    setSaveErr(null);
    try { await onUpdateClientBrand(clientId, draft); setEditing(false); }
    catch (e) { console.error(e); setSaveErr(e?.message || JSON.stringify(e)); }
    finally { setSaving(false); }
  };

  const resetBrand = async () => {
    setSaving(true);
    try { await onUpdateClientBrand(clientId, {}); setDraft(DEFAULT_BRAND); setEditing(false); }
    catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const readFile = (file, key) => {
    if (!file) return;
    const isLogo = key === "logoUrl";
    const maxW = isLogo ? 400 : 1200;
    const maxH = isLogo ? 200 : 600;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      const ratio = Math.min(maxW / width, maxH / height, 1);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      // Use PNG for logos (preserves transparency), JPEG for background images
      const dataUrl = isLogo
        ? canvas.toDataURL("image/png")
        : canvas.toDataURL("image/jpeg", 0.82);
      setDraft(d => ({ ...d, [key]: dataUrl }));
    };
    img.src = url;
  };

  // Use live draft when editing, saved brand otherwise
  const activeBrand = editing ? draft : brand;

  const heroStyle = {
    borderRadius: 14,
    padding: "32px 36px",
    marginBottom: editing ? 0 : 28,
    position: "relative",
    overflow: "hidden",
    background: activeBrand.bgImageUrl
      ? `url(${activeBrand.bgImageUrl}) center/cover no-repeat`
      : activeBrand.bgColor,
    borderBottomLeftRadius: editing ? 0 : 14,
    borderBottomRightRadius: editing ? 0 : 14,
  };

  // Overlay to ensure text is readable over images
  const needsScrim = !!activeBrand.bgImageUrl;

  const renderTestCard = (t) => {
    const s = Number(pieScore(t));
    const st = TEST_STATUSES.find(x => x.value === (t.status || DEFAULT_STATUS)) || TEST_STATUSES[0];
    const isHighPie = s >= 6.0;
    return (
      <div
        key={t.id}
        onClick={() => navigate(isPortal ? `/portal/${toSlug(client.name)}/tests/${toSlug(t.testName)}` : `/tests/${t.id}`)}
        style={{
          background: isHighPie ? "linear-gradient(135deg,#fff 80%,#FFFBEB 100%)" : CARD,
          border: `1.5px solid ${isHighPie ? "#F59E0B" : BORDER}`,
          borderRadius: 10,
          padding: 20,
          cursor: "pointer",
          boxShadow: "0 1px 4px rgba(0,0,0,.06)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          transition: "box-shadow .15s, transform .12s",
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 18px rgba(27,58,107,.12)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.06)"; e.currentTarget.style.transform = "none"; }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, border: `1.5px solid ${st.border}`, borderRadius: 20, padding: "3px 10px" }}>
            {t.status || DEFAULT_STATUS}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {isHighPie && <span style={{ color: "#F59E0B", fontSize: 13 }}>★</span>}
            <div style={{ background: scoreBg(s), border: `1.5px solid ${scoreBorder(s)}`, borderRadius: 6, padding: "3px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: scoreColor(s), lineHeight: 1 }}>{pieScore(t)}</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: scoreColor(s), letterSpacing: 0.5 }}>PIE</div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 15, fontWeight: 800, color: TEXT, lineHeight: 1.3 }}>
          {t.testName || <span style={{ color: DIM, fontWeight: 400 }}>Untitled Test</span>}
        </div>

        {t.if && (
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            <span style={{ fontWeight: 700, color: "#1B3A6B" }}>If </span>{t.if}
          </div>
        )}
        {t.then && (
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            <span style={{ fontWeight: 700, color: TEAL }}>Then </span>{t.then}
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {t.testType      && <span style={{ fontSize: 11, fontWeight: 600, color: ACCENT, background: "#F0F4FA", border: "1px solid #C0CFEA", borderRadius: 4, padding: "2px 7px" }}>{t.testType}</span>}
          {t.audience      && <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, background: BG, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2px 7px" }}>{t.audience}</span>}
          {t.primaryMetric && <span style={{ fontSize: 11, fontWeight: 600, color: TEAL, background: "#F0FAFA", border: "1px solid #A8D8D8", borderRadius: 4, padding: "2px 7px" }}>{t.primaryMetric}</span>}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${BORDER}`, marginTop: "auto" }}>
          <div style={{ display: "flex", gap: 10 }}>
            {PIE_CRITERIA.map(c => (
              <span key={c.key} style={{ fontSize: 11, fontWeight: 700, color: c.color }}>{c.label[0]}{t[c.key]}</span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: DIM }}>{fmtDate(t.updatedAt || t.createdAt)}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>View →</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter',sans-serif", color: TEXT }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .brand-input{width:100%;background:#0D1520;border:1.5px solid #2E3F5C;border-radius:6px;padding:8px 11px;font-family:'Inter',sans-serif;font-size:13px;color:#C8D8EE;outline:none;}
        .brand-input:focus{border-color:#4A7AAA;}
        .brand-label{font-size:10px;font-weight:700;color:#5A7AAA;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:5px;}
        .color-swatch{width:36px;height:36px;border-radius:6px;border:2px solid #2E3F5C;cursor:pointer;padding:0;overflow:hidden;flex-shrink:0;}
        .color-swatch input[type=color]{width:48px;height:48px;border:none;cursor:pointer;margin:-6px 0 0 -6px;padding:0;}
        .upload-btn{background:#1A2540;border:1.5px dashed #2E3F5C;color:#5A7AAA;padding:7px 14px;border-radius:6px;font-family:'Inter',sans-serif;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;}
        .upload-btn:hover{border-color:#4A7AAA;color:#8BA4C8;}
      `}</style>

      {isPortal ? <PortalHeader client={client} /> : <AppHeader />}

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "20px 16px" : "36px 28px" }}>

        {/* ── Hero ── */}
        <div style={heroStyle}>
          {needsScrim && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)", borderRadius: "inherit" }} />
          )}
          <div style={{ position: "relative", zIndex: 1 }}>
            {/* Pencil edit button — hidden in portal mode */}
            {!isPortal && (
            <button
              onClick={editing ? cancelEdit : openEdit}
              title={editing ? "Cancel" : "Edit brand"}
              style={{ position: "absolute", top: 0, right: 0, width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.28)", color: activeBrand.textColor, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)", padding: 0, flexShrink: 0 }}
            >
              {editing ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 11L11 1M1 1l10 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 4l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              )}
            </button>
            )}

            {/* Top row: text left, logo right */}
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "flex-start", justifyContent: "space-between", marginBottom: 16, paddingRight: isMobile ? 36 : 44, gap: isMobile ? 12 : 0 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: `${activeBrand.textColor}99`, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Client Portfolio</div>
                <div style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, color: activeBrand.textColor, lineHeight: 1.1 }}>{client.name}</div>
                {activeBrand.tagline && (
                  <div style={{ fontSize: 13, color: `${activeBrand.textColor}CC`, fontWeight: 500, marginTop: 6 }}>{activeBrand.tagline}</div>
                )}
              </div>
              {activeBrand.logoUrl && (
                <img src={activeBrand.logoUrl} alt="Logo" style={{ maxHeight: isMobile ? 40 : 56, maxWidth: isMobile ? 140 : 200, objectFit: "contain", flexShrink: 0, marginLeft: isMobile ? 0 : 24, marginTop: 2 }} />
              )}
            </div>

            {/* Stats */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <div style={{ background: "rgba(255,255,255,.12)", borderRadius: 8, padding: "10px 18px", textAlign: "center", backdropFilter: "blur(4px)" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: activeBrand.textColor, lineHeight: 1 }}>{clientTests.length}</div>
                <div style={{ fontSize: 10, color: `${activeBrand.textColor}99`, fontWeight: 600, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.8 }}>Total Tests</div>
              </div>
              {highPieCount > 0 && (
                <div style={{ background: "rgba(255,255,255,.12)", borderRadius: 8, padding: "10px 18px", textAlign: "center", backdropFilter: "blur(4px)" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: activeBrand.accentColor, lineHeight: 1 }}>{highPieCount}</div>
                  <div style={{ fontSize: 10, color: `${activeBrand.textColor}99`, fontWeight: 600, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.8 }}>High PIE (≥6)</div>
                </div>
              )}
              {avgPie && (
                <div style={{ background: scoreBg(Number(avgPie)), border: `1.5px solid ${scoreBorder(Number(avgPie))}`, borderRadius: 8, padding: "10px 18px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor(Number(avgPie)), lineHeight: 1 }}>{avgPie}</div>
                  <div style={{ fontSize: 10, color: scoreColor(Number(avgPie)), fontWeight: 600, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.8 }}>Avg PIE</div>
                </div>
              )}

              {/* Decorative accent bars (use activeBrand accent) */}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 3, alignSelf: "center" }}>
                <div style={{ width: 6, height: 40, borderRadius: 3, background: activeBrand.accentColor, opacity: 0.6 }} />
                <div style={{ width: 4, height: 52, borderRadius: 3, background: activeBrand.textColor, opacity: 0.2 }} />
                <div style={{ width: 6, height: 32, borderRadius: 3, background: activeBrand.accentColor, opacity: 0.35 }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Brand Editor Panel ── */}
        {editing && (
          <div style={{ background: "#111B2E", border: "1.5px solid #2E3F5C", borderTop: "none", borderRadius: "0 0 14px 14px", padding: isMobile ? "16px 16px" : "24px 28px", marginBottom: 28 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#5A7AAA", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 20 }}>Brand Settings</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 20, marginBottom: 20 }}>

              {/* BG Color */}
              <div>
                <div className="brand-label">Background Color</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="color-swatch" style={{ background: draft.bgColor }}>
                    <input type="color" value={draft.bgColor} onChange={e => setDraft(d => ({ ...d, bgColor: e.target.value }))} />
                  </div>
                  <input className="brand-input" value={draft.bgColor} onChange={e => setDraft(d => ({ ...d, bgColor: e.target.value }))} placeholder="#1B3A6B" style={{ flex: 1 }} />
                </div>
              </div>

              {/* Accent Color */}
              <div>
                <div className="brand-label">Accent Color</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="color-swatch" style={{ background: draft.accentColor }}>
                    <input type="color" value={draft.accentColor} onChange={e => setDraft(d => ({ ...d, accentColor: e.target.value }))} />
                  </div>
                  <input className="brand-input" value={draft.accentColor} onChange={e => setDraft(d => ({ ...d, accentColor: e.target.value }))} placeholder="#C9A84C" style={{ flex: 1 }} />
                </div>
              </div>

              {/* Text Color */}
              <div>
                <div className="brand-label">Text Color</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="color-swatch" style={{ background: draft.textColor }}>
                    <input type="color" value={draft.textColor} onChange={e => setDraft(d => ({ ...d, textColor: e.target.value }))} />
                  </div>
                  <input className="brand-input" value={draft.textColor} onChange={e => setDraft(d => ({ ...d, textColor: e.target.value }))} placeholder="#ffffff" style={{ flex: 1 }} />
                </div>
              </div>

              {/* Tagline */}
              <div>
                <div className="brand-label">Tagline</div>
                <input className="brand-input" value={draft.tagline} onChange={e => setDraft(d => ({ ...d, tagline: e.target.value }))} placeholder="Driving results through testing" />
              </div>

            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>

              {/* Background Image */}
              <div>
                <div className="brand-label">Background Image</div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <input className="brand-input" value={draft.bgImageUrl} onChange={e => setDraft(d => ({ ...d, bgImageUrl: e.target.value }))} placeholder="https://… or upload →" style={{ flex: 1 }} />
                  <button className="upload-btn" onClick={() => bgImgRef.current?.click()}>Upload</button>
                  <input ref={bgImgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => readFile(e.target.files[0], "bgImageUrl")} />
                  {draft.bgImageUrl && (
                    <button onClick={() => setDraft(d => ({ ...d, bgImageUrl: "" }))} style={{ background: "none", border: "1px solid #3A2020", color: "#DC2626", padding: "7px 10px", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 11, cursor: "pointer" }}>✕</button>
                  )}
                </div>
                {draft.bgImageUrl && (
                  <div style={{ marginTop: 8, height: 48, borderRadius: 6, background: `url(${draft.bgImageUrl}) center/cover`, border: "1px solid #2E3F5C" }} />
                )}
              </div>

              {/* Logo */}
              <div>
                <div className="brand-label">Logo</div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <input className="brand-input" value={draft.logoUrl} onChange={e => setDraft(d => ({ ...d, logoUrl: e.target.value }))} placeholder="https://… or upload →" style={{ flex: 1 }} />
                  <button className="upload-btn" onClick={() => logoRef.current?.click()}>Upload</button>
                  <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => readFile(e.target.files[0], "logoUrl")} />
                  {draft.logoUrl && (
                    <button onClick={() => setDraft(d => ({ ...d, logoUrl: "" }))} style={{ background: "none", border: "1px solid #3A2020", color: "#DC2626", padding: "7px 10px", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 11, cursor: "pointer" }}>✕</button>
                  )}
                </div>
                {draft.logoUrl && (
                  <div style={{ marginTop: 8, height: 48, borderRadius: 6, background: "#1A2540", border: "1px solid #2E3F5C", display: "flex", alignItems: "center", padding: "0 12px" }}>
                    <img src={draft.logoUrl} alt="Logo preview" style={{ maxHeight: 36, maxWidth: 160, objectFit: "contain" }} />
                  </div>
                )}
              </div>

            </div>

            {saveErr && (
              <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8, background: "#1a0000", border: "1px solid #7f1d1d", borderRadius: 6, padding: "8px 12px" }}>
                Save error: {saveErr}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={saveBrand} disabled={saving}
                style={{ background: ACCENT, color: "#fff", border: "none", padding: "10px 24px", borderRadius: 7, fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : "Save Brand"}
              </button>
              <button onClick={cancelEdit}
                style={{ background: "none", border: "1px solid #2E3F5C", color: "#5A7AAA", padding: "10px 18px", borderRadius: 7, fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={resetBrand} disabled={saving}
                style={{ marginLeft: "auto", background: "none", border: "1px solid #3A2020", color: "#DC2626", padding: "10px 18px", borderRadius: 7, fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Reset to Default
              </button>
            </div>
          </div>
        )}

        {/* ── Share portal link (admin only) ── */}
        {!isPortal && (
          <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 3 }}>Client Portal Link</div>
              <div style={{ fontSize: 12, color: MUTED, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {`${window.location.origin}/portal/${toSlug(client.name)}`}
              </div>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/portal/${toSlug(client.name)}`); }}
              style={{ flexShrink: 0, background: ACCENT, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Copy Link
            </button>
          </div>
        )}

        {/* ── Pipeline overview ── */}
        <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: "18px 22px", marginBottom: 28, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Test Pipeline</div>
          <div style={{ display: "flex", alignItems: "center" }}>
            {pipelineGroups.map((p, i) => (
              <div key={p.label} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <div style={{ flex: 1, background: p.bg, border: `1.5px solid ${p.border}`, borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: p.color, lineHeight: 1 }}>{p.tests.length}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: p.color, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 3 }}>{p.label}</div>
                </div>
                {i < pipelineGroups.length - 1 && (
                  <div style={{ fontSize: 16, color: DIM, flexShrink: 0, padding: "0 6px" }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Crawl Report ── */}
        <CrawlReport clientId={clientId} />

        {/* ── Tests grouped by stage ── */}
        {/* Client Notes feed */}
        <ClientNotesFeed
          tests={clientTests}
          clients={[client]}
          clientId={clientId}
          onUpdateTest={onUpdateTest}
        />

        {/* Tests grouped by stage — display order: Live, In Work, Backlog, Complete */}
        {clientTests.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: MUTED }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No tests yet for {client.name}</div>
            <div style={{ fontSize: 14 }}>Head back to the home page to create one.</div>
          </div>
        ) : (
          [...pipelineGroups]
            .sort((a, b) => {
              const order = ["Live", "In Work", "Backlog", "Complete"];
              return order.indexOf(a.label) - order.indexOf(b.label);
            })
            .filter(p => p.tests.length > 0)
            .map(p => (
              <div key={p.label} style={{ marginBottom: 36 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: p.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 800, color: p.color, letterSpacing: 1.2, textTransform: "uppercase" }}>{p.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: p.color, background: p.bg, border: `1px solid ${p.border}`, borderRadius: 10, padding: "1px 8px" }}>{p.tests.length}</span>
                  <div style={{ flex: 1, height: 1, background: p.border }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
                  {p.tests.map(renderTestCard)}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
