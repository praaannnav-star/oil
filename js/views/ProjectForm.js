import { ProjectsService } from '../services/projects.js';
import { Auth } from '../services/auth.js';
import { State } from '../state.js';
import { AppRouter } from '../router.js';
import { Toast } from '../components/Toast.js';

const DISCIPLINES = ['Civil', 'Mechanical', 'Piping', 'Electrical', 'Instrumentation', 'Safety', 'Cathodic Protection'];

export async function ProjectFormView(params = {}) {
  const editing = Boolean(params.id);
  const existing = editing ? await ProjectsService.getProject(params.id) : null;
  const container = document.createElement('div');
  container.className = 'view-container';
  if (editing && !existing) {
    container.innerHTML = '<div class="card p-5 text-center"><h2 class="text-danger">Project not found</h2></div>';
    return container;
  }
  const project = existing || { disciplines: [], health: 'on-track', client: 'Oil India Limited (OIL)' };
  const cls = ProjectsService.getClassifications();
  const options = (list, current) => list.map(v => `<option value="${v}" ${current === v ? 'selected' : ''}>${v}</option>`).join('');
  container.innerHTML = `
    <div class="d-flex justify-between items-center flex-wrap gap-3">
      <div><h1 class="text-2xl font-bold text-primary">${editing ? 'Edit Project' : 'Create New Project'}</h1><p class="text-xs text-secondary mt-1">${editing ? 'Maintain delivery ownership, baseline details and project context.' : 'Set up the portfolio record before field and schedule work begins.'}</p></div>
      <button type="button" id="cancel-project-form" class="btn btn-ghost">Cancel</button>
    </div>
    <form id="project-form" class="project-form card p-4 gap-4">
      <section class="form-section"><h2>Project identity</h2><div class="d-grid grid-2 gap-3">
        <label>Project name<input name="name" required value="${project.name || ''}" placeholder="e.g. Duliajan expansion"></label>
        <label>Project code<input name="code" required value="${project.code || ''}" placeholder="e.g. OIL-FHQ-DUL"></label>
        <label>Location<input name="location" required value="${project.location || ''}" placeholder="District, state"></label>
        <label>Client<input name="client" required value="${project.client || ''}"></label>
        <label>Budget<input name="budget" required value="${project.budget || ''}" placeholder="e.g. ₹ 200 Cr"></label>
        <label>Lead planner / manager<input name="leadPlanner" required value="${project.leadPlanner || ''}" placeholder="Name, designation"></label>
      </div></section>
      <section class="form-section"><h2>Delivery baseline</h2><div class="d-grid grid-3 gap-3">
        <label>Start date<input type="date" name="startDate" required value="${project.startDate || ''}"></label>
        <label>Target finish<input type="date" name="targetFinish" required value="${project.targetFinish || ''}"></label>
        <label>Health<select name="health"><option value="on-track" ${project.health === 'on-track' ? 'selected' : ''}>On track</option><option value="at-risk" ${project.health === 'at-risk' ? 'selected' : ''}>At risk</option><option value="delayed" ${project.health === 'delayed' ? 'selected' : ''}>Delayed</option></select></label>
      </div></section>
      <section class="form-section"><h2>Classification & location</h2><div class="d-grid grid-3 gap-3">
        <label>Project type<select name="projectType">${options(cls.projectType, project.projectType || 'Plant')}</select></label>
        <label>Category<select name="category">${options(cls.category, project.category || 'Greenfield')}</select></label>
        <label>Risk tier<select name="riskTier">${options(cls.riskTier, project.riskTier || 'B')}</select></label>
        <label>Priority<select name="priority">${options(cls.priority, project.priority || 'P2')}</select></label>
        <label>Region<select name="region">${options(cls.region, project.region || 'Assam East')}</select></label>
      </div><div class="d-grid grid-4 gap-3 mt-3">
        <label>Latitude<input type="number" step="any" name="lat" value="${project.lat ?? ''}" placeholder="27.1882"></label>
        <label>Longitude<input type="number" step="any" name="lng" value="${project.lng ?? ''}" placeholder="95.3132"></label>
      </div><p class="text-xs text-muted mt-1">Coordinates power the project map pin (OpenStreetMap embed). Classification drives grouping, badges and report routing defaults.</p></section>
      <section class="form-section"><h2>Scope and handover</h2><label>Description<textarea name="description" required rows="3" placeholder="Describe the project scope and delivery outcome.">${project.description || ''}</textarea></label><div class="discipline-picker">${DISCIPLINES.map(discipline => `<label><input type="checkbox" name="disciplines" value="${discipline}" ${project.disciplines.includes(discipline) ? 'checked' : ''}> ${discipline}</label>`).join('')}</div></section>
      <div class="d-flex justify-end gap-2"><button type="button" id="cancel-project-form-bottom" class="btn btn-secondary">Cancel</button><button type="submit" class="btn btn-primary">${editing ? 'Save Project Changes' : 'Create Project'}</button></div>
    </form>
  `;
  const returnToProject = () => AppRouter.navigate(editing ? `/projects/${project.id}` : '/projects');
  container.querySelector('#cancel-project-form').addEventListener('click', returnToProject);
  container.querySelector('#cancel-project-form-bottom').addEventListener('click', returnToProject);
  container.querySelector('#project-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    values.disciplines = form.getAll('disciplines');
    if (!values.disciplines.length) return Toast.warning('Select at least one project discipline.');
    if (values.targetFinish < values.startDate) return Toast.warning('Target finish must be after the start date.');
    const actor = Auth.getUser();
    try {
      const saved = editing ? await ProjectsService.updateProject(project.id, values, actor) : await ProjectsService.createProject(values, actor);
      State.setProject(saved.id);
      window.dispatchEvent(new Event('projects:changed'));
      Toast.success(editing ? 'Project details updated.' : 'Project created and added to the portfolio.');
      AppRouter.navigate(`/projects/${saved.id}`);
    } catch (error) {
      Toast.danger(error.message || 'Unable to save project.');
    }
  });
  return container;
}
