import { DEMO_ACCOUNTS } from '../services/auth.js';
import { ProjectsService } from '../services/projects.js';
import { MetricCard } from '../components/Card.js';
import { Badge } from '../components/Badge.js';
import { AppRouter } from '../router.js';

export async function AdminPanelView() {
  const projects = await ProjectsService.getProjects();
  const container = document.createElement('div');
  container.className = 'view-container';
  container.innerHTML = '<div><h1 class="text-2xl font-bold text-primary">System Administration</h1><p class="text-xs text-secondary mt-1">Govern demo users, access boundaries, project portfolio and operational controls.</p></div>';
  const metrics = document.createElement('div');
  metrics.className = 'd-grid grid-4 gap-3';
  metrics.append(MetricCard({ label: 'USER ACCOUNTS', value: DEMO_ACCOUNTS.length, subtext: 'Configured demo roles' }), MetricCard({ label: 'PROJECTS', value: projects.length, subtext: 'Active portfolio records' }), MetricCard({ label: 'ACCESS MODEL', value: 'RBAC', status: 'success', subtext: 'Route-level enforcement' }), MetricCard({ label: 'DATA MODE', value: 'LOCAL', status: 'warning', subtext: 'Browser-persisted demo data' }));
  container.appendChild(metrics);
  const access = document.createElement('section');
  access.className = 'card p-4 gap-3';
  access.innerHTML = '<div class="card-header p-0"><div><h2 class="card-title">User access directory</h2><p class="text-xs text-secondary mt-1">Role assignments are defined in the current demo configuration.</p></div></div>';
  const rows = document.createElement('div');
  rows.className = 'admin-user-list';
  DEMO_ACCOUNTS.forEach(user => { const row = document.createElement('div'); row.className = 'admin-user-row'; row.innerHTML = `<span class="admin-avatar">${user.avatar}</span><div><strong>${user.name}</strong><small>${user.title}</small></div><span>${Badge({ label: user.role, status: user.role === 'Admin' ? 'at-risk' : 'in-progress' })}</span><small>${user.allowedRoutes.length} permitted routes</small>`; rows.appendChild(row); });
  access.appendChild(rows); container.appendChild(access);
  const controls = document.createElement('section');
  controls.className = 'card p-4 gap-3';
  controls.innerHTML = '<div class="card-header p-0"><div><h2 class="card-title">Portfolio controls</h2><p class="text-xs text-secondary mt-1">Use these controls to maintain the portfolio in this demo environment.</p></div></div><div class="d-flex gap-2 flex-wrap"><button id="admin-create" class="btn btn-primary">Create Project</button><button id="admin-projects" class="btn btn-secondary">Manage Projects</button><button id="admin-audit" class="btn btn-secondary">Open Audit Trail</button></div>';
  controls.querySelector('#admin-create').addEventListener('click', () => AppRouter.navigate('/projects/new'));
  controls.querySelector('#admin-projects').addEventListener('click', () => AppRouter.navigate('/projects'));
  controls.querySelector('#admin-audit').addEventListener('click', () => AppRouter.navigate('/audit'));
  container.appendChild(controls);
  return container;
}
