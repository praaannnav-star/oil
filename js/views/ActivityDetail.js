import { ActivitiesService } from '../services/activities.js';
import { EvidenceService } from '../services/evidence.js';
import { AuditService } from '../services/audit.js';
import { Badge } from '../components/Badge.js';
import { Button } from '../components/Button.js';
import { Card, MetricCard } from '../components/Card.js';
import { Tabs } from '../components/Tabs.js';
import { Timeline } from '../components/Timeline.js';
import { EvidenceViewer } from '../components/EvidenceViewer.js';
import { Icons } from '../components/Icons.js';
import { AppRouter } from '../router.js';

export async function ActivityDetailView(params = {}) {
  const container = document.createElement('div');
  container.className = 'view-container';

  const activityId = params.id || 'ACT-CIV-B2-003';
  const activity = await ActivitiesService.getActivity(activityId);

  if (!activity) {
    container.innerHTML = `
      <div class="card p-5 text-center gap-3">
        <h2 class="text-xl font-bold text-danger">Activity Not Found</h2>
        <p class="text-secondary text-sm">No L5/L6 schedule activity found with ID: ${activityId}</p>
        <button class="btn btn-secondary" onclick="window.history.back()">Go Back</button>
      </div>
    `;
    return container;
  }

  // Breadcrumb Navigation
  const breadcrumb = document.createElement('div');
  breadcrumb.className = 'd-flex items-center gap-2 text-xs text-muted font-mono';
  breadcrumb.innerHTML = `
    <a href="#/schedule" class="text-secondary">Schedule Explorer</a>
    <span>/</span>
    <span>${activity.discipline}</span>
    <span>/</span>
    <span class="text-primary font-bold">${activity.code || activity.id}</span>
  `;
  container.appendChild(breadcrumb);

  // Activity Header Card
  const headerCard = document.createElement('div');
  headerCard.className = 'card p-4 gap-3';

  const headerTop = document.createElement('div');
  headerTop.className = 'd-flex justify-between items-center flex-wrap gap-2';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'd-flex flex-col';
  titleGroup.innerHTML = `
    <div class="d-flex items-center gap-2">
      <span class="badge badge-pending font-mono font-bold">${activity.level || 'L5'}</span>
      <h1 class="text-xl font-bold text-primary">${activity.name}</h1>
    </div>
    <span class="text-xs text-muted font-mono mt-1">WBS Code: <strong>${activity.code || activity.id}</strong> • Project: Oil India Limited portfolio</span>
  `;
  headerTop.appendChild(titleGroup);

  const statusBadge = Badge({
    label: (activity.status || 'in-progress').toUpperCase(),
    status: activity.status || 'in-progress'
  });
  headerTop.appendChild(statusBadge);
  headerCard.appendChild(headerTop);

  container.appendChild(headerCard);

  // High-Level KPI Comparison Grid (Planned vs Actual vs Variance)
  const kpiGrid = document.createElement('div');
  kpiGrid.className = 'd-grid grid-4 gap-3';

  kpiGrid.appendChild(MetricCard({
    label: 'PLANNED FINISH',
    value: activity.plannedFinish || 'N/A',
    subtext: `Start: ${activity.plannedStart || 'N/A'}`
  }));

  kpiGrid.appendChild(MetricCard({
    label: 'ACTUAL FINISH',
    value: activity.actualFinish || 'In Progress',
    status: activity.actualFinish ? 'success' : 'info',
    subtext: `Start: ${activity.actualStart || 'Pending'}`
  }));

  kpiGrid.appendChild(MetricCard({
    label: 'SCHEDULE VARIANCE',
    value: activity.variance !== undefined ? (activity.variance > 0 ? `+${activity.variance}d` : `${activity.variance}d`) : '0d',
    status: activity.variance < 0 ? 'danger' : (activity.variance > 0 ? 'success' : 'primary'),
    subtext: activity.variance < 0 ? '2 days finish variance' : 'Tracking on baseline'
  }));

  kpiGrid.appendChild(MetricCard({
    label: 'ACTUAL PROGRESS',
    value: `${activity.progress || 0}%`,
    status: activity.progress === 100 ? 'success' : 'primary',
    subtext: `Review State: ${activity.reviewState || 'Approved'}`
  }));

  container.appendChild(kpiGrid);

  // Tabs for Deep Operational Dive
  let activeTab = 'overview';
  const tabContainer = document.createElement('div');

  const evidenceItems = await EvidenceService.getEvidence(activity.id);
  const auditLogs = await AuditService.getAuditLogs(activity.id);

  const tabsNav = Tabs({
    tabs: [
      { id: 'overview', label: 'Planned vs Actual Analysis', icon: Icons.overview() },
      { id: 'evidence', label: `Evidence Verification (${evidenceItems.length})`, icon: Icons.evidence() },
      { id: 'deviation', label: 'Deviation & Corrective Action', icon: Icons.alert() },
      { id: 'audit', label: `Audit Trail (${auditLogs.length})`, icon: Icons.audit() }
    ],
    activeTab,
    onTabChange: (tabId) => {
      activeTab = tabId;
      renderTabContent();
    }
  });
  container.appendChild(tabsNav);

  const tabContentWrapper = document.createElement('div');
  container.appendChild(tabContentWrapper);

  function renderTabContent() {
    tabContentWrapper.innerHTML = '';

    if (activeTab === 'overview') {
      // Tab 1: Planned vs Actual Deep Comparison
      const compCard = document.createElement('div');
      compCard.className = 'd-grid grid-3 gap-4';

      // Column 1: Planned Baseline
      const colPlan = document.createElement('div');
      colPlan.className = 'card p-4 gap-3';
      colPlan.innerHTML = `
        <div class="card-header p-0 mb-2">
          <strong class="text-sm text-primary uppercase">PLANNED BASELINE (L5/L6 SCHEDULE)</strong>
        </div>
        <div class="d-flex flex-col gap-2 text-sm">
          <div class="d-flex justify-between"><span class="text-muted">Planned Start:</span> <strong class="font-mono">${activity.plannedStart || 'N/A'}</strong></div>
          <div class="d-flex justify-between"><span class="text-muted">Planned Finish:</span> <strong class="font-mono">${activity.plannedFinish || 'N/A'}</strong></div>
          <div class="d-flex justify-between"><span class="text-muted">Planned Duration:</span> <strong>7 Calendar Days</strong></div>
          <div class="d-flex justify-between"><span class="text-muted">Discipline:</span> <strong>${activity.discipline}</strong></div>
          <div class="d-flex justify-between"><span class="text-muted">Dependencies:</span> <span class="text-xs text-info">CIV-B2-002 (Rebar)</span></div>
        </div>
      `;
      compCard.appendChild(colPlan);

      // Column 2: Actual Execution (Field Linked)
      const colActual = document.createElement('div');
      colActual.className = 'card p-4 gap-3';
      colActual.style.borderColor = 'var(--color-primary-dim)';
      colActual.innerHTML = `
        <div class="card-header p-0 mb-2">
          <strong class="text-sm text-info uppercase">ACTUAL EXECUTION (FIELD LINKED)</strong>
        </div>
        <div class="d-flex flex-col gap-2 text-sm">
          <div class="d-flex justify-between"><span class="text-muted">Actual Start:</span> <strong class="font-mono text-primary">${activity.actualStart || '—'}</strong></div>
          <div class="d-flex justify-between"><span class="text-muted">Actual Finish:</span> <strong class="font-mono text-success">${activity.actualFinish || 'In Progress'}</strong></div>
          <div class="d-flex justify-between"><span class="text-muted">Actual Progress:</span> <strong class="font-mono text-primary">${activity.progress}%</strong></div>
          <div class="d-flex justify-between"><span class="text-muted">Verified Source:</span> <strong>Voice Field Report</strong></div>
          <div class="d-flex justify-between"><span class="text-muted">Evidence Linked:</span> <strong>${evidenceItems.length} Photo Packets</strong></div>
        </div>
      `;
      compCard.appendChild(colActual);

      // Column 3: Variance & Reconciliation Summary
      const colVariance = document.createElement('div');
      colVariance.className = 'card p-4 gap-3';
      colVariance.innerHTML = `
        <div class="card-header p-0 mb-2">
          <strong class="text-sm text-warning uppercase">VARIANCE & IMPACT</strong>
        </div>
        <div class="d-flex flex-col gap-2 text-sm">
          <div class="d-flex justify-between"><span class="text-muted">Start Variance:</span> <span class="font-mono text-danger">-1 day delay</span></div>
          <div class="d-flex justify-between"><span class="text-muted">Finish Variance:</span> <span class="font-mono text-danger">-2 days delay</span></div>
          <div class="d-flex justify-between"><span class="text-muted">Schedule SPI:</span> <strong class="font-mono text-warning">0.91</strong></div>
          <div class="d-flex justify-between"><span class="text-muted">Milestone Impact:</span> <span class="text-xs text-warning">MS-3 Handover at risk (+2d)</span></div>
          <div class="d-flex justify-between"><span class="text-muted">Reconciliation Status:</span> <span class="badge badge-on-track">RECONCILED</span></div>
        </div>
      `;
      compCard.appendChild(colVariance);

      tabContentWrapper.appendChild(compCard);
    } else if (activeTab === 'evidence') {
      // Tab 2: Evidence Viewer
      const evCard = document.createElement('div');
      evCard.className = 'card p-4 gap-3';
      evCard.innerHTML = `
        <div class="d-flex justify-between items-center">
          <h3 class="card-title">Photographic & Quality Evidence Packets</h3>
          <span class="text-xs text-muted">Geo-tagged and Timestamp-locked</span>
        </div>
      `;
      evCard.appendChild(EvidenceViewer({ items: evidenceItems }));
      tabContentWrapper.appendChild(evCard);
    } else if (activeTab === 'deviation') {
      // Tab 3: Deviation & Corrective Action
      const devCard = document.createElement('div');
      devCard.className = 'card p-4 gap-4';
      
      const dev = activity.deviation || {
        expected: 'Casting completed by 16 Aug with standard curing regime',
        actual: 'Completed on 18 Aug with +2 days variance due to torrential rainfall',
        cause: 'Severe monsoon precipitation and moisture compensation testing at batching plant',
        verifiedBy: 'M. Bordoloi (Executive Engineer, OIL Inspection)',
        correctiveAction: 'Accelerated thermal curing compound applied; subsequent anchor bolt installation shifted to double shifts to prevent downstream milestone slippage.'
      };

      devCard.innerHTML = `
        <div class="card-header p-0 mb-1">
          <h3 class="card-title text-warning">
            ${Icons.alert()}
            <span>DEVIATION ANALYSIS & CORRECTIVE ACTION</span>
          </h3>
          <span class="badge badge-at-risk">RESOLVED WITH MITIGATION</span>
        </div>

        <div class="d-grid grid-2 gap-4">
          <div class="card p-3 gap-2" style="background:var(--color-surface-el);">
            <strong class="text-xs text-muted uppercase">1. What Was Expected?</strong>
            <p class="text-sm text-primary">${dev.expected}</p>
          </div>
          
          <div class="card p-3 gap-2" style="background:var(--color-surface-el);">
            <strong class="text-xs text-muted uppercase">2. What Actually Happened?</strong>
            <p class="text-sm text-danger font-semibold">${dev.actual}</p>
          </div>

          <div class="card p-3 gap-2" style="background:var(--color-surface-el);">
            <strong class="text-xs text-muted uppercase">3. Root Cause Identified</strong>
            <p class="text-sm text-primary">${dev.cause}</p>
          </div>

          <div class="card p-3 gap-2" style="background:var(--color-surface-el);">
            <strong class="text-xs text-muted uppercase">4. Verification & Authority</strong>
            <p class="text-sm text-primary">Verified by: <strong>${dev.verifiedBy}</strong></p>
          </div>
        </div>

        <div class="card p-4 gap-2" style="background:rgba(37, 99, 235, 0.08); border-color:rgba(37, 99, 235, 0.3);">
          <strong class="text-xs text-info uppercase">5. Corrective Action & Recovery Plan</strong>
          <p class="text-sm text-primary">${dev.correctiveAction}</p>
        </div>
      `;

      tabContentWrapper.appendChild(devCard);
    } else if (activeTab === 'audit') {
      // Tab 4: Audit Trail
      const auditCard = document.createElement('div');
      auditCard.className = 'card p-4 gap-3';
      auditCard.innerHTML = `
        <div class="card-header p-0 mb-2">
          <h3 class="card-title">Audit Trail & Chain of Custody</h3>
          <span class="text-xs text-muted">Immutable timestamped transitions</span>
        </div>
      `;
      auditCard.appendChild(Timeline({ events: auditLogs }));
      tabContentWrapper.appendChild(auditCard);
    }
  }

  renderTabContent();
  return container;
}
