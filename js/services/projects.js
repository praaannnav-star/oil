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
  },

  // Classification taxonomy powering grouping, badges and LLM routing defaults
  getClassifications() {
    return {
      projectType: ['Pipeline', 'Plant', 'Substation', 'Roads', 'Drilling', 'Other'],
      category: ['Brownfield', 'Greenfield', 'Maintenance', 'Emergency'],
      riskTier: ['A', 'B', 'C'],
      priority: ['P1', 'P2', 'P3', 'P4'],
      region: ['Assam East', 'Assam West', 'Rajasthan', 'Andhra', 'Other']
    };
  },

  async setLocation(id, lat, lng) {
    const index = API.projects.findIndex(project => project.id === id);
    if (index === -1) throw new Error('Project not found');
    API.projects[index] = { ...API.projects[index], lat: Number(lat), lng: Number(lng) };
    API.persistProjects();
    return API.projects[index];
  },

  // Live pending-review counts per project, joined from real reports/review
  // items instead of the static pendingReviewCount seed field.
  async getLivePendingCounts() {
    const counts = {};
    for (const p of API.projects) counts[p.id] = 0;
    for (const item of API.reviewItems) {
      if (item.state !== 'needs-review') continue;
      const report = API.reports.find(r => r.id === item.reportId);
      const projectId = report?.projectId || (item.reportId && counts.hasOwnProperty(item.reportId) ? item.reportId : null);
      if (projectId && counts.hasOwnProperty(projectId)) counts[projectId]++;
    }
    for (const r of API.reports) {
      if (r.status === 'pending-sync' && counts.hasOwnProperty(r.projectId)) continue; // queued offline, counted after sync
    }
    return counts;
  }
};
