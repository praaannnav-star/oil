import { AppRouter } from '../router.js';
import { Auth } from '../services/auth.js';

export function LandingView() {
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
        <a href="#landing-workflow" class="landing-text-link">Explore the workflow ↓</a>
      </div>
      <div class="landing-signal-row">
        <span><b>01</b> Field capture</span><span><b>02</b> AI matching</span><span><b>03</b> Planner approval</span><span><b>04</b> Audit trail</span>
      </div>
    </section>
    <section id="landing-workflow" class="landing-workflow">
      <article><span>01</span><h2>Capture at source</h2><p>Voice notes, structured updates, photos, and offline drafts originate at the workfront.</p></article>
      <article><span>02</span><h2>Reconcile with plan</h2><p>Execution events are matched against the correct schedule activity with transparent confidence signals.</p></article>
      <article><span>03</span><h2>Lead with evidence</h2><p>Project leaders see health, risks, progress and approvals from one role-specific command center.</p></article>
    </section>
  `;
  container.querySelector('#landing-enter').addEventListener('click', () => {
    AppRouter.navigate(Auth.isAuthenticated() ? '/overview' : '/login');
  });
  return container;
}
