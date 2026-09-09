import { AppRouter } from './router.js';
import { State } from './state.js';
import { Auth } from './services/auth.js';
import { SessionManager } from './services/session-manager.js';
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
import { IngestHubView } from './views/IngestHub.js';
import { ProjectsService } from './services/projects.js';

// Application Bootstrap
document.addEventListener('DOMContentLoaded', async () => {
  // Hydrate persisted data without allowing a blocked storage backend to stop
  // the router and leave users on an empty application shell.
  await Promise.race([
    API.init(),
    new Promise(resolve => setTimeout(resolve, 2500))
  ]);

  // 1. Initialize API HTTP session, PWA & Offline & Sync subsystems
  try {
    const { ApiHttp } = await import('./services/http.js');
    await ApiHttp.init();
    // Fetch fresh session state if authenticated
    if (Auth.isAuthenticated()) {
      await SessionManager.fetchAndApplySession();
    }
  } catch (err) {
    console.warn('ApiHttp initialization fallback:', err);
  }
  await awaitStartup(PWA.init(), 'PWA registration');
  Offline.init();
  await awaitStartup(Sync.init(), 'offline sync initialization');

  // If we are authenticated but have no projects locally, trigger a remote pull
  if (Auth.getUser() && API.projects.length === 0) {
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
  AppRouter.register('/ingest', IngestHubView);
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

async function awaitStartup(task, label, timeoutMs = 1500) {
  let timer;
  let timedOut = false;
  try {
    await Promise.race([
      Promise.resolve(task).catch(error => console.warn(`${label} failed; continuing startup.`, error)),
      new Promise(resolve => {
        timer = setTimeout(() => {
          timedOut = true;
          resolve();
        }, timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
  // Startup helpers enhance the app, but routing must remain available if a
  // browser API such as service workers or IndexedDB is slow or unavailable.
  if (timedOut) console.warn(`${label} exceeded ${timeoutMs}ms; continuing startup.`);
}

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

    projectSelect.innerHTML = projects.map(project => {
      const progLabel = project.actualProgress != null ? `${project.actualProgress}%` : '0%';
      return `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)} (${escapeHtml(progLabel)})</option>`;
    }).join('');

    // Determine which project to select:
    // 1. Use the current project if it's in the list
    // 2. Prefer the CGGS demo project (PRJ-OIL-2026-01) if available
    // 3. Otherwise pick the first non-completed active project
    // 4. Finally fall back to the first project in the list
    let selectedId = (activeId && projects.some(p => p.id === activeId)) ? activeId : null;
    if (!selectedId) {
      const cggsProject = projects.find(p => p.id === 'PRJ-OIL-2026-01');
      if (cggsProject) {
        selectedId = cggsProject.id;
      } else {
        const activeProject = projects.find(p => p.health !== 'completed' && p.status !== 'completed');
        selectedId = activeProject?.id || projects[0]?.id || '';
      }
    }

    projectSelect.value = selectedId;

    // Sync state so all views use the correct project from first load
    if (selectedId && selectedId !== State.getState().currentProjectId) {
      State.setProject(selectedId);
    }
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
      SessionManager.logout();
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
