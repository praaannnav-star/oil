// Browser-Native Hash Router with Dynamic Parameter Matching & Auth Guards
import { State } from './state.js';
import { Auth } from './services/auth.js';
import { Toast } from './components/Toast.js';
import { escapeHtml } from './utils/dom.js';

class Router {
  constructor() {
    this.routes = {};
    this.currentViewEl = null;
    this.container = null;
    this.appEl = null;
  }

  register(pathPattern, viewFactory) {
    this.routes[pathPattern] = viewFactory;
  }

  init(containerElement) {
    this.container = containerElement;
    this.appEl = document.getElementById('app');
    window.addEventListener('hashchange', () => this.handleRoute());

    // Check initial hash
    if (!window.location.hash || window.location.hash === '#') {
      const target = Auth.isAuthenticated() ? '#/overview' : '#/';
      window.location.hash = target;
    }

    // Always run initial route handling directly
    this.handleRoute();
  }

  navigate(path) {
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    const targetHash = `#${cleanPath}`;
    if (window.location.hash === targetHash) {
      this.handleRoute();
    } else {
      window.location.hash = targetHash;
    }
  }

  async handleRoute() {
    let rawHash = window.location.hash.slice(1) || '';
    if (!rawHash) {
      rawHash = Auth.isAuthenticated() ? '/overview' : '/';
    }
    const [pathPart] = rawHash.split('?');
    let path = pathPart.startsWith('/') ? pathPart : '/' + pathPart;

    // --- Authentication Navigation Guards ---
    const isAuthed = Auth.isAuthenticated();

    if (!isAuthed && path !== '/login' && path !== '/') {
      window.location.hash = '#/login';
      return;
    } else if (isAuthed && path === '/login') {
      window.location.hash = '#/overview';
      return;
    } else if (window.location.hash !== '#' + path) {
      if (window.location.hash === '#' || window.location.hash === '') {
        window.location.hash = '#' + path;
        return;
      }
    }

    // Role-based route permission check (if authed and not login)
    if (isAuthed && path !== '/login' && path !== '/') {
      if (!Auth.canAccess(path)) {
        const user = Auth.getUser();
        Toast.warning(`Access restricted: Your role (${user ? user.role : 'Guest'}) does not have permission for ${path}`);
        window.location.hash = '#/overview';
        path = '/overview';
      }
    }

    State.setRoute(path);

    // Toggle Login Mode on app container
    if (this.appEl) {
      this.appEl.classList.toggle('login-mode', path === '/login' || path === '/');
    }

    // Clean up previous view resources (e.g. canvas animation loops)
    if (this.currentViewEl && this.currentViewEl._liquidSim) {
      try {
        this.currentViewEl._liquidSim.destroy();
      } catch (err) {
        console.warn('Error destroying liquid simulation', err);
      }
    }

    // Update active state on nav items
    document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(el => {
      const href = el.getAttribute('href') || '';
      const cleanHref = href.replace(/^#/, '');
      const isActive = cleanHref === path || (cleanHref !== '/overview' && cleanHref !== '/login' && path.startsWith(cleanHref));
      el.classList.toggle('active', isActive);
    });

    // Match route
    let matchedHandler = null;
    let params = {};

    for (const [pattern, handler] of Object.entries(this.routes)) {
      const match = this.matchPattern(pattern, path);
      if (match) {
        matchedHandler = handler;
        params = match.params;
        break;
      }
    }

    if (!matchedHandler) {
      matchedHandler = isAuthed ? this.routes['/overview'] : this.routes['/login'];
    }

    if (matchedHandler && this.container) {
      this.container.innerHTML = '';
      try {
        const viewEl = await matchedHandler(params);
        if (viewEl) {
          this.currentViewEl = viewEl;
          this.container.appendChild(viewEl);
        }
      } catch (err) {
        console.error('Error rendering route:', path, err);
        this.container.innerHTML = `<div style="padding: 2rem; color: #ef4444;">
          <h2>View Render Error</h2>
          <pre>${escapeHtml(err.message)}</pre>
          <pre>${escapeHtml(err.stack)}</pre>
        </div>`;
      }
      this.container.scrollTop = 0;
    }
  }

  matchPattern(pattern, path) {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);

    if (patternParts.length !== pathParts.length) return null;

    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        const paramName = patternParts[i].slice(1);
        params[paramName] = decodeURIComponent(pathParts[i]);
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }

    return { params };
  }
}

export const AppRouter = new Router();
