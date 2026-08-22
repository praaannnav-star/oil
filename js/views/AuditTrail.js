import { AuditService } from '../services/audit.js';
import { Timeline } from '../components/Timeline.js';
import { Card } from '../components/Card.js';
import { Icons } from '../components/Icons.js';

export async function AuditTrailView() {
  const container = document.createElement('div');
  container.className = 'view-container';

  // Header
  const header = document.createElement('div');
  header.className = 'd-flex justify-between items-center flex-wrap gap-2';
  header.innerHTML = `
    <div>
      <h1 class="text-2xl font-bold text-primary">System Audit Trail & Chain of Custody</h1>
      <p class="text-xs text-secondary mt-1">Full chronological event logging from field voice capture and AI entity extraction to human planner review and schedule baseline reconciliation</p>
    </div>
  `;
  container.appendChild(header);

  const logs = await AuditService.getAuditLogs();

  const auditCard = document.createElement('div');
  auditCard.className = 'card p-4 gap-4';

  const filterRow = document.createElement('div');
  filterRow.className = 'd-flex justify-between items-center flex-wrap gap-2';
  filterRow.innerHTML = `
    <div class="d-flex items-center gap-2">
      <span class="text-primary">${Icons.audit()}</span>
      <strong class="text-sm text-primary">Immutable Operational Event Log (${logs.length} entries)</strong>
    </div>
    <span class="text-xs text-muted">Timezone: Indian Standard Time (IST)</span>
  `;
  auditCard.appendChild(filterRow);

  const timelineEl = Timeline({ events: logs });
  auditCard.appendChild(timelineEl);

  container.appendChild(auditCard);
  return container;
}
