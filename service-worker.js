const CACHE_NAME = 'oil-tracker-v26';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/favicon.png',
  './assets/oil_logo.png',
  './css/tokens.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/utilities.css',
  './js/main.js',
  './js/router.js',
  './js/state.js',
  './js/db.js',
  './js/sync.js',
  './js/offline.js',
  './js/pwa.js',
  './js/utils/dom.js',
  './js/services/auth.js',
  './js/services/access-policy.js',
  './js/services/api.js',
  './js/services/http.js',
  './js/services/session-manager.js',

  './js/services/projects.js',
  './js/services/activities.js',
  './js/services/reports.js',
  './js/services/evidence.js',
  './js/services/review.js',
  './js/services/audit.js',
  './js/services/analytics.js',
  './js/services/speech.js',
  './js/services/surveys.js',
  './js/services/ingest.js',
  './js/components/Badge.js',
  './js/components/Button.js',
  './js/components/Card.js',
  './js/components/CanvasLiquid.js',
  './js/components/BridgeShader.js',
  './js/components/Modal.js',
  './js/components/Drawer.js',
  './js/components/Table.js',
  './js/components/Tabs.js',
  './js/components/Toast.js',
  './js/components/Timeline.js',
  './js/components/Skeleton.js',
  './js/components/EmptyState.js',
  './js/components/ConfidenceIndicator.js',
  './js/components/SyncIndicator.js',
  './js/components/ActivityMatchCard.js',
  './js/components/EvidenceViewer.js',
  './js/components/Icons.js',
  './js/views/Login.js',
  './js/views/Landing.js',
  './js/views/Overview.js',
  './js/views/ProjectList.js',
  './js/views/ProjectDetail.js',
  './js/views/ScheduleExplorer.js',
  './js/views/ActivityDetail.js',
  './js/views/FieldCapture.js',
  './js/views/ReviewQueue.js',
  './js/views/Evidence.js',
  './js/views/Analytics.js',
  './js/views/ExecutionMemory.js',
  './js/views/AuditTrail.js',
  './js/views/AdminPanel.js',
  './js/views/ProjectManagerPanel.js',
  './js/views/ProjectForm.js',
  './js/views/SurveyWizard.js',
  './js/views/IngestHub.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use addAll with soft error handling for resilient install
      return Promise.allSettled(
        APP_SHELL.map((url) => cache.add(url).catch((err) => console.warn('Cache add error for:', url, err)))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Handle assets: Network First, fallback to Cache for robust offline capability
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
