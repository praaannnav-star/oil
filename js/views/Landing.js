import { AppRouter } from '../router.js';
import { Auth } from '../services/auth.js';
import { API } from '../services/api.js';
import { PWA } from '../pwa.js';

export async function LandingView() {
  const container = document.createElement('div');
  container.className = 'product-landing product-landing-pro';
  container.innerHTML = `
    <div class="landing-industrial-scene" aria-hidden="true"><canvas id="landing-industrial-canvas"></canvas></div>
    <section class="landing-hero">
      <div class="landing-brand"><img src="./assets/oil_logo.png" alt="Oil India Limited"><span>OIL INDIA LIMITED<br><small>FIELD TO SCHEDULE BRIDGE</small></span></div>
      <div class="landing-copy">
        <span class="landing-eyebrow">SIH26122 · OPERATIONS INTELLIGENCE</span>
        <h1>From field signal to<br><em>trusted delivery picture.</em></h1>
        <p>Capture site progress, link it to L5/L6 schedules, validate the evidence, and give every delivery role the operational clarity it needs.</p>
      </div>
      <div class="landing-actions landing-actions-pro">
        <button id="landing-enter" class="btn btn-primary btn-lg">Enter Operations</button>
        <button id="landing-install" class="btn btn-secondary btn-lg d-none">Install Field PWA</button>
        <button id="landing-scroll-pipeline" class="landing-text-link" style="background:none;border:none;cursor:pointer;">See the live pipeline ↓</button>
      </div>
    </section>

    <section id="landing-pipeline" class="landing-pro-section">
      <span class="landing-eyebrow">LIVE PIPELINE</span><h2>Every update becomes an<br>operational signal.</h2>
      <div class="landing-workflow landing-pipeline">
        <article><span id="stat-capture">—</span><h3>Capture</h3><p>Field reports submitted from the offline-first PWA</p></article>
        <article><span id="stat-extract">—</span><h3>Schedule Link</h3><p>L5/L6 activities structured under active projects</p></article>
        <article><span id="stat-match">—</span><h3>Evidence</h3><p>Photo packets linked to schedule activities</p></article>
        <article><span id="stat-review">—</span><h3>Review</h3><p>Items awaiting planner validation right now</p></article>
        <article><span id="stat-reconcile">—</span><h3>Reconcile</h3><p>Reports processed through the schedule bridge</p></article>
      </div>
    </section>

    <section class="landing-pro-section">
      <span class="landing-eyebrow">ROLE-BASED OPERATIONS</span><h2>One shared picture.<br>Built for every delivery role.</h2>
      <div class="landing-workflow landing-roles">
        <article data-role="Field Supervisor"><span>⌁</span><h3>Field Supervisor</h3><p>Voice-to-schedule capture with photos, offline drafts and auto-sync.</p></article>
        <article data-role="Planner"><span>⌘</span><h3>Planner</h3><p>Transparent AI match suggestions with confidence you can audit.</p></article>
        <article data-role="Reviewer"><span>◎</span><h3>QAQC Reviewer</h3><p>Evidence-backed verification before any schedule actual moves.</p></article>
        <article data-role="Executive"><span>↗</span><h3>Executive</h3><p>Daily derived intelligence, grounded in verified delivery signals.</p></article>
      </div>
    </section>

    <section class="landing-trust-strip">
      <span id="trust-offline"></span>
      <span class="trust-item">🔗 Immutable audit chain</span>
      <span id="trust-evidence"></span>
      <span class="trust-item">📴 Works fully offline</span>
    </section>
  `;

  container.querySelector('#landing-enter').addEventListener('click', () => {
    AppRouter.navigate(Auth.isAuthenticated() ? '/overview' : '/login');
  });

  const scrollBtn = container.querySelector('#landing-scroll-pipeline');
  if (scrollBtn) {
    scrollBtn.addEventListener('click', () => {
      container.querySelector('#landing-pipeline')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

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

  startIndustrialScene(container.querySelector('#landing-industrial-canvas'));

  return container;
}

function startIndustrialScene(canvas) {
  const context = canvas?.getContext('2d');
  if (!context) return;
  let frame;
  const resize = () => { canvas.width = canvas.clientWidth * devicePixelRatio; canvas.height = canvas.clientHeight * devicePixelRatio; context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); };
  const draw = (time) => {
    const width = canvas.clientWidth, height = canvas.clientHeight, horizon = height * .42, speed = time * .00022;
    context.clearRect(0, 0, width, height);
    for (let i = 0; i < 14; i++) { const d = (i / 14 + speed) % 1, y = horizon + d * d * height * .7, spread = 35 + d * width * .52; context.strokeStyle = `rgba(223,115,255,${.04 + d * .14})`; context.beginPath(); context.moveTo(width / 2 - spread, y); context.lineTo(width / 2 + spread, y); context.stroke(); }
    context.strokeStyle = 'rgba(0,218,116,.22)'; context.lineWidth = 7; [[.12,.42],[.88,.58]].forEach(([from, to]) => { context.beginPath(); context.moveTo(width * from, height); context.lineTo(width * to, horizon); context.stroke(); });
    context.lineWidth = 2; for (let i = 0; i < 4; i++) { const z = (i / 4 + speed * .35) % 1, x = width * (.5 + (i % 2 ? .19 : -.19) * z), y = horizon + z * height * .44, size = 15 + z * 75; context.strokeStyle = `rgba(223,115,255,${.1 + z * .35})`; context.beginPath(); context.moveTo(x - size, y + size); context.lineTo(x, y - size * 1.8); context.lineTo(x + size, y + size); context.stroke(); }
    frame = requestAnimationFrame(draw);
  };
  new ResizeObserver(resize).observe(canvas); resize(); draw(0);
  canvas.closest('.product-landing')._industrialScene = () => cancelAnimationFrame(frame);
}
