/**
 * IndexedDB-backed cache for Transformers.js model weights.
 * Implements the Cache-like interface (match, put) so model files are
 * downloaded on first use and persisted in IndexedDB instead of the
 * Cache API, for more reliable storage in extension contexts.
 *
 * Model weights are never bundled; only the WASM runtime is in /assets.
 */

const DB_NAME = 'promptprune-models-idb';
const STORE_NAME = 'model-files';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'url' });
      }
    };
  });
}

function get(db: IDBDatabase, url: string): Promise<{ body: ArrayBuffer; headers: Record<string, string> } | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(url);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const row = req.result;
      resolve(row ? { body: row.body, headers: row.headers || {} } : undefined);
    };
  });
}

function put(db: IDBDatabase, url: string, body: ArrayBuffer, headers: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put({ url, body, headers });
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

/**
 * Cache-like object for env.customCache. Model weights are fetched on first use
 * and stored in IndexedDB; subsequent loads use the cached copy.
 */
export const indexedDBModelCache = {
  async match(key: Request | string): Promise<Response | undefined> {
    const url = typeof key === 'string' ? key : (key as Request).url;
    try {
      const db = await openDB();
      const entry = await get(db, url);
      db.close();
      if (entry) {
        const sizeMB = (entry.body.byteLength / (1024 * 1024)).toFixed(2);
        console.log(`[IndexedDB cache] ✅ HIT: ${url.substring(url.lastIndexOf('/') + 1)} (${sizeMB} MB)`);
        const headers = new Headers(entry.headers);
        return new Response(entry.body, { status: 200, statusText: 'OK', headers });
      } else {
        console.log(`[IndexedDB cache] ❌ MISS: ${url.substring(url.lastIndexOf('/') + 1)}`);
        return undefined;
      }
    } catch (e) {
      console.warn('[IndexedDB model cache] match failed:', e);
      return undefined;
    }
  },

  async put(key: Request | string, response: Response): Promise<void> {
    const url = typeof key === 'string' ? key : (key as Request).url;
    if (!response || !response.ok) return;
    try {
      const body = await response.arrayBuffer();
      const sizeMB = (body.byteLength / (1024 * 1024)).toFixed(2);
      const headers: Record<string, string> = {};
      response.headers.forEach((v, k) => { headers[k] = v; });
      const db = await openDB();
      await put(db, url, body, headers);
      db.close();
      console.log(`[IndexedDB cache] 💾 SAVED: ${url.substring(url.lastIndexOf('/') + 1)} (${sizeMB} MB) - will use cache next time`);
    } catch (e) {
      console.warn('[IndexedDB model cache] put failed:', e);
    }
  },
};
