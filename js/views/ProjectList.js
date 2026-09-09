import { ProjectsService } from '../services/projects.js';
import { Badge } from '../components/Badge.js';
import { AppRouter } from '../router.js';
import { Auth, USER_ROLES } from '../services/auth.js';
import { Button } from '../components/Button.js';
import { escapeHtml } from '../utils/dom.js';

const RING_COLORS = {
  'on-track': 'var(--color-success)',
  'at-risk': 'var(--color-warning)',
  'delayed': 'var(--color-danger)'
};

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

  const [projects, pendingCounts, classifications] = await Promise.all([
    ProjectsService.getProjects(),
    ProjectsService.getLivePendingCounts(),
    Promise.resolve(ProjectsService.getClassifications())
  ]);

  // Filter chips — health + classification category
  let activeFilter = 'all';
  const categories = ['all', ...classifications.category];
  const chipRow = document.createElement('div');
  chipRow.className = 'chip-row';

  const renderChips = () => {
    chipRow.innerHTML = '';
    categories.forEach(cat => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `btn btn-sm ${activeFilter === cat ? 'btn-primary' : 'btn-secondary'}`;
      chip.textContent = cat === 'all' ? `All (${projects.length})` : cat;
      chip.addEventListener('click', () => {
        activeFilter = cat;
        renderChips();
        renderGrid();
      });
      chipRow.appendChild(chip);
    });
  };

  const grid = document.createElement('div');
  grid.className = 'project-card-grid mt-3';

  const renderGrid = () => {
    grid.innerHTML = '';
    const visible = projects.filter(p => activeFilter === 'all' || p.category === activeFilter);
    if (visible.length === 0) {
      grid.innerHTML = '<div class="card p-5 text-center text-muted">No projects match this filter.</div>';
      return;
    }
    visible.forEach(project => {
      const pct = Math.round(project.actualProgress || 0);
      const color = RING_COLORS[project.health] || 'var(--color-text-muted)';
      const pending = pendingCounts[project.id] ?? project.pendingReviewCount ?? 0;

      const card = document.createElement('article');
      card.className = 'project-card';
      card.innerHTML = `
        <div class="d-flex gap-3 items-start justify-between">
          <div class="d-flex flex-col gap-1" style="min-width:0;">
            <strong class="text-sm text-primary">${escapeHtml(project.name)}</strong>
            <span class="text-xs text-muted font-mono">${escapeHtml(project.code)} • ${escapeHtml(project.location)}</span>
          </div>
          <div class="health-ring" style="background: conic-gradient(${color} ${pct * 3.6}deg, rgba(255,255,255,0.08) 0deg);">
            <span class="${project.health === 'on-track' ? 'text-success' : project.health === 'delayed' ? 'text-danger' : 'text-warning'}">${pct}%</span>
          </div>
        </div>
        <div class="d-flex flex-col gap-1">
          <div class="d-flex justify-between text-xs font-mono font-bold">
            <span>SPI ${escapeHtml(String(project.spi ?? '—'))}</span>
            <span class="${(project.variance ?? 0) < 0 ? 'text-danger' : 'text-success'}">${(project.variance ?? 0) > 0 ? '+' : ''}${escapeHtml(String(project.variance ?? 0))}% vs plan</span>
          </div>
          <div class="confidence-bar-bg" style="height:6px;">
            <div class="confidence-bar-fill ${project.health === 'on-track' ? 'confidence-high' : project.health === 'delayed' ? 'confidence-low' : 'confidence-medium'}" style="width:${pct}%;"></div>
          </div>
        </div>
        <div class="chip-row">
          ${Badge({ label: String(project.health || 'unknown').toUpperCase(), status: project.health })}
          ${project.category ? `<span class="badge badge-in-progress">${escapeHtml(project.category)}</span>` : ''}
          ${project.projectType ? `<span class="badge badge-in-progress">${escapeHtml(project.projectType)}</span>` : ''}
          ${project.riskTier ? `<span class="badge badge-rejected">Tier ${escapeHtml(project.riskTier)}</span>` : ''}
          ${pending > 0 ? `<span class="badge badge-at-risk">${pending} pending review</span>` : '<span class="badge badge-completed">Review clear</span>'}
        </div>
      `;
      card.addEventListener('click', () => AppRouter.navigate(`/projects/${project.id}`));
      grid.appendChild(card);
    });
  };

  renderChips();
  container.appendChild(chipRow);
  container.appendChild(grid);
  return container;
}
