import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import ScreenshotZone from "../components/ScreenshotZone";
import { generateSVG } from "../lib/svg";
import { pieScore, scoreColor, scoreBg, scoreBorder, scoreLabel, fmtDate, makePdfFromSvg, generateHypothesis } from "../lib/utils";
import { PIE_CRITERIA, TEST_STATUSES, DEFAULT_STATUS, SCREENSHOT_ZONES, ACCENT, TEAL, GOLD, BG, CARD, BORDER, TEXT, MUTED, DIM, IF_COLOR, THEN_COLOR, BECAUSE_COLOR } from "../lib/constants";
import { loadScreenshots } from "../db";

export default function TestDetailsPage({ tests, screenshotsMap, setScreenshotsMap, onUpdateTest, onSaveScreenshot, onClearScreenshot, clients }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const test = tests.find(t => t.id === Number(id));

  const [svgPreviewOpen, setSvgPreviewOpen] = useState(false);
  const [svgPreviewZoom, setSvgPreviewZoom] = useState("fit");
  const [svgContent, setSvgContent] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  // Inline hypothesis builder state
  const [hypoEdit, setHypoEdit] = useState(false);
  const [draft, setDraft] = useState({ if: "", then: "", because: "" });
  const [aiStatement, setAiStatement] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const screenshots = screenshotsMap[Number(id)] || {};

  // Load screenshots from IDB on mount
  useEffect(() => {
    if (!id || screenshotsMap[Number(id)]) return;
    loadScreenshots(Number(id)).then((shots) => {
      if (shots && Object.keys(shots).length > 0) {
        setScreenshotsMap(prev => ({ ...prev, [Number(id)]: shots }));
      }
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render SVG preview when screenshots change
  useEffect(() => {
    if (svgPreviewOpen && test) {
      setSvgContent(generateSVG(test, screenshotsMap[test.id] || {}));
    }
  }, [screenshotsMap]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const saveHypo = () => {
    const testId = Number(id);
    if (draft.if      !== test.if)      onUpdateTest(testId, "if",      draft.if);
    if (draft.then    !== test.then)    onUpdateTest(testId, "then",    draft.then);
    if (draft.because !== test.because) onUpdateTest(testId, "because", draft.because);
    setHypoEdit(false);
  };

  const openPreview = () => {
    setSvgContent(generateSVG(test, screenshotsMap[test.id] || {}));
    setSvgPreviewZoom("fit");
    setSvgPreviewOpen(true);
  };

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      await makePdfFromSvg(
        generateSVG(test, screenshotsMap[test.id] || {}),
        `${test.testName || "test-hypothesis"}.pdf`
      );
    } catch (e) { console.error(e); }
    finally { setPdfLoading(false); }
  };

  const handleDownloadSVG = () => {
    const svg = generateSVG(test, screenshotsMap[test.id] || {});
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
      `}</style>

      <AppHeader right={
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => navigate("/")}
            style={{ background: "none", border: `1.5px solid ${BORDER}`, color: MUTED, padding: "7px 14px", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            ← All Tests
          </button>
          <button onClick={() => navigate(`/tests/${id}/edit`)}
            style={{ background: ACCENT, color: "#fff", border: "none", padding: "7px 16px", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Edit Definition →
          </button>
        </div>
      } />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 28px" }}>
        {/* Page title row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8, gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: TEXT, lineHeight: 1.2 }}>
              {test.testName || <span style={{ color: DIM, fontWeight: 400 }}>Untitled Test</span>}
            </h1>
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
                    {!hypoEdit && (
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
            <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
              <img
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`}
                alt="SVG template preview"
                style={{ display: "block", width: svgPreviewZoom === "fit" ? "100%" : "1200px", maxWidth: svgPreviewZoom === "fit" ? "100%" : "none", height: "auto", borderRadius: 6, boxShadow: "0 8px 40px rgba(0,0,0,.6)" }}
              />
            </div>
            <div style={{ width: 230, flexShrink: 0, background: "#111B2E", borderLeft: "1px solid #2E3F5C", overflowY: "auto", padding: "16px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#5A7AAA", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Screenshots</div>
              {SCREENSHOT_ZONES.map(z => (
                <ScreenshotZone
                  key={z.key}
                  label={z.label}
                  sub={z.sub}
                  value={screenshots[z.key] || null}
                  onSet={(dataUrl) => onSaveScreenshot(Number(id), z.key, dataUrl)}
                  onClear={() => onClearScreenshot(Number(id), z.key)}
                />
              ))}
              <div style={{ marginTop: 8, fontSize: 10, color: "#3A5070", lineHeight: 1.7 }}>Screenshots persist via IndexedDB.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
