// Background Sync Manager for Offline Field Reports
import { DB } from './db.js';
import { API } from './services/api.js';
import { State } from './state.js';
import { Toast } from './components/Toast.js';

class SyncManager {
  constructor() {
    this.isSyncing = false;
  }

  async init() {
    await this.updatePendingCount();

    window.addEventListener('online', () => {
      this.syncPending();
    });
  }

  async updatePendingCount() {
    const pending = await DB.getPendingReports();
    State.setPendingCount(pending.length);
    return pending.length;
  }

  async pullRemoteState() {
    if (!navigator.onLine) return;
    
    // dynamically load ApiHttp to avoid circular dependencies during initialization
    const { ApiHttp } = await import('./services/http.js');

    try {
      // Fetch all collections from the backend
      const [projects, activities, reports, reviewItems, surveys] = await Promise.all([
        ApiHttp.request('/projects'),
        ApiHttp.request('/activities'),
        ApiHttp.request('/reports'),
        ApiHttp.request('/reviews'),
        ApiHttp.request('/surveys')
      ]);

      // Update in-memory state
      API.projects = projects || [];
      API.activities = activities || [];
      API.reports = reports || [];
      API.reviewItems = reviewItems || [];
      API.surveys = surveys || [];

      // Update local storage
      API.persist('projects', true);
      API.persist('activities', true);
      API.persist('reports', true);
      API.persist('reviewItems', true);
      API.persist('surveys', true);

      console.log('Successfully pulled remote state into local IndexedDB cache.');
      API._hydrated = true;
      State.notify(); // Re-render application with fetched data
    } catch (err) {
      console.warn('Failed to pull remote state from backend:', err);
    }
  }

  async syncPending() {
    if (this.isSyncing || !navigator.onLine) return;

    const pending = await DB.getPendingReports();
    if (pending.length === 0) return;

    this.isSyncing = true;
    State.setConnectionStatus('syncing');
    Toast.info(`Syncing ${pending.length} offline report(s) to schedule database...`);

    const { ApiHttp } = await import('./services/http.js');
    let successCount = 0;

    for (const report of pending) {
      try {
        if (report.type === 'survey') {
          // Push survey to backend
          await ApiHttp.request('/surveys', {
            method: 'POST',
            body: {
              ...report,
              isOffline: true
            }
          });
          await DB.removePendingReport(report.id);
          successCount++;
          continue;
        }

        // Push report to backend
        await ApiHttp.request('/reports', {
          method: 'POST',
          body: {
            ...report,
            isOffline: true
          }
        });
        await DB.removePendingReport(report.id);
        successCount++;
      } catch (err) {
        console.error('Failed to sync item:', report.id, err);
      }
    }

    this.isSyncing = false;
    State.setConnectionStatus('online');
    await this.updatePendingCount();

    if (successCount > 0) {
      Toast.success(`Successfully synchronized ${successCount} field report(s)!`);
      // Pull latest state from backend to get the finalized review items
      await this.pullRemoteState();
    }
  }
}

export const Sync = new SyncManager();
