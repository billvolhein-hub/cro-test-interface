import { useState, useRef } from "react";
import { ACCENT, TEAL, GOLD, BG, CARD, BORDER, TEXT, MUTED, DIM } from "../lib/constants";
import { OVERLAY_TYPES } from "../lib/constants";
import { computeSVGZones } from "../lib/svg";
import { useBreakpoint } from "../lib/useBreakpoint";

const STEP_CHOOSE    = 0;
const STEP_UPLOAD    = 1;
const STEP_ANALYZING = 2;
const STEP_RESULTS   = 3;

const SYSTEM_PROMPT = `You are a conversion rate optimization (CRO) expert analyzing web pages for A/B testing opportunities.

You will receive:
1. A screenshot of the current page (control)
2. Google Analytics 90-day data (CSV)
3. Google Search Console 90-day data (CSV)
4. Optionally, the page URL

Analyze the data and visual thoroughly to identify high-impact conversion testing opportunities grounded in the data.

Return ONLY valid JSON (no markdown, no explanation) in exactly this format:
{
  "recommendations": [
    {
      "testName": "Short test name (max 60 chars)",
      "successProbability": 72,
      "if": "we make this specific change to the page element or layout",
      "then": "this measurable outcome will improve for the target audience",
      "because": "rationale grounded in the GA/GSC data and visual page analysis",
      "testType": "A/B",
      "audience": "All users",
      "primaryMetric": "Form submissions",
      "secondaryMetrics": ["CTA clicks"],
      "potential": 7,
      "importance": 8,
      "ease": 6,
      "overlays": [
        {
          "type": "CTA Highlight",
          "note": "Brief annotation (max 60 chars)",
          "xFrac": 0.5,
          "yFrac": 0.3
        }
      ]
    }
  ]
}

Rules:
- successProbability: 1–100 integer estimating probability of a winning test result
- potential, importance, ease: 1–10 integers for PIE scoring
- overlays xFrac/yFrac: 0–1 fractions of the uploaded screenshot width/height indicating where the change occurs
- overlay type must be one of: "Add/Blur", "Removed", "Copy Change", "Layout Shift", "Sticky Element", "CTA Highlight", "Brand Accent", "Annotation"
- audience must be one of: "All users", "New users", "Returning users", "Organic search", "Paid search", "Mobile users", "Desktop users", "Direct traffic"
- testType must be one of: "A/B", "A/B/n", "Multivariate", "Split URL", "Redirect"
- primaryMetric must be one of: "Form submissions", "RFI completions", "CTA clicks", "Scroll depth", "Time on page", "Bounce rate", "Sessions", "Conversion rate", "Engagement rate", "Exit rate"
- Each recommendation should have 1–3 overlays
- Make recommendations meaningfully different from each other (different page areas or strategies)
- Ground successProbability in data evidence — high traffic + clear friction = higher probability`;

// Crop an image to a vertical slice centered on (centerX, centerY) in 0-1 coords.
// Returns a new dataUrl showing ~55% of the image height focused on the area of interest.
function cropImageToArea(dataUrl, centerX, centerY) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const cropH = Math.round(img.height * 0.55);
      let sy = Math.round(centerY * img.height - cropH / 2);
      sy = Math.max(0, Math.min(img.height - cropH, sy));
      const canvas = document.createElement("canvas");
      canvas.width  = img.width;
      canvas.height = cropH;
      canvas.getContext("2d").drawImage(img, 0, sy, img.width, cropH, 0, 0, img.width, cropH);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => resolve(dataUrl); // fallback to original
    img.src = dataUrl;
  });
}

