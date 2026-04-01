import { useState, useEffect, useRef, Fragment } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useBreakpoint } from "../lib/useBreakpoint";
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
import { PIE_CRITERIA, TEST_STATUSES, DEFAULT_STATUS, SCREENSHOT_ZONES, OVERLAY_TYPES, ACCENT, TEAL, BG, CARD, BORDER, TEXT, MUTED, DIM, IF_COLOR, THEN_COLOR, BECAUSE_COLOR } from "../lib/constants";
import { loadScreenshots } from "../db";

export default function TestDetailsPage({ tests, screenshotsMap, setScreenshotsMap, onUpdateTest, onDeleteTest, onSaveScreenshot, onClearScreenshot, clients }) {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isMobile, isTablet } = useBreakpoint();
  const { isPortal } = usePortal();
  const test = isPortal
    ? tests.find(t => toSlug(t.testName) === params.testSlug)
    : tests.find(t => t.id === Number(params.id));
  const id = test?.id;

  const [svgPreviewOpen, setSvgPreviewOpen] = useState(() => searchParams.get("template") === "1");
  const [svgPreviewZoom, setSvgPreviewZoom] = useState("fit");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [svgContent, setSvgContent] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [overlaysByVariant, setOverlaysByVariant] = useState(() => test?.overlays ?? {});
  const [activeVariant, setActiveVariant] = useState("B");
  const [editingOverlayId, setEditingOverlayId] = useState(null);
  const [editingNote, setEditingNote] = useState("");
  const [dragOverZone, setDragOverZone] = useState(null);
  const [hoveredZone, setHoveredZone] = useState(null);
  const zoneFileRef = useRef(null);
  const [uploadTargetZone, setUploadTargetZone] = useState(null);
  const lastDropTime = useRef(0);
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

  const [pagePdfLoading, setPagePdfLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);

  const handleDownloadDoc = async () => {
    setDocLoading(true);
    try {
      const {
        Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
        Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
        PageBreak, Spacing,
      } = await import("docx");
      const { saveAs } = await import("file-saver");

      const client = clients?.find(c => c.id === test.clientId);
      const scoreNum = Number(pieScore(test));
      const scoreLabelStr = scoreLabel(scoreNum);
      const children = [];

      // ── Helpers ──────────────────────────────────────────────────────
      const heading = (text, lvl = HeadingLevel.HEADING_2, color = "1B3A6B") =>
        new Paragraph({
          text,
          heading: lvl,
          spacing: { before: 280, after: 120 },
          run: { color },
        });

      const para = (runs, opts = {}) =>
        new Paragraph({ children: Array.isArray(runs) ? runs : [runs], spacing: { after: 120 }, ...opts });

      const run = (text, opts = {}) => new TextRun({ text: String(text ?? ""), font: "Calibri", size: 22, ...opts });

      const labelRun = (text) => run(text, { bold: true, color: "6B7280", size: 18, allCaps: true });

      const divider = () => new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "E5E7EB" } },
        spacing: { after: 160 },
      });

      const stripHtml = (html) => (html || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<li[^>]*>/gi, "• ")
        .replace(/<\/li>/gi, "\n")
        .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, (_, t) => `\n${t.replace(/<[^>]+>/g, "").toUpperCase()}\n`)
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      // ── Title block ──────────────────────────────────────────────────
      children.push(new Paragraph({
        children: [run(test.testName || "Untitled Test", { bold: true, size: 52, color: "1B3A6B" })],
        spacing: { after: 120 },
      }));

      const metaParts = [
        client ? `Client: ${client.name}` : null,
        test.status ? `Status: ${test.status}` : null,
        test.pageUrl ? `URL: ${test.pageUrl}` : null,
        `Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
      ].filter(Boolean);
      children.push(para(metaParts.map((p, i) => run(
        i < metaParts.length - 1 ? p + "   ·   " : p,
        { color: "6B7280", size: 18 }
      ))));

      // PIE score line
      children.push(para([
        run(`PIE Score: `, { bold: true, size: 22, color: "374151" }),
        run(`${scoreNum}  —  ${scoreLabelStr}`, { bold: true, size: 22, color: scoreColor(scoreNum).replace("#", "") }),
        ...(test.testType ? [run(`     |     Test Type: ${test.testType}`, { size: 22, color: "6B7280" })] : []),
        ...(test.audience ? [run(`     |     Audience: ${test.audience}`, { size: 22, color: "6B7280" })] : []),
      ]));
      children.push(divider());

      // ── Hypothesis ───────────────────────────────────────────────────
      if (test.if || test.then || test.because) {
        children.push(heading("Hypothesis"));
        const hypoBlocks = [
          { key: "if",      label: "IF — The Change",         color: IF_COLOR.replace("#", "") },
          { key: "then",    label: "THEN — Expected Outcome",  color: THEN_COLOR.replace("#", "") },
          { key: "because", label: "BECAUSE — The Rationale",  color: BECAUSE_COLOR.replace("#", "") },
        ];
        hypoBlocks.forEach(({ key, label, color }) => {
          if (!test[key]) return;
          children.push(para([run(label.toUpperCase(), { bold: true, size: 18, color, allCaps: true })]));
          children.push(para([run(test[key], { size: 22, color: "374151" })], {
            indent: { left: 360 },
            border: { left: { style: BorderStyle.THICK, size: 12, color } },
            spacing: { after: 160 },
          }));
        });
        children.push(divider());
      }

      // ── Findings ─────────────────────────────────────────────────────
      if (test.findings) {
        children.push(heading("Test Findings", HeadingLevel.HEADING_2, "15803D"));
        const plain = stripHtml(test.findings);
        plain.split("\n").forEach(line => {
          if (!line.trim()) return;
          const isBullet = line.startsWith("• ");
          children.push(new Paragraph({
            children: [run(line.replace(/^• /, ""), { size: 22 })],
            bullet: isBullet ? { level: 0 } : undefined,
            spacing: { after: 80 },
          }));
        });
        children.push(divider());
      }

      // ── Results ──────────────────────────────────────────────────────
      if (test.results?.goals?.length) {
        children.push(heading("Test Results", HeadingLevel.HEADING_2, "0E7490"));
        test.results.goals.forEach((goal, gi) => {
          children.push(para([run(`Goal ${gi + 1}: ${goal.name}`, { bold: true, size: 22, color: "1B3A6B" })]));
          const headerRow = new TableRow({
            children: ["Variant", "Visitors", "Conv. Rate", "Conversions", "Change"].map(h =>
              new TableCell({
                children: [para([run(h, { bold: true, size: 18, color: "6B7280" })])],
                shading: { type: ShadingType.SOLID, color: "F3F4F6", fill: "F3F4F6" },
                width: { size: 20, type: WidthType.PERCENTAGE },
              })
            ),
          });
          const dataRows = (goal.rows ?? []).map((row, ri) => {
            const isBaseline = ri === 0;
            const changeText = isBaseline ? "baseline" : `${row.change >= 0 ? "+" : ""}${(row.change ?? 0).toFixed(1)}%`;
            const changeColor = isBaseline ? "374151" : (row.change >= 0 ? "15803D" : "DC2626");
            return new TableRow({
              children: [
                row.variant,
                (row.visitors ?? 0).toLocaleString(),
                `${(row.rate ?? 0).toFixed(2)}%`,
                (row.conversions ?? 0).toLocaleString(),
                changeText,
              ].map((val, ci) => new TableCell({
                children: [para([run(val, { bold: isBaseline, size: 20, color: ci === 4 ? changeColor : "374151" })])],
                width: { size: 20, type: WidthType.PERCENTAGE },
              })),
            });
          });
          children.push(new Table({
            rows: [headerRow, ...dataRows],
            width: { size: 100, type: WidthType.PERCENTAGE },
          }));
          children.push(new Paragraph({ spacing: { after: 200 } }));
        });
        children.push(divider());
      }

      // ── PIE Breakdown ────────────────────────────────────────────────
      children.push(heading("PIE Score Breakdown"));
      PIE_CRITERIA.forEach(c => {
        const val = Number(test[c.key] ?? 0);
        children.push(para([
          run(`${c.label}  `, { bold: true, size: 22, color: c.color.replace("#", "") }),
          run(`${val}/10`, { bold: true, size: 22, color: c.color.replace("#", "") }),
          run(`   —   ${c.description}`, { size: 20, color: "6B7280" }),
        ]));
      });
      children.push(divider());

      // ── Metrics ──────────────────────────────────────────────────────
      if (test.primaryMetric || (test.secondaryMetrics || []).length > 0) {
        children.push(heading("Metrics"));
        if (test.primaryMetric) {
          children.push(para([
            run("Primary KPI:  ", { bold: true, size: 22 }),
            run(test.primaryMetric, { size: 22 }),
          ]));
        }
        if ((test.secondaryMetrics || []).length > 0) {
          children.push(para([
            run("Secondary:  ", { bold: true, size: 22 }),
            run(test.secondaryMetrics.join(", "), { size: 22, color: "6B7280" }),
          ]));
        }
        children.push(divider());
      }

      // ── Annotations ──────────────────────────────────────────────────
      const allOverlays = Object.entries(overlaysByVariant).flatMap(([variant, ovs]) =>
        (ovs ?? []).filter(o => !o.isClientNote).map(o => ({ ...o, _variant: variant }))
      );
      if (allOverlays.length > 0) {
        children.push(heading("Test Annotations"));
        allOverlays.forEach(o => {
          const zone = zoneForOverlay(o, test);
          children.push(para([
            run(`[${o._variant}]  ${o.label || ""}`, { bold: true, size: 22, color: (o.color || "#374151").replace("#", "") }),
            ...(zone ? [run(`  —  ${zone.label}`, { size: 20, color: "6B7280" })] : []),
          ]));
          if (o.note) {
            children.push(para([run(o.note, { size: 20, color: "374151" })], { indent: { left: 360 }, spacing: { after: 80 } }));
          }
        });
      }

      // ── Build & save ─────────────────────────────────────────────────
      const document = new Document({
        styles: {
          default: {
            document: { run: { font: "Calibri", size: 22 } },
          },
        },
        sections: [{ children }],
      });

      const blob = await Packer.toBlob(document);
      saveAs(blob, `${(test.testName || "test").replace(/[^a-z0-9]/gi, "-")}.docx`);
    } catch (e) {
      console.error("Doc error:", e);
      alert(`Document generation failed: ${e.message}`);
    } finally {
      setDocLoading(false);
    }
  };

  const handleDownloadPagePDF = async () => {
    setPagePdfLoading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { jsPDF } = await import("jspdf");
      const el = document.getElementById("test-details-content");
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#F4F6FA" });
      const ptW = 595.28;
      const ptH = (canvas.height / canvas.width) * ptW;
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: [ptW, ptH] });
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, ptW, ptH);
      pdf.save(`${test.testName || "test"}.pdf`);
    } catch (e) { console.error("Page PDF error:", e); }
    finally { setPagePdfLoading(false); }
  };

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      const shots = screenshotsMap[test.id] || {};
      const { zones } = computeSVGZones(test);
      await makePdfFromSvg(
        generateSVG(test, shots, overlaysByVariant),
        `${test.testName || "test-hypothesis"}.pdf`,
        shots,
        zones
      );
    } catch (e) { console.error("PDF error:", e); }
    finally { setPdfLoading(false); }
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
              <button onClick={() => navigate(`/portal/${client.portalToken}`)}
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

      <div id="test-details-content" style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "20px 16px" : "36px 28px" }}>
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
          {test.testType && <span style={{ fontSize: 12, fontWeight: 600, color: ACCENT, background: "#F0F4FA", border: `1px solid #C0CFEA`, borderRadius: 5, padding: "4px 10px" }}><span style={{ fontWeight: 500, opacity: 0.65, marginRight: 4 }}>Type</span>{test.testType}</span>}
          {test.audience && <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 5, padding: "4px 10px" }}><span style={{ fontWeight: 500, opacity: 0.65, marginRight: 4 }}>Audience</span>{test.audience}</span>}
          {test.primaryMetric && <span style={{ fontSize: 12, fontWeight: 600, color: TEAL, background: "#F0FAFA", border: `1px solid #A8D8D8`, borderRadius: 5, padding: "4px 10px" }}><span style={{ fontWeight: 500, opacity: 0.65, marginRight: 4 }}>KPI</span>{test.primaryMetric}</span>}
          <span style={{ fontSize: 12, color: DIM, fontWeight: 500, padding: "4px 0" }}>Updated {fmtDate(test.updatedAt)}</span>
        </div>

        {/* Action row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
          <button
            onClick={openPreview}
            style={{ background: TEAL, color: "#fff", border: "none", borderRadius: 7, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", gap: 7 }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <circle cx="8" cy="8" r="2" stroke="white" strokeWidth="1.5"/>
            </svg>
            View Visualization
          </button>
          <button
            onClick={handleDownloadPagePDF}
            disabled={pagePdfLoading}
            style={{ background: CARD, color: TEXT, border: `1.5px solid ${BORDER}`, borderRadius: 7, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: pagePdfLoading ? "wait" : "pointer", fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", gap: 7, opacity: pagePdfLoading ? 0.7 : 1 }}
          >
            {pagePdfLoading ? (
              <><svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 1s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(0,0,0,.2)" strokeWidth="2"/><path d="M14 8a6 6 0 00-6-6" stroke={TEXT} strokeWidth="2" strokeLinecap="round"/></svg>Generating…</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="8" height="10" rx="1" stroke={TEXT} strokeWidth="1.5"/><path d="M10 4h2a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-1" stroke={TEXT} strokeWidth="1.5" strokeLinecap="round"/><path d="M5 9h4M5 7h4M5 11h2" stroke={TEXT} strokeWidth="1.2" strokeLinecap="round"/></svg>Download PDF</>
            )}
          </button>
          <button
            onClick={handleDownloadDoc}
            disabled={docLoading}
            style={{ background: CARD, color: TEXT, border: `1.5px solid ${BORDER}`, borderRadius: 7, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: docLoading ? "wait" : "pointer", fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", gap: 7, opacity: docLoading ? 0.7 : 1 }}
          >
            {docLoading ? (
              <><svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 1s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(0,0,0,.2)" strokeWidth="2"/><path d="M14 8a6 6 0 00-6-6" stroke={TEXT} strokeWidth="2" strokeLinecap="round"/></svg>Generating…</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke={TEXT} strokeWidth="1.5" strokeLinejoin="round"/><path d="M10 2v3h3" stroke={TEXT} strokeWidth="1.5" strokeLinejoin="round"/><path d="M5 8h6M5 11h4" stroke={TEXT} strokeWidth="1.2" strokeLinecap="round"/></svg>Download Document</>
            )}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "1fr 340px", gap: 24 }}>
          {/* Left column */}
          <div>
            {/* Findings — top of column when Test Running or Test Complete */}
            {(test.status === "Test Complete" || test.status === "Test Running") && (
              <div style={{ background: CARD, border: `1.5px solid ${test.status === "Test Running" ? "#A5F3FC" : "#BBF7D0"}`, borderRadius: 10, padding: 24, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: test.status === "Test Running" ? "#0E7490" : "#15803D", letterSpacing: 1.5, textTransform: "uppercase", flex: 1 }}>Test Findings</div>
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
                    <>
                      <button onClick={() => { onUpdateTest(Number(id), "findings", ""); setFindingsEditing(false); }} style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", background: "#FFF8F8", border: "1px solid #FECACA", borderRadius: 5, padding: "3px 10px", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Clear</button>
                      <button onClick={() => setFindingsEditing(false)} style={{ fontSize: 11, fontWeight: 700, color: test.status === "Test Running" ? "#0E7490" : "#15803D", background: test.status === "Test Running" ? "#ECFEFF" : "#F0FDF4", border: `1px solid ${test.status === "Test Running" ? "#A5F3FC" : "#BBF7D0"}`, borderRadius: 5, padding: "3px 10px", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Done</button>
                    </>
                  ) : (
                    <button onClick={() => setFindingsEditing(true)} style={{ fontSize: 11, fontWeight: 700, color: test.status === "Test Running" ? "#0E7490" : "#15803D", background: test.status === "Test Running" ? "#ECFEFF" : "#F0FDF4", border: `1px solid ${test.status === "Test Running" ? "#A5F3FC" : "#BBF7D0"}`, borderRadius: 5, padding: "3px 10px", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>✎ Edit</button>
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

            {/* Results — top of column when Test Running or Test Complete */}
            {(test.status === "Test Complete" || test.status === "Test Running") && (
              <div style={{ background: CARD, border: `1.5px solid ${test.status === "Test Running" ? "#A5F3FC" : "#BBF7D0"}`, borderRadius: 10, padding: 24, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: test.status === "Test Running" ? "#0E7490" : "#15803D", letterSpacing: 1.5, textTransform: "uppercase", flex: 1 }}>Test Results</div>
                  {test.results && (
                    <span style={{ fontSize: 11, color: test.status === "Test Running" ? "#0E7490" : "#15803D", fontWeight: 500, background: test.status === "Test Running" ? "#ECFEFF" : "#F0FDF4", border: `1px solid ${test.status === "Test Running" ? "#A5F3FC" : "#BBF7D0"}`, borderRadius: 5, padding: "2px 9px" }}>
                      {test.results.goals?.length} goals · {test.results.variantOrder?.length} variants
                    </span>
                  )}
                </div>
                <TestResults results={test.results ?? null} onImport={(parsed) => onUpdateTest(Number(id), "results", parsed)} onClear={() => onUpdateTest(Number(id), "results", null)} />
              </div>
            )}

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

            {/* Test Type */}
            <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: 24, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Test Type</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: test.testType ? ACCENT : DIM }}>{test.testType || <em style={{ fontWeight: 400 }}>Not set</em>}</div>
            </div>

            {/* Audience */}
            <div style={{ background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: 24, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Audience</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>Segment</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: test.audience ? TEXT : DIM }}>{test.audience || <em style={{ fontWeight: 400 }}>Not set</em>}</div>
                </div>
                {test.pageUrl && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>Page URL</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: TEAL, wordBreak: "break-all" }}>{test.pageUrl}</div>
                  </div>
                )}
              </div>
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
            {/* Client Notes */}
            {(() => {
              const clientNotes = activeOverlays.filter(o => o.isClientNote);
              return (
                <div style={{ background: CARD, border: "1.5px solid #DDD6FE", borderRadius: 10, padding: 18, marginBottom: 16, boxShadow: "0 1px 4px rgba(124,58,237,.08)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: clientNotes.length ? 12 : 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", letterSpacing: 1.5, textTransform: "uppercase", flex: 1 }}>Client Notes</div>
                    {clientNotes.length > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#7C3AED", background: "#EDE9FE", borderRadius: 8, padding: "1px 7px" }}>{clientNotes.length}</span>
                    )}
                  </div>
                  {clientNotes.length === 0 ? (
                    <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>No client notes yet.<br/><span style={{ fontSize: 11 }}>Open the template view to drag a note onto the page.</span></div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {clientNotes.map(o => (
                        <div key={o.id} style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 6, padding: "8px 10px" }}>
                          <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.5, marginBottom: 4 }}>{o.note || <span style={{ color: MUTED, fontStyle: "italic" }}>No note text</span>}</div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <button
                              onClick={() => { setSvgPreviewOpen(true); setTimeout(() => { setEditingNote(o.note || ""); setEditingOverlayId(o.id); }, 100); }}
                              style={{ fontSize: 10, fontWeight: 600, color: "#7C3AED", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'Inter',sans-serif" }}
                            >Edit</button>
                            <button
                              onClick={() => updateActiveOverlays(prev => prev.filter(x => x.id !== o.id))}
                              style={{ fontSize: 10, color: MUTED, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'Inter',sans-serif" }}
                            >Remove</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

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

              {/* Placed overlays for active variant (excludes Client Notes) */}
              {activeOverlays.filter(o => !o.isClientNote).length === 0 ? (
                <div style={{ fontSize: 12, color: MUTED, textAlign: "center", padding: "16px 0", lineHeight: 1.5 }}>
                  No overlays placed.<br/>
                  <span style={{ fontSize: 11 }}>Open the SVG preview to drag overlays onto the template.</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {activeOverlays.filter(o => !o.isClientNote).map(o => {
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
                  {OVERLAY_TYPES.filter(o => !o.isClientNote).map(o => (
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
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{test.testName || "Untitled Test"}</div>
              <div style={{ fontSize: 11, color: "#8BA4C8", marginTop: 1 }}>Test Visualization</div>
            </div>
            <button onClick={handleDownloadPDF} disabled={pdfLoading}
              style={{ background: ACCENT, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: pdfLoading ? "wait" : "pointer", fontFamily: "'Inter',sans-serif", opacity: pdfLoading ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
              {pdfLoading ? (
                <><svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 1s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,.3)" strokeWidth="2"/><path d="M14 8a6 6 0 00-6-6" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>Generating…</>
              ) : <>⬇ Download PDF</>}
            </button>
            <button onClick={() => setSvgPreviewOpen(false)}
              style={{ background: "none", border: "1px solid #2E3F5C", color: "#8BA4C8", padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
              Close
            </button>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", overflow: "hidden" }}>
            <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "12px" : "20px", boxSizing: "border-box" }}>
              <div
                style={{ position: "relative", display: "block", width: "100%" }}
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
                {/* Screenshot drop zones — drag/drop + click to upload + remove */}
                <input
                  ref={zoneFileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={e => {
                    const file = e.target.files[0];
                    if (!file || !uploadTargetZone) return;
                    const reader = new FileReader();
                    reader.onload = ev => onSaveScreenshot(Number(id), uploadTargetZone, ev.target.result);
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }}
                />
                {test && (() => {
                  const { W, totalH, zones } = computeSVGZones(test);
                  return zones.map(zone => {
                    const hasShot = !!screenshots[zone.key];
                    const isDragOver = dragOverZone === zone.key;
                    const isHovered = hoveredZone === zone.key;
                    return (
                      <div
                        key={zone.key}
                        onMouseEnter={() => setHoveredZone(zone.key)}
                        onMouseLeave={() => setHoveredZone(null)}
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
                          background: isDragOver ? "rgba(42,140,140,0.25)" : "transparent",
                          border: isDragOver ? "2px dashed #2A8C8C" : "2px solid transparent",
                          transition: "background 0.15s, border-color 0.15s",
                          zIndex: 5,
                          pointerEvents: "all",
                        }}
                      >
                        {/* Drag-over label */}
                        {isDragOver && (
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#2A8C8C", background: "rgba(13,21,32,0.85)", padding: "8px 16px", borderRadius: 6, fontFamily: "'Inter',sans-serif" }}>
                              Drop to set {zone.label}
                            </div>
                          </div>
                        )}
                        {/* Hover controls */}
                        {!isDragOver && isHovered && (
                          hasShot ? (
                            /* Remove button — top-right corner */
                            <button
                              onClick={e => { e.stopPropagation(); onClearScreenshot(Number(id), zone.key); }}
                              title="Remove screenshot"
                              style={{
                                position: "absolute", top: 6, right: 6,
                                width: 26, height: 26, borderRadius: 5,
                                background: "rgba(0,0,0,.72)", border: "none",
                                color: "#fff", fontSize: 15, lineHeight: "26px",
                                textAlign: "center", cursor: "pointer", padding: 0,
                              }}
                            >×</button>
                          ) : (
                            /* Upload button — centred */
                            <button
                              onClick={e => { e.stopPropagation(); setUploadTargetZone(zone.key); zoneFileRef.current?.click(); }}
                              title="Upload screenshot"
                              style={{
                                position: "absolute", inset: 0, width: "100%", height: "100%",
                                background: "rgba(13,21,32,0.45)", border: "none",
                                cursor: "pointer", display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 6,
                              }}
                            >
                              <span style={{ fontSize: 22, opacity: 0.9 }}>↑</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "'Inter',sans-serif" }}>Upload screenshot</span>
                            </button>
                          )
                        )}
                      </div>
                    );
                  });
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
                        e.dataTransfer.setData("overlayType", JSON.stringify({ label: p.label, color: p.color, isAnnotation: p.isAnnotation, isClientNote: p.isClientNote }));
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
                        {p.isClientNote && (
                          <button
                            onClick={() => {
                              updateActiveOverlays(prev => prev.map(x => x.id === p.id ? { ...x, resolved: !x.resolved } : x));
                              setEditingOverlayId(null);
                            }}
                            style={{ width: "100%", marginTop: 6, background: p.resolved ? "#1A2540" : "#0F2A1A", border: `1px solid ${p.resolved ? "#3B2A5C" : "#166534"}`, color: p.resolved ? "#9F7AEA" : "#4ADE80", padding: "6px 0", borderRadius: 5, fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                          >
                            {p.resolved ? "↩ Unresolve" : "✓ Mark Resolved"}
                          </button>
                        )}
                        <div style={{ marginTop: 8, fontSize: 9, color: "#3A5070" }}>Enter to save · Esc to cancel</div>
                      </div>
                    )}
                  </Fragment>
                ))}
              </div>
            </div>
            <div style={isMobile ? { width: "100%", flexShrink: 0, background: "#111B2E", borderTop: "1px solid #2E3F5C", overflowY: "auto", maxHeight: "45vh", padding: "12px 14px" } : { width: 260, flexShrink: 0, background: "#111B2E", borderLeft: "1px solid #2E3F5C", overflowY: "auto", padding: "16px 14px" }}>

              {/* Client Notes */}
              <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #1E2F48" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#7C3AED", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Client Notes</div>
                <div style={{ fontSize: 10, color: "#3A5070", lineHeight: 1.6, marginBottom: 10 }}>Drag onto the template to pin a note. Click a marker to edit.</div>
                <div
                  draggable
                  onDragStart={e => e.dataTransfer.setData("overlayType", JSON.stringify({ label: "Client Note", color: "#7C3AED", isClientNote: true }))}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 6, background: "#1A2540", border: "1px solid #3B2A5C", marginBottom: 10, cursor: "grab", userSelect: "none" }}
                >
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: "#7C3AED", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "#C8D8EE", fontWeight: 500 }}>Client Note</span>
                </div>
                {activeOverlays.filter(o => o.isClientNote).map(o => (
                  <div key={o.id} style={{ background: o.resolved ? "#0E1520" : "#160F2A", border: `1px solid ${o.resolved ? "#1E2F48" : "#3B2A5C"}`, borderRadius: 6, padding: "8px 10px", marginBottom: 6, opacity: o.resolved ? 0.6 : 1 }}>
                    <div style={{ fontSize: 11, color: o.resolved ? "#4A6080" : "#C8B8F0", lineHeight: 1.5, marginBottom: 4, textDecoration: o.resolved ? "line-through" : "none" }}>{o.note || <span style={{ color: "#4A3A6A", fontStyle: "italic" }}>No note yet</span>}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => { setEditingNote(o.note || ""); setEditingOverlayId(o.id); }}
                        style={{ fontSize: 10, color: "#9F7AEA", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'Inter',sans-serif" }}
                      >Edit</button>
                      <button
                        onClick={() => updateActiveOverlays(prev => prev.map(x => x.id === o.id ? { ...x, resolved: !x.resolved } : x))}
                        style={{ fontSize: 10, color: o.resolved ? "#9F7AEA" : "#4ADE80", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'Inter',sans-serif" }}
                      >{o.resolved ? "↩ Unresolve" : "✓ Resolve"}</button>
                    </div>
                  </div>
                ))}
                {activeOverlays.filter(o => o.isClientNote).length > 0 && (
                  <button
                    onClick={() => updateActiveOverlays(prev => prev.filter(o => !o.isClientNote))}
                    style={{ width: "100%", marginTop: 2, background: "none", border: "1px solid #2E3F5C", color: "#5A7AAA", padding: "5px 0", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                  >Clear notes ({activeOverlays.filter(o => o.isClientNote).length})</button>
                )}
              </div>

              {/* Overlay Items */}
              <div style={{ marginTop: 16, borderTop: "1px solid #1E2F48", paddingTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#5A7AAA", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Overlay Items — Variant {activeVariant}</div>
                <div style={{ fontSize: 10, color: "#3A5070", lineHeight: 1.6, marginBottom: 12 }}>Drag onto the variant view to annotate changes. Click a marker to edit.</div>
                {OVERLAY_TYPES.filter(o => !o.isClientNote).map(o => (
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
                {activeOverlays.filter(o => !o.isClientNote).length > 0 && (
                  <button
                    onClick={() => updateActiveOverlays(prev => prev.filter(o => o.isClientNote))}
                    style={{ width: "100%", marginTop: 6, background: "none", border: "1px solid #2E3F5C", color: "#5A7AAA", padding: "6px 0", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                  >
                    Clear overlays ({activeOverlays.filter(o => !o.isClientNote).length})
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
