// Session Framework for role-based authentication lifecycle.
// Handles session TTL, auto-logout, token rotation checks, and live session sync.

import { Auth, USER_ROLES } from './auth.js';
import { ApiHttp } from './http.js';
import { Toast } from '../components/Toast.js';

export class SessionManager {
  static HEARTBEAT_INTERVAL_MS = 60000; // Check every minute
  static timer = null;

  /**
   * Start the session monitoring framework.
   * Auto-logs out users if their refresh session dies or JWT expires without refresh.
   */
  static startMonitoring() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.checkSessionState(), this.HEARTBEAT_INTERVAL_MS);
    
    // Listen to tab visibility changes to check session immediately when returning to the app
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkSessionState();
      }
    });
  }

  static stopMonitoring() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Fetch the current session from the live backend and apply it to Auth store.
   * Keeps role models in sync with the backend permissions.
   */
  static async fetchAndApplySession() {
    if (!Auth.isAuthenticated() || !window.navigator.onLine) return false;
    try {
      const res = await ApiHttp.request('/auth/me');
      if (res && res.user) {
        Auth.saveSession(res.user);
        return true;
      }
      throw new Error('Session Invalidated');
    } catch (e) {
      if (e.status === 401 || String(e.message).toLowerCase().includes('invalid') || String(e.message).toLowerCase().includes('expired')) {
        console.warn('[SessionManager] Session expired or revoked. Logging out.');
        Toast.show('Session expired. Please log in again.', 'warning');
        this.logout();
      }
      return false;
    }
  }

  /**
   * Verifies if the current session is still valid.
   * Triggers a silent refresh if needed, or logs out if dead.
   */
  static async checkSessionState() {
    await this.fetchAndApplySession();
  }

  /**
   * Framework entry for standard login
   */
  static async login(username, password) {
    const res = await Auth.login(username, password);
    if (res.success) {
      this.startMonitoring();
    }
    return res;
  }

  /**
   * Framework entry for global logout
   */
  static async logout(redirect = true) {
    this.stopMonitoring();
    Auth.logout(); // Will call ApiHttp.logout()
    
    if (redirect) {
      window.location.hash = '#/login';
    }
  }

  /**
   * Get all available framework roles
   */
  static getAvailableRoles() {
    return Object.values(USER_ROLES);
  }
}

// Auto-start if already authenticated on boot
if (Auth.isAuthenticated()) {
  SessionManager.startMonitoring();
}
