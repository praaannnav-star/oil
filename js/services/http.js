// ApiHttp — live-mode transport adapter (UI_REDESIGN_PLAN §3/§11).
// Active when API.useMock = false. Services keep their method names; this
// module carries the network concerns:
//   - JWT access token in memory only; rotating refresh token in IndexedDB
//     (never localStorage) per plan R4
//   - Authorization: Bearer on every call, one silent refresh on 401
//   - logout-and-redirect when the refresh session is dead
//   - retry with exponential backoff on 5xx / network errors
import { DB } from '../db.js';
import { Auth } from './auth.js';
const TOKEN_KEY = 'authTokens';
const BASE = 'https://oil-bridge-api.praaannnav.workers.dev/api';
const MAX_RETRIES = 2;

class ApiHttpService {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
  }

  async init() {
    const stored = await DB.getEntity(TOKEN_KEY);
    if (stored) {
      this.accessToken = stored.access || null;
      this.refreshToken = stored.refresh || null;
      // Access tokens are short-lived (15m); warm the session up front.
      if (!this.accessToken && this.refreshToken) await this._refresh();
    }
  }

  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: { username, password },
      skipAuth: true
    });
    this.accessToken = data.jwt;
    this.refreshToken = data.refresh;
    await DB.saveEntity(TOKEN_KEY, { access: data.jwt, refresh: data.refresh });
    Auth.saveSession(data.user);
    return { success: true, user: data.user };
  }

  async logout() {
    try {
      if (this.refreshToken) {
        await fetch(`${BASE}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: this.refreshToken })
        });
      }
    } catch { /* best-effort revoke */ }
    this.accessToken = null;
    this.refreshToken = null;
    await DB.saveEntity(TOKEN_KEY, {});
    Auth.logout();
  }

  async _persistTokens() {
    await DB.saveEntity(TOKEN_KEY, { access: this.accessToken, refresh: this.refreshToken });
  }

  async _refresh() {
    if (!this.refreshToken) return false;
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: this.refreshToken })
      });
      if (!res.ok) throw new Error(`refresh rejected (${res.status})`);
      const data = await res.json();
      this.accessToken = data.jwt;
      this.refreshToken = data.refresh;
      await this._persistTokens();
      return true;
    } catch {
      // Dead session: clear state and bounce to login.
      this.accessToken = null;
      this.refreshToken = null;
      await DB.saveEntity(TOKEN_KEY, {});
      Auth.logout();
      if (location.hash && !location.hash.startsWith('#/login')) location.hash = '#/login';
      return false;
    }
  }

  /**
   * Core request helper.
   * opts: { method, body (object), rawBody (Blob/ArrayBuffer), contentType,
   *         skipAuth, retries }
   */
  async request(path, opts = {}) {
    const url = `${BASE}${path}`;
    const method = opts.method || (opts.body || opts.rawBody ? 'POST' : 'GET');

    let attempt = 0;
    let refreshedOnce = false;
    while (true) {
      const headers = {};
      if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
      if (opts.rawBody !== undefined && opts.contentType) headers['Content-Type'] = opts.contentType;
      if (!opts.skipAuth && this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;

      let res;
      try {
        res = await fetch(url, {
          method,
          headers,
          body: opts.body !== undefined ? JSON.stringify(opts.body)
            : opts.rawBody !== undefined ? opts.rawBody : undefined
        });
      } catch {
        // Offline/network failure — surface as a typed error for sync queues.
        const err = new Error('Network unavailable');
        err.offline = true;
        throw err;
      }

      if (res.status === 401 && !opts.skipAuth && !refreshedOnce) {
        refreshedOnce = true;
        if (await this._refresh()) continue; // retry original request once
      }

      if (res.status >= 500 && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 400 * 2 ** attempt));
        attempt++;
        continue;
      }

      if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try {
          const payload = await res.json();
          if (payload?.error) message = payload.error;
        } catch { /* non-JSON error body */ }
        const err = new Error(message);
        err.status = res.status;
        throw err;
      }

      const ct = res.headers.get('content-type') || '';
      return ct.includes('application/json') ? res.json() : res.text();
    }
  }
}

export const ApiHttp = new ApiHttpService();
