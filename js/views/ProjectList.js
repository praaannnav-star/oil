import { ProjectsService } from '../services/projects.js';
import { Table } from '../components/Table.js';
import { Badge } from '../components/Badge.js';
import { AppRouter } from '../router.js';
import { Auth, USER_ROLES } from '../services/auth.js';
import { Button } from '../components/Button.js';
import { escapeHtml } from '../utils/dom.js';

export async function ProjectListView() {
  const container = document.createElement('div');
  container.className = 'view-container';

  const header = document.createElement('div');
  header.className = 'd-flex justify-between items-center flex-wrap gap-3';
  header.innerHTML = `
    <div>
      <h1 class="text-2xl font-bold text-primary">Strategic Infrastructure Projects</h1>
      <p class="text-xs text-secondary mt-1">Capital expenditure projects tracked in Oil India Limited Master Portfolio</p>
    </div>
  `;
  const user = Auth.getUser();
  if (user && (user.role === USER_ROLES.ADMIN || user.role === USER_ROLES.PROJECT_MANAGER)) {
    header.appendChild(Button({ text: 'Create Project', variant: 'primary', onClick: () => AppRouter.navigate('/projects/new') }));
  }
  container.appendChild(header);

  const projects = await ProjectsService.getProjects();
  const card = document.createElement('div');
  card.className = 'card p-4 gap-3';

  const columns = [
    {
      key: 'name',
      label: 'Project Name',
      render: (val, row) => `
        <div class="d-flex flex-col">
          <strong class="text-sm text-primary">${escapeHtml(val)}</strong>
          <span class="text-xs text-muted font-mono">${escapeHtml(row.code)} • ${escapeHtml(row.location)}</span>
        </div>
      `
    },
    {
      key: 'health',
      label: 'Status',
      width: '120px',
      render: (val) => Badge({ label: val.toUpperCase(), status: val })
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
      width: '120px',
      render: (val) => `<span class="text-xs font-mono font-bold ${val > 0 ? 'text-danger' : 'text-success'}">${val} Activities</span>`
    }
  ];

  const table = Table({
    columns,
    data: projects,
    onRowClick: (row) => AppRouter.navigate(`/projects/${row.id}`)
  });

  card.appendChild(table);
  container.appendChild(card);
  return container;
}
