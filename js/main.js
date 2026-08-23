import { AppRouter } from './router.js';
import { State } from './state.js';
import { Auth, DEMO_ACCOUNTS } from './services/auth.js';
import { Offline } from './offline.js';
import { Sync } from './sync.js';
import { PWA } from './pwa.js';
import { API } from './services/api.js';
import { Toast } from './components/Toast.js';
import { SyncIndicator } from './components/SyncIndicator.js';
import { Icons } from './components/Icons.js';
import { escapeHtml } from './utils/dom.js';

// Import Views
import { LoginView } from './views/Login.js';
import { OverviewView } from './views/Overview.js';
import { ProjectListView } from './views/ProjectList.js';
import { ProjectDetailView } from './views/ProjectDetail.js';
import { ScheduleExplorerView } from './views/ScheduleExplorer.js';
import { ActivityDetailView } from './views/ActivityDetail.js';
import { FieldCaptureView } from './views/FieldCapture.js';
import { SurveyWizardView } from './views/SurveyWizard.js';
import { ReviewQueueView } from './views/ReviewQueue.js';
import { EvidenceView } from './views/Evidence.js';
import { AnalyticsView } from './views/Analytics.js';
import { ExecutionMemoryView } from './views/ExecutionMemory.js';
import { AuditTrailView } from './views/AuditTrail.js';
import { LandingView } from './views/Landing.js';
import { AdminPanelView } from './views/AdminPanel.js';
import { ProjectManagerPanelView } from './views/ProjectManagerPanel.js';
import { ProjectFormView } from './views/ProjectForm.js';
import { ProjectsService } from './services/projects.js';

// Application Bootstrap
document.addEventListener('DOMContentLoaded', async () => {
  // 0. Hydrate persisted domain collections from IndexedDB before any view renders
  await API.init();

  // 1. Initialize API HTTP session, PWA & Offline & Sync subsystems
  try {
    const { ApiHttp } = await import('./services/http.js');
    await ApiHttp.init();
  } catch (err) {
    console.warn('ApiHttp initialization fallback:', err);
  }
  await PWA.init();
  Offline.init();
  await Sync.init();

  // If we are authenticated but have no projects locally, trigger a remote pull
  if (Auth.getUser() && API.projects.length === 0 && !API.useMock) {
    Sync.pullRemoteState().catch(e => console.warn('Initial remote pull failed', e));
  }

  // 2. Register Routes
  AppRouter.register('/', LandingView);
  AppRouter.register('/login', LoginView);
  AppRouter.register('/overview', OverviewView);
  AppRouter.register('/projects', ProjectListView);
  AppRouter.register('/projects/new', ProjectFormView);
  AppRouter.register('/projects/:id/edit', ProjectFormView);
  AppRouter.register('/projects/:id', ProjectDetailView);
  AppRouter.register('/manager', ProjectManagerPanelView);
  AppRouter.register('/admin', AdminPanelView);
  AppRouter.register('/schedule', ScheduleExplorerView);
  AppRouter.register('/activities/:id', ActivityDetailView);
  AppRouter.register('/progress', FieldCaptureView);
  AppRouter.register('/progress/new', FieldCaptureView);
  AppRouter.register('/surveys', SurveyWizardView);
  AppRouter.register('/review', ReviewQueueView);
  AppRouter.register('/evidence', EvidenceView);
  AppRouter.register('/analytics', AnalyticsView);
  AppRouter.register('/memory', ExecutionMemoryView);
  AppRouter.register('/audit', AuditTrailView);

  // 3. Header & Navigation Controls
  setupHeaderControls();
  setupSyncStateListener();
  setupUserProfileListener();
  setupProjectSelector();

  // 4. Initialize Router on main container
  const mainContainer = document.getElementById('main-content');
  AppRouter.init(mainContainer);
});

