// Authentication session coordinator. API tokens are handled by ApiHttp;
// this service owns the browser-visible identity and navigation grants.
import { canAccessRoute } from './access-policy.js';

export const USER_ROLES = {
  ADMIN: 'Admin',
  EXECUTIVE: 'Executive / GM',
  PROJECT_MANAGER: 'Project Manager',
  PLANNER: 'Planner',
  REVIEWER: 'Reviewer',
  FIELD_SUPERVISOR: 'Field Supervisor'
};

const STORAGE_KEY = 'oil_auth_session';

class AuthService {
  constructor() {
    this.currentUser = this.loadSession();
    this.listeners = new Set();
  }

  loadSession() {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not parse saved session', e);
    }
    return null;
  }

  saveSession(user) {
    this.currentUser = user;
    try {
      if (user) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed saving session to storage', e);
    }
    this.notify();
  }

  clearSession() {
    this.saveSession(null);
  }

  async login(username, password) {
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanUser || !cleanPass) {
      return { success: false, error: 'Please enter both username and password.' };
    }

    try {
      const { ApiHttp } = await import('./http.js');
      const result = await ApiHttp.login(cleanUser, cleanPass, { applySession: true });
      if (result && result.user) {
        // Trigger initial remote state pull
        import('../sync.js').then(({ Sync }) => {
          if (Sync?.pullRemoteState) {
            Sync.pullRemoteState().catch(err => console.warn('Post-login sync:', err.message));
          }
        });
        return { success: true, user: result.user };
      }
      return { success: false, error: 'Authentication failed. Please verify credentials.' };
    } catch (err) {
      return { success: false, error: err.message || 'Invalid username or password.' };
    }
  }

  logout() {
    this.clearSession();
    import('./http.js').then(({ ApiHttp }) => ApiHttp.logout({ clearSession: false }).catch(() => {}));
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  getUser() {
    return this.currentUser;
  }

  canAccess(routePath) {
    return canAccessRoute(this.currentUser, routePath);
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    this.listeners.forEach(fn => fn(this.currentUser));
  }
}

export const Auth = new AuthService();
