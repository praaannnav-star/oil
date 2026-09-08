// Authentication session coordinator. API tokens are handled by ApiHttp;
// this service owns the browser-visible identity and navigation grants.
import { API } from './api.js';
import { canAccessRoute } from './access-policy.js';
export const USER_ROLES = {
  ADMIN: 'Admin',
  EXECUTIVE: 'Executive / GM',
  PROJECT_MANAGER: 'Project Manager',
  PLANNER: 'Planner',
  REVIEWER: 'Reviewer',
  FIELD_SUPERVISOR: 'Field Supervisor'
};

export const DEMO_ACCOUNTS = [
  {
    id: 'USR-PM-01',
    username: 'manager',
    password: 'password123',
    name: 'Nandita Das',
    title: 'Project Manager, Capital Projects',
    role: USER_ROLES.PROJECT_MANAGER,
    department: 'Projects Delivery Division',
    avatar: '👷',
    badgeClass: 'badge-in-progress',
    allowedRoutes: ['/overview', '/manager', '/projects', '/projects/new', '/projects/:id', '/projects/:id/edit', '/schedule', '/activities/:id', '/review', '/surveys', '/evidence', '/analytics', '/memory', '/audit', '/progress', '/progress/new']
  },
  {
    id: 'USR-ADMIN-01',
    username: 'admin',
    password: 'password123',
    name: 'Sanjeev Sarmah',
    title: 'Chief General Manager & System Admin',
    role: USER_ROLES.ADMIN,
    department: 'Corporate IT & Operations Control',
    avatar: '👨‍💼',
    badgeClass: 'badge-rejected',
    allowedRoutes: ['/overview', '/projects', '/projects/:id', '/schedule', '/activities/:id', '/progress', '/progress/new', '/review', '/surveys', '/evidence', '/analytics', '/memory', '/audit']
  },
  {
    id: 'USR-EXEC-01',
    username: 'executive',
    password: 'password123',
    name: 'Dr. Ranjit Bora',
    title: 'Director (Operations & Projects)',
    role: USER_ROLES.EXECUTIVE,
    department: 'Executive Directorate — Duliajan',
    avatar: '👔',
    badgeClass: 'badge-completed',
    allowedRoutes: ['/overview', '/projects', '/projects/:id', '/schedule', '/activities/:id', '/evidence', '/analytics', '/memory', '/audit', '/progress', '/progress/new']
  },
  {
    id: 'USR-PLAN-01',
    username: 'planner',
    password: 'password123',
    name: 'Rajesh Baruah',
    title: 'Lead Schedule & Planning Engineer',
    role: USER_ROLES.PLANNER,
    department: 'Planning & Project Controls Division',
    avatar: '📐',
    badgeClass: 'badge-in-progress',
    allowedRoutes: ['/overview', '/projects', '/projects/:id', '/schedule', '/activities/:id', '/review', '/surveys', '/evidence', '/analytics', '/memory', '/audit', '/progress', '/progress/new']
  },
  {
    id: 'USR-REV-01',
    username: 'reviewer',
    password: 'password123',
    name: 'Ananya Dutta',
    title: 'Senior QA / QC Review Engineer',
    role: USER_ROLES.REVIEWER,
    department: 'Quality Assurance & Inspection Bureau',
    avatar: '🔍',
    badgeClass: 'badge-at-risk',
    allowedRoutes: ['/overview', '/schedule', '/activities/:id', '/review', '/surveys', '/evidence', '/audit', '/progress', '/progress/new']
  },
  {
    id: 'USR-FIELD-01',
    username: 'supervisor',
    password: 'password123',
    name: 'Manoj Kalita',
    title: 'Resident Field Engineer & Site Supervisor',
    role: USER_ROLES.FIELD_SUPERVISOR,
    department: 'Field Operations & Construction — Rig 04',
    avatar: '👷‍♂️',
    badgeClass: 'badge-on-track',
    allowedRoutes: ['/overview', '/projects', '/projects/:id', '/progress', '/progress/new', '/surveys', '/evidence', '/activities/:id']
  }
];

const STORAGE_KEY = 'oil_auth_session';

class AuthService {
  constructor() {
    this.currentUser = this.loadSession();
    this.listeners = new Set();
    this._authIntent = 0;
  }

  _triggerLiveLogin(username, password) {
    // A mock persona is a complete local session. Trying to establish a
    // Worker session in the background made temporary network failures look
    // like logout events and replaced client route grants mid-navigation.
    if (API.useMock || !navigator.onLine) return;
    if (this._syncTimeout) clearTimeout(this._syncTimeout);
    const intent = ++this._authIntent;
    this._syncTimeout = setTimeout(() => {
      import('./http.js').then(({ ApiHttp }) => {
        ApiHttp.login(username, password, { applySession: false })
          .then(({ user }) => {
            if (intent !== this._authIntent) return;
            this.saveSession(user);
            // Once JWT is established, pull initial data!
            return import('../sync.js').then(({ Sync }) => {
              if (Sync.pullRemoteState) return Sync.pullRemoteState();
            });
          })
          .catch(err => console.warn('Live API auth background sync:', err.message));
      });
    }, 100);
  }

  loadSession() {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Re-hydrate from DEMO_ACCOUNTS only if using mock backend or missing required fields
        if (parsed && parsed.role && (API.useMock || !parsed.allowedRoutes)) {
          const freshAccount = DEMO_ACCOUNTS.find(acc => acc.role === parsed.role);
          if (freshAccount) {
            return { ...freshAccount, token: parsed.token || `mock-jwt-${Date.now()}` };
          }
        }
        return parsed;
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

  login(username, password) {
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    const account = DEMO_ACCOUNTS.find(
      acc => acc.username.toLowerCase() === cleanUser && acc.password === cleanPass
    );

    if (!account) {
      // Also allow logging in with role name matching
      const byRole = DEMO_ACCOUNTS.find(
        acc => acc.role.toLowerCase() === cleanUser && (cleanPass === 'password123' || cleanPass === 'password' || cleanPass === '')
      );
      if (byRole) {
        const userObj = { ...byRole, token: `mock-jwt-${Date.now()}` };
        this.saveSession(userObj);
        // Silently authenticate with live backend
        this._triggerLiveLogin(byRole.username, byRole.password);
        return { success: true, user: userObj };
      }
      return { success: false, error: 'Invalid username or password. (Demo password: password123)' };
    }

    const userObj = { ...account, token: `mock-jwt-${Date.now()}` };
    this.saveSession(userObj);

    // Silently authenticate with live backend to establish JWT session
    this._triggerLiveLogin(account.username, account.password);

    return { success: true, user: userObj };
  }

  quickLogin(roleOrUsername) {
    const target = DEMO_ACCOUNTS.find(
      acc => acc.role === roleOrUsername || acc.username === roleOrUsername || acc.role.toLowerCase().includes(roleOrUsername.toLowerCase())
    ) || DEMO_ACCOUNTS[3]; // Default to Planner

    const userObj = { ...target, token: `mock-jwt-${Date.now()}` };
    this.saveSession(userObj);

    // Silently authenticate with live backend to establish JWT session
    this._triggerLiveLogin(target.username, target.password);

    return userObj;
  }

  logout() {
    ++this._authIntent;
    this.clearSession();
    // Remote revocation is best effort and must never re-enter Auth.logout().
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