function setupHeaderControls() {
  // Project Selector
  const projectSelect = document.getElementById('header-project-select');
  if (projectSelect) {
    projectSelect.addEventListener('change', (e) => {
      State.setProject(e.target.value);
      Toast.info(`Switched project context: ${e.target.selectedOptions[0].text}`);
      AppRouter.handleRoute(); // refresh current view with new project
    });
  }

  // Demo Reset Button (Jury Scenario Reset)
  const demoResetBtn = document.getElementById('btn-demo-reset');
  if (demoResetBtn) {
    demoResetBtn.addEventListener('click', () => {
      API.resetDemoData();
      Toast.success('Jury Demo Scenario state reset to fresh baseline.');
      AppRouter.handleRoute();
    });
  }

  // PWA Install Prompt Button
  const installBtn = document.getElementById('btn-pwa-install');
  if (installBtn) {
    installBtn.addEventListener('click', () => {
      PWA.promptInstall();
    });
  }
}

function setupProjectSelector() {
  const projectSelect = document.getElementById('header-project-select');
  if (!projectSelect) return;
  const refresh = async () => {
    const projects = await ProjectsService.getProjects();
    const activeId = State.getState().currentProjectId;
    projectSelect.innerHTML = projects.map(project => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)} (${escapeHtml(project.budget)})</option>`).join('');
    projectSelect.value = projects.some(project => project.id === activeId) ? activeId : (projects[0]?.id || '');
  };
  window.addEventListener('projects:changed', refresh);
  refresh();
}

function setupUserProfileListener() {
  const userMount = document.getElementById('header-user-mount');

  function renderUserProfile() {
    if (!userMount) return;
    const user = Auth.getUser();
    userMount.innerHTML = '';

    if (!user) return;

    const profileEl = document.createElement('div');
    profileEl.className = 'header-user-profile';
    profileEl.innerHTML = `
      <span class="user-avatar-pill">${escapeHtml(user.avatar || '👤')}</span>
      <div class="user-meta-group">
        <span class="user-name-text">${escapeHtml(user.name)}</span>
        <span class="user-role-badge-text">${escapeHtml(user.role)}</span>
      </div>
      <button id="btn-header-logout" class="btn-logout" title="Sign Out of Operations">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        <span>Sign Out</span>
      </button>
    `;

    profileEl.querySelector('#btn-header-logout').addEventListener('click', () => {
      Auth.logout();
      Toast.info('Signed out successfully.');
      AppRouter.navigate('/login');
    });

    userMount.appendChild(profileEl);

    // Filter sidebar navigation items based on role permissions
    updateSidebarForRole(user);
  }

  Auth.subscribe(() => renderUserProfile());
  renderUserProfile();
}

function updateSidebarForRole(user) {
  if (!user) return;

  document.querySelectorAll('.app-sidebar .nav-item, .mobile-bottom-nav .mobile-nav-item').forEach(item => {
    const href = item.getAttribute('href') || '';
    const cleanRoute = href.replace(/^#/, '');
    if (cleanRoute && cleanRoute !== '/overview') {
      const allowed = Auth.canAccess(cleanRoute);
      item.style.display = allowed ? '' : 'none';
    } else {
      item.style.display = '';
    }
  });
}

function setupSyncStateListener() {
  const syncMount = document.getElementById('sync-indicator-mount');
  if (!syncMount) return;

  function updateSyncUI() {
    const s = State.getState();
    syncMount.innerHTML = '';
    const ind = SyncIndicator({
      status: s.connectionStatus,
      pendingCount: s.pendingCount,
      onClick: () => {
        if (s.connectionStatus === 'offline' && s.pendingCount > 0) {
          Toast.info(`${s.pendingCount} report(s) queued locally. Will sync automatically when connection resumes.`);
        } else if (navigator.onLine) {
          Sync.syncPending();
        }
      }
    });
    syncMount.appendChild(ind);

    // Update offline banner visibility
    const offlineBanner = document.getElementById('offline-alert-banner');
    if (offlineBanner) {
      offlineBanner.classList.toggle('d-none', s.connectionStatus === 'online');
    }
  }

  State.subscribe(() => updateSyncUI());
  updateSyncUI();
}
