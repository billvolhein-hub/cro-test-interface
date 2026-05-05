import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { fetchAgencyBySlug, updateAgency } from "../lib/agencies";
import { loadScreenshots, saveScreenshots, removeScreenshots } from "../db";
import {
  fetchClients, fetchTests,
  createClient, createClients, updateClient, updateClientBrand, updateClientCrawlReport, updateClientCustomUA, deleteClient, regeneratePortalToken, updateClientPortalPassword, normalizeCrawlReports,
  createTest, createTests, updateTestField, replaceTest, deleteTest,
} from "../lib/api";
import { AgencyContext } from "../context/AgencyContext";
import { AgencyGate } from "./PasswordGate";
import HomePage            from "../pages/HomePage";
import TestDetailsPage     from "../pages/TestDetailsPage";
import TestDefinitionPage  from "../pages/TestDefinitionPage";
import ClientPage          from "../pages/ClientPage";
import { BG, MUTED } from "../lib/constants";

export default function AgencyWrapper() {
  const { agencySlug } = useParams();

  const [agency,        setAgency]        = useState(null);
  const [agencyLoading, setAgencyLoading] = useState(true);
  const [notFound,      setNotFound]      = useState(false);

  const [tests,          setTests]          = useState([]);
  const [clients,        setClients]        = useState([]);
  const [screenshotsMap, setScreenshotsMap] = useState({});
  const [dataLoading,    setDataLoading]    = useState(true);

  // 1. Load agency record
  useEffect(() => {
    fetchAgencyBySlug(agencySlug).then(ag => {
      if (!ag) setNotFound(true);
      else setAgency(ag);
      setAgencyLoading(false);
    });
  }, [agencySlug]);

  // 2. Load agency-scoped data once agency is known
  useEffect(() => {
    if (!agency) return;
    (async () => {
      const [c, t] = await Promise.all([fetchClients(agency.id), fetchTests()]);
      // Filter tests to only those belonging to this agency's clients
      const clientIds = new Set(c.map(cl => cl.id));
      setClients(c);
      setTests(t.filter(test => clientIds.has(test.clientId)));
      setDataLoading(false);
    })();
  }, [agency]);

  if (agencyLoading) return <Spinner />;
  if (notFound)      return <NotFound slug={agencySlug} />;

  // Determine if super admin is impersonating — if so, bypass gate
  const isImpersonating = sessionStorage.getItem("me_superadmin_impersonating") === agencySlug;

  return (
    <AgencyGate agency={agency}>
      {dataLoading
        ? <Spinner />
        : <AgencyApp
            agency={agency}
            setAgency={setAgency}
            isImpersonating={isImpersonating}
            tests={tests}          setTests={setTests}
            clients={clients}      setClients={setClients}
            screenshotsMap={screenshotsMap} setScreenshotsMap={setScreenshotsMap}
          />
      }
    </AgencyGate>
  );
}

// ── Agency-scoped app (handlers + routes) ────────────────────────────────────

