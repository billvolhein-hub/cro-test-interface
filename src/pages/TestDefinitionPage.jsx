import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import ScreenshotZone from "../components/ScreenshotZone";
import { generateSVG } from "../lib/svg";
import { pieScore, scoreColor, scoreBg, scoreBorder, scoreLabel, makePdfFromSvg, parseCSV, mapCSVToTest, generateHypothesis } from "../lib/utils";
import { TEST_TYPES, TEST_STATUSES, DEFAULT_STATUS, METRICS, AUDIENCES, PIE_CRITERIA, SCREENSHOT_ZONES, ACCENT, TEAL, GOLD, BG, CARD, BORDER, TEXT, MUTED, DIM, IF_COLOR, THEN_COLOR, BECAUSE_COLOR } from "../lib/constants";
import { loadScreenshots } from "../db";

export default function TestDefinitionPage({ tests, screenshotsMap, setScreenshotsMap, onUpdateTest, onReplaceTest, onSaveScreenshot, onClearScreenshot, clients, onCreateClient }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const testId = Number(id);
  const test = tests.find(t => t.id === testId);

  const [copied, setCopied] = useState(false);
  const [activeHint, setActiveHint] = useState(null);
  const [aiStatement, setAiStatement] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [svgReady, setSvgReady] = useState(false);
  const [svgContent, setSvgContent] = useState("");
  const [exportMsg, setExportMsg] = useState("");
  const [svgPreviewOpen, setSvgPreviewOpen] = useState(false);
  const [svgPreviewZoom, setSvgPreviewZoom] = useState("fit");
  const [pdfLoading, setPdfLoading] = useState(false);
  const svgAreaRef   = useRef(null);
  const stmtAreaRef  = useRef(null);
  const [pasteOpen,        setPasteOpen]        = useState(false);
  const [pasteText,        setPasteText]        = useState("");
  const [pasteError,       setPasteError]       = useState("");
  const [newClientInput,   setNewClientInput]   = useState("");
  const [showNewClient,    setShowNewClient]    = useState(false);

  const screenshots = screenshotsMap[testId] || {};

  // Load screenshots from IDB if not already in cache
  useEffect(() => {
    if (!testId || screenshotsMap[testId]) return;
    loadScreenshots(testId).then((shots) => {
      if (shots && Object.keys(shots).length > 0) {
        setScreenshotsMap(prev => ({ ...prev, [testId]: shots }));
      }
    });
  }, [testId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render SVG preview when screenshots change
  useEffect(() => {
    if (svgPreviewOpen && test) {
      setSvgContent(generateSVG(test, screenshotsMap[testId] || {}));
    }
  }, [screenshotsMap]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!test) { navigate("/"); return null; }

  const score = Number(pieScore(test));
  const update = (field, value) => onUpdateTest(testId, field, value);

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
      update("if", result.if);
      update("then", result.then);
      update("because", result.because);
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const toggleSecondary = (metric) => {
    const existing = test.secondaryMetrics || [];
    update("secondaryMetrics", existing.includes(metric)
      ? existing.filter(m => m !== metric) : [...existing, metric]);
  };

  const copyText = (text, ref, onDone) => {
    const doExec = () => {
      const el = ref?.current || document.createElement("textarea");
      if (!ref?.current) { el.style.cssText = "position:fixed;top:-9999px;opacity:0"; document.body.appendChild(el); }
      el.value = text; el.select(); el.setSelectionRange(0, 99999);
      try { document.execCommand("copy"); } catch (_) {}
      if (!ref?.current) document.body.removeChild(el);
      onDone();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(onDone).catch(doExec);
    else doExec();
  };

  const fullStatement = `If ${test.if || "[condition]"}, then ${test.then || "[expected outcome]"}, because ${test.because || "[rationale]"}.`;
  const copyStatement = () => copyText(fullStatement, stmtAreaRef, () => { setCopied(true); setTimeout(() => setCopied(false), 2000); });

  const exportSVG = () => { setSvgContent(generateSVG(test, screenshotsMap[testId] || {})); setSvgReady(true); setExportMsg(""); };
  const copySVG  = () => copyText(svgContent, svgAreaRef, () => { setExportMsg("✓ Copied!"); setTimeout(() => setExportMsg(""), 3000); });
  const closeSVG = () => { setSvgReady(false); setSvgContent(""); };

  const downloadSVG = () => {
    const svg  = generateSVG(test, screenshotsMap[testId] || {});
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${test.testName || "test-hypothesis"}.svg`; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = async () => {
    setPdfLoading(true);
    try { await makePdfFromSvg(generateSVG(test, screenshotsMap[testId] || {}), `${test.testName || "test-hypothesis"}.pdf`); }
    catch (e) { console.error(e); }
    finally { setPdfLoading(false); }
  };

  const openSVGPreview = () => { setSvgContent(generateSVG(test, screenshotsMap[testId] || {})); setSvgPreviewZoom("fit"); setSvgPreviewOpen(true); setExportMsg(""); };

  const handleAddClient = async () => {
    const trimmed = newClientInput.trim();
    if (!trimmed) return;
    const newClient = await onCreateClient(trimmed);
    update("clientId", newClient.id);
    setNewClientInput("");
    setShowNewClient(false);
  };

  const applyPaste = () => {
    setPasteError("");
    const row = parseCSV(pasteText);
    if (!row) { setPasteError("Paste a header row and a data row (comma or tab separated)."); return; }
    const fields = mapCSVToTest(row);
    if (Object.keys(fields).length === 0) { setPasteError("No recognised column headers found. Expected: Test Name, Page URL, Test Type, Audience, Primary Metric, Secondary Metrics, If, Then, Because, Potential, Importance, Ease"); return; }
    onReplaceTest({ ...test, ...fields });
    setPasteText("");
    setPasteOpen(false);
  };

  const SH  = ({ children }) => <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>{children}</div>;
  const Lbl = ({ children, required, empty }) => (
    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.8px", display: "flex", alignItems: "center", gap: 6, color: required && empty ? "#D97706" : MUTED }}>
      {children}
      {required && empty && <span style={{ fontSize: 9, fontWeight: 800, background: "#FEF3C7", color: "#D97706", border: "1px solid #FDE68A", borderRadius: 3, padding: "1px 5px", letterSpacing: 0.5 }}>REQUIRED</span>}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter',sans-serif", color: TEXT }}>
      <textarea ref={stmtAreaRef} readOnly aria-hidden="true" style={{ position: "fixed", top: -9999, left: -9999, opacity: 0, pointerEvents: "none" }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .fi{width:100%;background:#fff;border:1.5px solid ${BORDER};color:${TEXT};padding:10px 14px;border-radius:6px;font-family:'Inter',sans-serif;font-size:14px;font-weight:500;outline:none;transition:border-color .15s;resize:none;line-height:1.6;}
        .fi:focus{border-color:${ACCENT};box-shadow:0 0 0 3px #1B3A6B22;}
        .fi::placeholder{color:${DIM};font-weight:400;}
        .chip{display:inline-flex;align-items:center;padding:5px 12px;border-radius:5px;font-size:13px;font-weight:500;cursor:pointer;border:1.5px solid ${BORDER};background:#fff;color:${MUTED};font-family:'Inter',sans-serif;transition:all .15s;}
        .chip:hover{border-color:${ACCENT};color:${ACCENT};background:#F0F4FA;}
        .chip.on{border-color:${ACCENT};background:#F0F4FA;color:${ACCENT};font-weight:600;}
        .cbtn{background:${ACCENT};color:#fff;border:none;padding:11px 18px;border-radius:6px;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;cursor:pointer;}
        .cbtn:hover{background:#142d54;}
        .ebtn{background:${GOLD};color:#fff;border:none;padding:11px 18px;border-radius:6px;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;justify-content:center;}
        .ebtn:hover{background:#b8942e;}
        .vbtn{background:${TEAL};color:#fff;border:none;padding:11px 18px;border-radius:6px;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;justify-content:center;}
        .vbtn:hover{background:#226f6f;}
        .pdfbtn{background:${ACCENT};color:#fff;border:none;padding:11px 18px;border-radius:6px;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;justify-content:center;width:100%;}
        .pdfbtn:hover{background:#142d54;}
        .pdfbtn:disabled{opacity:.6;cursor:wait;}
        .ifb{border-left:4px solid;padding:16px 18px;border-radius:0 8px 8px 0;background:${CARD};margin-bottom:12px;border-top:1.5px solid ${BORDER};border-right:1.5px solid ${BORDER};border-bottom:1.5px solid ${BORDER};}
        .srow{display:flex;gap:12px;padding:8px 0;border-bottom:1px solid ${BORDER};font-size:13px;}
        input[type=range]{-webkit-appearance:none;width:100%;height:5px;border-radius:3px;outline:none;cursor:pointer;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;cursor:pointer;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.2);}
        .hbtn{background:none;border:none;cursor:pointer;font-size:11px;font-weight:600;font-family:'Inter',sans-serif;padding:0;text-decoration:underline;}
        .back-btn{background:none;border:1.5px solid ${BORDER};color:${MUTED};padding:7px 14px;border-radius:6px;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;cursor:pointer;}
        .back-btn:hover{border-color:${ACCENT};color:${ACCENT};}
        @keyframes spin{to{transform:rotate(360deg);}}
      `}</style>

      <AppHeader right={
        <button className="back-btn" onClick={() => navigate(`/tests/${id}`)}>
          ← Test Details
        </button>
      } />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", minHeight: "calc(100vh - 69px)" }}>
        {/* Left – form */}
        <div style={{ padding: "28px 32px", borderRight: `1px solid ${BORDER}`, overflowY: "auto" }}>

          {/* Paste-to-fill panel */}
          <div style={{ background: "#F0F4FA", border: `1.5px solid #C0CFEA`, borderRadius: 8, marginBottom: 28, overflow: "hidden" }}>
            <button
              onClick={() => { setPasteOpen(o => !o); setPasteError(""); }}
              style={{ width: "100%", background: "none", border: "none", padding: "13px 18px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontFamily: "'Inter',sans-serif", textAlign: "left" }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="4" y="1" width="9" height="12" rx="1" stroke={ACCENT} strokeWidth="1.5"/>
                <path d="M4 3H3a1 1 0 00-1 1v10a1 1 0 001 1h9a1 1 0 001-1v-1" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M7 6h4M7 9h4M7 12h2" stroke={ACCENT} strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: ACCENT }}>Fill from spreadsheet paste</span>
              <span style={{ fontSize: 11, color: MUTED }}>{pasteOpen ? "▲" : "▼"}</span>
            </button>
            {pasteOpen && (
              <div style={{ padding: "0 18px 16px" }}>
                <div style={{ fontSize: 11, color: MUTED, marginBottom: 8, lineHeight: 1.6 }}>
                  Copy a header row + one data row from Google Sheets and paste below (comma or tab separated). Recognised columns: <em>Test Name, Page URL, Test Type, Audience, Primary Metric, Secondary Metrics, If, Then, Because, Potential, Importance, Ease</em>
                </div>
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder={"Test Name\tPage URL\tIf\tThen\tBecause\nMy test\t/page\twe do X\tY improves\tbecause Z"}
                  style={{ width: "100%", height: 90, fontFamily: "monospace", fontSize: 11, color: TEXT, background: "#fff", border: `1.5px solid ${BORDER}`, borderRadius: 6, padding: 10, resize: "vertical", lineHeight: 1.5, outline: "none" }}
                />
                {pasteError && (
                  <div style={{ fontSize: 11, color: "#DC2626", fontWeight: 600, marginTop: 6 }}>{pasteError}</div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={applyPaste}
                    style={{ background: ACCENT, color: "#fff", border: "none", padding: "8px 18px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                    Apply
                  </button>
                  <button onClick={() => { setPasteOpen(false); setPasteText(""); setPasteError(""); }}
                    style={{ background: "none", color: MUTED, border: `1.5px solid ${BORDER}`, padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 32 }}>
            <SH>Test Details</SH>

            {/* Client */}
            <div style={{ marginBottom: 14 }}>
              <Lbl required empty={!test.clientId}>Client</Lbl>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <select value={test.clientId ?? ""}
                    onChange={e => update("clientId", e.target.value === "" ? null : Number(e.target.value))}
                    style={{ width: "100%", appearance: "none", background: !test.clientId ? "#FFFBEB" : "#fff", border: `1.5px solid ${!test.clientId ? "#FDE68A" : BORDER}`, color: !test.clientId ? "#92400E" : TEXT, padding: "9px 36px 9px 14px", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer", outline: "none" }}>
                    <option value="">— Select Client —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                    <path d="M2 4l4 4 4-4" stroke={MUTED} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <button title="Add new client" onClick={() => setShowNewClient(v => !v)}
                  style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 6, border: `1.5px solid ${BORDER}`, background: showNewClient ? "#F0F4FA" : "#fff", color: ACCENT, fontSize: 20, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  +
                </button>
              </div>
              {showNewClient && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input className="fi" placeholder="New client name…" value={newClientInput} autoFocus
                    onChange={e => setNewClientInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleAddClient(); if (e.key === "Escape") { setShowNewClient(false); setNewClientInput(""); }}}
                    style={{ flex: 1 }} />
                  <button onClick={handleAddClient}
                    style={{ background: ACCENT, color: "#fff", border: "none", padding: "9px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif", flexShrink: 0 }}>
                    Add
                  </button>
                  <button onClick={() => { setShowNewClient(false); setNewClientInput(""); }}
                    style={{ background: "none", color: MUTED, border: `1.5px solid ${BORDER}`, padding: "9px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                    ×
                  </button>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <Lbl>Status</Lbl>
              {(() => {
                const current = TEST_STATUSES.find(s => s.value === (test.status || DEFAULT_STATUS)) || TEST_STATUSES[0];
                return (
                  <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
                    <select
                      value={test.status || DEFAULT_STATUS}
                      onChange={e => update("status", e.target.value)}
                      style={{ width: "100%", appearance: "none", background: current.bg, border: `1.5px solid ${current.border}`, color: current.color, padding: "9px 36px 9px 14px", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer", outline: "none" }}>
                      {TEST_STATUSES.map(s => (
                        <option key={s.value} value={s.value}>{s.value}</option>
                      ))}
                    </select>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                      <path d="M2 4l4 4 4-4" stroke={current.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                );
              })()}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
              <div><Lbl required empty={!test.testName}>Test Name</Lbl><input className="fi" placeholder="e.g. Remove PDF download element" value={test.testName} onChange={e => update("testName", e.target.value)} style={{ borderColor: !test.testName ? "#FDE68A" : undefined, background: !test.testName ? "#FFFBEB" : undefined }} /></div>
              <div><Lbl>Page / URL</Lbl><input className="fi" placeholder="e.g. /masters/data-analytics" value={test.pageUrl} onChange={e => update("pageUrl", e.target.value)} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <Lbl>Test Type</Lbl>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {TEST_TYPES.map(t => <button key={t} className={`chip${test.testType === t ? " on" : ""}`} onClick={() => update("testType", test.testType === t ? "" : t)}>{t}</button>)}
                </div>
              </div>
              <div>
                <Lbl>Audience / Segment</Lbl>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {AUDIENCES.map(a => <button key={a} className={`chip${test.audience === a ? " on" : ""}`} onClick={() => update("audience", test.audience === a ? "" : a)}>{a}</button>)}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <SH>Metrics</SH>
            <div style={{ marginBottom: 16 }}>
              <Lbl>Primary Metric</Lbl>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {METRICS.map(m => <button key={m} className={`chip${test.primaryMetric === m ? " on" : ""}`} onClick={() => update("primaryMetric", test.primaryMetric === m ? "" : m)}>{m}</button>)}
              </div>
            </div>
            <div>
              <Lbl>Secondary Metrics <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(select multiple)</span></Lbl>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {METRICS.filter(m => m !== test.primaryMetric).map(m => <button key={m} className={`chip${(test.secondaryMetrics || []).includes(m) ? " on" : ""}`} onClick={() => toggleSecondary(m)}>{m}</button>)}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <SH>PIE Score</SH>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 16px", background: scoreBg(score), border: `1.5px solid ${scoreBorder(score)}`, borderRadius: 8 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: scoreColor(score), lineHeight: 1 }}>{pieScore(test)}</div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: scoreColor(score), textTransform: "uppercase", letterSpacing: 1 }}>{scoreLabel(score)}</div>
                  <div style={{ fontSize: 10, color: MUTED, fontWeight: 500 }}>(P+I+E) ÷ 3</div>
                </div>
              </div>
            </div>
            {PIE_CRITERIA.map(c => (
              <div key={c.key} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 8, padding: "14px 16px", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.color, textTransform: "uppercase", letterSpacing: 1, flex: 1 }}>{c.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: c.color, lineHeight: 1, marginRight: 12 }}>{test[c.key]}</div>
                  <button className="hbtn" style={{ color: c.color }} onClick={() => setActiveHint(activeHint === c.key ? null : c.key)}>
                    {activeHint === c.key ? "▲ hide guide" : "▼ scoring guide"}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: MUTED, fontWeight: 500, marginBottom: 10 }}>{c.description}</div>
                <input type="range" min="1" max="10" step="0.1" value={test[c.key]}
                  onChange={e => update(c.key, Number(e.target.value))}
                  style={{ background: `linear-gradient(to right,${c.color} 0%,${c.color} ${(test[c.key]-1)/9*100}%,#ddd ${(test[c.key]-1)/9*100}%,#ddd 100%)` }} />
                {activeHint === c.key && (
                  <div style={{ marginTop: 10, padding: "10px 14px", background: "#fff", borderRadius: 6, border: `1px solid ${c.border}` }}>
                    {c.hints.map((h, i) => <div key={i} style={{ fontSize: 12, fontWeight: 500, color: MUTED, lineHeight: 1.8 }}>— {h}</div>)}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div>
            <SH>Hypothesis Statement</SH>
            {/* AI generator */}
            <div style={{ background: "#F0F4FA", border: `1.5px solid #C0CFEA`, borderRadius: 8, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>✦ AI — describe your test idea</div>
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
              {aiError && <div style={{ marginTop: 8, fontSize: 12, color: "#DC2626", fontWeight: 500 }}>{aiError}</div>}
              {!aiError && (test.if || test.then || test.because) && aiStatement && !aiLoading && (
                <div style={{ marginTop: 8, fontSize: 11, color: ACCENT, fontWeight: 500 }}>✓ Fields updated — review below.</div>
              )}
            </div>
            {[
              { color: IF_COLOR,      label: "IF — The Change",        field: "if",      ph: "we remove the PDF download element from the hero section..." },
              { color: THEN_COLOR,    label: "THEN — Expected Outcome", field: "then",    ph: "form submission rate will increase among new users..." },
              { color: BECAUSE_COLOR, label: "BECAUSE — The Rationale", field: "because", ph: "the PDF acts as a conversion escape hatch..." },
            ].map(({ color, label, field, ph }) => (
              <div key={field} className="ifb" style={{ borderLeftColor: color, borderTopColor: !test[field] ? "#FDE68A" : undefined, borderRightColor: !test[field] ? "#FDE68A" : undefined, borderBottomColor: !test[field] ? "#FDE68A" : undefined, background: !test[field] ? "#FFFBEB" : CARD }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color, textTransform: "uppercase" }}>{label}</div>
                  {!test[field] && <span style={{ fontSize: 9, fontWeight: 800, background: "#FEF3C7", color: "#D97706", border: "1px solid #FDE68A", borderRadius: 3, padding: "1px 5px", letterSpacing: 0.5 }}>REQUIRED</span>}
                </div>
                <textarea className="fi" rows={2} placeholder={ph} value={test[field]} onChange={e => update(field, e.target.value)} style={{ background: "transparent", border: "none", padding: 0, resize: "none", boxShadow: "none" }} />
              </div>
            ))}
          </div>
        </div>

        {/* Right – preview + actions */}
        <div style={{ padding: "28px 24px", background: "#F1F5F9", overflowY: "auto" }}>
          <SH>Preview</SH>
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {[{ label: "Client", done: !!test.clientId }, { label: "Name", done: !!test.testName }, { label: "IF", done: !!test.if }, { label: "THEN", done: !!test.then }, { label: "BECAUSE", done: !!test.because }]
              .map((item, i, arr) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", fontSize: 12, fontWeight: 600, color: item.done ? TEAL : "#D97706" }}>
                  <span style={{ marginRight: 4 }}>{item.done ? "✓" : "○"}</span>{item.label}
                  {i < arr.length - 1 && <span style={{ margin: "0 8px", color: BORDER }}>·</span>}
                </div>
              ))}
          </div>

          <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: 20, marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
            <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.9, color: TEXT }}>
              <span style={{ color: IF_COLOR, fontWeight: 700 }}>If </span>
              {test.if || <span style={{ color: DIM }}>the change...</span>}
              <span style={{ color: THEN_COLOR, fontWeight: 700 }}>, then </span>
              {test.then || <span style={{ color: DIM }}>expected outcome...</span>}
              <span style={{ color: BECAUSE_COLOR, fontWeight: 700 }}>, because </span>
              {test.because || <span style={{ color: DIM }}>the rationale...</span>}
              {(test.if || test.then || test.because) && "."}
            </div>
          </div>

          <button className="cbtn" onClick={copyStatement} style={{ width: "100%", marginBottom: 10 }}>
            {copied ? "✓ COPIED" : "COPY STATEMENT"}
          </button>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <button className="vbtn" onClick={openSVGPreview}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="8" cy="8" r="2" stroke="white" strokeWidth="1.5"/></svg>
              VIEW TEMPLATE
            </button>
            <button className="ebtn" onClick={exportSVG}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 1v8M5 6l3 3 3-3M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              EXPORT CODE
            </button>
          </div>
          <button className="pdfbtn" onClick={downloadPDF} disabled={pdfLoading} style={{ marginBottom: 24 }}>
            {pdfLoading
              ? <><svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 1s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,.3)" strokeWidth="2"/><path d="M14 8a6 6 0 00-6-6" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>Generating PDF…</>
              : <><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="8" height="10" rx="1" stroke="white" strokeWidth="1.5"/><path d="M10 4h2a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/><path d="M5 9h4M5 7h4M5 11h2" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></svg>DOWNLOAD PDF</>
            }
          </button>

          <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,.07)", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: MUTED }}>Test Summary</div>
              {(() => {
                const st = TEST_STATUSES.find(s => s.value === (test.status || DEFAULT_STATUS)) || TEST_STATUSES[0];
                return <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, border: `1px solid ${st.border}`, borderRadius: 20, padding: "3px 10px" }}>{test.status || DEFAULT_STATUS}</span>;
              })()}
            </div>
            {[
              { label: "Client",    value: clients.find(c => c.id === test.clientId)?.name },
              { label: "Test Name", value: test.testName },
              { label: "Page",      value: test.pageUrl },
              { label: "Type",      value: test.testType },
              { label: "Audience",  value: test.audience },
              { label: "Primary",   value: test.primaryMetric },
              { label: "Secondary", value: (test.secondaryMetrics || []).join(", ") },
            ].map(row => (
              <div key={row.label} className="srow">
                <span style={{ color: MUTED, fontWeight: 600, minWidth: 90 }}>{row.label}</span>
                <span style={{ color: row.value ? TEXT : DIM, fontWeight: row.value ? 500 : 400 }}>{row.value || "—"}</span>
              </div>
            ))}
          </div>

          <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: MUTED, marginBottom: 14 }}>Screenshots</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {SCREENSHOT_ZONES.map(z => (
                <ScreenshotZone key={z.key} label={z.label} sub={z.sub}
                  value={screenshots[z.key] || null}
                  onSet={(dataUrl) => onSaveScreenshot(testId, z.key, dataUrl)}
                  onClear={() => onClearScreenshot(testId, z.key)}
                  light />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SVG Code Modal */}
      {svgReady && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,25,35,.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: CARD, borderRadius: 12, width: "100%", maxWidth: 700, maxHeight: "82vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,.35)" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>SVG Template Ready</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Paste into TextEdit/Notepad → save as <strong>.svg</strong> → open in Illustrator.</div>
              </div>
              <button onClick={closeSVG} style={{ background: "none", border: "none", fontSize: 22, color: MUTED, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ padding: "10px 24px", background: "#FFFBEB", borderBottom: "1px solid #FDE68A", fontSize: 12, color: "#92400E", fontWeight: 500 }}>
              <strong>Tip:</strong> Click inside the code box → <kbd>Cmd/Ctrl+A</kbd> → <kbd>Cmd/Ctrl+C</kbd> — or use the copy button below.
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "14px 24px" }}>
              <textarea ref={svgAreaRef} readOnly value={svgContent}
                onClick={e => { e.target.select(); e.target.setSelectionRange(0, 99999); }}
                style={{ width: "100%", height: 300, fontFamily: "monospace", fontSize: 10.5, color: "#334155", background: "#F8FAFC", border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12, resize: "none", lineHeight: 1.5 }} />
            </div>
            <div style={{ padding: "14px 24px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 10 }}>
              <button onClick={copySVG} style={{ flex: 1, background: GOLD, color: "#fff", border: "none", padding: "11px 18px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {exportMsg || "📋 Copy SVG Code"}
              </button>
              <button onClick={downloadSVG} style={{ flex: 1, background: ACCENT, color: "#fff", border: "none", padding: "11px 18px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                ⬇ Download .svg
              </button>
              <button onClick={closeSVG} style={{ background: BG, color: MUTED, border: `1.5px solid ${BORDER}`, padding: "11px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Close</button>
            </div>
          </div>
        </div>
      )}

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
            <button onClick={downloadSVG} style={{ background: GOLD, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>⬇ Download SVG</button>
            <button onClick={() => setSvgPreviewOpen(false)} style={{ background: "none", border: "1px solid #2E3F5C", color: "#8BA4C8", padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Close</button>
          </div>
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
              <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`} alt="SVG template preview"
                style={{ display: "block", width: svgPreviewZoom === "fit" ? "100%" : "1200px", maxWidth: svgPreviewZoom === "fit" ? "100%" : "none", height: "auto", borderRadius: 6, boxShadow: "0 8px 40px rgba(0,0,0,.6)" }} />
            </div>
            <div style={{ width: 230, flexShrink: 0, background: "#111B2E", borderLeft: "1px solid #2E3F5C", overflowY: "auto", padding: "16px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#5A7AAA", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Screenshots</div>
              {SCREENSHOT_ZONES.map(z => (
                <ScreenshotZone key={z.key} label={z.label} sub={z.sub}
                  value={screenshots[z.key] || null}
                  onSet={(dataUrl) => onSaveScreenshot(testId, z.key, dataUrl)}
                  onClear={() => onClearScreenshot(testId, z.key)} />
              ))}
              <div style={{ marginTop: 8, fontSize: 10, color: "#3A5070", lineHeight: 1.7 }}>Screenshots persist via IndexedDB.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
