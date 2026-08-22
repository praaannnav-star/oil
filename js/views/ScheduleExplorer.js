import { ActivitiesService } from '../services/activities.js';
import { Table } from '../components/Table.js';
import { Badge } from '../components/Badge.js';
import { Button } from '../components/Button.js';
import { Icons } from '../components/Icons.js';
import { AppRouter } from '../router.js';
import { State } from '../state.js';
import { escapeHtml } from '../utils/dom.js';

export async function ScheduleExplorerView() {
  const container = document.createElement('div');
  container.className = 'view-container';

  // Header
  const header = document.createElement('div');
  header.className = 'd-flex justify-between items-center flex-wrap gap-2';
  header.innerHTML = `
    <div>
      <h1 class="text-2xl font-bold text-primary">Schedule Hierarchy Explorer</h1>
      <p class="text-xs text-secondary mt-1">Multi-tier Work Breakdown Structure (L1 to L6) with real-time planned vs actual schedule variance tracking</p>
    </div>
  `;

  const newReportBtn = Button({
    text: 'Report Progress',
    icon: Icons.progress(),
    variant: 'primary',
    size: 'sm',
    onClick: () => AppRouter.navigate('/progress/new')
  });
  header.appendChild(newReportBtn);
  container.appendChild(header);

  // Filters Bar
  const filtersCard = document.createElement('div');
  filtersCard.className = 'card p-3 d-flex flex-row items-center gap-3 flex-wrap';

  let currentDiscipline = 'All';
  let currentStatus = 'All';
  let currentLevel = 'All';
  let searchQuery = '';

  filtersCard.innerHTML = `
    <div class="d-flex items-center gap-2 flex-1" style="min-width: 200px;">
      <span class="text-muted">${Icons.search()}</span>
      <input type="text" id="sch-search" placeholder="Search activity, WBS code, or discipline..." class="w-full text-sm">
    </div>
    
    <div class="d-flex items-center gap-2">
      <span class="text-xs font-bold text-muted">DISCIPLINE:</span>
      <select id="sch-discipline" class="text-sm">
        <option value="All">All Disciplines</option>
        <option value="Civil">Civil</option>
        <option value="Piping">Piping</option>
        <option value="Electrical">Electrical</option>
        <option value="Instrumentation">Instrumentation</option>
        <option value="Management">Management</option>
      </select>
    </div>

    <div class="d-flex items-center gap-2">
      <span class="text-xs font-bold text-muted">STATUS:</span>
      <select id="sch-status" class="text-sm">
        <option value="All">All Statuses</option>
        <option value="in-progress">In Progress</option>
        <option value="completed">Completed</option>
        <option value="delayed">Delayed</option>
        <option value="pending">Pending</option>
      </select>
    </div>

    <div class="d-flex items-center gap-2">
      <span class="text-xs font-bold text-muted">LEVEL:</span>
      <select id="sch-level" class="text-sm">
        <option value="All">All Levels (L1-L6)</option>
        <option value="L1">L1 Master</option>
        <option value="L2">L2 Discipline</option>
        <option value="L3">L3 Area</option>
        <option value="L4">L4 Package</option>
        <option value="L5">L5 Activity</option>
        <option value="L6">L6 Step</option>
      </select>
    </div>
  `;
  container.appendChild(filtersCard);

  // Table Container
  const tableWrapper = document.createElement('div');
  container.appendChild(tableWrapper);

  async function renderScheduleTable() {
    tableWrapper.innerHTML = '';
    const activities = await ActivitiesService.getActivities(State.getState().currentProjectId, {
      discipline: currentDiscipline,
      status: currentStatus,
      level: currentLevel,
      search: searchQuery
    });

    const columns = [
      {
        key: 'level',
        label: 'Level',
        width: '70px',
        render: (val) => `<span class="badge badge-pending font-mono font-bold">${val || 'L5'}</span>`
      },
      {
        key: 'code',
        label: 'Activity ID',
        width: '120px',
        render: (val) => `<span class="text-xs font-mono font-bold text-secondary">${escapeHtml(val)}</span>`
      },
      {
        key: 'name',
        label: 'Activity Description',
        render: (val, row) => `
          <div class="d-flex flex-col">
            <strong class="text-sm text-primary">${escapeHtml(val)}</strong>
            <span class="text-xs text-muted">${escapeHtml(row.discipline)}</span>
          </div>
        `
      },
      {
        key: 'plannedStart',
        label: 'Planned Schedule',
        width: '170px',
        render: (_, row) => `
          <div class="text-xs font-mono text-muted">
            <div>P.Start: ${row.plannedStart || 'N/A'}</div>
            <div>P.Finish: ${row.plannedFinish || 'N/A'}</div>
          </div>
        `
      },
      {
        key: 'actualStart',
        label: 'Actuals (Field Linked)',
        width: '170px',
        render: (_, row) => `
          <div class="text-xs font-mono">
            <div class="${row.actualStart ? 'text-primary' : 'text-muted'}">A.Start: ${row.actualStart || '—'}</div>
            <div class="${row.actualFinish ? 'text-success font-bold' : 'text-muted'}">A.Finish: ${row.actualFinish || '—'}</div>
          </div>
        `
      },
      {
        key: 'progress',
        label: 'Progress',
        width: '130px',
        render: (val, row) => `
          <div class="d-flex flex-col gap-1">
            <div class="d-flex justify-between text-xs font-mono font-bold">
              <span>${val || 0}%</span>
            </div>
            <div class="confidence-bar-bg" style="height:6px;">
              <div class="confidence-bar-fill ${row.status === 'completed' ? 'confidence-high' : 'confidence-medium'}" style="width:${val || 0}%;"></div>
            </div>
          </div>
        `
      },
      {
        key: 'variance',
        label: 'Variance',
        width: '100px',
        render: (val) => {
          if (val === undefined || val === null) return '—';
          if (val > 0) {
            return `<span class="text-xs font-mono font-bold text-success">+${val}d Ahead</span>`;
          } else if (val < 0) {
            return `<span class="text-xs font-mono font-bold text-danger">${val}d Delay</span>`;
          }
          return `<span class="text-xs font-mono text-muted">0d (On Time)</span>`;
        }
      },
      {
        key: 'status',
        label: 'Status',
        width: '120px',
        render: (val) => {
          let badgeStatus = 'pending';
          if (val === 'completed') badgeStatus = 'completed';
          else if (val === 'in-progress') badgeStatus = 'in-progress';
          else if (val === 'delayed') badgeStatus = 'delayed';
          return Badge({ label: (val || 'pending').toUpperCase(), status: badgeStatus });
        }
      },
      {
        key: 'evidenceCount',
        label: 'Evidence',
        width: '80px',
        render: (val) => `
          <span class="d-flex items-center gap-1 text-xs text-muted">
            ${Icons.evidence()}
            <strong>${val || 0}</strong>
          </span>
        `
      }
    ];

    const tableEl = Table({
      columns,
      data: activities,
      emptyMessage: 'No activities found matching current filter criteria.',
      onRowClick: (row) => {
        AppRouter.navigate(`/activities/${row.id}`);
      }
    });

    tableWrapper.appendChild(tableEl);
  }

  // Bind filter events
  setTimeout(() => {
    const searchInput = document.getElementById('sch-search');
    const discSelect = document.getElementById('sch-discipline');
    const statusSelect = document.getElementById('sch-status');
    const levelSelect = document.getElementById('sch-level');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderScheduleTable();
      });
    }
    if (discSelect) {
      discSelect.addEventListener('change', (e) => {
        currentDiscipline = e.target.value;
        renderScheduleTable();
      });
    }
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        currentStatus = e.target.value;
        renderScheduleTable();
      });
    }
    if (levelSelect) {
      levelSelect.addEventListener('change', (e) => {
        currentLevel = e.target.value;
        renderScheduleTable();
      });
    }
  }, 50);

  renderScheduleTable();
  return container;
}
