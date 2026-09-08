import { ProjectsService } from '../services/projects.js';
import { MetricCard } from '../components/Card.js';
import { Badge } from '../components/Badge.js';
import { Button } from '../components/Button.js';
import { AppRouter } from '../router.js';
import { escapeHtml } from '../utils/dom.js';

export async function ProjectManagerPanelView() {
  const projects = await ProjectsService.getProjects();
  const atRisk = projects.filter(project => project.health !== 'on-track');
  const container = document.createElement('div');
  container.className = 'view-container';
  const header = document.createElement('div');
  header.className = 'd-flex justify-between items-center flex-wrap gap-3';
  header.innerHTML = '<div><h1 class="text-2xl font-bold text-primary">Project Manager Command Center</h1><p class="text-xs text-secondary mt-1">Portfolio health, delivery priorities, and team accountability.</p></div>';
  header.appendChild(Button({ text: 'Create Project', variant: 'primary', onClick: () => AppRouter.navigate('/projects/new') }));
  container.appendChild(header);
  const metrics = document.createElement('div');
  metrics.className = 'd-grid grid-4 gap-3';
  metrics.append(MetricCard({ label: 'ACTIVE PROJECTS', value: projects.length, subtext: 'Portfolio in delivery' }), MetricCard({ label: 'REQUIRING ATTENTION', value: atRisk.length, status: 'warning', subtext: 'At risk or delayed' }), MetricCard({ label: 'PENDING REVIEWS', value: projects.reduce((sum, project) => sum + project.pendingReviewCount, 0), status: 'warning', subtext: 'Planner validation needed' }), MetricCard({ label: 'DELAYED ACTIVITIES', value: projects.reduce((sum, project) => sum + project.delayedActivitiesCount, 0), status: 'danger', subtext: 'Across L5/L6 schedules' }));
  container.appendChild(metrics);
  const list = document.createElement('section');
  list.className = 'manager-project-list';
  list.innerHTML = '<div><h2 class="text-lg font-bold text-primary">Delivery portfolio</h2><p class="text-xs text-secondary mt-1">Open a project to review its execution view or update its baseline context.</p></div>';
  projects.forEach(project => {
    const row = document.createElement('article');
    row.className = 'manager-project-row';
    row.innerHTML = `<div><div class="d-flex items-center gap-2"><h3>${escapeHtml(project.name)}</h3><span class="badge badge-${project.health}">${project.health.toUpperCase()}</span></div><p>${escapeHtml(project.code)} · ${escapeHtml(project.location)}</p></div><div class="manager-progress"><span>${project.actualProgress}% actual</span><div class="confidence-bar-bg"><div class="confidence-bar-fill ${project.health === 'on-track' ? 'confidence-high' : 'confidence-medium'}" style="width:${project.actualProgress}%"></div></div><small>${project.plannedProgress}% planned · SPI ${project.spi}</small></div><div class="d-flex gap-2"><button class="btn btn-secondary btn-sm" data-project="${escapeHtml(project.id)}" data-action="edit">Edit</button><button class="btn btn-primary btn-sm" data-project="${escapeHtml(project.id)}" data-action="open">Open</button></div>`;
    list.appendChild(row);
  });
  list.addEventListener('click', event => {
    const button = event.target.closest('button[data-project]');
    if (!button) return;
    AppRouter.navigate(button.dataset.action === 'edit' ? `/projects/${button.dataset.project}/edit` : `/projects/${button.dataset.project}`);
  });
  container.appendChild(list);
  return container;
}
