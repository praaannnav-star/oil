// Authentication & Role-Based Access Control (RBAC) Service
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
    allowedRoutes: ['/overview', '/manager', '/projects', '/projects/new', '/projects/:id', '/projects/:id/edit', '/schedule', '/activities/:id', '/review', '/evidence', '/analytics', '/memory', '/audit']
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
    allowedRoutes: ['/overview', '/projects', '/projects/:id', '/schedule', '/activities/:id', '/progress', '/progress/new', '/review', '/evidence', '/analytics', '/memory', '/audit']
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
    allowedRoutes: ['/overview', '/projects', '/projects/:id', '/schedule', '/activities/:id', '/evidence', '/analytics', '/memory', '/audit']
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
    allowedRoutes: ['/overview', '/projects', '/projects/:id', '/schedule', '/activities/:id', '/review', '/evidence', '/analytics', '/memory', '/audit']
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
    allowedRoutes: ['/overview', '/schedule', '/activities/:id', '/review', '/evidence', '/audit']
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
    allowedRoutes: ['/overview', '/progress', '/progress/new', '/evidence', '/activities/:id']
  }
];

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
        const parsed = JSON.parse(saved);
        // Re-hydrate from DEMO_ACCOUNTS to ensure we have allowedRoutes and fresh properties
        if (parsed && parsed.role) {
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
        return { success: true, user: userObj };
      }
      return { success: false, error: 'Invalid username or password. (Demo password: password123)' };
    }

    const userObj = { ...account, token: `mock-jwt-${Date.now()}` };
    this.saveSession(userObj);
    return { success: true, user: userObj };
  }

  quickLogin(roleOrUsername) {
    const target = DEMO_ACCOUNTS.find(
      acc => acc.role === roleOrUsername || acc.username === roleOrUsername || acc.role.toLowerCase().includes(roleOrUsername.toLowerCase())
    ) || DEMO_ACCOUNTS[2]; // Default to Planner

    const userObj = { ...target, token: `mock-jwt-${Date.now()}` };
    this.saveSession(userObj);
    return userObj;
  }

  logout() {
    this.saveSession(null);
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  getUser() {
    return this.currentUser;
  }

  canAccess(routePath) {
    if (!this.currentUser) return false;
    if (this.currentUser.role === USER_ROLES.ADMIN) return true;
    if (!this.currentUser.allowedRoutes) return true; // Fallback to allow if undefined

    const routeParts = routePath.split('/').filter(Boolean);
    return this.currentUser.allowedRoutes.some(pattern => {
      const patternParts = pattern.split('/').filter(Boolean);
      // A named creation route must not be mistaken for a dynamic project id.
      if (routeParts.includes('new') && !patternParts.includes('new')) return false;
      return patternParts.length === routeParts.length && patternParts.every((part, index) => part.startsWith(':') || part === routeParts[index]);
    });
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
