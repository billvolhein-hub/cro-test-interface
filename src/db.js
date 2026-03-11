import { openDB } from "idb";

const DB_NAME = "hypothesis-builder-db";
const STORE = "screenshots";
const VERSION = 1;

function getDB() {
  return openDB(DB_NAME, VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    },
  });
}

// Returns { controlDesktop, controlMobile, variantDesktop, variantMobile } or {}
export async function loadScreenshots(testId) {
  const db = await getDB();
  return (await db.get(STORE, testId)) ?? {};
}

// Persists the full screenshots object for a test
export async function saveScreenshots(testId, screenshots) {
  const db = await getDB();
  await db.put(STORE, screenshots, testId);
}

// Removes all screenshots for a deleted test
export async function removeScreenshots(testId) {
  const db = await getDB();
  await db.delete(STORE, testId);
}
