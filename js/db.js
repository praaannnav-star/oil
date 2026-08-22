// IndexedDB Storage Layer for Offline-First PWA Operations
const DB_NAME = 'oil-field-db';
const DB_VERSION = 1;

class Database {
  constructor() {
    this.db = null;
    this.initPromise = this.init();
  }

  async init() {
    return new Promise((resolve) => {
      try {
        const request = window.indexedDB ? window.indexedDB.open(DB_NAME, DB_VERSION) : indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('pendingReports')) {
            db.createObjectStore('pendingReports', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('drafts')) {
            db.createObjectStore('drafts', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('cachedData')) {
            db.createObjectStore('cachedData', { keyPath: 'key' });
          }
        };

        request.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(this.db);
        };

        request.onerror = (e) => {
          console.warn('IndexedDB init error (likely denied):', e);
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB exception (private mode or unsupported):', err);
        resolve(null);
      }
    });
  }

  async getDb() {
    if (!this.db) await this.initPromise;
    return this.db;
  }

  async addPendingReport(report) {
    const db = await this.getDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pendingReports', 'readwrite');
      const store = tx.objectStore('pendingReports');
      store.put({ ...report, queuedAt: Date.now(), syncStatus: 'pending' });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPendingReports() {
    const db = await this.getDb();
    if (!db) return [];
    return new Promise((resolve) => {
      const tx = db.transaction('pendingReports', 'readonly');
      const store = tx.objectStore('pendingReports');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  }

  async removePendingReport(id) {
    const db = await this.getDb();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction('pendingReports', 'readwrite');
      const store = tx.objectStore('pendingReports');
      store.delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  async saveDraft(draft) {
    const db = await this.getDb();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction('drafts', 'readwrite');
      const store = tx.objectStore('drafts');
      store.put({ ...draft, updatedAt: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  async getDrafts() {
    const db = await this.getDb();
    if (!db) return [];
    return new Promise((resolve) => {
      const tx = db.transaction('drafts', 'readonly');
      const store = tx.objectStore('drafts');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  // --- Generic entity persistence (P1) ---
  // Whole-collection snapshots keyed by collection name in the 'cachedData'
  // store. The in-memory arrays remain the runtime source of truth; these
  // methods make them survive page refreshes.
  async getEntity(key) {
    const db = await this.getDb();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('cachedData', 'readonly');
        const req = tx.objectStore('cachedData').get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => resolve(null);
      } catch (err) {
        console.warn(`Could not read entity "${key}" from IndexedDB`, err);
        resolve(null);
      }
    });
  }

  async saveEntity(key, value) {
    const db = await this.getDb();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('cachedData', 'readwrite');
        tx.objectStore('cachedData').put({ key, value, savedAt: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch (err) {
        console.warn(`Could not save entity "${key}" to IndexedDB`, err);
        resolve(false);
      }
    });
  }
}

export const DB = new Database();
