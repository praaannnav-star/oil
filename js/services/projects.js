import { API } from './api.js';
import { AuditService } from './audit.js';

export const ProjectsService = {
  async getProjects() {
    await API.delay();
    return API.projects;
  },

  async getProject(id) {
    await API.delay();
    const prj = API.projects.find(p => p.id === id);
    if (!prj && API.projects.length > 0) return API.projects[0];
    return prj;
  },

  async createProject(data, actor) {
    await API.delay();
    const project = {
      id: `PRJ-OIL-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
      plannedProgress: 0, actualProgress: 0, variance: 0, spi: 1,
      health: 'on-track', delayedActivitiesCount: 0, pendingReviewCount: 0,
      evidenceCoverage: 0, yesterdayChanges: [], ...data
    };
    API.projects.unshift(project);
    API.persistProjects();
    await AuditService.appendAudit({ action: 'PROJECT_CREATED', actor: actor?.name || 'System Administrator', role: actor?.role || 'Admin', detail: `Created project ${project.code}: ${project.name}` });
    return project;
  },

  async updateProject(id, patch, actor) {
    await API.delay();
    const index = API.projects.findIndex(project => project.id === id);
    if (index === -1) throw new Error('Project not found');
    API.projects[index] = { ...API.projects[index], ...patch, id };
    API.persistProjects();
    await AuditService.appendAudit({ action: 'PROJECT_UPDATED', actor: actor?.name || 'System Administrator', role: actor?.role || 'Admin', detail: `Updated project ${API.projects[index].code}: ${API.projects[index].name}` });
    return API.projects[index];
  }
};
