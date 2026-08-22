import { ProjectsService } from '../services/projects.js';
import { AnalyticsService } from '../services/analytics.js';
import { ReportsService } from '../services/reports.js';
import { MetricCard, Card } from '../components/Card.js';
import { Badge } from '../components/Badge.js';
import { Button } from '../components/Button.js';
import { Table } from '../components/Table.js';
import { Icons } from '../components/Icons.js';
import { AppRouter } from '../router.js';
import { escapeHtml } from '../utils/dom.js';

export async function OverviewView() {
  const container = document.createElement('div');
  container.className = 'view-container';

  // Page Header
  const header = document.createElement('div');
  header.className = 'd-flex justify-between items-center flex-wrap gap-2';
  header.innerHTML = `
    <div>
      <h1 class="text-2xl font-bold text-primary">Executive Operations Overview</h1>
      <p class="text-xs text-secondary mt-1">Cross-project operational intelligence linking actual field events to L5/L6 schedule performance</p>
    </div>
  `;

  const actionsGroup = document.createElement('div');
  actionsGroup.className = 'd-flex gap-2';

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

  kpiGrid.appendChild(MetricCard({
    label: 'ACTIVE INFRA PROJECTS',
    value: metrics.totalProjects,
    subtext: 'OIL Major Capital Works',
    icon: Icons.projects()
  }));

  kpiGrid.appendChild(MetricCard({
    label: 'DELAYED ACTIVITIES (L5/L6)',
    value: metrics.totalDelayedActs,
    status: 'danger',
    subtext: '4 activities requiring corrective action',
    icon: Icons.alert()
  }));

  kpiGrid.appendChild(MetricCard({
    label: 'PENDING FIELD REVIEWS',
    value: metrics.pendingReviews,
    status: 'warning',
    subtext: 'Awaiting planner reconciliation',
    icon: Icons.review()
  }));

  kpiGrid.appendChild(MetricCard({
    label: 'EVIDENCE COVERAGE',
    value: `${metrics.avgCoverage}%`,
    status: 'success',
    subtext: 'Photo & inspection quality audit',
    icon: Icons.evidence()
  }));

  container.appendChild(kpiGrid);

  // "What changed since yesterday?" Intelligence Box (Mandatory Core Feature)
  const prj = await ProjectsService.getProject('PRJ-OIL-2026-01');
  const intelligenceCard = document.createElement('div');
  intelligenceCard.className = 'card p-4 gap-3';
  intelligenceCard.style.background = 'linear-gradient(180deg, rgba(37, 99, 235, 0.08) 0%, var(--color-surface) 100%)';
  intelligenceCard.style.borderColor = 'rgba(37, 99, 235, 0.35)';

  intelligenceCard.innerHTML = `
    <div class="card-header p-0 mb-1">
      <div class="d-flex items-center gap-2">
        <span class="text-primary">${Icons.sparkle()}</span>
        <h3 class="card-title text-md">WHAT CHANGED SINCE YESTERDAY?</h3>
      </div>
      <span class="badge badge-in-progress">DAILY OPERATIONAL INTELLIGENCE</span>
    </div>
  `;

  // Derived from real field data — no hardcoded intelligence blocks
  const digestSignals = await ReportsService.summarizeDailyDigest('PRJ-OIL-2026-01');
  const toneClass = { success: 'text-success', info: 'text-info', danger: 'text-danger', warning: 'text-warning' };
  const digestGrid = document.createElement('div');
  digestGrid.className = 'd-grid grid-3 gap-3 mt-1';
  digestSignals.forEach(signal => {
    const cell = document.createElement('div');
    cell.className = 'card p-3 gap-1';
    cell.style.background = 'var(--color-surface-el)';
    const h = document.createElement('div');
    h.className = `text-xs font-bold font-mono ${toneClass[signal.tone] || 'text-secondary'}`;
    h.textContent = signal.headline;
    const d = document.createElement('div');
    d.className = 'text-xs text-secondary';
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
  portfolioSection.className = 'card p-4 gap-3';

  portfolioSection.innerHTML = `
    <div class="card-header p-0 mb-1">
      <h3 class="card-title">Active Infrastructure Projects Portfolio</h3>
      <span class="text-xs text-muted">Oil India Limited Strategic Capital Works</span>
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
