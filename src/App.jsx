import { useState, useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { fetchAgencies } from "./lib/agencies";
import { fetchClients, fetchTests } from "./lib/api";
import { SuperAdminGate, PortalGate } from "./components/PasswordGate";
import { PortalContext } from "./context/PortalContext";
import { ACCENT, BG, MUTED } from "./lib/constants";

const SuperAdminPage  = lazy(() => import("./pages/SuperAdminPage"));
const AgencyWrapper   = lazy(() => import("./components/AgencyWrapper"));
const TestDetailsPage = lazy(() => import("./pages/TestDetailsPage"));
const ClientPage      = lazy(() => import("./pages/ClientPage"));

// ── Portal wrapper — looks up client by token, applies gate + context ─────────
function PortalTokenGate({ clients, screenshotsMap, setScreenshotsMap, onUpdateTest, onSaveScreenshot, onClearScreenshot, onUpdateClientBrand }) {
  const { portalToken } = useParams();
  const client = clients.find(c => c.portalToken === portalToken);
  return (
    <PortalGate client={client}>
      <PortalContext.Provider value={{ isPortal: true }}>
        {/* children rendered by the Route's element */}
        <ClientPage
          clients={clients}
          tests={[]}  // portal fetches its own
          onUpdateClientBrand={onUpdateClientBrand}
        />
      </PortalContext.Provider>
    </PortalGate>
  );
}

// ── Portal shell — fetches all clients (needed to resolve portalToken) ────────
function PortalShell({ children }) {
  const [clients, setClients]           = useState([]);
  const [tests,   setTests]             = useState([]);
  const [screenshotsMap, setScreenshotsMap] = useState({});
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    Promise.all([fetchClients(), fetchTests()]).then(([c, t]) => {
      setClients(c);
      setTests(t);
      setLoading(false);
    });
  }, []);

  if (loading) return <Spinner />;
  return children({ clients, tests, screenshotsMap, setScreenshotsMap });
}

// ── Super admin shell — loads agencies ───────────────────────────────────────
function SuperAdminShell() {
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchAgencies()
      .then(a => { setAgencies(a); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  if (loading) return <Spinner />;
  if (error) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif", gap: 12, padding: 24 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#DC2626" }}>Setup Required</div>
      <div style={{ fontSize: 13, color: MUTED, maxWidth: 480, textAlign: "center" }}>
        The <code>agencies</code> table is missing. Run the setup SQL in your Supabase dashboard, then refresh.
      </div>
      <div style={{ fontSize: 11, color: "#EF4444", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 14px", maxWidth: 480, wordBreak: "break-all" }}>
        {error}
      </div>
      <button onClick={load} style={{ marginTop: 8, padding: "8px 20px", borderRadius: 7, border: "none", background: ACCENT, color: "#fff", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        Retry
      </button>
    </div>
  );
  return (
    <SuperAdminGate>
      <SuperAdminPage agencies={agencies} onAgenciesChange={load} />
    </SuperAdminGate>
  );
}

function Spinner() {
  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif", color: MUTED, fontSize: 14 }}>
      Loading…
    </div>
  );
}

// ── Root app ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Spinner />}>
        <Routes>
          {/* Platform admin — manage agencies */}
          <Route path="/" element={<SuperAdminShell />} />

          {/* Client portals — unchanged, accessed by portalToken UUID */}
          <Route path="/portal/:portalToken" element={
            <PortalShell>
              {({ clients, tests, screenshotsMap, setScreenshotsMap }) => (
                <PortalRoute clients={clients} tests={tests} screenshotsMap={screenshotsMap} setScreenshotsMap={setScreenshotsMap} />
              )}
            </PortalShell>
          } />
          <Route path="/portal/:portalToken/tests/:testSlug" element={
            <PortalShell>
              {({ clients, tests, screenshotsMap, setScreenshotsMap }) => (
                <PortalTestRoute clients={clients} tests={tests} screenshotsMap={screenshotsMap} setScreenshotsMap={setScreenshotsMap} />
              )}
            </PortalShell>
          } />

          {/* Agency admin — all agency routes handled inside AgencyWrapper */}
          <Route path="/:agencySlug/*" element={<AgencyWrapper />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

// ── Portal route helpers ──────────────────────────────────────────────────────
function PortalRoute({ clients, tests, screenshotsMap, setScreenshotsMap }) {
  const { portalToken } = useParams();
  const client = clients.find(c => c.portalToken === portalToken);
  return (
    <PortalGate client={client}>
      <PortalContext.Provider value={{ isPortal: true }}>
        <ClientPage clients={clients} tests={tests} onUpdateClientBrand={() => {}} />
      </PortalContext.Provider>
    </PortalGate>
  );
}

function PortalTestRoute({ clients, tests, screenshotsMap, setScreenshotsMap }) {
  const { portalToken } = useParams();
  const client = clients.find(c => c.portalToken === portalToken);
  return (
    <PortalGate client={client}>
      <PortalContext.Provider value={{ isPortal: true }}>
        <TestDetailsPage
          tests={tests}
          screenshotsMap={screenshotsMap}
          setScreenshotsMap={setScreenshotsMap}
          onUpdateTest={() => {}}
          onDeleteTest={() => {}}
          onSaveScreenshot={() => {}}
          onClearScreenshot={() => {}}
          clients={clients}
        />
      </PortalContext.Provider>
    </PortalGate>
  );
}
