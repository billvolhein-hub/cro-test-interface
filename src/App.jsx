import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { loadScreenshots, saveScreenshots, removeScreenshots } from "./db";
import {
  fetchClients, createClient, createClients, updateClient, deleteClient,
  fetchTests, createTest, createTests, updateTestField, replaceTest, deleteTest,
} from "./lib/api";
import HomePage from "./pages/HomePage";
import TestDetailsPage from "./pages/TestDetailsPage";
import TestDefinitionPage from "./pages/TestDefinitionPage";

export default function App() {
  const [tests, setTests] = useState([]);
  const [clients, setClients] = useState([]);
  const [screenshotsMap, setScreenshotsMap] = useState({});
  const [loading, setLoading] = useState(true);

  // Load from Supabase on mount, migrating localStorage data if Supabase is empty
  useEffect(() => {
    (async () => {
      try {
        let [remoteClients, remoteTests] = await Promise.all([fetchClients(), fetchTests()]);

        if (remoteClients.length === 0 && remoteTests.length === 0) {
          // Attempt one-time migration from localStorage
          const rawClients = localStorage.getItem("hypothesis-builder-clients");
          const rawTests   = localStorage.getItem("hypothesis-builder-tests");
          const lsClients  = rawClients ? JSON.parse(rawClients) : [];
          const lsTests    = rawTests   ? JSON.parse(rawTests)   : [];

          if (lsClients.length > 0 || lsTests.length > 0) {
            // Insert clients, capture old→new ID mapping
            const idMap = {};
            if (lsClients.length > 0) {
              const inserted = await createClients(lsClients.map(c => c.name));
              lsClients.forEach((old, i) => { idMap[old.id] = inserted[i].id; });
              remoteClients = inserted;
            }
            // Remap clientId on each test then insert
            if (lsTests.length > 0) {
              const mapped = lsTests.map(t => ({
                ...t,
                clientId: idMap[t.clientId] ?? remoteClients[0]?.id ?? null,
              }));
              remoteTests = await createTests(mapped);
            }
            // Clear localStorage so migration doesn't repeat
            localStorage.removeItem("hypothesis-builder-clients");
            localStorage.removeItem("hypothesis-builder-tests");
          }
        }

        setClients(remoteClients);
        setTests(remoteTests);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Clients ──────────────────────────────────────────────────────────────
  const onCreateClient = async (name) => {
    const client = await createClient(name);
    setClients((prev) => [...prev, client]);
    return client;
  };

  const onCreateClients = async (names) => {
    const newClients = await createClients(names);
    setClients((prev) => [...prev, ...newClients]);
    return newClients;
  };

  const onUpdateClient = async (id, name) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)));
    await updateClient(id, name);
  };

  const onDeleteClient = async (id) => {
    const remaining = clients.filter((c) => c.id !== id);
    const fallbackId = remaining[0]?.id ?? null;
    setClients(remaining);
    setTests((prev) => prev.map((t) =>
      t.clientId === id ? { ...t, clientId: fallbackId, updatedAt: Date.now() } : t
    ));
    await deleteClient(id);
    // Reassign affected tests in DB
    const affected = tests.filter((t) => t.clientId === id);
    await Promise.all(affected.map((t) => updateTestField(t.id, "clientId", fallbackId)));
  };

  // ── Tests ─────────────────────────────────────────────────────────────────
  const onCreateTest = async (t) => {
    const saved = await createTest(t);
    setTests((prev) => [...prev, saved]);
    return saved;
  };

  const onCreateTests = async (arr) => {
    const saved = await createTests(arr);
    setTests((prev) => [...prev, ...saved]);
    return saved;
  };

  const onUpdateTest = async (testId, field, value) => {
    setTests((prev) => prev.map((t) =>
      t.id === testId ? { ...t, [field]: value, updatedAt: Date.now() } : t
    ));
    await updateTestField(testId, field, value);
  };

  const onReplaceTest = async (updated) => {
    const withTs = { ...updated, updatedAt: Date.now() };
    setTests((prev) => prev.map((t) => t.id === updated.id ? withTs : t));
    await replaceTest(withTs);
  };

  const onDeleteTest = async (id) => {
    setTests((prev) => prev.filter((t) => t.id !== id));
    setScreenshotsMap((prev) => { const n = { ...prev }; delete n[id]; return n; });
    await Promise.all([deleteTest(id), removeScreenshots(id)]);
  };

  // ── Screenshots ───────────────────────────────────────────────────────────
  const onSaveScreenshot = async (testId, zone, dataUrl) => {
    const current = screenshotsMap[testId] ?? {};
    const next = { ...current, [zone]: dataUrl };
    setScreenshotsMap((prev) => ({ ...prev, [testId]: next }));
    await saveScreenshots(testId, next);
  };

  const onClearScreenshot = async (testId, zone) => {
    const current = screenshotsMap[testId] ?? {};
    const next = { ...current };
    delete next[zone];
    setScreenshotsMap((prev) => ({ ...prev, [testId]: next }));
    await saveScreenshots(testId, next);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif", color: "#64748B", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              tests={tests}
              onCreateTest={onCreateTest}
              onCreateTests={onCreateTests}
              onDeleteTest={onDeleteTest}
              clients={clients}
              onCreateClient={onCreateClient}
              onCreateClients={onCreateClients}
              onUpdateClient={onUpdateClient}
              onDeleteClient={onDeleteClient}
            />
          }
        />
        <Route
          path="/tests/:id"
          element={
            <TestDetailsPage
              tests={tests}
              screenshotsMap={screenshotsMap}
              setScreenshotsMap={setScreenshotsMap}
              onUpdateTest={onUpdateTest}
              onSaveScreenshot={onSaveScreenshot}
              onClearScreenshot={onClearScreenshot}
              clients={clients}
            />
          }
        />
        <Route
          path="/tests/:id/edit"
          element={
            <TestDefinitionPage
              tests={tests}
              screenshotsMap={screenshotsMap}
              setScreenshotsMap={setScreenshotsMap}
              onUpdateTest={onUpdateTest}
              onReplaceTest={onReplaceTest}
              onSaveScreenshot={onSaveScreenshot}
              onClearScreenshot={onClearScreenshot}
              clients={clients}
              onCreateClient={onCreateClient}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
