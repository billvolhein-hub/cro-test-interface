import { useEffect, useRef, useState } from "react";

// ── Helpers ────────────────────────────────────────────────────────────────────

// Distribute N points evenly around a sphere at given radius
function ringPos(i, total, radius) {
  // Use Fibonacci sphere for even distribution
  const phi   = Math.acos(1 - (2 * (i + 0.5)) / total);
  const theta = Math.PI * (1 + Math.sqrt(5)) * i;
  return {
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.sin(phi) * Math.sin(theta),
    z: radius * Math.cos(phi),
  };
}

function nodeColor(n) {
  if (n._external) return "#3B82F6";
  const status = String(n.status ?? "");
  if (!status || status === "0") return "#6B7280";
  if (status.startsWith("3")) return "#F59E0B";
  if (status.startsWith("4")) return "#DC2626";
  if (status.startsWith("5")) return "#7C3AED";
  if (status === "200" && n.index) {
    const greens = ["#16A34A", "#22C55E", "#4ADE80", "#86EFAC", "#BBF7D0"];
    return greens[Math.min(n.depth ?? 0, greens.length - 1)];
  }
  return "#DC2626";
}

function buildGraph(rawNodes, ahrefsData) {
  if (!rawNodes?.length) return { nodes: [], links: [] };

  let origin = "";
  try { origin = new URL(rawNodes[0].url).origin; } catch { origin = "root"; }

  const urlSet     = new Set(rawNodes.map(n => n.url));
  const statusByUrl = new Map(rawNodes.map(n => [n.url, String(n.status || "?")]));
  const gNodes = [{ id: origin, url: origin, title: origin, status: "200", index: true, depth: 0, inlinks: 0 }];
  rawNodes.forEach(n => gNodes.push({ ...n, id: n.url }));

  const links = [];
  rawNodes.forEach(n => {
    let parentId = origin;
    try {
      const u = new URL(n.url);
      const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
      if (parts.length > 0) {
        for (let i = parts.length - 1; i >= 0; i--) {
          if (i === 0) { parentId = origin; break; }
          const c1 = `${u.origin}/${parts.slice(0, i).join("/")}`;
          const c2 = `${u.origin}/${parts.slice(0, i).join("/")}/`;
          if (urlSet.has(c1)) { parentId = c1; break; }
          if (urlSet.has(c2)) { parentId = c2; break; }
        }
      }
    } catch { /* keep origin */ }
    if (parentId !== n.url) links.push({ source: parentId, target: n.url, _external: false });
  });

  // ── Ahrefs backlinks ───────────────────────────────────────────────────────
  const blItems    = ahrefsData?.data?.backlinks?.backlinks ?? [];
  const refDomains = ahrefsData?.data?.refs?.refdomains    ?? [];

  // Build DR lookup from refdomains
  const drByDomain = new Map(refDomains.map(r => [r.domain, r.domain_rating ?? 0]));

  if (blItems.length > 0) {
    // Page-level: each backlink domain → specific internal page
    const domainMap = new Map();
    for (const bl of blItems) {
      const { domain_from, url_to } = bl;
      if (!domain_from || !url_to) continue;
      if (!domainMap.has(domain_from)) {
        domainMap.set(domain_from, { dr: drByDomain.get(domain_from) ?? 0, targets: new Map() });
      }
      const resolvedUrl = urlSet.has(url_to) ? url_to : urlSet.has(url_to + "/") ? url_to + "/" : origin;
      const status = statusByUrl.get(resolvedUrl) ?? "?";
      domainMap.get(domain_from).targets.set(resolvedUrl, status);
    }
    const extEntries = [...domainMap.entries()];
    extEntries.forEach(([domain, { dr, targets }], i) => {
      const extId = `__ext__${domain}`;
      const { x, y, z } = ringPos(i, extEntries.length, 1200);
      // _targets: [{url, path, status}] for card display (max 5)
      const _targets = [...targets.entries()].slice(0, 5).map(([url, status]) => ({
        url, status, path: url === origin ? "/" : (url.replace(origin, "") || "/"),
      }));
      gNodes.push({ id: extId, url: `https://${domain}`, title: domain, status: "ext", index: false, depth: 0, inlinks: 0, _external: true, _dr: dr, _targets, x, y, z });
      for (const target of targets.keys()) links.push({ source: extId, target, _external: true });
    });
  } else if (refDomains.length > 0) {
    // Fallback: domain-level only, connect to root
    refDomains.forEach((r, i) => {
      if (!r.domain) return;
      const extId = `__ext__${r.domain}`;
      const { x, y, z } = ringPos(i, refDomains.length, 1200);
      const rootStatus = statusByUrl.get(origin) ?? "200";
      const _targets = [{ url: origin, path: "/", status: rootStatus }];
      gNodes.push({ id: extId, url: `https://${r.domain}`, title: r.domain, status: "ext", index: false, depth: 0, inlinks: 0, _external: true, _dr: r.domain_rating ?? 0, _targets, x, y, z });
      links.push({ source: extId, target: origin, _external: true });
    });
  }

  return { nodes: gNodes, links };
}

