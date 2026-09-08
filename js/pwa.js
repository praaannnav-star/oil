
// PWA Service Worker Registration & Deferred Install Prompt
import { Toast } from './components/Toast.js';

class PWAManager {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
  }

  async init() {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('./service-worker.js');
        reg.update();
        console.log('OIL PWA ServiceWorker registered with scope:', reg.scope);
      } catch (err) {
        console.warn('ServiceWorker registration error:', err);
      }
    }

    // Intercept BeforeInstallPrompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      const installBtn = document.getElementById('btn-pwa-install');
      if (installBtn) {
        installBtn.classList.remove('d-none');
      }
    });

    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.deferredPrompt = null;
      Toast.success('OIL Field Tracker installed as PWA!');
      const installBtn = document.getElementById('btn-pwa-install');
      if (installBtn) installBtn.classList.add('d-none');
    });
  }

  async canPromptInstall() {
    return !!this.deferredPrompt && !this.isInstalled;
  }

  async promptInstall() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        Toast.success('Installing application...');
      }
      this.deferredPrompt = null;
    } else {
      Toast.info('To install on iOS/Desktop: Use "Add to Home Screen" in your browser menu.');
    }
  }
}

export const PWA = new PWAManager();
