const DB_NAME = "gallerium-cache";
const DB_VERSION = 1;

// The only non-plumbing decision in this module: is a cached record too old to use?
// Extracted so it's unit-testable without an IndexedDB. A falsy maxAgeMs means "no
// expiry" (the staleness UI uses cacheGetEntry to read the age regardless).
export function isExpired(timestamp: number, maxAgeMs?: number, now: number = Date.now()): boolean {
  return !!maxAgeMs && now - timestamp > maxAgeMs;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("data")) {
        db.createObjectStore("data", { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("data", "readwrite");
    tx.objectStore("data").put({ key, value, timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function cacheGet<T>(
  key: string,
  maxAgeMs?: number
): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("data", "readonly");
    const request = tx.objectStore("data").get(key);

    request.onsuccess = () => {
      const record = request.result;
      if (!record) return resolve(null);
      if (isExpired(record.timestamp, maxAgeMs)) {
        return resolve(null); // expired
      }
      resolve(record.value as T);
    };

    request.onerror = () => reject(request.error);
  });
}

// Returns the raw cached entry (value + write timestamp) regardless of age, or
// null if absent. Used to surface data staleness (e.g. "satellite data is N days old").
export async function cacheGetEntry<T>(
  key: string
): Promise<{ value: T; timestamp: number } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("data", "readonly");
    const request = tx.objectStore("data").get(key);
    request.onsuccess = () => {
      const record = request.result;
      if (!record) return resolve(null);
      resolve({ value: record.value as T, timestamp: record.timestamp });
    };
    request.onerror = () => reject(request.error);
  });
}

export async function cacheDelete(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("data", "readwrite");
    tx.objectStore("data").delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}