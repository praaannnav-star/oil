// API abstraction layer with seamless mock data vs live Cloudflare Workers switch.
// P1: all runtime collections are hydrated from IndexedDB on startup and
// persisted (debounced) after every mutation, so state survives page refreshes.
import { DB } from '../db.js';

const COLLECTIONS = ['projects', 'activities', 'reports', 'evidence', 'reviewItems', 'auditLogs', 'surveys'];
const PERSIST_DEBOUNCE_MS = 200;

class ApiService {
  constructor() {
    this.useMock = false; // Toggle to true to use IndexedDB local-only mode
    this.baseUrl = '/api';

    // In-memory runtime state - hydrated in init() before first render
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

    // Flush any pending debounced writes when the page is hidden or closed,
    // so a refresh during the debounce window never loses submitted data.
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
    let hasData = false;
    for (const name of COLLECTIONS) {
      let stored = null;
      try {
        stored = await DB.getEntity(name);
      } catch (err) {
        console.warn(`Entity "${name}" could not be read; falling back to seed data`, err);
      }

      if (Array.isArray(stored) && stored.length > 0) {
        this[name] = stored;
        hasData = true;
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

  // Public portfolio stats for the landing pipeline — cached to IDB so the
  // marketing numbers stay truthful even when offline.
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

  resetDemoData() {
    for (const name of COLLECTIONS) {
      this[name] = JSON.parse(JSON.stringify(SEEDS[name]));
      this.persist(name, true);
    }
    try {
      localStorage.removeItem('oil_demo_projects');
    } catch (error) {
      console.warn('Could not clear legacy demo projects storage', error);
    }
  }

  loadProjects() {
    try {
      const saved = localStorage.getItem('oil_demo_projects');
      if (saved) return JSON.parse(saved);
    } catch (error) {
      console.warn('Could not restore demo projects', error);
    }
    return JSON.parse(JSON.stringify(MOCK_PROJECTS));
  }

  persistProjects() {
    this.persist('projects');
    try {
      localStorage.setItem('oil_demo_projects', JSON.stringify(this.projects));
    } catch (error) {
      console.warn('Could not persist demo projects', error);
    }
  }

  // Simulated latency for realistic UI transitions
  async delay(ms = 80) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const API = new ApiService();

