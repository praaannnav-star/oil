import { AppRouter } from '../router.js';
import { Auth } from '../services/auth.js';
import { API } from '../services/api.js';
import { PWA } from '../pwa.js';

export async function LandingView() {
  const container = document.createElement('div');
  container.className = 'product-landing';
  container.innerHTML = `
    <div class="landing-orbit landing-orbit-one"></div>
    <div class="landing-orbit landing-orbit-two"></div>
    <section class="landing-hero">
      <div class="landing-brand"><img src="./assets/oil_logo.png" alt="Oil India Limited"><span>OIL INDIA LIMITED</span></div>
      <div class="landing-copy">
        <span class="landing-eyebrow">SIH26122 · FIELD TO SCHEDULE BRIDGE</span>
        <h1>Every field update.<br><em>One trusted project picture.</em></h1>
        <p>Capture site progress, link it to L5/L6 schedules, validate the evidence, and give every delivery role the operational clarity it needs.</p>
      </div>
      <div class="landing-actions">
        <button id="landing-enter" class="btn btn-primary btn-lg">Enter Operations</button>
        <button id="landing-install" class="btn btn-secondary btn-lg d-none">Install Field PWA</button>
        <a href="#landing-pipeline" class="landing-text-link">See the live pipeline ↓</a>
      </div>
    </section>

    <section id="landing-pipeline" class="landing-workflow landing-pipeline">
      <h2 class="landing-section-title">The live pipeline — real numbers from the platform</h2>
      <article><span id="stat-capture">—</span><h2>Capture</h2><p>Field reports submitted from the offline-first PWA</p></article>
      <article><span id="stat-extract">—</span><h2>Extract</h2><p>Schedule activities structured under active projects</p></article>
      <article><span id="stat-match">—</span><h2>Evidence</h2><p>Photo packets linked to schedule activities</p></article>
      <article><span id="stat-review">—</span><h2>Review</h2><p>Items awaiting planner validation right now</p></article>
      <article><span id="stat-reconcile">—</span><h2>Reconcile</h2><p>Reports processed through the schedule bridge</p></article>
    </section>

    <section class="landing-workflow landing-roles">
      <h2 class="landing-section-title">Built for every delivery role</h2>
      <article data-role="Field Supervisor"><span>👷</span><h2>Field Supervisor</h2><p>Voice-to-schedule capture with photos, offline drafts and auto-sync.</p></article>
      <article data-role="Planner"><span>📐</span><h2>Planner</h2><p>Transparent AI match suggestions with confidence you can audit.</p></article>
      <article data-role="Reviewer"><span>🔍</span><h2>QAQC Reviewer</h2><p>Evidence-backed verification before any schedule actual moves.</p></article>
      <article data-role="Executive"><span>👔</span><h2>Executive</h2><p>Daily derived intelligence — never fabricated status theatre.</p></article>
    </section>

    <section class="landing-trust-strip">
      <span id="trust-offline"></span>
      <a href="#/audit" class="trust-item">🔗 Immutable audit chain</a>
      <span id="trust-evidence"></span>
      <span class="trust-item">📴 Works fully offline</span>
    </section>
  `;

  container.querySelector('#landing-enter').addEventListener('click', () => {
    AppRouter.navigate(Auth.isAuthenticated() ? '/overview' : '/login');
  });

  // Install prompt only when the browser offers one
  const installBtn = container.querySelector('#landing-install');
  try {
    if (await PWA.canPromptInstall?.()) installBtn.classList.remove('d-none');
  } catch (_) { /* capability probe optional */ }
  installBtn.addEventListener('click', () => PWA.promptInstall());

  // Role cards deep-link to persona login
  container.querySelectorAll('.landing-roles article').forEach(card => {
    card.addEventListener('click', () => {
      const role = card.getAttribute('data-role');
      if (role) sessionStorage.setItem('oil_login_hint', role);
      AppRouter.navigate('/login');
    });
  });

  // Live pipeline + trust strip from real platform state
  const stats = await API.getPublicStatsCached();
  const setStat = (id, value) => {
    const el = container.querySelector(id);
    if (el) el.textContent = String(value);
  };
  setStat('#stat-capture', stats.reports);
  setStat('#stat-extract', stats.activities);
  setStat('#stat-match', stats.evidence);
  setStat('#stat-review', stats.pendingReviews);
  setStat('#stat-reconcile', stats.reports);

  const offlineEl = container.querySelector('#trust-offline');
  offlineEl.textContent = navigator.onLine ? '🟢 Live — synced' : '🔴 Offline — queued';
  const evidenceEl = container.querySelector('#trust-evidence');
  evidenceEl.textContent = `📸 ${stats.evidence} verified evidence packets`;

  return container;
}
