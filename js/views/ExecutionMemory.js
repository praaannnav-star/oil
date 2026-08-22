import { AnalyticsService } from '../services/analytics.js';
import { ReportsService } from '../services/reports.js';
import { Card } from '../components/Card.js';
import { Table } from '../components/Table.js';
import { Badge } from '../components/Badge.js';
import { Icons } from '../components/Icons.js';

export async function ExecutionMemoryView() {
  const container = document.createElement('div');
  container.className = 'view-container';

  // Header
  const header = document.createElement('div');
  header.className = 'd-flex justify-between items-center flex-wrap gap-2';
  header.innerHTML = `
    <div>
      <h1 class="text-2xl font-bold text-primary">Organizational Execution Memory</h1>
      <p class="text-xs text-secondary mt-1">Empirical project intelligence aggregated from historical field actuals, recurring delay causes, and discipline duration patterns</p>
    </div>
  `;
  container.appendChild(header);

  const memoryData = await AnalyticsService.getExecutionMemoryData();

  // Top Insights Card
  const insightCard = document.createElement('div');
  insightCard.className = 'card p-4 gap-3';
  insightCard.style.background = 'linear-gradient(180deg, rgba(37, 99, 235, 0.08) 0%, var(--color-surface) 100%)';
  insightCard.style.borderColor = 'rgba(37, 99, 235, 0.3)';

  insightCard.innerHTML = `
    <div class="card-header p-0 mb-1">
      <h3 class="card-title">
        ${Icons.memory()}
        <span>EMPIRICAL EXECUTION PATTERNS & BOTTLENECK IDENTIFIERS</span>
      </h3>
      <span class="badge badge-in-progress">HISTORICAL AGGREGATION</span>
    </div>
    <div class="d-grid grid-3 gap-3 text-sm mt-1">
      <div class="card p-3 gap-1" style="background:var(--color-surface-el);">
        <strong class="text-xs text-danger uppercase font-mono">Top Schedule Risk (Weather)</strong>
        <p class="text-xs text-secondary">Monsoon rainfall accounts for <strong>34% of all historical activity delays</strong> across Upper Assam drilling & gathering stations.</p>
      </div>
      <div class="card p-3 gap-1" style="background:var(--color-surface-el);">
        <strong class="text-xs text-warning uppercase font-mono">Procurement Lead Time</strong>
        <p class="text-xs text-secondary">Instrumentation double-compression cable glands consistently encounter <strong>+12 days transit variance</strong> from eastern regional hubs.</p>
      </div>
      <div class="card p-3 gap-1" style="background:var(--color-surface-el);">
        <strong class="text-xs text-success uppercase font-mono">Electrical Acceleration</strong>
        <p class="text-xs text-secondary">Substation transformer foundation placing completes <strong>1.1% faster than baseline</strong> due to standardized pre-cast plinth engineering.</p>
      </div>
    </div>
  `;
  container.appendChild(insightCard);

  // Live Delay Signals — classified from actual field reports via
  // classifyDelayCause (rules engine today, Workers AI when live).
  const allReports = await ReportsService.getReports();
  const blockerReports = allReports.filter(r => r.extractedEvent?.blocker && r.extractedEvent.blocker !== 'None');
  if (blockerReports.length > 0) {
    const causeCounts = new Map();
    for (const report of blockerReports) {
      const cause = await ReportsService.classifyDelayCause(report.extractedEvent.blocker);
      if (!causeCounts.has(cause.code)) {
        causeCounts.set(cause.code, { label: cause.label, count: 0 });
      }
      causeCounts.get(cause.code).count++;
    }
    const liveCauses = [...causeCounts.values()].sort((a, b) => b.count - a.count);

    const liveCard = document.createElement('div');
    liveCard.className = 'card p-4 gap-3';
    liveCard.innerHTML = `
      <div class="card-header p-0 mb-1">
        <h3 class="card-title">Live Delay Signals — Current Field Reports</h3>
        <span class="text-xs text-muted">Auto-classified from ${blockerReports.length} blocker observation(s)</span>
      </div>
    `;
    const liveGrid = document.createElement('div');
    liveGrid.className = 'd-grid grid-3 gap-2 text-sm mt-1';
    liveCauses.forEach(c => {
      const cell = document.createElement('div');
      cell.className = 'card p-3 gap-1';
      cell.style.background = 'var(--color-surface-el)';
      cell.innerHTML = `
        <strong class="text-xs text-danger uppercase font-mono">${c.count} Event${c.count > 1 ? 's' : ''}</strong>
        <p class="text-xs text-secondary">${c.label}</p>
      `;
      liveGrid.appendChild(cell);
    });
    liveCard.appendChild(liveGrid);
    container.appendChild(liveCard);
  }

  // Section 1: Recurring Delay Causes Table
  const delayCard = document.createElement('div');
  delayCard.className = 'card p-4 gap-3';
  delayCard.innerHTML = `
    <div class="card-header p-0 mb-1">
      <h3 class="card-title">Top Recurring Delay Causes Across OIL Infrastructure Projects</h3>
      <span class="text-xs text-muted">Ranked by Cumulative Schedule Impact (Days)</span>
    </div>
  `;

  const delayColumns = [
    {
      key: 'cause',
      label: 'Root Cause Description',
      render: (val) => `<strong class="text-sm text-primary">${val}</strong>`
    },
    {
      key: 'discipline',
      label: 'Discipline',
      width: '140px',
      render: (val) => Badge({ label: val, status: 'in-progress' })
    },
    {
      key: 'count',
      label: 'Occurrences',
      width: '110px',
      render: (val) => `<span class="font-mono font-bold text-sm text-secondary">${val} Events</span>`
    },
    {
      key: 'pct',
      label: 'Share of Delays',
      width: '140px',
      render: (val) => `
        <div class="d-flex items-center gap-2">
          <div class="confidence-bar-bg" style="width:60px; height:6px;">
            <div class="confidence-bar-fill confidence-medium" style="width:${val * 2}%;"></div>
          </div>
          <span class="font-mono text-xs text-warning">${val}%</span>
        </div>
      `
    },
    {
      key: 'impactDays',
      label: 'Cumulative Delay',
      width: '130px',
      render: (val) => `<strong class="text-sm font-mono text-danger">+${val} Days</strong>`
    }
  ];

  const delayTable = Table({
    columns: delayColumns,
    data: memoryData.historicalDelayCauses
  });
  delayCard.appendChild(delayTable);
  container.appendChild(delayCard);

  // Section 2: Discipline Performance Historical Matrix
  const perfCard = document.createElement('div');
  perfCard.className = 'card p-4 gap-3';
  perfCard.innerHTML = `
    <div class="card-header p-0 mb-1">
      <h3 class="card-title">Discipline Planned vs Actual Duration Variance History</h3>
      <span class="text-xs text-muted">Baseline Calibration Dataset</span>
    </div>
  `;

  const perfColumns = [
    {
      key: 'discipline',
      label: 'Engineering Discipline',
      render: (val) => `<strong class="text-sm text-primary">${val}</strong>`
    },
    {
      key: 'sampleActivities',
      label: 'Sample Size',
      width: '120px',
      render: (val) => `<span class="text-xs font-mono text-muted">${val} Completed L5s</span>`
    },
    {
      key: 'plannedDays',
      label: 'Avg Planned Duration',
      width: '160px',
      render: (val) => `<span class="font-mono text-xs text-secondary">${val} Days</span>`
    },
    {
      key: 'actualAvgDays',
      label: 'Avg Actual Duration',
      width: '160px',
      render: (val) => `<span class="font-mono text-xs text-primary font-bold">${val} Days</span>`
    },
    {
      key: 'variancePct',
      label: 'Duration Drag %',
      width: '140px',
      render: (val) => `<strong class="font-mono text-xs ${val < 0 ? 'text-danger' : 'text-success'}">${val > 0 ? '+' : ''}${val}%</strong>`
    }
  ];

  const perfTable = Table({
    columns: perfColumns,
    data: memoryData.disciplinePerformance
  });
  perfCard.appendChild(perfTable);
  container.appendChild(perfCard);

  return container;
}
