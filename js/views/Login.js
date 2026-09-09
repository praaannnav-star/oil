// Animated Oil India Limited Petroleum Landing & Enterprise Authentication Page
import { SessionManager } from '../services/session-manager.js';
import { State } from '../state.js';
import { AppRouter } from '../router.js';
import { Toast } from '../components/Toast.js';
import { BridgeShader } from '../components/BridgeShader.js';

export function LoginView() {
  const container = document.createElement('div');
  container.className = 'login-landing-container';

  container.innerHTML = `
    <!-- HTML5 Canvas Background for Petroleum Fluid Simulation -->
    <canvas id="petroleum-bg-canvas" class="petroleum-canvas"></canvas>

    <!-- Overlay Content Layer -->
    <div class="login-content-wrapper">
      <!-- Left Hero Section: Oil India Limited Brand & Mission -->
      <div class="login-hero-pane">
        <div class="hero-brand-badge">
          <span class="pulse-dot"></span>
          <span>SIH26122 • SMART AUTOMATION</span>
        </div>

        <div class="hero-brand-header">
          <img src="./assets/oil_logo.png" alt="Oil India Limited" class="hero-logo-img">
          <div class="hero-title-group">
            <h1 class="hero-title">OIL INDIA LIMITED</h1>
            <p class="hero-sub">ऑयल इंडिया लिमिटेड • Navratna Enterprise</p>
          </div>
        </div>

        <h2 class="hero-headline">
          Intelligent Data Capture &<br>
          <span class="text-gradient-oil">Schedule-Linking Layer</span>
        </h2>

        <p class="hero-description">
          Bridging the operational gap between L5/L6 project schedules and real-time field actuals through multi-modal capture, explainable AI matching, and tamper-evident reconciliation.
        </p>

        <div class="hero-feature-pills">
          <div class="feature-pill">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line></svg>
            <span>Voice & Vision Capture</span>
          </div>
          <div class="feature-pill">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>Real-Time L5/L6 Match</span>
          </div>
          <div class="feature-pill">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 1l22 22"></path><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path><path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>
            <span>Offline-First PWA Sync</span>
          </div>
          <div class="feature-pill">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            <span>Audit-Proof Ledger</span>
          </div>
        </div>

        <div class="canvas-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>
          <span>Move mouse or touch screen to disturb raw petroleum fluid surface</span>
        </div>
      </div>

      <!-- Right Login Card: Enterprise Authentication Form -->
      <div class="login-card-pane">
        <div class="login-glass-card">
          <div class="card-header-section">
            <h3 class="card-title">Operations Sign In</h3>
            <p class="card-subtitle">Enter your Oil India enterprise credentials</p>
          </div>

          <!-- Enterprise Credentials Form -->
          <form id="login-form" class="login-form">
            <div class="form-group">
              <label for="input-username" class="form-label">Username</label>
              <div class="input-with-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <input type="text" id="input-username" class="form-input" placeholder="Enter username (e.g. planner, admin)" required autocomplete="username">
              </div>
            </div>

            <div class="form-group">
              <label for="input-password" class="form-label">Password</label>
              <div class="input-with-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <input type="password" id="input-password" class="form-input" placeholder="••••••••" required autocomplete="current-password">
              </div>
            </div>

            <div id="login-error-box" class="login-error-alert d-none"></div>

            <button type="submit" id="btn-login-submit" class="btn btn-primary btn-block btn-lg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
              <span>Authenticate & Enter Operations</span>
            </button>
          </form>

          <div class="card-footer-meta">
            <span>Oil India Limited Enterprise Operations • PWA</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Initialize Petroleum Canvas Simulation
  setTimeout(() => {
    const canvas = container.querySelector('#petroleum-bg-canvas');
    if (canvas) {
      const liquidSim = new BridgeShader(canvas);
      // Store reference on element for cleanup
      container._liquidSim = liquidSim;
    }
  }, 20);

  // Setup Form Submission
  const form = container.querySelector('#login-form');
  const errorBox = container.querySelector('#login-error-box');
  const submitBtn = form.querySelector('#btn-login-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = container.querySelector('#input-username').value.trim();
    const password = container.querySelector('#input-password').value;

    errorBox.classList.add('d-none');
    submitBtn.disabled = true;
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.innerHTML = `
      <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
      <span>Authenticating...</span>
    `;

    try {
      const result = await SessionManager.login(username, password);
      if (result.success) {
        State.setRole(result.user.role);
        Toast.success(`Welcome, ${result.user.name}! Access Granted.`);
        AppRouter.navigate(getPostLoginRoute());
      } else {
        errorBox.textContent = result.error || 'Invalid credentials. Please verify username and password.';
        errorBox.classList.remove('d-none');
        Toast.danger('Authentication failed. Please verify credentials.');
      }
    } catch (err) {
      errorBox.textContent = err.message || 'An error occurred during authentication.';
      errorBox.classList.remove('d-none');
      Toast.danger('Network error or server unavailable.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }
  });

  return container;
}

function getPostLoginRoute() {
  const route = sessionStorage.getItem('oil_redirect_route') || '/overview';
  sessionStorage.removeItem('oil_redirect_route');
  return route.startsWith('/') ? route : '/overview';
}
