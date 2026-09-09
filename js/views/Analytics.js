import { AnalyticsService } from '../services/analytics.js';
import { Card, MetricCard } from '../components/Card.js';
import { Button } from '../components/Button.js';
import { Badge } from '../components/Badge.js';
import { Icons } from '../components/Icons.js';
import { Toast } from '../components/Toast.js';
import { escapeHtml } from '../utils/dom.js';

export async function AnalyticsView() {
  const container = document.createElement('div');
  container.className = 'view-container';

  // Header
  const header = document.createElement('div');
  header.className = 'd-flex justify-between items-center flex-wrap gap-2 mb-2';
  header.innerHTML = `
    <div>
      <div class="d-flex items-center gap-2">
        <h1 class="text-2xl font-bold text-primary">Project Intelligence & Analytics</h1>
        <span class="badge badge-success" style="font-size:10px; padding:2px 8px;">LIVE D1 ENGINE</span>
      </div>
      <p class="text-xs text-secondary mt-1">Real-time schedule reconciliation, LLM discipline categorization, and reviewer acceptance metrics</p>
    </div>
  `;

  const refreshBtn = Button({
    text: 'Refresh Analytics',
    icon: Icons.sync(),
    variant: 'secondary',
    size: 'sm',
    onClick: async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Refreshing...';
      await renderAnalytics(true);
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Refresh Analytics';
      Toast.success('Analytics metrics refreshed from live database.');
    }
  });
  header.appendChild(refreshBtn);
  container.appendChild(header);

  const contentMount = document.createElement('div');
  contentMount.className = 'd-flex flex-col gap-4';
  container.appendChild(contentMount);

  async function renderAnalytics(isRefresh = false) {
    if (!isRefresh) {
      contentMount.innerHTML = '<div class="p-4 text-center text-muted font-mono">Computing live schedule analytics & discipline telemetry...</div>';
    }

    try {
      const data = await AnalyticsService.getLiveAnalytics();
      contentMount.innerHTML = '';

      const kpis = data.kpis || {};
      const breakdown = data.disciplineBreakdown || [];
      const heatmap = data.confidenceHeatmap || [];
      const scurve = data.sCurve || [];

      // 1. Top KPI Grid
      const kpiGrid = document.createElement('div');
      kpiGrid.className = 'd-grid grid-4 gap-3';

      const spiStatus = kpis.portfolioSpi >= 1.0 ? 'success' : (kpis.portfolioSpi >= 0.88 ? 'warning' : 'danger');
      const spiText = kpis.spiDrag != null && kpis.spiDrag > 0
        ? `Target 1.00 • ${kpis.spiDrag}% schedule drag`
        : `Target 1.00 • On track / Ahead (+${Math.abs(kpis.spiDrag || 0)}%)`;

      kpiGrid.appendChild(MetricCard({
        label: 'PORTFOLIO SPI',
        value: kpis.portfolioSpi != null ? String(kpis.portfolioSpi) : '—',
        status: spiStatus,
        subtext: spiText
      }));

      kpiGrid.appendChild(MetricCard({
        label: 'REVIEW RECONCILIATION VELOCITY',
        value: kpis.reviewVelocityHours != null ? `${kpis.reviewVelocityHours} hrs` : '—',
        status: 'success',
        subtext: 'Average reviewer turnaround time'
      }));

      kpiGrid.appendChild(MetricCard({
        label: 'FIELD REPORT ADOPTION',
        value: kpis.fieldReportAdoptionPct != null ? `${kpis.fieldReportAdoptionPct}%` : '0%',
        status: 'primary',
        subtext: `${data.meta?.totalReports || 0} reports captured across active sites`
      }));

      const accStatus = (kpis.firstPassAccuracyPct ?? 90) >= 80 ? 'success' : 'warning';
      kpiGrid.appendChild(MetricCard({
        label: 'FIRST-PASS MATCH ACCURACY',
        value: kpis.firstPassAccuracyPct != null ? `${kpis.firstPassAccuracyPct}%` : '—',
        status: accStatus,
        subtext: `${kpis.pendingReviewsCount ?? 0} items currently pending review`
      }));

      contentMount.appendChild(kpiGrid);

      // 2. Activity Status Breakdown (Completed, In Progress, Started / Not Started)
      const statusData = data.activityStatusBreakdown || {
        completed: { count: 0, pct: 0 },
        inProgress: { count: 0, pct: 0 },
        started: { count: 0, pct: 0 },
        total: 0
      };

      const statusCard = document.createElement('div');
      statusCard.className = 'card p-4 gap-3';
      statusCard.innerHTML = `
        <div class="card-header p-0 mb-1 d-flex justify-between items-center flex-wrap gap-2">
          <div>
            <h3 class="card-title">Schedule Execution Progress Distribution</h3>
            <span class="text-xs text-muted">Tracking progress across all activities: Completed, In Progress, and Started / Pending</span>
          </div>
          <span class="badge badge-neutral font-mono" style="padding:2px 8px; font-size:11px;">${statusData.total} Activities Tracked</span>
        </div>

        <div class="d-flex rounded overflow-hidden" style="height: 14px; background: var(--color-surface-el); border: 1px solid var(--color-border); border-radius: 6px;">
          <div style="width: ${statusData.completed.pct}%; background: var(--color-success); transition: width 0.4s ease;" title="Completed: ${statusData.completed.count} (${statusData.completed.pct}%)"></div>
          <div style="width: ${statusData.inProgress.pct}%; background: var(--color-info); transition: width 0.4s ease;" title="In Progress: ${statusData.inProgress.count} (${statusData.inProgress.pct}%)"></div>
          <div style="width: ${statusData.started.pct}%; background: var(--color-warning); transition: width 0.4s ease;" title="Started / Pending: ${statusData.started.count} (${statusData.started.pct}%)"></div>
        </div>

        <div class="d-grid grid-3 gap-3 mt-1">
          <div class="p-3 rounded border" style="background: var(--color-surface); border-color: rgba(16,185,129,0.25) !important;">
            <div class="d-flex justify-between items-center text-xs">
              <span class="d-flex items-center gap-2 font-bold text-success">
                <span style="width:8px; height:8px; border-radius:50%; background:var(--color-success); display:inline-block;"></span>
                COMPLETED (100%)
              </span>
              <span class="badge badge-completed font-mono">${statusData.completed.pct}%</span>
            </div>
            <div class="text-2xl font-bold font-mono text-primary mt-1">${statusData.completed.count} <span class="text-xs text-muted font-sans font-normal">milestones achieved</span></div>
          </div>

          <div class="p-3 rounded border" style="background: var(--color-surface); border-color: rgba(2,132,199,0.25) !important;">
            <div class="d-flex justify-between items-center text-xs">
              <span class="d-flex items-center gap-2 font-bold text-info">
                <span style="width:8px; height:8px; border-radius:50%; background:var(--color-info); display:inline-block;"></span>
                IN PROGRESS (1–99%)
              </span>
              <span class="badge badge-in-progress font-mono">${statusData.inProgress.pct}%</span>
            </div>
            <div class="text-2xl font-bold font-mono text-primary mt-1">${statusData.inProgress.count} <span class="text-xs text-muted font-sans font-normal">active field execution</span></div>
          </div>

          <div class="p-3 rounded border" style="background: var(--color-surface); border-color: rgba(245,158,11,0.25) !important;">
            <div class="d-flex justify-between items-center text-xs">
              <span class="d-flex items-center gap-2 font-bold text-warning">
                <span style="width:8px; height:8px; border-radius:50%; background:var(--color-warning); display:inline-block;"></span>
                STARTED / PENDING
              </span>
              <span class="badge badge-warning font-mono">${statusData.started.pct}%</span>
            </div>
            <div class="text-2xl font-bold font-mono text-primary mt-1">${statusData.started.count} <span class="text-xs text-muted font-sans font-normal">workfront ready</span></div>
          </div>
        </div>
      `;
      contentMount.appendChild(statusCard);

      // 3. Charts Grid: S-Curve + Discipline Performance
      const chartsGrid = document.createElement('div');
      chartsGrid.className = 'd-grid grid-2 gap-4';

      // Chart 1: Dynamic S-Curve SVG
      const scurveCard = document.createElement('div');
      scurveCard.className = 'card p-4 gap-3';

      // Compute SVG coordinates from real sCurve points
      const n = scurve.length;
      const xStep = n > 1 ? (420 / (n - 1)) : 420;
      const getX = (idx) => Math.round(50 + idx * xStep);
      const getY = (val) => Math.round(180 - (Math.min(100, Math.max(0, Number(val) || 0)) / 100) * 160);

      let plannedPoints = '';
      let actualPoints = '';
      let currentPoint = null;

      scurve.forEach((pt, idx) => {
        const x = getX(idx);
        const yPlan = getY(pt.planned);
        plannedPoints += `${idx === 0 ? 'M' : 'L'} ${x} ${yPlan} `;

        if (pt.actual !== null && pt.actual !== undefined && !isNaN(pt.actual)) {
          const yAct = getY(pt.actual);
          actualPoints += `${actualPoints === '' ? 'M' : 'L'} ${x} ${yAct} `;
          if (pt.isCurrent) {
            currentPoint = { x, y: yAct, label: `${pt.actual}% Actual (${pt.month})`, planned: pt.planned, actual: pt.actual };
          }
        }
      });

      if (!currentPoint && scurve.length > 0) {
        const withAct = scurve.filter(p => p.actual !== null && p.actual !== undefined && !isNaN(p.actual));
        const lastWithAct = withAct.pop() || scurve[0];
        const idx = scurve.indexOf(lastWithAct);
        currentPoint = {
          x: getX(idx),
          y: getY(lastWithAct.actual ?? 62),
          label: `${lastWithAct.actual ?? 62}% Actual`,
          planned: lastWithAct.planned ?? 68.5,
          actual: lastWithAct.actual ?? 62
        };
      }

      const currentVariance = currentPoint ? Number(((currentPoint.actual ?? 62) - (currentPoint.planned ?? 68.5)).toFixed(1)) : -6.5;
      const varianceLabel = currentVariance >= 0
        ? `+${currentVariance}% Ahead of Baseline`
        : `${currentVariance}% Schedule Drag`;

      scurveCard.innerHTML = `
        <div class="card-header p-0 mb-1 d-flex justify-between items-center">
          <div>
            <h3 class="card-title">Cumulative Planned vs Actual Progress (S-Curve)</h3>
            <span class="text-xs text-muted font-mono">Dynamic schedule baseline actualization</span>
          </div>
          <span class="badge ${currentVariance >= 0 ? 'badge-completed' : 'badge-warning'} font-mono">${varianceLabel}</span>
        </div>
        <div style="height: 220px; width: 100%; position: relative;">
          <svg viewBox="0 0 500 200" width="100%" height="100%" preserveAspectRatio="none">
            <!-- Grid lines -->
            <line x1="40" y1="20" x2="480" y2="20" stroke="var(--color-border)" stroke-dasharray="4"/>
            <line x1="40" y1="60" x2="480" y2="60" stroke="var(--color-border)" stroke-dasharray="4"/>
            <line x1="40" y1="100" x2="480" y2="100" stroke="var(--color-border)" stroke-dasharray="4"/>
            <line x1="40" y1="140" x2="480" y2="140" stroke="var(--color-border)" stroke-dasharray="4"/>
            <line x1="40" y1="180" x2="480" y2="180" stroke="var(--color-border)"/>

            <!-- Y Axis Labels -->
            <text x="32" y="24" fill="var(--color-text-muted)" font-size="10" text-anchor="end">100%</text>
            <text x="32" y="64" fill="var(--color-text-muted)" font-size="10" text-anchor="end">75%</text>
            <text x="32" y="104" fill="var(--color-text-muted)" font-size="10" text-anchor="end">50%</text>
            <text x="32" y="144" fill="var(--color-text-muted)" font-size="10" text-anchor="end">25%</text>
            <text x="32" y="184" fill="var(--color-text-muted)" font-size="10" text-anchor="end">0%</text>

            <!-- Planned Curve (Dashed Accent) -->
            <path d="${plannedPoints}" fill="none" stroke="var(--color-info)" stroke-width="2.5" stroke-dasharray="6 4"/>

            <!-- Actual Curve (Solid Green up to current month) -->
            <path d="${actualPoints}" fill="none" stroke="var(--color-success)" stroke-width="3.5"/>

            ${currentPoint ? `
              <!-- Current Milestone Node -->
              <circle cx="${currentPoint.x}" cy="${currentPoint.y}" r="6" fill="var(--color-success)" stroke="var(--color-bg)" stroke-width="2.5"/>
              <text x="${Math.min(380, currentPoint.x + 8)}" y="${currentPoint.y - 8}" fill="var(--color-success)" font-size="10" font-weight="bold">${escapeHtml(currentPoint.label)}</text>
            ` : ''}

            <!-- X Axis Month Labels -->
            ${scurve.map((p, i) => {
              if (i % 2 !== 0 && i !== scurve.length - 1) return '';
              const x = getX(i);
              return `<text x="${x}" y="196" fill="var(--color-text-muted)" font-size="9" text-anchor="middle">${escapeHtml(p.month.replace(' 202', "'2"))}</text>`;
            }).join('')}
          </svg>
        </div>
        <div class="d-flex justify-between items-center text-xs mt-1 flex-wrap gap-2">
          <span class="d-flex items-center gap-2"><span style="width:12px; height:3px; background:var(--color-info); display:inline-block;"></span> Planned Baseline (${currentPoint?.planned ?? 0}%)</span>
          <span class="d-flex items-center gap-2"><span style="width:12px; height:3px; background:var(--color-success); display:inline-block;"></span> Field Actuals (${currentPoint?.actual ?? 0}%)</span>
          <span class="${currentVariance >= 0 ? 'text-success' : 'text-danger'} font-bold font-mono">${varianceLabel}</span>
        </div>
      `;
      chartsGrid.appendChild(scurveCard);

      // Chart 2: Discipline Performance Breakdown
      const discCard = document.createElement('div');
      discCard.className = 'card p-4 gap-3';

      const discListHtml = breakdown.map(d => {
        const barColorClass = d.status === 'on-track' ? 'confidence-high' : (d.status === 'at-risk' ? 'confidence-medium' : 'confidence-low');
        const varColor = d.variance >= 0 ? 'text-success' : (d.variance >= -6 ? 'text-warning' : 'text-danger');
        const varSign = d.variance > 0 ? '+' : '';

        return `
          <div class="mb-2">
            <div class="d-flex justify-between items-center text-xs mb-1">
              <div class="d-flex items-center gap-2">
                <strong class="text-primary">${escapeHtml(d.label)}</strong>
                <span class="badge badge-neutral font-mono" style="font-size:9px; padding:1px 5px;">🤖 AI: ${d.avgConfidence}%</span>
              </div>
              <div class="d-flex items-center gap-2 font-mono">
                <span class="text-secondary">${d.actualProgress}% Act / ${d.plannedProgress}% Plan</span>
                <span class="${varColor} font-bold">(${varSign}${d.variance}%)</span>
              </div>
            </div>
            <div class="confidence-bar-bg" style="height: 10px; position:relative;">
              <div class="confidence-bar-fill ${barColorClass}" style="width: ${Math.min(100, Math.max(0, d.actualProgress))}%;"></div>
              <!-- Planned Target Line Marker -->
              <div style="position:absolute; top:-2px; bottom:-2px; left:${Math.min(100, Math.max(0, d.plannedProgress))}%; width:2px; background:var(--color-text-primary); box-shadow:0 0 4px rgba(0,0,0,0.8);" title="Plan: ${d.plannedProgress}%"></div>
            </div>
          </div>
        `;
      }).join('');

      discCard.innerHTML = `
        <div class="card-header p-0 mb-1 d-flex justify-between items-center">
          <div>
            <h3 class="card-title">Discipline Execution vs Baseline</h3>
            <span class="text-xs text-muted">Field actuals reconciliation against scheduled WBS milestones</span>
          </div>
          <span class="text-xs text-muted font-mono">${breakdown.reduce((acc, d) => acc + d.activityCount, 0)} Total Activities</span>
        </div>
        <div class="d-flex flex-col gap-2 justify-center" style="min-height: 220px;">
          ${discListHtml}
        </div>
        <div class="text-xs text-secondary mt-1">
          *White vertical lines represent scheduled baseline target. Progress reconciles directly upon reviewer approval.
        </div>
      `;
      chartsGrid.appendChild(discCard);

      contentMount.appendChild(chartsGrid);

      // 3. Confidence Heatmap & Reviewer Acceptance Table
      const heatmapCard = document.createElement('div');
      heatmapCard.className = 'card p-4 gap-3';
      heatmapCard.innerHTML = `
        <div class="card-header p-0 mb-1 d-flex justify-between items-center">
          <div>
            <h3 class="card-title">LLM Discipline Categorization & Reviewer Acceptance Heatmap</h3>
            <p class="text-xs text-secondary mt-0">Tracks AI categorization confidence score, reviewer approval ratios, and discipline bottleneck telemetry</p>
          </div>
        </div>
        <div class="table-container" style="overflow-x:auto;">
          <table class="table w-100 text-xs">
            <thead>
              <tr style="border-bottom: 1px solid var(--color-border); text-align: left;">
                <th class="p-2 text-muted uppercase font-mono">Discipline Category</th>
                <th class="p-2 text-muted uppercase font-mono text-center">Submissions</th>
                <th class="p-2 text-muted uppercase font-mono text-center">Approved</th>
                <th class="p-2 text-muted uppercase font-mono text-center">Pending</th>
                <th class="p-2 text-muted uppercase font-mono text-center">Rejected</th>
                <th class="p-2 text-muted uppercase font-mono">Review Acceptance Rate</th>
                <th class="p-2 text-muted uppercase font-mono">AI Matching Confidence</th>
              </tr>
            </thead>
            <tbody>
              ${heatmap.map(h => {
                const rateColor = h.acceptanceRate >= 80 ? 'text-success' : (h.acceptanceRate >= 60 ? 'text-warning' : 'text-danger');
                const confColor = h.avgConfidence >= 85 ? 'confidence-high' : (h.avgConfidence >= 70 ? 'confidence-medium' : 'confidence-low');

                return `
                  <tr style="border-bottom: 1px solid var(--color-border-subtle); height: 42px;">
                    <td class="p-2 font-semibold text-primary">${escapeHtml(h.label)}</td>
                    <td class="p-2 text-center font-mono font-bold">${h.totalSubmissions}</td>
                    <td class="p-2 text-center">
                      <span class="badge badge-completed font-mono" style="padding:1px 6px; font-size:10px;">${h.approvedCount}</span>
                    </td>
                    <td class="p-2 text-center">
                      <span class="badge badge-in-progress font-mono" style="padding:1px 6px; font-size:10px;">${h.pendingCount}</span>
                    </td>
                    <td class="p-2 text-center font-mono text-muted">${h.rejectedCount}</td>
                    <td class="p-2">
                      <div class="d-flex items-center gap-2">
                        <span class="font-mono font-bold ${rateColor}">${h.acceptanceRate}%</span>
                        <div class="confidence-bar-bg" style="width: 60px; height: 6px;">
                          <div class="confidence-bar-fill ${h.acceptanceRate >= 80 ? 'confidence-high' : 'confidence-medium'}" style="width: ${h.acceptanceRate}%;"></div>
                        </div>
                      </div>
                    </td>
                    <td class="p-2">
                      <div class="d-flex items-center gap-2">
                        <div class="confidence-bar-bg" style="width: 70px; height: 6px;">
                          <div class="confidence-bar-fill ${confColor}" style="width: ${h.avgConfidence}%;"></div>
                        </div>
                        <span class="font-mono font-bold text-primary">${h.avgConfidence}%</span>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
      contentMount.appendChild(heatmapCard);

    } catch (err) {
      console.error('Failed to render analytics:', err);
      contentMount.innerHTML = `
        <div class="card p-4 text-center text-danger">
          <div class="text-md font-bold mb-1">Failed to load live analytics</div>
          <div class="text-xs text-muted mb-3 font-mono">${escapeHtml(err.message)}</div>
          <button class="btn btn-secondary btn-sm" id="btn-retry-analytics">Retry Loading</button>
        </div>
      `;
      contentMount.querySelector('#btn-retry-analytics')?.addEventListener('click', () => renderAnalytics());
    }
  }

  renderAnalytics();
  return container;
}
