// Session Framework for role-based authentication lifecycle.
// Handles session TTL, auto-logout, token rotation checks, and multi-role swapping.

import { Auth, USER_ROLES, DEMO_ACCOUNTS } from './auth.js';
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
      const { API } = await import('./api.js');
      if (API.useMock) return false;

      const res = await ApiHttp.request('/auth/me');
      if (res && res.user) {
        Auth.saveSession(res.user);
        return true;
      }
      throw new Error('Session Invalidated');
    } catch (e) {
      if (e.status === 401 || String(e.message).toLowerCase().includes('invalid')) {
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
   * Switch roles dynamically - useful for testing all roles in the project.
   */
  static async switchRole(roleName) {
    Toast.show(`Switching session to ${roleName}...`);
    // Best-effort logout of current session
    await this.logout(false); 
    
    const res = Auth.quickLogin(roleName);
    if (res && res.username) {
      Toast.show(`Session established as ${res.name} (${res.role})`, 'success');
      // Hard reload to reset all app state and DB caches
      window.location.hash = '#/overview';
      setTimeout(() => window.location.reload(), 500);
      return true;
    }
    return false;
  }

  /**
   * Framework entry for standard login
   */
  static async login(username, password) {
    const res = Auth.login(username, password);
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

  /**
   * Get all mock persona credentials
   */
  static getRolePersonas() {
    return DEMO_ACCOUNTS;
  }
}

// Auto-start if already authenticated on boot
if (Auth.isAuthenticated()) {
  SessionManager.startMonitoring();
}
