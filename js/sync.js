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
    // Check pending count on launch
    await this.updatePendingCount();

    // Auto sync when coming back online
    window.addEventListener('online', () => {
      this.syncPending();
    });
  }

  async updatePendingCount() {
    const pending = await DB.getPendingReports();
    State.setPendingCount(pending.length);
    return pending.length;
  }

  async syncPending() {
    if (this.isSyncing || !navigator.onLine) return;

    const pending = await DB.getPendingReports();
    if (pending.length === 0) return;

    this.isSyncing = true;
    State.setConnectionStatus('syncing');
    Toast.info(`Syncing ${pending.length} offline report(s) to schedule database...`);

    let successCount = 0;
    for (const report of pending) {
      try {
        // Push to server state
        API.reports.unshift({
          ...report,
          status: 'pending-review',
          syncedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST'
        });

        // Add to review items
        API.reviewItems.unshift({
          id: `REV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          reportId: report.id,
          source: 'Field PWA (Offline Synced)',
          reporter: report.author,
          discipline: report.extractedEvent?.discipline || 'Civil',
          extractedEvent: report.extractedEvent,
          topMatch: report.matchedActivityId ? {
            id: report.matchedActivityId,
            code: report.matchedActivityCode,
            name: report.matchedActivityName,
            discipline: report.extractedEvent?.discipline || 'Civil',
            confidence: report.confidence || 90,
            signals: report.signals || []
          } : null,
          alternatives: [],
          state: 'needs-review',
          tabCategory: 'needs-review',
          reviewer: null,
          reviewedAt: null,
          age: 'Just now'
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
    }
  }
}

export const Sync = new SyncManager();
