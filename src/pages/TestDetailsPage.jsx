import { useState, useEffect, useRef, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppHeader, { PortalHeader } from "../components/AppHeader";
import { usePortal } from "../context/PortalContext";
import ScreenshotZone from "../components/ScreenshotZone";
import FindingsEditor from "../components/FindingsEditor";
import TestResults from "../components/TestResults";
import { generateSVG, computeSVGZones } from "../lib/svg";

function zoneForOverlay(overlay, test) {
  if (!test) return null;
  const { W, totalH, zones } = computeSVGZones(test);
  const px = overlay.relX * W;
  const py = overlay.relY * totalH;
  return zones.find(z => px >= z.x && px <= z.x + z.w && py >= z.y && py <= z.y + z.h) ?? null;
}
import { pieScore, scoreColor, scoreBg, scoreBorder, scoreLabel, fmtDate, makePdfFromSvg, generateHypothesis, generateFindings, toSlug } from "../lib/utils";
import { PIE_CRITERIA, TEST_STATUSES, DEFAULT_STATUS, SCREENSHOT_ZONES, OVERLAY_TYPES, ACCENT, TEAL, GOLD, BG, CARD, BORDER, TEXT, MUTED, DIM, IF_COLOR, THEN_COLOR, BECAUSE_COLOR } from "../lib/constants";
import { loadScreenshots } from "../db";

export default function TestDetailsPage({ tests, screenshotsMap, setScreenshotsMap, onUpdateTest, onDeleteTest, onSaveScreenshot, onClearScreenshot, clients }) {
  const params = useParams();
  const navigate = useNavigate();
  const { isPortal } = usePortal();
  const test = isPortal
    ? tests.find(t => toSlug(t.testName) === params.testSlug)
    : tests.find(t => t.id === Number(params.id));
  const id = test?.id;

  const [svgPreviewOpen, setSvgPreviewOpen] = useState(false);
  const [svgPreviewZoom, setSvgPreviewZoom] = useState("fit");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [svgContent, setSvgContent] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [overlaysByVariant, setOverlaysByVariant] = useState(() => test?.overlays ?? {});
  const [activeVariant, setActiveVariant] = useState("B");
  const [editingOverlayId, setEditingOverlayId] = useState(null);
  const [editingNote, setEditingNote] = useState("");
  const [dragOverZone, setDragOverZone] = useState(null);
  const lastDropTime = useRef(0);
  const [clientNoteInput, setClientNoteInput] = useState("");
  const [findingsEditing, setFindingsEditing] = useState(false);
  const [findingsAiLoading, setFindingsAiLoading] = useState(false);
  const [findingsAiError, setFindingsAiError] = useState("");

  // Inline hypothesis builder state
  const [hypoEdit, setHypoEdit] = useState(false);
  const [draft, setDraft] = useState({ if: "", then: "", because: "" });
  const [aiStatement, setAiStatement] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const screenshots = screenshotsMap[Number(id)] || {};

  const VARIANT_LETTERS = ["B","C","D","E","F","G","H"];
  const VARIANT_COLORS_MAP = { B:"#C9A84C", C:"#2A8C8C", D:"#6D28D9", E:"#E74C3C", F:"#2ECC71", G:"#F39C12", H:"#E91E63" };
  const variants = test?.variants ?? ["B"];
  // Deduplicate by id — guards against StrictMode double-mount creating duplicates
  const dedupeOverlays = (arr) => [...new Map((arr ?? []).map(o => [o.id, o])).values()];
  const activeOverlays = dedupeOverlays(overlaysByVariant[activeVariant]);

  function variantScreenshotKeys(label) {
    return label === "B"
      ? { desktop: "variantDesktop", mobile: "variantMobile" }
      : { desktop: `variant${label}Desktop`, mobile: `variant${label}Mobile` };
  }

  const rebuildSvg = (byVariant) =>
    setSvgContent(generateSVG(test, screenshotsMap[test?.id] || {}, byVariant));

  const updateActiveOverlays = (updater) => {
    const current = dedupeOverlays(overlaysByVariant[activeVariant]);
    const next = dedupeOverlays(typeof updater === "function" ? updater(current) : updater);
    const updated = { ...overlaysByVariant, [activeVariant]: next };
    setOverlaysByVariant(updated);
    rebuildSvg(updated);
    onUpdateTest(test.id, "overlays", updated);
  };

  // Load screenshots from IDB on mount
  useEffect(() => {
    if (!id || screenshotsMap[Number(id)]) return;
    loadScreenshots(Number(id)).then((shots) => {
      if (shots && Object.keys(shots).length > 0) {
        setScreenshotsMap(prev => ({ ...prev, [Number(id)]: shots }));
      }
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render SVG preview when screenshots or overlays change
  useEffect(() => {
    if (svgPreviewOpen && test) {
      setSvgContent(generateSVG(test, screenshotsMap[test.id] || {}, overlaysByVariant));
    }
  }, [screenshotsMap, overlaysByVariant]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll while preview modal is open
  useEffect(() => {
    document.body.style.overflow = svgPreviewOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [svgPreviewOpen]);

  if (!test) { navigate("/"); return null; }

  const score = Number(pieScore(test));

  const openHypoBuilder = () => {
    setDraft({ if: test.if || "", then: test.then || "", because: test.because || "" });
    setAiStatement("");
    setAiError("");
    setHypoEdit(true);
  };
  const cancelHypo = () => { setHypoEdit(false); setDraft({ if: "", then: "", because: "" }); setAiStatement(""); setAiError(""); };

  const handleAiGenerate = async () => {
    if (!aiStatement.trim()) return;
    setAiLoading(true);
    setAiError("");
    try {
      const result = await generateHypothesis(aiStatement.trim(), {
        testName: test.testName,
        pageUrl: test.pageUrl,
        testType: test.testType,
        audience: test.audience,
      });
      setDraft(result);
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  };
  const handleAiFindings = async () => {
    if (!test.results) return;
    setFindingsAiLoading(true);
    setFindingsAiError("");
    try {
      const html = await generateFindings(test.results, { testName: test.testName, pageUrl: test.pageUrl });
      await onUpdateTest(Number(id), "findings", html);
      setFindingsEditing(false);
    } catch (e) {
      setFindingsAiError(e.message);
    } finally {
      setFindingsAiLoading(false);
    }
  };

  const saveHypo = () => {
    const testId = Number(id);
    if (draft.if      !== test.if)      onUpdateTest(testId, "if",      draft.if);
    if (draft.then    !== test.then)    onUpdateTest(testId, "then",    draft.then);
    if (draft.because !== test.because) onUpdateTest(testId, "because", draft.because);
    setHypoEdit(false);
  };

  const addVariant = () => {
    const next = VARIANT_LETTERS[variants.length];
    if (!next) return;
    const newVariants = [...variants, next];
    onUpdateTest(test.id, "variants", newVariants);
  };

  const removeVariant = (label) => {
    if (variants.length <= 1) return;
    const newVariants = variants.filter(v => v !== label);
    onUpdateTest(test.id, "variants", newVariants);
    setOverlaysByVariant(prev => { const n = { ...prev }; delete n[label]; rebuildSvg(n); onUpdateTest(test.id, "overlays", n); return n; });
    if (activeVariant === label) setActiveVariant(newVariants[newVariants.length - 1]);
  };

  const svgForDisplay = (zoom) => {
    // Strip XML declaration (invalid in inline HTML) and set width for zoom mode
    let s = svgContent.replace(/^<\?xml[^?]*\?>\s*/i, "");
    if (zoom === "fit") {
      s = s
        .replace(/(<svg\b[^>]*)\bwidth="[^"]*"/, '$1width="100%"')
        .replace(/(<svg\b[^>]*)\bheight="[^"]*"/, "$1");
    }
    return s;
  };

  const openPreview = () => {
    setSvgContent(generateSVG(test, screenshotsMap[test.id] || {}, overlaysByVariant));
    setSvgPreviewZoom("fit");
    setSvgPreviewOpen(true);
  };

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      await makePdfFromSvg(
        generateSVG(test, screenshotsMap[test.id] || {}, overlaysByVariant),
        `${test.testName || "test-hypothesis"}.pdf`
      );
    } catch (e) { console.error(e); }
    finally { setPdfLoading(false); }
  };

  const handleDownloadSVG = () => {
    const svg = generateSVG(test, screenshotsMap[test.id] || {}, overlaysByVariant);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${test.testName || "test-hypothesis"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter',sans-serif", color: TEXT }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .srow{display:flex;gap:12px;padding:8px 0;border-bottom:1px solid ${BORDER};font-size:13px;}
        .act-btn{border:none;border-radius:6px;padding:11px 18px;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;justify-content:center;width:100%;margin-bottom:8px;}
        @keyframes spin{to{transform:rotate(360deg);}}
        .findings-view h2{font-size:17px;font-weight:800;margin:14px 0 6px;color:#0F1923;}
        .findings-view h3{font-size:15px;font-weight:700;margin:12px 0 4px;color:#0F1923;}
        .findings-view ul,.findings-view ol{padding-left:22px;margin:6px 0;}
        .findings-view li{margin:3px 0;}
        .findings-view p{margin:4px 0;}
        .findings-view strong{font-weight:700;}
        .findings-view em{font-style:italic;}
        .findings-view u{text-decoration:underline;}
      `}</style>

      {(() => {
        const client = clients?.find(c => c.id === test.clientId);
        if (isPortal) {
          return <PortalHeader client={client} right={
            client && (
              <button onClick={() => navigate(`/portal/${toSlug(client.name)}`)}
                style={{ background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)", color: client?.brand?.textColor || "#fff", padding: "6px 14px", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer", backdropFilter: "blur(4px)" }}>
                ← Portfolio
              </button>
            )
          } />;
        }
        return <AppHeader right={
          client ? (
            <button onClick={() => navigate(`/clients/${client.id}`)}
              style={{ background: "none", border: `1.5px solid ${BORDER}`, color: MUTED, padding: "7px 14px", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              ← {client.name}
            </button>
          ) : null
        } />;
      })()}

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 28px" }}>
        {/* Page title row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8, gap: 16 }}>
          <div
            onClick={() => !isPortal && navigate(`/tests/${id}/edit`)}
            title={isPortal ? undefined : "Edit definition"}
            style={{ cursor: isPortal ? "default" : "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: TEXT, lineHeight: 1.2 }}>
                {test.testName || <span style={{ color: DIM, fontWeight: 400 }}>Untitled Test</span>}
              </h1>
              {!isPortal && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: MUTED, flexShrink: 0, marginTop: 2 }}>
                <path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              </svg>
              )}
            </div>
            {test.pageUrl && (
              <div style={{ fontSize: 13, color: TEAL, fontWeight: 500, marginTop: 4 }}>{test.pageUrl}</div>
            )}
          </div>
          <div style={{ flexShrink: 0, background: scoreBg(score), border: `2px solid ${scoreBorder(score)}`, borderRadius: 10, padding: "10px 18px", textAlign: "center", minWidth: 90 }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: scoreColor(score), lineHeight: 1 }}>{pieScore(test)}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: scoreColor(score), letterSpacing: 1, textTransform: "uppercase", marginTop: 2 }}>{scoreLabel(score)}</div>
            <div style={{ fontSize: 10, color: MUTED, marginTop: 1 }}>PIE Score</div>
          </div>
        </div>

        {/* Meta tags */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32, alignItems: "center" }}>
          {(() => {
            const st = TEST_STATUSES.find(s => s.value === (test.status || DEFAULT_STATUS)) || TEST_STATUSES[0];
            return <span style={{ fontSize: 12, fontWeight: 700, color: st.color, background: st.bg, border: `1.5px solid ${st.border}`, borderRadius: 20, padding: "4px 12px" }}>{test.status || DEFAULT_STATUS}</span>;
          })()}
          {(() => {
            const name = clients?.find(c => c.id === test.clientId)?.name;
            return name ? <span style={{ fontSize: 12, fontWeight: 600, color: "#6D28D9", background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 5, padding: "4px 10px" }}>{name}</span> : null;
          })()}
          {test.testType && <span style={{ fontSize: 12, fontWeight: 600, color: ACCENT, background: "#F0F4FA", border: `1px solid #C0CFEA`, borderRadius: 5, padding: "4px 10px" }}>{test.testType}</span>}
          {test.audience && <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 5, padding: "4px 10px" }}>{test.audience}</span>}
          {test.primaryMetric && <span style={{ fontSize: 12, fontWeight: 600, color: TEAL, background: "#F0FAFA", border: `1px solid #A8D8D8`, borderRadius: 5, padding: "4px 10px" }}>{test.primaryMetric}</span>}
          <span style={{ fontSize: 12, color: DIM, fontWeight: 500, padding: "4px 0" }}>Updated {fmtDate(test.updatedAt)}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
          {/* Left column */}
          <div>
            {/* Findings — top of column when Test Complete */}
            {(test.status === "Test Complete") && (
              <div style={{ background: CARD, border: `1.5px solid #BBF7D0`, borderRadius: 10, padding: 24, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#15803D", letterSpacing: 1.5, textTransform: "uppercase", flex: 1 }}>Test Findings</div>
                  {test.results && !findingsEditing && (
                    <button
                      onClick={handleAiFindings}
                      disabled={findingsAiLoading}
                      style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#fff", background: findingsAiLoading ? "#6B7280" : ACCENT, border: "none", borderRadius: 5, padding: "4px 10px", cursor: findingsAiLoading ? "wait" : "pointer", fontFamily: "'Inter',sans-serif", opacity: findingsAiLoading ? 0.8 : 1 }}>
                      {findingsAiLoading ? (
                        <><svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 1s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,.4)" strokeWidth="2"/><path d="M14 8a6 6 0 00-6-6" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>Generating…</>
                      ) : <>✦ AI Populate</>}
                    </button>
                  )}
                  {!isPortal && (findingsEditing ? (
                    <button onClick={() => setFindingsEditing(false)} style={{ fontSize: 11, fontWeight: 700, color: "#15803D", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 5, padding: "3px 10px", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Done</button>
                  ) : (
                    <button onClick={() => setFindingsEditing(true)} style={{ fontSize: 11, fontWeight: 700, color: "#15803D", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 5, padding: "3px 10px", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>✎ Edit</button>
                  ))}
                </div>
                {findingsAiError && (
                  <div style={{ marginBottom: 12, fontSize: 12, color: "#DC2626", background: "#FFF8F8", border: "1px solid #FECACA", borderRadius: 6, padding: "8px 12px" }}>{findingsAiError}</div>
                )}
                {findingsEditing ? (
                  <FindingsEditor value={test.findings || ""} onChange={(html) => onUpdateTest(Number(id), "findings", html)} />
                ) : (
                  <div className="findings-view" dangerouslySetInnerHTML={{ __html: test.findings || "<p style='color:#9CA3AF;font-style:italic'>No findings written yet. Click Edit to add, or use AI Populate if results are uploaded.</p>" }} style={{ fontSize: 14, color: TEXT, lineHeight: 1.8, fontFamily: "'Inter',sans-serif" }} />
                )}
              </div>
            )}

            {/* Results — top of column when Test Complete */}
            {(test.status === "Test Complete") && (
              <div style={{ background: CARD, border: `1.5px solid #BBF7D0`, borderRadius: 10, padding: 24, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#15803D", letterSpacing: 1.5, textTransform: "uppercase", flex: 1 }}>Test Results</div>
                  {test.results && (
                    <span style={{ fontSize: 11, color: "#15803D", fontWeight: 500, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 5, padding: "2px 9px" }}>
                      {test.results.goals?.length} goals · {test.results.variantOrder?.length} variants
                    </span>
                  )}
                </div>
                <TestResults results={test.results ?? null} onImport={(parsed) => onUpdateTest(Number(id), "results", parsed)} onClear={() => onUpdateTest(Number(id), "results", null)} />
              </div>
            )}

            {/* Client Notes */}
            {(() => {
              const notes = test.clientNotes ?? [];
              const addNote = () => {
                const trimmed = clientNoteInput.trim();
                if (!trimmed) return;
                const updated = [...notes, { id: Date.now(), note: trimmed }];
                onUpdateTest(Number(id), "clientNotes", updated);
                setClientNoteInput("");
              };
              return (
                <div style={{ background: CARD, border: "1.5px solid #DDD6FE", borderRadius: 10, padding: 24, marginBottom: 20, boxShadow: "0 1px 4px rgba(124,58,237,.08)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Client Notes</div>
                  {notes.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      {notes.map(n => (
                        <div key={n.id} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                              <path d="M2 2h8v7l-4 2-4-2V2z" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round"/>
                              <path d="M4 5h4M4 7h2" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
                            </svg>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.6 }}>{n.note}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                              <span style={{ fontSize: 10, color: MUTED }}>{fmtDate(n.id)}</span>
                              {!isPortal && (
                                <button
                                  onClick={() => onUpdateTest(Number(id), "clientNotes", notes.filter(x => x.id !== n.id))}
                                  style={{ fontSize: 10, color: "#DC2626", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'Inter',sans-serif" }}
                                >Remove</button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <textarea
                      value={clientNoteInput}
                      onChange={e => setClientNoteInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addNote(); } }}
                      placeholder="Leave a note…"
                      rows={2}
                      style={{ flex: 1, border: `1.5px solid #DDD6FE`, borderRadius: 6, padding: "8px 10px", fontFamily: "'Inter',sans-serif", fontSize: 13, color: TEXT, resize: "none", outline: "none", lineHeight: 1.5 }}
                    />
                    <button
                      onClick={addNote}
                      style={{ alignSelf: "flex-end", background: "#7C3AED", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >Post</button>
                  </div>
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 6 }}>Enter to post · Shift+Enter for new line</div>
                </div>
              );
            })()}

            {/* Hypothesis */}
            {(() => {
              const incomplete = !test.if || !test.then || !test.because;
              const BLOCKS = [
                { key: "if",      color: IF_COLOR,      label: "IF — The Change",         ph: "we remove the PDF download element from the hero section…" },
                { key: "then",    color: THEN_COLOR,    label: "THEN — Expected Outcome",  ph: "form submission rate will increase among new users…" },
                { key: "because", color: BECAUSE_COLOR, label: "BECAUSE — The Rationale",  ph: "the PDF acts as a conversion escape hatch…" },
              ];
              return (
                <div style={{ background: CARD, border: `1.5px solid ${incomplete && !hypoEdit ? "#FDE68A" : BORDER}`, borderRadius: 10, padding: 24, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", flex: 1 }}>Hypothesis</div>
                    {!hypoEdit && !isPortal && (
                      <button onClick={openHypoBuilder}
                        style={{ background: incomplete ? "#D97706" : BG, color: incomplete ? "#fff" : MUTED, border: incomplete ? "none" : `1.5px solid ${BORDER}`, padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
                        {incomplete ? (
                          <><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 3v5M8 11v1" stroke="white" strokeWidth="2" strokeLinecap="round"/><circle cx="8" cy="8" r="7" stroke="white" strokeWidth="1.5"/></svg>Build Hypothesis</>
                        ) : (
                          <><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 12.5L5.5 9 9 12.5 14 4" stroke={MUTED} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>Edit</>
                        )}
                      </button>
                    )}
                  </div>

                  {incomplete && !hypoEdit && (
                    <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 7, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#92400E", fontWeight: 500 }}>
                      This test is missing {[!test.if && "IF", !test.then && "THEN", !test.because && "BECAUSE"].filter(Boolean).join(", ")} — click <strong>Build Hypothesis</strong> to complete it.
                    </div>
                  )}

                  {hypoEdit ? (
                    <>
                      {/* AI input */}
                      <div style={{ background: "#F0F4FA", border: `1.5px solid #C0CFEA`, borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>
                          ✦ AI — describe your test idea
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            value={aiStatement}
                            onChange={e => setAiStatement(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !aiLoading) handleAiGenerate(); }}
                            placeholder="e.g. Move the CTA button above the fold to reduce scroll friction…"
                            style={{ flex: 1, border: `1.5px solid #C0CFEA`, borderRadius: 6, padding: "8px 12px", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 500, color: TEXT, outline: "none", background: "#fff" }}
                            onFocus={e => { e.target.style.borderColor = ACCENT; }}
                            onBlur={e => { e.target.style.borderColor = "#C0CFEA"; }}
                          />
                          <button
                            onClick={handleAiGenerate}
                            disabled={aiLoading || !aiStatement.trim()}
                            style={{ background: ACCENT, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: aiLoading || !aiStatement.trim() ? "not-allowed" : "pointer", fontFamily: "'Inter',sans-serif", opacity: aiLoading || !aiStatement.trim() ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            {aiLoading ? (
                              <><svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 1s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,.3)" strokeWidth="2"/><path d="M14 8a6 6 0 00-6-6" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>Writing…</>
                            ) : "Generate"}
                          </button>
                        </div>
                        {aiError && (
                          <div style={{ marginTop: 8, fontSize: 12, color: "#DC2626", fontWeight: 500 }}>{aiError}</div>
                        )}
                        {!aiError && (draft.if || draft.then || draft.because) && (
                          <div style={{ marginTop: 8, fontSize: 11, color: ACCENT, fontWeight: 500 }}>✓ Fields pre-filled below — review and edit before saving.</div>
                        )}
                      </div>

                      {BLOCKS.map(({ key, color, label, ph }) => (
                        <div key={key} style={{ borderLeft: `4px solid ${color}`, padding: "12px 16px", borderRadius: "0 8px 8px 0", background: BG, marginBottom: 10, border: `1.5px solid ${BORDER}`, borderLeftColor: color }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
                          <textarea
                            value={draft[key]}
                            onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                            placeholder={ph}
                            rows={2}
                            style={{ width: "100%", background: "#fff", border: `1.5px solid ${BORDER}`, borderRadius: 6, padding: "8px 10px", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 500, color: TEXT, resize: "vertical", outline: "none", lineHeight: 1.6, transition: "border-color .15s" }}
                            onFocus={e => { e.target.style.borderColor = color; }}
                            onBlur={e => { e.target.style.borderColor = BORDER; }}
                          />
                        </div>
                      ))}
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button onClick={saveHypo}
                          style={{ background: ACCENT, color: "#fff", border: "none", padding: "9px 20px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                          Save Hypothesis
                        </button>
                        <button onClick={cancelHypo}
                          style={{ background: "none", color: MUTED, border: `1.5px solid ${BORDER}`, padding: "9px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    BLOCKS.map(({ key, color, label }) => (
                      <div key={key} style={{ borderLeft: `4px solid ${color}`, padding: "12px 16px", borderRadius: "0 8px 8px 0", background: BG, marginBottom: 10, border: `1.5px solid ${BORDER}`, borderLeftColor: color }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
                        <div style={{ fontSize: 14, color: test[key] ? TEXT : DIM, fontWeight: 500, lineHeight: 1.7 }}>
                          {test[key] || <em style={{ fontWeight: 400 }}>Not yet defined</em>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })()}

            {/* PIE breakdown */}
            <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: 24, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>PIE Breakdown</div>
              {PIE_CRITERIA.map(c => (
                <div key={c.key} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: c.color, textTransform: "uppercase", letterSpacing: 1 }}>{c.label}</span>
                      <span style={{ fontSize: 11, color: MUTED, marginLeft: 8 }}>{c.description}</span>
                    </div>
                    <span style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{test[c.key]}</span>
                  </div>
                  <div style={{ height: 6, background: "#EEF0F4", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(test[c.key] - 1) / 9 * 100}%`, background: c.color, borderRadius: 3, transition: "width .3s" }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Metrics */}
            <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Metrics</div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Primary KPI</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: ACCENT, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: test.primaryMetric ? TEXT : DIM }}>{test.primaryMetric || "Not set"}</span>
                </div>
              </div>
              {(test.secondaryMetrics || []).length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Secondary</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {test.secondaryMetrics.map(m => (
                      <span key={m} style={{ fontSize: 12, fontWeight: 500, color: MUTED, background: BG, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "3px 9px" }}>{m}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Right column */}
          <div>
            {/* Actions */}
            <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: 18, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Export</div>
              <button className="act-btn" onClick={openPreview} style={{ background: TEAL, color: "#fff" }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                  <circle cx="8" cy="8" r="2" stroke="white" strokeWidth="1.5"/>
                </svg>
                View Template
              </button>
              <button className="act-btn" onClick={handleDownloadPDF} disabled={pdfLoading} style={{ background: ACCENT, color: "#fff", opacity: pdfLoading ? 0.7 : 1, cursor: pdfLoading ? "wait" : "pointer" }}>
                {pdfLoading ? (
                  <><svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 1s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,.3)" strokeWidth="2"/><path d="M14 8a6 6 0 00-6-6" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>Generating…</>
                ) : (
                  <><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="8" height="10" rx="1" stroke="white" strokeWidth="1.5"/><path d="M10 4h2a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/><path d="M5 9h4M5 7h4M5 11h2" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></svg>Download PDF</>
                )}
              </button>
              <button className="act-btn" onClick={handleDownloadSVG} style={{ background: GOLD, color: "#fff" }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1v8M5 6l3 3 3-3M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Download SVG
              </button>
            </div>

            {/* Screenshots */}
            <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Screenshots</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {SCREENSHOT_ZONES.map(z => (
                  <ScreenshotZone
                    key={z.key}
                    label={z.label}
                    sub={z.sub}
                    value={screenshots[z.key] || null}
                    onSet={(dataUrl) => onSaveScreenshot(Number(id), z.key, dataUrl)}
                    onClear={() => onClearScreenshot(Number(id), z.key)}
                    light
                  />
                ))}
              </div>
            </div>

            {/* Overlays */}
            <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Overlays</div>

              {/* Variant tabs (only shown when multiple variants) */}
              {variants.length > 1 && (
                <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
                  {variants.map(v => {
                    const vc = VARIANT_COLORS_MAP[v] ?? "#C9A84C";
                    const isActive = activeVariant === v;
                    const count = (overlaysByVariant[v] ?? []).length;
                    return (
                      <button key={v} onClick={() => setActiveVariant(v)}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 5, border: `1.5px solid ${isActive ? vc : BORDER}`, background: isActive ? vc : "transparent", color: isActive ? "#fff" : TEXT, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all .15s" }}>
                        {v}
                        {count > 0 && (
                          <span style={{ background: isActive ? "rgba(255,255,255,.25)" : vc, color: isActive ? "#fff" : "#fff", borderRadius: 8, padding: "0 5px", fontSize: 9, fontWeight: 800, lineHeight: "16px" }}>{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Placed overlays for active variant */}
              {activeOverlays.length === 0 ? (
                <div style={{ fontSize: 12, color: MUTED, textAlign: "center", padding: "16px 0", lineHeight: 1.5 }}>
                  No overlays placed.<br/>
                  <span style={{ fontSize: 11 }}>Open the SVG preview to drag overlays onto the template.</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {activeOverlays.map(o => {
                    const zone = zoneForOverlay(o, test);
                    return (
                      <div key={o.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", borderRadius: 6, background: BG, border: `1px solid ${BORDER}` }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: o.color, flexShrink: 0, marginTop: 3 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{zone ? zone.label : "Unpositioned"}</div>
                          <div style={{ fontSize: 10, color: o.color, fontWeight: 600, marginTop: 2 }}>{o.label}</div>
                          {o.note && <div style={{ fontSize: 11, color: MUTED, marginTop: 3, lineHeight: 1.5, wordBreak: "break-word" }}>{o.note}</div>}
                        </div>
                        <button
                          onClick={() => updateActiveOverlays(prev => prev.filter(x => x.id !== o.id))}
                          title="Remove overlay"
                          style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 14, lineHeight: 1, padding: "0 2px", flexShrink: 0 }}>
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Overlay type legend */}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Types</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {OVERLAY_TYPES.map(o => (
                    <div key={o.label} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 4, background: BG, border: `1px solid ${BORDER}` }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: o.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: TEXT, whiteSpace: "nowrap" }}>{o.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Danger zone — hidden in portal mode */}
            {!isPortal && <div style={{ marginTop: 16, padding: "14px 16px", border: `1.5px solid #FECACA`, borderRadius: 10, background: "#FFF8F8" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>Danger Zone</div>
              {confirmDelete ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "#DC2626", fontWeight: 600, flex: 1 }}>This cannot be undone.</span>
                  <button onClick={async () => { await onDeleteTest(Number(id)); navigate("/"); }}
                    style={{ background: "#DC2626", color: "#fff", border: "none", padding: "6px 14px", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Confirm Delete
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    style={{ background: "none", border: `1.5px solid #FECACA`, color: "#DC2626", padding: "6px 10px", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  style={{ width: "100%", background: "none", border: `1.5px solid #FECACA`, color: "#DC2626", padding: "8px 0", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Delete Test
                </button>
              )}
            </div>}
          </div>
        </div>
      </div>

      {/* SVG Preview Modal */}
      {svgPreviewOpen && (
        <div style={{ position: "fixed", inset: 0, background: "#0D1520", zIndex: 1100, display: "flex", flexDirection: "column" }}>
          <div style={{ flexShrink: 0, background: "#1A2540", borderBottom: "1px solid #2E3F5C", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{test.testName || "Untitled Test"}</div>
              <div style={{ fontSize: 11, color: "#8BA4C8", marginTop: 1 }}>SVG Template Preview</div>
            </div>
            <div style={{ display: "flex", background: "#0D1520", borderRadius: 6, padding: 3, gap: 2 }}>
              {["fit", "actual"].map(z => (
                <button key={z} onClick={() => setSvgPreviewZoom(z)}
                  style={{ padding: "5px 12px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'Inter',sans-serif", background: svgPreviewZoom === z ? TEAL : "transparent", color: svgPreviewZoom === z ? "#fff" : "#8BA4C8" }}>
                  {z === "fit" ? "Fit" : "100%"}
                </button>
              ))}
            </div>
            <button onClick={handleDownloadPDF} disabled={pdfLoading}
              style={{ background: ACCENT, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: pdfLoading ? "wait" : "pointer", fontFamily: "'Inter',sans-serif", opacity: pdfLoading ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
              {pdfLoading ? (
                <><svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 1s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,.3)" strokeWidth="2"/><path d="M14 8a6 6 0 00-6-6" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>Generating…</>
              ) : <>⬇ Download PDF</>}
            </button>
            <button onClick={handleDownloadSVG}
              style={{ background: GOLD, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
              ⬇ Download SVG
            </button>
            <button onClick={() => setSvgPreviewOpen(false)}
              style={{ background: "none", border: "1px solid #2E3F5C", color: "#8BA4C8", padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
              Close
            </button>
          </div>
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <div style={{ flex: 1, overflow: "auto", padding: "20px", boxSizing: "border-box" }}>
              <div
                style={{ position: "relative", display: "block", width: svgPreviewZoom === "fit" ? "100%" : "max-content" }}
                onDragOver={e => e.preventDefault()}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverZone(null); }}
                onDrop={e => {
                  const now = Date.now();
                  const moveId = e.dataTransfer.getData("overlayMove");
                  const raw = e.dataTransfer.getData("overlayType");
                  if (!raw) return;
                  const ot = JSON.parse(raw);
                  const rect = e.currentTarget.getBoundingClientRect();
                  const relX = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                  const relY = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
                  if (moveId) {
                    updateActiveOverlays(prev => prev.map(x => x.id === Number(moveId) ? { ...x, relX, relY } : x));
                  } else {
                    if (now - lastDropTime.current < 300) return;
                    lastDropTime.current = now;
                    const newId = now;
                    updateActiveOverlays(prev => [...prev, { id: newId, ...ot, relX, relY, note: "" }]);
                    if (ot.isAnnotation) { setEditingNote(""); setEditingOverlayId(newId); }
                  }
                }}
              >
                <div
                  dangerouslySetInnerHTML={{ __html: svgForDisplay(svgPreviewZoom) }}
                  style={{ display: "block", lineHeight: 0, borderRadius: 6, boxShadow: "0 8px 40px rgba(0,0,0,.6)", overflow: "hidden" }}
                />
                {/* Screenshot drop zones */}
                {test && (() => {
                  const { W, totalH, zones } = computeSVGZones(test);
                  return zones.map(zone => (
                    <div
                      key={zone.key}
                      onDragEnter={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragOverZone(zone.key); } }}
                      onDragOver={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.stopPropagation(); setDragOverZone(zone.key); } }}
                      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverZone(null); }}
                      onDrop={e => {
                        if (!e.dataTransfer.types.includes("Files")) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverZone(null);
                        const file = e.dataTransfer.files[0];
                        if (!file || !file.type.startsWith("image/")) return;
                        const reader = new FileReader();
                        reader.onload = ev => onSaveScreenshot(Number(id), zone.key, ev.target.result);
                        reader.readAsDataURL(file);
                      }}
                      style={{
                        position: "absolute",
                        left: `${(zone.x / W) * 100}%`,
                        top: `${(zone.y / totalH) * 100}%`,
                        width: `${(zone.w / W) * 100}%`,
                        height: `${(zone.h / totalH) * 100}%`,
                        borderRadius: 6,
                        boxSizing: "border-box",
                        background: dragOverZone === zone.key ? "rgba(42,140,140,0.25)" : "transparent",
                        border: dragOverZone === zone.key ? "2px dashed #2A8C8C" : "2px solid transparent",
                        transition: "background 0.15s, border-color 0.15s",
                        zIndex: 5,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "all",
                      }}
                    >
                      {dragOverZone === zone.key && (
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#2A8C8C", background: "rgba(13,21,32,0.85)", padding: "8px 16px", borderRadius: 6, pointerEvents: "none", fontFamily: "'Inter',sans-serif" }}>
                          Drop to set {zone.label}
                        </div>
                      )}
                    </div>
                  ));
                })()}
                {activeOverlays.map(p => (
                  <Fragment key={p.id}>
                    {/* Marker */}
                    <div
                      draggable
                      onDragStart={e => {
                        e.stopPropagation();
                        if (editingOverlayId === p.id) { e.preventDefault(); return; }
                        e.dataTransfer.setData("overlayMove", p.id.toString());
                        e.dataTransfer.setData("overlayType", JSON.stringify({ label: p.label, color: p.color, isAnnotation: p.isAnnotation }));
                      }}
                      onClick={() => {
                        setEditingNote(p.note || "");
                        setEditingOverlayId(editingOverlayId === p.id ? null : p.id);
                      }}
                      title={`${p.label}${p.note ? `: ${p.note}` : ""} — drag to reposition · click to edit`}
                      style={{
                        position: "absolute",
                        left: `${p.relX * 100}%`,
                        top: `${p.relY * 100}%`,
                        transform: p.isAnnotation ? "translate(-50%, -100%)" : "translate(-50%, -50%)",
                        zIndex: editingOverlayId === p.id ? 30 : 10,
                        cursor: "grab",
                        userSelect: "none",
                        ...(!p.isAnnotation ? {
                          width: 26, height: 26, borderRadius: "50%",
                          background: p.color,
                          border: `2.5px solid ${editingOverlayId === p.id ? "#fff" : "white"}`,
                          outline: editingOverlayId === p.id ? `2px solid ${p.color}` : "none",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 800, color: "#fff",
                          boxShadow: "0 2px 10px rgba(0,0,0,.5)",
                          fontFamily: "'Inter',sans-serif",
                        } : {}),
                      }}
                    >
                      {p.isAnnotation ? (
                        <div style={{
                          background: p.color,
                          color: "#fff",
                          borderRadius: 6,
                          padding: "5px 9px",
                          fontSize: 11,
                          fontWeight: 600,
                          fontFamily: "'Inter',sans-serif",
                          maxWidth: 180,
                          boxShadow: "0 2px 10px rgba(0,0,0,.5)",
                          border: editingOverlayId === p.id ? "2px solid #fff" : "2px solid transparent",
                          outline: editingOverlayId === p.id ? `2px solid ${p.color}` : "none",
                          whiteSpace: p.note ? "normal" : "nowrap",
                          lineHeight: 1.4,
                        }}>
                          {p.note || "✎ Add note…"}
                          {/* callout pointer */}
                          <div style={{
                            position: "absolute", bottom: -7, left: "50%", transform: "translateX(-50%)",
                            width: 0, height: 0,
                            borderLeft: "7px solid transparent", borderRight: "7px solid transparent",
                            borderTop: `7px solid ${p.color}`,
                          }} />
                        </div>
                      ) : (
                        <>
                          {p.label[0]}
                          {p.note && (
                            <div style={{ position: "absolute", bottom: -2, right: -2, width: 8, height: 8, borderRadius: "50%", background: "white", border: `1.5px solid ${p.color}` }} />
                          )}
                        </>
                      )}
                    </div>

                    {/* Annotation popover */}
                    {editingOverlayId === p.id && (
                      <div
                        style={{
                          position: "absolute",
                          left: `calc(${p.relX * 100}% + 20px)`,
                          top: `${p.relY * 100}%`,
                          transform: "translateY(-50%)",
                          zIndex: 40,
                          background: "#1A2540",
                          border: `1.5px solid ${p.color}`,
                          borderRadius: 8,
                          padding: "12px 14px",
                          minWidth: 220,
                          boxShadow: "0 6px 24px rgba(0,0,0,.7)",
                          fontFamily: "'Inter',sans-serif",
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div style={{ fontSize: 10, fontWeight: 700, color: p.color, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{p.label}</div>
                        <textarea
                          autoFocus
                          value={editingNote}
                          onChange={e => setEditingNote(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              updateActiveOverlays(prev => prev.map(x => x.id === p.id ? { ...x, note: editingNote.trim() } : x));
                              setEditingOverlayId(null);
                            }
                            if (e.key === "Escape") setEditingOverlayId(null);
                          }}
                          placeholder="Add annotation…"
                          rows={2}
                          style={{ width: "100%", background: "#0D1520", border: "1px solid #2E3F5C", borderRadius: 5, padding: "7px 9px", fontFamily: "'Inter',sans-serif", fontSize: 12, color: "#C8D8EE", resize: "none", outline: "none", lineHeight: 1.5 }}
                        />
                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                          <button
                            onClick={() => {
                              updateActiveOverlays(prev => prev.map(x => x.id === p.id ? { ...x, note: editingNote.trim() } : x));
                              setEditingOverlayId(null);
                            }}
                            style={{ flex: 1, background: p.color, color: "#fff", border: "none", padding: "6px 0", borderRadius: 5, fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingOverlayId(null)}
                            style={{ background: "none", border: "1px solid #2E3F5C", color: "#5A7AAA", padding: "6px 10px", borderRadius: 5, fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              updateActiveOverlays(prev => prev.filter(x => x.id !== p.id));
                              setEditingOverlayId(null);
                            }}
                            style={{ background: "none", border: "1px solid #4A1A1A", color: "#DC2626", padding: "6px 10px", borderRadius: 5, fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                          >
                            Remove
                          </button>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 9, color: "#3A5070" }}>Enter to save · Esc to cancel</div>
                      </div>
                    )}
                  </Fragment>
                ))}
              </div>
            </div>
            <div style={{ width: 260, flexShrink: 0, background: "#111B2E", borderLeft: "1px solid #2E3F5C", overflowY: "auto", padding: "16px 14px" }}>

              {/* Control screenshots */}
              <div style={{ fontSize: 10, fontWeight: 700, color: "#5A7AAA", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Screenshots — Control</div>
              <ScreenshotZone
                label="Control"
                sub="Desktop"
                value={screenshots.controlDesktop || null}
                onSet={(dataUrl) => onSaveScreenshot(Number(id), "controlDesktop", dataUrl)}
                onClear={() => onClearScreenshot(Number(id), "controlDesktop")}
              />
              <div style={{ marginTop: 8 }}>
                <ScreenshotZone
                  label="Control"
                  sub="Mobile"
                  value={screenshots.controlMobile || null}
                  onSet={(dataUrl) => onSaveScreenshot(Number(id), "controlMobile", dataUrl)}
                  onClear={() => onClearScreenshot(Number(id), "controlMobile")}
                />
              </div>

              {/* Screenshots for active variant */}
              <div style={{ marginTop: 16, borderTop: "1px solid #1E2F48", paddingTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#5A7AAA", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
                  Screenshots — Variant {activeVariant}
                </div>
                {(() => {
                  const keys = variantScreenshotKeys(activeVariant);
                  return (
                    <>
                      <ScreenshotZone
                        label={`Variant ${activeVariant}`}
                        sub="Desktop"
                        value={screenshots[keys.desktop] || null}
                        onSet={(dataUrl) => onSaveScreenshot(Number(id), keys.desktop, dataUrl)}
                        onClear={() => onClearScreenshot(Number(id), keys.desktop)}
                      />
                      <div style={{ marginTop: 8 }}>
                        <ScreenshotZone
                          label={`Variant ${activeVariant}`}
                          sub="Mobile"
                          value={screenshots[keys.mobile] || null}
                          onSet={(dataUrl) => onSaveScreenshot(Number(id), keys.mobile, dataUrl)}
                          onClear={() => onClearScreenshot(Number(id), keys.mobile)}
                        />
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Overlay Items */}
              <div style={{ marginTop: 16, borderTop: "1px solid #1E2F48", paddingTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#5A7AAA", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Overlay Items — Variant {activeVariant}</div>
                <div style={{ fontSize: 10, color: "#3A5070", lineHeight: 1.6, marginBottom: 12 }}>Drag onto the variant view to annotate changes. Click a marker to remove it.</div>
                {OVERLAY_TYPES.map(o => (
                  <div
                    key={o.label}
                    draggable
                    onDragStart={e => e.dataTransfer.setData("overlayType", JSON.stringify({ label: o.label, color: o.color, isAnnotation: o.isAnnotation }))}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "7px 10px", borderRadius: 6,
                      background: "#1A2540", border: "1px solid #2E3F5C",
                      marginBottom: 6, cursor: "grab", userSelect: "none",
                    }}
                  >
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: o.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#C8D8EE", fontWeight: 500 }}>{o.label}</span>
                  </div>
                ))}
                {activeOverlays.length > 0 && (
                  <button
                    onClick={() => updateActiveOverlays([])}
                    style={{ width: "100%", marginTop: 6, background: "none", border: "1px solid #2E3F5C", color: "#5A7AAA", padding: "6px 0", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                  >
                    Clear all ({activeOverlays.length})
                  </button>
                )}
              </div>

              {/* Variant tabs */}
              <div style={{ marginTop: 16, borderTop: "1px solid #1E2F48", paddingTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#5A7AAA", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Variants</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {variants.map(v => (
                    <div key={v} style={{ display: "flex", alignItems: "center", borderRadius: 6, overflow: "hidden", border: `1.5px solid ${activeVariant === v ? (VARIANT_COLORS_MAP[v] ?? "#C9A84C") : "#2E3F5C"}` }}>
                      <button
                        onClick={() => { setActiveVariant(v); setEditingOverlayId(null); }}
                        style={{ padding: "5px 12px", background: activeVariant === v ? (VARIANT_COLORS_MAP[v] ?? "#C9A84C") : "#1A2540", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}
                      >
                        {v}
                      </button>
                      {variants.length > 1 && (
                        <button
                          onClick={() => removeVariant(v)}
                          style={{ padding: "5px 7px", background: activeVariant === v ? (VARIANT_COLORS_MAP[v] ?? "#C9A84C") : "#1A2540", color: "rgba(255,255,255,.5)", border: "none", fontSize: 11, cursor: "pointer", fontFamily: "'Inter',sans-serif", borderLeft: "1px solid rgba(255,255,255,.15)" }}
                          title={`Remove Variant ${v}`}
                        >×</button>
                      )}
                    </div>
                  ))}
                  {variants.length < 7 && (
                    <button
                      onClick={addVariant}
                      style={{ padding: "5px 12px", background: "#1A2540", border: "1.5px dashed #2E3F5C", color: "#5A7AAA", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}
                    >+ Add</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
