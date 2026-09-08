// API state coordinator with IndexedDB persistence and live API sync.
// Runtime collections are hydrated from IndexedDB on startup and
// persisted (debounced) after mutations so state survives offline sessions.
import { DB } from '../db.js';

const COLLECTIONS = ['projects', 'activities', 'reports', 'evidence', 'reviewItems', 'auditLogs', 'surveys'];
const PERSIST_DEBOUNCE_MS = 200;

class ApiService {
  constructor() {
    this.baseUrl = '/api';
    this.useMock = false;

    // In-memory runtime state - hydrated from IndexedDB in init()
    this.projects = [];
    this.activities = [];
    this.reports = [];
    this.evidence = [];
    this.reviewItems = [];
    this.auditLogs = [];
    this.surveys = [];

    this._hydrated = false;
    this._initPromise = null;
    this._saveTimers = {};

    // Flush any pending debounced writes when the page is hidden or closed
    const flushPendingWrites = () => {
      for (const name of COLLECTIONS) {
        if (this._saveTimers[name]) {
          clearTimeout(this._saveTimers[name]);
          delete this._saveTimers[name];
          if (this._hydrated) DB.saveEntity(name, this[name]);
        }
      }
    };
    try {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushPendingWrites();
      });
      window.addEventListener('pagehide', flushPendingWrites);
    } catch (err) {
      console.warn('Lifecycle flush listeners unavailable', err);
    }
  }

  // Called once from main.js before the router renders any view.
  async init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._hydrate();
    return this._initPromise;
  }

  async _hydrate() {
    for (const name of COLLECTIONS) {
      try {
        const stored = await DB.getEntity(name);
        if (Array.isArray(stored)) {
          this[name] = stored;
        }
      } catch (err) {
        console.warn(`Entity "${name}" could not be read from storage`, err);
      }
    }
    this._hydrated = true;
  }

  isHydrated() {
    return this._hydrated;
  }

  // Debounced whole-collection snapshot to IndexedDB after mutations.
  persist(collection, immediate = false) {
    if (!COLLECTIONS.includes(collection)) {
      console.warn(`persist(): unknown collection "${collection}"`);
      return;
    }
    clearTimeout(this._saveTimers[collection]);
    const write = () => DB.saveEntity(collection, this[collection]);
    if (immediate) {
      write();
    } else {
      this._saveTimers[collection] = setTimeout(write, PERSIST_DEBOUNCE_MS);
    }
  }

  // Public portfolio stats for the landing pipeline — cached to IDB
  async getPublicStats() {
    const stats = {
      projects: this.projects.length,
      activities: this.activities.filter(a => a.level === 'L5' || a.level === 'L6').length,
      pendingReviews: this.reviewItems.filter(i => i.state === 'needs-review').length,
      evidence: this.evidence.length,
      reports: this.reports.length,
      savedAt: Date.now()
    };
    try {
      await DB.saveEntity('publicStats', stats);
    } catch (err) {
      console.warn('Could not cache public stats', err);
    }
    return stats;
  }

  async getPublicStatsCached() {
    try {
      return await this.getPublicStats();
    } catch (err) {
      const cached = await DB.getEntity('publicStats');
      if (cached) return cached;
      return { projects: 0, activities: 0, pendingReviews: 0, evidence: 0, reports: 0 };
    }
  }

  // Simulated latency for UI transitions when executing client-side actions
  async delay(ms = 80) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const API = new ApiService();