// ── Legend ─────────────────────────────────────────────────────────────────────
function Legend() {
  const items = [
    { color: "#16A34A", label: "Indexable (depth 0–1)" },
    { color: "#4ADE80", label: "Indexable (depth 2–3)" },
    { color: "#86EFAC", label: "Indexable (depth 4+)" },
    { color: "#F59E0B", label: "Redirect (3xx)" },
    { color: "#DC2626", label: "Non-indexable / 4xx" },
    { color: "#7C3AED", label: "Server Error (5xx)" },
    { color: "#6B7280", label: "Unknown / not crawled" },
    { color: "#3B82F6", label: "External backlink domain" },
  ];
  return (
    <div style={{ position: "absolute", bottom: 24, left: 24, background: "rgba(0,0,0,.72)", borderRadius: 8, padding: "12px 16px", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,.12)" }}>
      {items.map(({ color, label }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "#D1D5DB", fontFamily: "'Inter',sans-serif" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Stats bar ──────────────────────────────────────────────────────────────────
function StatsBar({ nodes, ahrefsData }) {
  if (!nodes?.length) return null;
  const indexable    = nodes.filter(n => String(n.status) === "200" && n.index).length;
  const nonIndexable = nodes.length - indexable;
  const avgDepth     = (nodes.reduce((s, n) => s + (n.depth ?? 0), 0) / nodes.length).toFixed(1);
  const orphans      = nodes.filter(n => n.inlinks === 0 && (n.depth ?? 0) > 0).length;
  const blItems      = ahrefsData?.data?.backlinks?.backlinks ?? [];
  const refDomains   = ahrefsData?.data?.refs?.refdomains ?? [];
  const extCount     = blItems.length > 0
    ? new Set(blItems.map(b => b.domain_from).filter(Boolean)).size
    : refDomains.length;
  const stats = [
    { label: "Total URLs",    value: nodes.length.toLocaleString() },
    { label: "Indexable",     value: indexable.toLocaleString(),    color: "#4ADE80" },
    { label: "Non-indexable", value: nonIndexable.toLocaleString(), color: "#FCA5A5" },
    { label: "Avg Depth",     value: avgDepth },
    { label: "Orphaned",      value: orphans.toLocaleString(),      color: "#FCD34D" },
    ...(extCount > 0 ? [{ label: "Ext. Domains", value: extCount.toLocaleString(), color: "#93C5FD" }] : []),
  ];
  return (
    <div style={{ position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 2, background: "rgba(0,0,0,.72)", borderRadius: 8, padding: "8px 16px", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,.12)", whiteSpace: "nowrap" }}>
      {stats.map(({ label, value, color }, i) => (
        <div key={label} style={{ textAlign: "center", padding: "0 14px", borderRight: i < stats.length - 1 ? "1px solid rgba(255,255,255,.12)" : "none" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: color || "#F9FAFB", fontFamily: "'Inter',sans-serif" }}>{value}</div>
          <div style={{ fontSize: 9, color: "#9CA3AF", fontFamily: "'Inter',sans-serif", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// Decide whether a hex color is light (needs dark text) or dark (needs white text)
function isLightColor(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Perceived luminance (WCAG formula)
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160;
}

// ── Tooltip ────────────────────────────────────────────────────────────────────
function Tooltip({ node, pos }) {
  if (!node) return null;
  const color = nodeColor(node);
  const light = isLightColor(color);
  const textPrimary   = light ? "#111827" : "#ffffff";
  const textSecondary = light ? "rgba(0,0,0,.7)" : "rgba(255,255,255,.85)";
  const textMeta      = light ? "rgba(0,0,0,.85)" : "rgba(255,255,255,.95)";
  const border        = light ? "rgba(0,0,0,.15)" : "rgba(255,255,255,.2)";
  const isIndexable   = String(node.status) === "200" && node.index;
  return (
    <div style={{ position: "fixed", left: pos.x + 14, top: pos.y - 10, background: color, borderRadius: 8, padding: "10px 14px", maxWidth: 340, pointerEvents: "none", zIndex: 9999, boxShadow: "0 4px 24px rgba(0,0,0,.5)", border: `1px solid ${border}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: textPrimary, wordBreak: "break-all", marginBottom: node.title ? 4 : 6, fontFamily: "'Inter',sans-serif", lineHeight: 1.4 }}>
        {node.url}
      </div>
      {node.title && (
        <div style={{ fontSize: 10, color: textSecondary, marginBottom: 6, fontFamily: "'Inter',sans-serif" }}>
          {node.title}
        </div>
      )}
      {node._external ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 12px" }}>
          <span style={{ fontSize: 10, color: textMeta, fontFamily: "'Inter',sans-serif" }}><b>Type:</b> External domain</span>
          <span style={{ fontSize: 10, color: textMeta, fontFamily: "'Inter',sans-serif" }}><b>DR:</b> {node._dr ?? "—"}</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 12px" }}>
          {[["Status", node.status || "—"], ["Depth", node.depth ?? 0], ["Inlinks", node.inlinks ?? 0], ["Indexable", isIndexable ? "Yes" : "No"]].map(([k, v]) => (
            <span key={k} style={{ fontSize: 10, color: textMeta, fontFamily: "'Inter',sans-serif" }}><b>{k}:</b> {v}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────
export default function DirectoryTreeModal({ nodes: rawNodes, ahrefsData, onClose }) {
  const mountRef    = useRef(null);
  const graphRef    = useRef(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const dragRef     = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const [hoveredNode,    setHoveredNode]    = useState(null);
  const [tooltipPos,     setTooltipPos]     = useState({ x: 0, y: 0 });
  const [ready,          setReady]          = useState(false);
  const [fullscreen,     setFullscreen]     = useState(false);
  const [pos,            setPos]            = useState({ x: 0, y: 0 });
  const [showBacklinks,  setShowBacklinks]  = useState(true);
  const showBacklinksRef = useRef(true);

  const hasBacklinks = !!(ahrefsData?.data?.refs?.refdomains?.length || ahrefsData?.data?.backlinks?.backlinks?.length);

  const toggleBacklinks = () => {
    const next = !showBacklinksRef.current;
    showBacklinksRef.current = next;
    setShowBacklinks(next);
    if (graphRef.current) {
      graphRef.current
        .nodeVisibility(node => !node._external || next)
        .linkVisibility(link => !link._external || next);
    }
  };

  const startDrag = (e) => {
    if (fullscreen) return;
    e.preventDefault();
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    const onMove = (ev) => {
      if (!dragRef.current.dragging) return;
      setPos({ x: dragRef.current.origX + ev.clientX - dragRef.current.startX, y: dragRef.current.origY + ev.clientY - dragRef.current.startY });
    };
    const onUp = () => {
      dragRef.current.dragging = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  useEffect(() => {
    const onMove = (e) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      setTooltipPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [{ default: ForceGraph3D }, { default: SpriteText }] = await Promise.all([
        import("3d-force-graph"),
        import("three-spritetext"),
      ]);
      if (cancelled || !mountRef.current) return;

      const graphData = buildGraph(rawNodes, ahrefsData);

      // Which internal node IDs receive external backlinks?
      const backlinkTargets = new Set(
        graphData.links.filter(l => l._external).map(l => l.target)
      );

      const fg = ForceGraph3D({ antialias: true, alpha: false })(mountRef.current)
        .width(mountRef.current.clientWidth)
        .height(mountRef.current.clientHeight)
        .backgroundColor("#1a1a2e")
        .graphData(graphData)
        .nodeLabel(() => "")
        .nodeColor(n => nodeColor(n))
        .nodeOpacity(0.92)
        .nodeVal(n => {
          if (n._external) return Math.max(2, (n._dr ?? 0) * 0.05 + 2);
          return Math.max(1, (n.inlinks || 0) * 0.4 + 1.5);
        })
        // ── Custom node rendering ──────────────────────────────────────────
        .nodeThreeObject(node => {
          if (node._external) {
            // Build card text: domain + DR + each linked page with status
            const targets = node._targets ?? [];
            const targetLines = targets.map(t => {
              const statusOk = t.status.startsWith("2");
              const icon = statusOk ? "✓" : "✗";
              // Show path, label homepage explicitly
              const label = t.path === "/" || t.path === "" ? "(homepage)" : t.path.length > 34 ? t.path.slice(0, 32) + "…" : t.path;
              return `${icon} ${label}  [${t.status}]`;
            });
            const lines = [node.title, `DR ${node._dr ?? "?"}`, "── Links to ──", ...targetLines];
            const cardText = lines.join("\n");
            const sprite = new SpriteText(cardText);
            sprite.color = "#DBEAFE";
            sprite.backgroundColor = "rgba(29,78,216,0.88)";
            sprite.padding = 6;
            sprite.textHeight = 2.8;
            sprite.borderRadius = 4;
            sprite.fontFace = "Inter, sans-serif";
            return sprite;
          }
          if (backlinkTargets.has(node.id)) {
            // Status badge for internal pages that receive backlinks
            const status = String(node.status || "?");
            const ok = status.startsWith("2");
            const sprite = new SpriteText(status);
            sprite.color = ok ? "#4ADE80" : "#FCA5A5";
            sprite.backgroundColor = ok ? "rgba(0,60,20,0.75)" : "rgba(80,0,0,0.75)";
            sprite.padding = 3;
            sprite.textHeight = 3.5;
            sprite.fontWeight = "800";
            sprite.borderRadius = 3;
            sprite.fontFace = "Inter, sans-serif";
            return sprite;
          }
          return undefined; // default sphere
        })
        // extend=true adds label on top of sphere; false replaces sphere with label
        .nodeThreeObjectExtend(node => !node._external)
        // ── Links ──────────────────────────────────────────────────────────
        .linkColor(l => l._external ? "rgba(59,130,246,0.8)" : "rgba(255,255,255,0.55)")
        .linkWidth(l => l._external ? 1.5 : 0.8)
        .linkOpacity(0.9)
        // ── Interaction ────────────────────────────────────────────────────
        .onNodeHover(node => {
          setHoveredNode(node || null);
          if (mountRef.current) mountRef.current.style.cursor = node ? "pointer" : "default";
        })
        .onNodeClick(node => {
          if (node.url && node.url !== node.id) window.open(node.url, "_blank");
        });

      // Keep external nodes far from the cluster
      fg.d3Force("charge").strength(node => node._external ? -800 : -30);
      // Long link distance for external links keeps cards away from the internal cluster
      fg.d3Force("link").distance(link => link._external ? 900 : 30);

      setTimeout(() => { if (!cancelled) { fg.zoomToFit(800, 80); setReady(true); } }, 2500);
      graphRef.current = fg;
    })();

    const onResize = () => {
      if (graphRef.current && mountRef.current)
        graphRef.current.width(mountRef.current.clientWidth).height(mountRef.current.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      try { graphRef.current?._destructor?.(); } catch {}
      graphRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const modalStyle = fullscreen
    ? { position: "fixed", inset: 0, zIndex: 2000, background: "#1a1a2e", fontFamily: "'Inter',sans-serif" }
    : { position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)", fontFamily: "'Inter',sans-serif" };

  const innerStyle = fullscreen
    ? { position: "absolute", inset: 0, background: "#1a1a2e", overflow: "hidden" }
    : { position: "relative", width: "80%", height: "80vh", background: "#1a1a2e", borderRadius: 12, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,.7)", border: "1px solid rgba(255,255,255,.1)", transform: `translate(${pos.x}px, ${pos.y}px)`, transition: dragRef.current.dragging ? "none" : "box-shadow .2s" };

  return (
    <div style={modalStyle} onClick={e => { if (!fullscreen && e.target === e.currentTarget) onClose(); }}>
    <div style={innerStyle}>
      <div
        onMouseDown={startDrag}
        style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", background: "rgba(0,0,0,.5)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,.1)", cursor: fullscreen ? "default" : "grab", userSelect: "none" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#F9FAFB" }}>Site Directory Tree</div>
          <div style={{ fontSize: 10, color: "#6B7280" }}>3D Force-Directed Graph · blue cards = external backlink domains · status badge = backlinked page · click to open URL</div>
        </div>
        <button onClick={() => graphRef.current?.zoomToFit(600, 80)}
          style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", color: "#D1D5DB", padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
          Zoom to Fit
        </button>
        {hasBacklinks && (
          <button onClick={toggleBacklinks}
            style={{ background: showBacklinks ? "rgba(59,130,246,.25)" : "rgba(255,255,255,.1)", border: `1px solid ${showBacklinks ? "rgba(59,130,246,.6)" : "rgba(255,255,255,.2)"}`, color: showBacklinks ? "#93C5FD" : "#9CA3AF", padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
            {showBacklinks ? "⬡ Hide Backlinks" : "⬡ Show Backlinks"}
          </button>
        )}
        <button onClick={() => { setFullscreen(f => !f); if (!fullscreen) setPos({ x: 0, y: 0 }); setTimeout(() => { graphRef.current?.width(mountRef.current?.clientWidth).height(mountRef.current?.clientHeight); graphRef.current?.zoomToFit(400, 60); }, 50); }}
          style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", color: "#D1D5DB", padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
          {fullscreen ? "⊡ Exit Fullscreen" : "⛶ Fullscreen"}
        </button>
        <button onClick={onClose}
          style={{ background: "rgba(220,38,38,.15)", border: "1px solid rgba(220,38,38,.3)", color: "#FCA5A5", padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
          ✕ Close
        </button>
      </div>

      <StatsBar nodes={rawNodes} ahrefsData={ahrefsData} />

      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

      {!ready && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 5 }}>
          <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,.1)", borderTopColor: "#4ADE80", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: 16 }} />
          <div style={{ color: "#9CA3AF", fontSize: 12 }}>Building graph…</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      <Legend />
      <Tooltip node={hoveredNode} pos={tooltipPos} />

      <div style={{ position: "absolute", bottom: 24, right: 24, fontSize: 10, color: "#4B5563", textAlign: "right", lineHeight: 1.8 }}>
        Left-click + drag · Scroll to zoom · Right-click to pan
      </div>
    </div>
    </div>
  );
}
