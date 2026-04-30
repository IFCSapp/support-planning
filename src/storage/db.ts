import type { SupportPlanDraft } from "../types/plan";

const DB_NAME = "support-plan-navi-db";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("plans")) db.createObjectStore("plans", { keyPath: "id" });
      if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
      if (!db.objectStoreNames.contains("backups")) db.createObjectStore("backups", { keyPath: "id" });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function store(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

export async function savePlan(plan: SupportPlanDraft): Promise<void> {
  const objectStore = await store("plans", "readwrite");
  await requestToPromise(objectStore.put(plan));
}

export async function getPlan(id: string): Promise<SupportPlanDraft | undefined> {
  const objectStore = await store("plans", "readonly");
  return requestToPromise<SupportPlanDraft | undefined>(objectStore.get(id));
}

export async function listPlans(): Promise<SupportPlanDraft[]> {
  const objectStore = await store("plans", "readonly");
  const plans = await requestToPromise<SupportPlanDraft[]>(objectStore.getAll());
  return plans.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deletePlan(id: string): Promise<void> {
  const objectStore = await store("plans", "readwrite");
  await requestToPromise(objectStore.delete(id));
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const objectStore = await store("settings", "readwrite");
  await requestToPromise(objectStore.put({ key, value }));
}

export async function getSettings(): Promise<Record<string, unknown>> {
  const objectStore = await store("settings", "readonly");
  const rows = await requestToPromise<Array<{ key: string; value: unknown }>>(objectStore.getAll());
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

function requestToPromise<T = void>(request: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as T);
  });
}
