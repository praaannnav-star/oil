import { AnalyticsService } from '../services/analytics.js';
import { Card, MetricCard } from '../components/Card.js';
import { Icons } from '../components/Icons.js';

export async function AnalyticsView() {
  const container = document.createElement('div');
  container.className = 'view-container';

  // Header
  const header = document.createElement('div');
  header.className = 'd-flex justify-between items-center flex-wrap gap-2';
  header.innerHTML = `
    <div>
      <h1 class="text-2xl font-bold text-primary">Project Intelligence & Analytics</h1>
      <p class="text-xs text-secondary mt-1">Operational decision metrics answering: Are we tracking to baseline, where are bottlenecks, and what requires intervention?</p>
    </div>
  `;
  container.appendChild(header);

  // Top Metrics
  const metrics = await AnalyticsService.getExecutiveMetrics();
  const kpiGrid = document.createElement('div');
  kpiGrid.className = 'd-grid grid-4 gap-3';

  kpiGrid.appendChild(MetricCard({
    label: 'PORTFOLIO SPI',
    value: '0.94',
    status: 'warning',
    subtext: 'Target 1.00 • 6% schedule drag'
  }));

  kpiGrid.appendChild(MetricCard({
    label: 'REVIEW BACKLOG VELOCITY',
    value: '4.2 hrs',
    status: 'success',
    subtext: 'Average time to reconcile match'
  }));

  kpiGrid.appendChild(MetricCard({
    label: 'FIELD REPORT ADOPTION',
    value: '92%',
    status: 'primary',
    subtext: 'Site supervisors reporting daily'
  }));

  kpiGrid.appendChild(MetricCard({
    label: 'FIRST-PASS MATCH ACCURACY',
    value: '89.4%',
    status: 'success',
    subtext: 'High confidence linking rate'
  }));

  container.appendChild(kpiGrid);

  // Charts Grid
  const chartsGrid = document.createElement('div');
  chartsGrid.className = 'd-grid grid-2 gap-4';

  // Chart 1: S-Curve Planned vs Actual (SVG)
  const scurveCard = document.createElement('div');
  scurveCard.className = 'card p-4 gap-3';
  scurveCard.innerHTML = `
    <div class="card-header p-0 mb-1">
      <h3 class="card-title">Cumulative Planned vs Actual Progress (S-Curve)</h3>
      <span class="text-xs text-muted font-mono">Nov 2025 – Dec 2026</span>
    </div>
    <div style="height: 220px; width: 100%; position: relative;">
      <svg viewBox="0 0 500 200" width="100%" height="100%" preserveAspectRatio="none">
        <!-- Grid lines -->
        <line x1="40" y1="20" x2="480" y2="20" stroke="#1E2D4A" stroke-dasharray="4"/>
        <line x1="40" y1="60" x2="480" y2="60" stroke="#1E2D4A" stroke-dasharray="4"/>
        <line x1="40" y1="100" x2="480" y2="100" stroke="#1E2D4A" stroke-dasharray="4"/>
        <line x1="40" y1="140" x2="480" y2="140" stroke="#1E2D4A" stroke-dasharray="4"/>
        <line x1="40" y1="180" x2="480" y2="180" stroke="#1E2D4A"/>

        <!-- Y Axis Labels -->
        <text x="32" y="24" fill="#566F95" font-size="10" text-anchor="end">100%</text>
        <text x="32" y="64" fill="#566F95" font-size="10" text-anchor="end">75%</text>
        <text x="32" y="104" fill="#566F95" font-size="10" text-anchor="end">50%</text>
        <text x="32" y="144" fill="#566F95" font-size="10" text-anchor="end">25%</text>
        <text x="32" y="184" fill="#566F95" font-size="10" text-anchor="end">0%</text>

        <!-- Planned Curve (Dashed Blue) -->
        <path d="M 50 180 Q 200 160 300 70 T 480 20" fill="none" stroke="#2563EB" stroke-width="3" stroke-dasharray="6 4"/>

        <!-- Actual Curve (Solid Green up to today) -->
        <path d="M 50 180 Q 180 165 300 81" fill="none" stroke="#10B981" stroke-width="3.5"/>
        
        <!-- Current Point Indicator -->
        <circle cx="300" cy="81" r="5" fill="#10B981" stroke="#0A1628" stroke-width="2"/>
        <text x="305" y="75" fill="#10B981" font-size="10" font-weight="bold">62% Actual (Aug)</text>
      </svg>
    </div>
    <div class="d-flex justify-between items-center text-xs mt-1">
      <span class="d-flex items-center gap-2"><span style="width:12px; height:3px; background:#2563EB; display:inline-block;"></span> Planned Baseline (68.5%)</span>
      <span class="d-flex items-center gap-2"><span style="width:12px; height:3px; background:#10B981; display:inline-block;"></span> Field Actuals (62.0%)</span>
      <span class="text-danger font-bold">-6.5% Schedule Drag</span>
    </div>
  `;
  chartsGrid.appendChild(scurveCard);

  // Chart 2: Discipline Performance (Stacked Bar)
  const discCard = document.createElement('div');
  discCard.className = 'card p-4 gap-3';
  discCard.innerHTML = `
    <div class="card-header p-0 mb-1">
      <h3 class="card-title">Discipline Execution vs Baseline</h3>
      <span class="text-xs text-muted">Completed vs Remaining Scope</span>
    </div>
    <div class="d-flex flex-col gap-3 justify-center" style="height: 220px;">
      <div>
        <div class="d-flex justify-between text-xs mb-1">
          <strong class="text-primary">Civil & Structural (WBS-100)</strong>
          <span class="font-mono text-success">78% Actual / 81% Plan</span>
        </div>
        <div class="confidence-bar-bg" style="height: 12px;">
          <div class="confidence-bar-fill confidence-high" style="width: 78%;"></div>
        </div>
      </div>

      <div>
        <div class="d-flex justify-between text-xs mb-1">
          <strong class="text-primary">Process Piping & Manifolds (WBS-200)</strong>
          <span class="font-mono text-info">54% Actual / 58% Plan</span>
        </div>
        <div class="confidence-bar-bg" style="height: 12px;">
          <div class="confidence-bar-fill confidence-medium" style="width: 54%;"></div>
        </div>
      </div>

      <div>
        <div class="d-flex justify-between text-xs mb-1">
          <strong class="text-primary">Electrical Substation & Cabling (WBS-300)</strong>
          <span class="font-mono text-success">48% Actual / 47% Plan</span>
        </div>
        <div class="confidence-bar-bg" style="height: 12px;">
          <div class="confidence-bar-fill confidence-high" style="width: 48%;"></div>
        </div>
      </div>

      <div>
        <div class="d-flex justify-between text-xs mb-1">
          <strong class="text-primary">Instrumentation & Control (WBS-400)</strong>
          <span class="font-mono text-danger">35% Actual / 46% Plan (-11%)</span>
        </div>
        <div class="confidence-bar-bg" style="height: 12px;">
          <div class="confidence-bar-fill confidence-low" style="width: 35%;"></div>
        </div>
      </div>
    </div>
    <div class="text-xs text-secondary">
      *Instrumentation identified as the primary critical path bottleneck.
    </div>
  `;
  chartsGrid.appendChild(discCard);

  container.appendChild(chartsGrid);

  return container;
}