function AgencyApp({ agency, setAgency, isImpersonating, tests, setTests, clients, setClients, screenshotsMap, setScreenshotsMap }) {
  const slug = agency.slug;

  const onUpdateAgency = async (fields) => {
    await updateAgency(agency.id, fields);
    setAgency(prev => ({ ...prev, ...fields, brand: fields.brand ?? prev.brand }));
  };

  // ── Clients ────────────────────────────────────────────────────────────────
  const onCreateClient = async (name) => {
    const client = await createClient(name, agency.id);
    setClients(prev => [...prev, client]);
    return client;
  };

  const onCreateClients = async (names) => {
    const newClients = await createClients(names, agency.id);
    setClients(prev => [...prev, ...newClients]);
    return newClients;
  };

  const onUpdateClient = async (id, name) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, name: name.trim() } : c));
    await updateClient(id, name);
  };

  const onUpdateClientBrand = async (id, brand) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, brand } : c));
    await updateClientBrand(id, brand);
  };

  const onUpdateClientCustomUA = async (id, customUA) => {
    const client = clients.find(c => c.id === id);
    setClients(prev => prev.map(c => c.id === id ? { ...c, customUA: customUA || null } : c));
    await updateClientCustomUA(id, customUA, client?.brand ?? {});
  };

  const onSaveCrawlReport = async (id, crawlReports) => {
    // crawlReports is always the full domain-keyed map
    const normalized = normalizeCrawlReports(crawlReports);
    const domains    = Object.keys(normalized);
    setClients(prev => prev.map(c => c.id !== id ? c : {
      ...c,
      crawlReports: normalized,
      domains,
      crawlReport: normalized[domains[0]] ?? null,
    }));
    await updateClientCrawlReport(id, normalized);
  };

  const onRegeneratePortalToken = (id, portalToken) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, portalToken } : c));
  };

  const onUpdatePortalPassword = async (id, password) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, portalPassword: password || null } : c));
    await updateClientPortalPassword(id, password);
  };

  const onDeleteClient = async (id) => {
    const remaining  = clients.filter(c => c.id !== id);
    const fallbackId = remaining[0]?.id ?? null;
    setClients(remaining);
    setTests(prev => prev.map(t => t.clientId === id ? { ...t, clientId: fallbackId, updatedAt: Date.now() } : t));
    await deleteClient(id);
    const affected = tests.filter(t => t.clientId === id);
    await Promise.all(affected.map(t => updateTestField(t.id, "clientId", fallbackId)));
  };

  // ── Tests ──────────────────────────────────────────────────────────────────
  const onCreateTest = async (t) => {
    const saved = await createTest(t);
    setTests(prev => [...prev, saved]);
    return saved;
  };

  const onCreateTests = async (arr) => {
    const saved = await createTests(arr);
    setTests(prev => [...prev, ...saved]);
    return saved;
  };

  const onUpdateTest = async (testId, field, value) => {
    setTests(prev => prev.map(t => t.id === testId ? { ...t, [field]: value, updatedAt: Date.now() } : t));
    await updateTestField(testId, field, value);
  };

  const onReplaceTest = async (updated) => {
    const withTs = { ...updated, updatedAt: Date.now() };
    setTests(prev => prev.map(t => t.id === updated.id ? withTs : t));
    await replaceTest(withTs);
  };

  const onDeleteTest = async (id) => {
    setTests(prev => prev.filter(t => t.id !== id));
    setScreenshotsMap(prev => { const n = { ...prev }; delete n[id]; return n; });
    await Promise.all([deleteTest(id), removeScreenshots(id)]);
  };

  // ── Screenshots ────────────────────────────────────────────────────────────
  const onSaveScreenshot = async (testId, zone, dataUrl) => {
    const current = screenshotsMap[testId] ?? {};
    const next    = { ...current, [zone]: dataUrl };
    setScreenshotsMap(prev => ({ ...prev, [testId]: next }));
    await saveScreenshots(testId, next);
  };

  const onSaveScreenshots = async (testId, zonesObj) => {
    const current = screenshotsMap[testId] ?? {};
    const next    = { ...current, ...zonesObj };
    setScreenshotsMap(prev => ({ ...prev, [testId]: next }));
    await saveScreenshots(testId, next);
  };

  const onClearScreenshot = async (testId, zone) => {
    const current = screenshotsMap[testId] ?? {};
    const next    = { ...current };
    delete next[zone];
    setScreenshotsMap(prev => ({ ...prev, [testId]: next }));
    await saveScreenshots(testId, next);
  };

  const sharedTestProps = { tests, screenshotsMap, setScreenshotsMap, onUpdateTest, onDeleteTest, onSaveScreenshot, onSaveScreenshots, onClearScreenshot, clients };

  return (
    <AgencyContext.Provider value={{ agency, onUpdateAgency }}>
      {/* Super admin impersonation banner */}
      {isImpersonating && (
        <div style={{ background: "#FEF9C3", borderBottom: "1px solid #FDE68A", padding: "7px 20px", fontSize: 12, color: "#92400E", fontWeight: 600, display: "flex", alignItems: "center", gap: 12, fontFamily: "'Inter',sans-serif" }}>
          <span>👁 Impersonating <b>{agency.name}</b></span>
          <button
            onClick={() => { sessionStorage.removeItem("me_superadmin_impersonating"); window.location.href = "/"; }}
            style={{ padding: "3px 10px", borderRadius: 5, border: "none", background: "#92400E", color: "#fff", fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            ← Back to Platform Admin
          </button>
        </div>
      )}

      <Routes>
        <Route path="/"
          element={
            <HomePage
              agencySlug={slug}
              tests={tests}
              onCreateTest={onCreateTest} onCreateTests={onCreateTests} onDeleteTest={onDeleteTest} onUpdateTest={onUpdateTest}
              clients={clients}
              onCreateClient={onCreateClient} onCreateClients={onCreateClients} onUpdateClient={onUpdateClient} onUpdateClientCustomUA={onUpdateClientCustomUA} onSaveCrawlReport={onSaveCrawlReport} onDeleteClient={onDeleteClient}
              onSaveScreenshot={onSaveScreenshot} onSaveScreenshots={onSaveScreenshots}
            />
          }
        />
        <Route path="/tests/:id"
          element={<TestDetailsPage agencySlug={slug} {...sharedTestProps} />}
        />
        <Route path="/tests/:id/edit"
          element={
            <TestDefinitionPage agencySlug={slug} {...sharedTestProps}
              onReplaceTest={onReplaceTest} onCreateClient={onCreateClient}
            />
          }
        />
        <Route path="/clients/:id"
          element={
            <ClientPage agencySlug={slug}
              clients={clients} tests={tests} onCreateTest={onCreateTest} onUpdateTest={onUpdateTest}
              onSaveScreenshots={onSaveScreenshots}
              onSaveCrawlReport={onSaveCrawlReport} onUpdateClientBrand={onUpdateClientBrand}
              onRegeneratePortalToken={onRegeneratePortalToken} onUpdatePortalPassword={onUpdatePortalPassword}
            />
          }
        />
        <Route path="*" element={<Navigate to={`/${slug}`} replace />} />
      </Routes>
    </AgencyContext.Provider>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif", color: MUTED, fontSize: 14 }}>
      Loading…
    </div>
  );
}

function NotFound({ slug }) {
  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif", gap: 12 }}>
      <div style={{ fontSize: 48, fontWeight: 900, color: "#E2E8F0" }}>404</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#475569" }}>Agency not found: <code>/{slug}</code></div>
      <a href="/" style={{ fontSize: 13, color: "#3B82F6" }}>← Back to Platform Admin</a>
    </div>
  );
}