function FileDropZone({ label, hint, accept, file, onFile, icon }) {
  const ref = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${dragOver ? TEAL : file ? "#15803D" : BORDER}`,
        borderRadius: 10,
        padding: "18px 16px",
        background: dragOver ? "#F0FAFA" : file ? "#F0FDF4" : BG,
        cursor: "pointer",
        transition: "all .15s",
        textAlign: "center",
      }}
    >
      <input ref={ref} type="file" accept={accept} style={{ display: "none" }}
        onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); }} />
      <div style={{ fontSize: 22, marginBottom: 6 }}>{file ? "✓" : icon}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: file ? "#15803D" : TEXT, marginBottom: 2, wordBreak: "break-all" }}>
        {file ? file.name : label}
      </div>
      <div style={{ fontSize: 11, color: file ? "#22C55E" : MUTED }}>
        {file ? "File selected — click to replace" : hint}
      </div>
    </div>
  );
}

function ScoreBadge({ value, color }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, background: `${color}18`, color, fontSize: 13, fontWeight: 800 }}>
      {value}
    </span>
  );
}

export default function IdeationModal({
  open, onClose, onSelectBlank, onSelectRecommendation, clients, activeClientId,
}) {
  const { isMobile } = useBreakpoint();
  const [step, setStep]                   = useState(STEP_CHOOSE);
  const [gaFile, setGaFile]               = useState(null);
  const [gscFile, setGscFile]             = useState(null);
  const [pageUrl, setPageUrl]             = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [error, setError]                 = useState("");
  const capturedScreenshot                = useRef(null);

  const defaultClientId = () => activeClientId !== "all" ? activeClientId : (clients[0]?.id ?? null);
  const [selectedClientId, setSelectedClientId] = useState(defaultClientId);

  const reset = () => {
    setStep(STEP_CHOOSE);
    setGaFile(null);
    setGscFile(null);
    setPageUrl("");
    setRecommendations([]);
    setError("");
    capturedScreenshot.current = null;
    setSelectedClientId(defaultClientId());
  };

  const handleClose = () => { reset(); onClose(); };

  const readFileText = async (file) => {
    // If it's a zip, extract the first CSV inside
    if (file.name.endsWith(".zip") || file.type === "application/zip") {
      const { default: JSZip } = await import("jszip");
      const zip = await JSZip.loadAsync(file);
      const csvFile = Object.values(zip.files).find(f => f.name.endsWith(".csv") && !f.dir);
      if (!csvFile) throw new Error(`No CSV found inside ${file.name}`);
      return csvFile.async("string");
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target.result);
      reader.readAsText(file);
    });
  };

  const isValidUrl = (s) => { try { return /^https?:\/\/.+/.test(s) && Boolean(new URL(s)); } catch { return false; } };

  const canAnalyze = isValidUrl(pageUrl) && gaFile && gscFile;

  const analyze = async () => {
    if (!canAnalyze) return;
    setStep(STEP_ANALYZING);
    setError("");

    try {
      // 1. Screenshot the URL via Puppeteer (optional — only available in local dev)
      let screenshot = null;
      try {
        const ssRes = await fetch(`/api/screenshot?url=${encodeURIComponent(pageUrl)}`);
        if (ssRes.ok) {
          const ssData = await ssRes.json();
          if (ssData.dataUrl) {
            const [header, base64] = ssData.dataUrl.split(",");
            const mediaType = header.replace("data:", "").replace(";base64", "");
            screenshot = { dataUrl: ssData.dataUrl, base64, mediaType };
            capturedScreenshot.current = screenshot;
          }
        }
      } catch { /* screenshot unavailable — proceed without it */ }

      // 2. Read CSVs
      const [gaText, gscText] = await Promise.all([
        readFileText(gaFile),
        readFileText(gscFile),
      ]);

      const truncate = (text, lines = 200) => text.split("\n").slice(0, lines).join("\n");
      const gaTextTruncated  = truncate(gaText,  200);
      const gscTextTruncated = truncate(gscText, 200);

      const userContent = [
        ...(screenshot ? [{
          type: "image",
          source: { type: "base64", media_type: screenshot.mediaType, data: screenshot.base64 },
        }] : []),
        {
          type: "text",
          text: [
            `Page URL: ${pageUrl}`,
            "",
            "=== GOOGLE ANALYTICS (90-day) ===",
            gaTextTruncated,
            "",
            "=== GOOGLE SEARCH CONSOLE (90-day) ===",
            gscTextTruncated,
            "",
            screenshot
              ? "Analyze the screenshot and data above. Return exactly 3 CRO test recommendations as JSON."
              : "Analyze the data above (no screenshot available). Return exactly 3 CRO test recommendations as JSON.",
          ].join("\n"),
        },
      ];

      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userContent }],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const rawText = data.content?.[0]?.text ?? "";

      // Extract JSON from response (may have markdown fences)
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in API response");

      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.recommendations?.length) throw new Error("No recommendations returned");

      setRecommendations(parsed.recommendations.slice(0, 3));
      setStep(STEP_RESULTS);
    } catch (err) {
      setError(err.message || "Analysis failed. Please try again.");
      setStep(STEP_UPLOAD);
    }
  };

  const [selecting, setSelecting] = useState(false);

  const handleSelect = async (rec) => {
    const screenshotUrl = capturedScreenshot.current?.dataUrl ?? null;

    // Compute overlay positions in variantDesktop zone
    const mockTest = { if: rec.if, then: rec.then, because: rec.because, variants: ["B"] };
    const { W, totalH, zones } = computeSVGZones(mockTest);
    const variantZone = zones.find(z => z.key === "variantDesktop");

    const overlayDefs = rec.overlays ?? [];
    const overlayArr = overlayDefs.slice(0, 3).map((o, i) => {
      const overlayType = OVERLAY_TYPES.find(t => t.label === o.type) ?? OVERLAY_TYPES[1];
      const svgX = variantZone.x + (o.xFrac ?? 0.5) * variantZone.w;
      const svgY = variantZone.y + (o.yFrac ?? (0.25 + i * 0.25)) * variantZone.h;
      return {
        id: Date.now() + i,
        label: overlayType.label,
        color: overlayType.color,
        note: o.note ?? "",
        relX: svgX / W,
        relY: svgY / totalH,
      };
    });

    const testData = {
      clientId:         selectedClientId,
      testName:         rec.testName,
      pageUrl:          pageUrl || rec.pageUrl || "",
      if:               rec.if,
      then:             rec.then,
      because:          rec.because,
      testType:         rec.testType,
      audience:         rec.audience,
      primaryMetric:    rec.primaryMetric,
      secondaryMetrics: rec.secondaryMetrics ?? [],
      potential:        rec.potential,
      importance:       rec.importance,
      ease:             rec.ease,
      overlays:         { B: overlayArr },
    };

    setSelecting(true);
    setError("");
    try {
      // Build per-zone screenshots:
      // Control zones: full screenshot
      // Variant zones: cropped to the area the overlays point at
      let screenshots = {};
      if (screenshotUrl) {
        // Centroid of overlay positions in screenshot coords
        const cx = overlayDefs.length
          ? overlayDefs.reduce((s, o) => s + (o.xFrac ?? 0.5), 0) / overlayDefs.length
          : 0.5;
        const cy = overlayDefs.length
          ? overlayDefs.reduce((s, o) => s + (o.yFrac ?? 0.5), 0) / overlayDefs.length
          : 0.5;

        const variantCrop = await cropImageToArea(screenshotUrl, cx, cy);

        screenshots = {
          controlDesktop: screenshotUrl,
          controlMobile:  screenshotUrl,
          variantDesktop: variantCrop,
          variantMobile:  variantCrop,
        };
      }

      await onSelectRecommendation(testData, screenshots);
      reset();
    } catch (err) {
      setError(err.message || "Failed to create test. Please try again.");
      setSelecting(false);
    }
  };

  if (!open) return null;

  const overlay = (
    <div
      onClick={handleClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,25,35,.55)",
        backdropFilter: "blur(3px)", zIndex: 1000, display: "flex",
        alignItems: "center", justifyContent: "center", padding: isMobile ? 12 : 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: CARD, borderRadius: 14, width: "100%",
          maxWidth: step === STEP_RESULTS ? 860 : step === STEP_UPLOAD ? 640 : 540,
          maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,.25)",
          fontFamily: "'Inter',sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: TEXT }}>
              {step === STEP_CHOOSE    && "+ New Test"}
              {step === STEP_UPLOAD    && "AI Ideation — Upload Data"}
              {step === STEP_ANALYZING && "AI Ideation — Analyzing"}
              {step === STEP_RESULTS   && "AI Ideation — Select a Test"}
            </div>
            {step === STEP_RESULTS && (
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                Choose one of the 3 recommendations to pre-populate your test
              </div>
            )}
          </div>
          <button onClick={handleClose} style={{ background: "none", border: "none", fontSize: 22, color: DIM, cursor: "pointer", lineHeight: 1, padding: "2px 4px" }}>×</button>
        </div>

        <div style={{ padding: 24 }}>

          {/* ── STEP 0: Choose ─────────────────────────────────────────────── */}
          {step === STEP_CHOOSE && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {clients.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Client</div>
                <select
                  value={selectedClientId ?? ""}
                  onChange={e => setSelectedClientId(e.target.value ? Number(e.target.value) : null)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1.5px solid ${BORDER}`, fontFamily: "'Inter',sans-serif", fontSize: 13, color: TEXT, background: BG, outline: "none" }}
                >
                  <option value="">— No client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
              <button
                onClick={() => { handleClose(); onSelectBlank(selectedClientId); }}
                style={{
                  background: BG, border: `1.5px solid ${BORDER}`, borderRadius: 10,
                  padding: "28px 20px", cursor: "pointer", textAlign: "left",
                  transition: "border-color .15s, box-shadow .15s",
                  fontFamily: "'Inter',sans-serif",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.boxShadow = "0 4px 16px rgba(27,58,107,.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 6 }}>Blank Test</div>
                <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
                  Start with an empty test form and fill in all details manually.
                </div>
              </button>

              <button
                onClick={() => setStep(STEP_UPLOAD)}
                style={{
                  background: `linear-gradient(135deg, #F0FAFA 0%, #EEF2FF 100%)`,
                  border: `1.5px solid ${TEAL}`, borderRadius: 10,
                  padding: "28px 20px", cursor: "pointer", textAlign: "left",
                  transition: "border-color .15s, box-shadow .15s",
                  fontFamily: "'Inter',sans-serif",
                  position: "relative", overflow: "hidden",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(42,140,140,.18)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ fontSize: 28, marginBottom: 10 }}>✨</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: TEAL, marginBottom: 6 }}>AI Ideation</div>
                <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
                  Enter a page URL + GA & GSC data. Claude screenshots the page, analyzes everything, and recommends 3 tests with predicted success rates.
                </div>
                <div style={{ position: "absolute", top: 10, right: 12, fontSize: 10, fontWeight: 700, color: "#fff", background: TEAL, borderRadius: 4, padding: "2px 7px", letterSpacing: 0.5 }}>
                  AI POWERED
                </div>
              </button>
            </div>
            </div>
          )}

          {/* ── STEP 1: Upload ─────────────────────────────────────────────── */}
          {step === STEP_UPLOAD && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {error && (
                <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#DC2626", fontWeight: 500 }}>
                  {error}
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6, letterSpacing: 0.3 }}>
                  Page URL
                </label>
                <input
                  value={pageUrl}
                  onChange={(e) => setPageUrl(e.target.value)}
                  placeholder="https://example.com/page"
                  style={{
                    width: "100%", padding: "10px 12px", border: `1.5px solid ${BORDER}`,
                    borderRadius: 7, fontSize: 13, fontFamily: "'Inter',sans-serif",
                    color: TEXT, background: BG, outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <FileDropZone
                  label="Google Analytics CSV"
                  hint="90-day export from GA4 or UA"
                  accept=".csv,.zip,text/csv,application/zip"
                  file={gaFile}
                  onFile={setGaFile}
                  icon="📊"
                />

                <FileDropZone
                  label="Search Console CSV"
                  hint="90-day performance export from GSC"
                  accept=".csv,.zip,text/csv,application/zip"
                  file={gscFile}
                  onFile={setGscFile}
                  icon="🔍"
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
                <button
                  onClick={() => setStep(STEP_CHOOSE)}
                  style={{ background: "none", border: `1.5px solid ${BORDER}`, color: MUTED, padding: "9px 18px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}
                >
                  Back
                </button>
                <button
                  onClick={analyze}
                  disabled={!canAnalyze}
                  style={{
                    background: canAnalyze ? TEAL : DIM, color: "#fff", border: "none",
                    padding: "9px 22px", borderRadius: 7, fontSize: 13, fontWeight: 700,
                    cursor: canAnalyze ? "pointer" : "not-allowed", fontFamily: "'Inter',sans-serif",
                    display: "flex", alignItems: "center", gap: 8,
                  }}
                >
                  <span>✨</span> Analyze & Generate Tests
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Analyzing ──────────────────────────────────────────── */}
          {step === STEP_ANALYZING && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 44, marginBottom: 20, animation: "spin 2s linear infinite" }}>
                ✨
              </div>
              <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} } @keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:1} }`}</style>
              <div style={{ fontSize: 17, fontWeight: 700, color: TEXT, marginBottom: 10 }}>
                Analyzing your data...
              </div>
              <div style={{ fontSize: 13, color: MUTED, maxWidth: 340, margin: "0 auto", lineHeight: 1.6 }}>
                Screenshotting the page, then Claude is analyzing your GA &amp; GSC data to generate 3 tailored test recommendations.
              </div>
              <div style={{ marginTop: 28, display: "flex", justifyContent: "center", gap: 6 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: TEAL, animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite` }} />
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 3: Results ────────────────────────────────────────────── */}
          {step === STEP_RESULTS && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {error && (
                <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#DC2626", fontWeight: 500 }}>
                  {error}
                </div>
              )}
              {recommendations.map((rec, i) => (
                <div
                  key={i}
                  style={{
                    border: `1.5px solid ${BORDER}`, borderRadius: 10,
                    padding: "20px", background: BG,
                    transition: "border-color .15s, box-shadow .15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = TEAL; e.currentTarget.style.boxShadow = "0 4px 16px rgba(42,140,140,.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 4 }}>
                        {i + 1}. {rec.testName}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: rec.successProbability >= 70 ? "#15803D" : rec.successProbability >= 50 ? "#B45309" : "#DC2626", borderRadius: 4, padding: "2px 8px" }}>
                          {rec.successProbability}% predicted success
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2px 8px" }}>
                          {rec.testType}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2px 8px" }}>
                          {rec.audience}
                        </span>
                      </div>
                    </div>
                    {/* PIE scores */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <ScoreBadge value={rec.potential}   color="#C9A84C" />
                      <ScoreBadge value={rec.importance}  color="#1B3A6B" />
                      <ScoreBadge value={rec.ease}        color="#2A8C8C" />
                    </div>
                  </div>

                  {/* Hypothesis */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                    {[
                      { label: "IF",      color: "#1B3A6B", text: rec.if },
                      { label: "THEN",    color: "#2A8C8C", text: rec.then },
                      { label: "BECAUSE", color: "#C9A84C", text: rec.because },
                    ].map(({ label, color, text }) => (
                      <div key={label} style={{ display: "flex", gap: 8 }}>
                        <div style={{ width: 3, background: color, borderRadius: 2, flexShrink: 0, alignSelf: "stretch" }} />
                        <div>
                          <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: 0.8 }}>{label} — </span>
                          <span style={{ fontSize: 12, color: TEXT }}>{text}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Metrics + Overlays row */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, fontSize: 12 }}>
                    <span style={{ color: MUTED }}>Primary: <strong style={{ color: TEXT }}>{rec.primaryMetric}</strong></span>
                    {(rec.secondaryMetrics ?? []).slice(0, 2).map((m, mi) => (
                      <span key={mi} style={{ color: MUTED }}>· {m}</span>
                    ))}
                    {(rec.overlays ?? []).map((o, oi) => {
                      const ot = OVERLAY_TYPES.find(t => t.label === o.type);
                      return (
                        <span key={oi} style={{ fontSize: 11, fontWeight: 600, color: ot?.color ?? MUTED, background: `${ot?.color ?? MUTED}14`, borderRadius: 4, padding: "2px 7px" }}>
                          {o.type}: {o.note}
                        </span>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => handleSelect(rec)}
                    disabled={selecting}
                    style={{
                      width: "100%", padding: "10px 0", background: selecting ? DIM : TEAL, color: "#fff",
                      border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700,
                      cursor: selecting ? "not-allowed" : "pointer", fontFamily: "'Inter',sans-serif",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}
                  >
                    {selecting ? "Creating test…" : "Use This Test →"}
                  </button>
                </div>
              ))}

              <div style={{ display: "flex", justifyContent: "center" }}>
                <button
                  onClick={() => setStep(STEP_UPLOAD)}
                  style={{ background: "none", border: "none", color: MUTED, fontSize: 13, cursor: "pointer", fontFamily: "'Inter',sans-serif", textDecoration: "underline" }}
                >
                  ← Re-upload and regenerate
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );

  return overlay;
}
