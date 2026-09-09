import { ProjectsService } from '../services/projects.js';
import { AnalyticsService } from '../services/analytics.js';
import { ReportsService } from '../services/reports.js';
import { Badge } from '../components/Badge.js';
import { Button } from '../components/Button.js';
import { Table } from '../components/Table.js';
import { Icons } from '../components/Icons.js';
import { AppRouter } from '../router.js';
import { State } from '../state.js';
import { escapeHtml } from '../utils/dom.js';

function monoMetric(label, value, detail) {
  const card = document.createElement('article');
  card.className = 'card p-3 gap-1';
  card.innerHTML = `
    <span class="text-xs font-bold text-muted uppercase tracking-wider">${escapeHtml(label)}</span>
    <strong class="text-3xl font-bold text-primary font-mono mt-2">${escapeHtml(String(value))}</strong>
    <small class="text-xs text-secondary mt-1">${escapeHtml(detail)}</small>
  `;
  return card;
}

export async function OverviewView() {
  const container = document.createElement('div');
  container.className = 'view-container';

  // Page Header
  const header = document.createElement('div');
  header.className = 'd-flex justify-between items-center flex-wrap gap-2 mb-2';
  header.innerHTML = `
    <div>
      <h1 class="text-2xl font-bold text-primary">Operational Pulse</h1>
      <p class="text-xs text-secondary mt-1">Cross-project intelligence linking verified field events to L5/L6 schedule performance</p>
    </div>
  `;

  const actionsGroup = document.createElement('div');
  actionsGroup.className = 'd-flex gap-2 items-center';

  const reportBtn = Button({
    text: 'Report Progress',
    icon: Icons.progress(),
    variant: 'primary',
    size: 'sm',
    onClick: () => AppRouter.navigate('/progress/new')
  });

  const reviewBtn = Button({
    text: 'Review Queue',
    icon: Icons.review(),
    variant: 'secondary',
    size: 'sm',
    onClick: () => AppRouter.navigate('/review')
  });

  actionsGroup.appendChild(reportBtn);
  actionsGroup.appendChild(reviewBtn);
  header.appendChild(actionsGroup);
  container.appendChild(header);

  // High Level KPIs
  const metrics = await AnalyticsService.getExecutiveMetrics();
  const kpiGrid = document.createElement('div');
  kpiGrid.className = 'd-grid grid-4 gap-3';
  kpiGrid.append(
    monoMetric('ACTIVE INFRA PROJECTS', metrics.totalProjects, 'OIL capital works portfolio'),
    monoMetric('DELAYED L5/L6 ACTIVITIES', metrics.totalDelayedActs, 'Requires corrective action'),
    monoMetric('PENDING FIELD REVIEWS', metrics.pendingReviews, 'Awaiting planner reconciliation'),
    monoMetric('EVIDENCE COVERAGE', `${metrics.avgCoverage}%`, 'Photo and inspection quality audit')
  );

  container.appendChild(kpiGrid);

  // "What changed since yesterday?" Intelligence Box (Mandatory Core Feature)
  const currentProjectId = State.getState().currentProjectId || 'PRJ-OIL-DUL-001';
  const intelligenceCard = document.createElement('div');
  intelligenceCard.className = 'card gap-3';

  intelligenceCard.innerHTML = `
    <div class="d-flex justify-between items-center border-b pb-2 mb-2" style="border-color: var(--color-border-subtle)">
      <div>
        <h3 class="card-title">Delivery signal</h3>
        <p class="card-subtitle">What changed since yesterday across verified project activity.</p>
      </div>
      <span class="badge badge-pending">DAILY BRIEF</span>
    </div>
  `;

  // Derived from real field data — no hardcoded intelligence blocks
  const digestSignals = await ReportsService.summarizeDailyDigest(currentProjectId);
  const digestGrid = document.createElement('div');
  digestGrid.className = 'd-grid grid-3 gap-3';
  digestSignals.forEach(signal => {
    const cell = document.createElement('div');
    cell.className = 'p-3 rounded';
    cell.style.background = 'var(--color-surface-el)';
    cell.style.border = '1px solid var(--color-border-subtle)';
    const h = document.createElement('div');
    h.className = 'text-xs font-bold font-mono text-primary';
    h.textContent = signal.headline;
    const d = document.createElement('div');
    d.className = 'text-xs text-secondary mt-1';
    d.textContent = signal.detail;
    cell.appendChild(h);
    cell.appendChild(d);
    digestGrid.appendChild(cell);
  });
  intelligenceCard.appendChild(digestGrid);
  container.appendChild(intelligenceCard);

  // Projects Portfolio Table
  const projects = await ProjectsService.getProjects();
  const portfolioSection = document.createElement('div');
  portfolioSection.className = 'card gap-3';

  portfolioSection.innerHTML = `
    <div class="d-flex justify-between items-center border-b pb-2 mb-2" style="border-color: var(--color-border-subtle)">
      <div>
        <h3 class="card-title">Project health</h3>
        <p class="card-subtitle">Schedule progress, health, and review readiness by active project.</p>
      </div>
      <span class="badge badge-pending">PORTFOLIO</span>
    </div>
  `;

  const prjColumns = [
    {
      key: 'name',
      label: 'Project Name & Location',
      render: (val, row) => `
        <div class="d-flex flex-col">
          <strong class="text-sm text-primary">${escapeHtml(val)}</strong>
          <span class="text-xs text-muted font-mono">${escapeHtml(row.code)} • ${escapeHtml(row.location)}</span>
        </div>
      `
    },
    {
      key: 'health',
      label: 'Health',
      width: '120px',
      render: (val) => {
        let badgeStatus = 'on-track';
        if (val === 'at-risk') badgeStatus = 'at-risk';
        else if (val === 'delayed') badgeStatus = 'delayed';
        return Badge({ label: val.toUpperCase(), status: badgeStatus });
      }
    },
    {
      key: 'actualProgress',
      label: 'Progress vs Planned',
      width: '180px',
      render: (val, row) => `
        <div class="d-flex flex-col gap-1">
          <div class="d-flex justify-between text-xs font-mono font-bold">
            <span class="text-primary">${val}% Actual</span>
            <span class="text-muted">${row.plannedProgress}% Plan</span>
          </div>
          <div class="confidence-bar-bg" style="height:6px;">
            <div class="confidence-bar-fill ${row.health === 'on-track' ? 'confidence-high' : 'confidence-medium'}" style="width:${val}%;"></div>
          </div>
        </div>
      `
    },
    {
      key: 'spi',
      label: 'SPI',
      width: '90px',
      render: (val) => `<strong class="font-mono text-sm ${val < 1 ? 'text-warning' : 'text-success'}">${val}</strong>`
    },
    {
      key: 'delayedActivitiesCount',
      label: 'Delayed L5/L6',
      width: '110px',
      render: (val) => `<span class="text-xs font-mono font-bold ${val > 0 ? 'text-danger' : 'text-success'}">${val} Activities</span>`
    },
    {
      key: 'pendingReviewCount',
      label: 'Pending Reviews',
      width: '120px',
      render: (val) => `<span class="badge badge-pending font-mono">${val} Queued</span>`
    }
  ];

  const prjTable = Table({
    columns: prjColumns,
    data: projects,
    onRowClick: (row) => AppRouter.navigate(`/projects/${row.id}`)
  });
  portfolioSection.appendChild(prjTable);
  container.appendChild(portfolioSection);

  return container;
}
