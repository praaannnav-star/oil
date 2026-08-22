// Online / Offline Connectivity Detection & State Dispatch
import { State } from './state.js';
import { Toast } from './components/Toast.js';

class OfflineManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = [];
  }

  init() {
    window.addEventListener('online', () => this.handleStatusChange(true));
    window.addEventListener('offline', () => this.handleStatusChange(false));
    State.setConnectionStatus(this.isOnline ? 'online' : 'offline');
  }

  handleStatusChange(online) {
    this.isOnline = online;
    State.setConnectionStatus(online ? 'online' : 'offline');

    if (online) {
      Toast.success('Connection restored. Ready to sync queued reports.');
    } else {
      Toast.warning('Working offline. Progress reports will be saved locally in IndexedDB.');
    }

    this.listeners.forEach(cb => cb(online));
  }

  onChange(callback) {
    this.listeners.push(callback);
  }
}

export const Offline = new OfflineManager();
