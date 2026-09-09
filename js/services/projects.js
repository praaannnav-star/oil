import { API } from './api.js';
import { AuditService } from './audit.js';

export const HARDCODED_BASELINE_PROJECTS = [
  {
    id: 'PRJ-OIL-DUL-001',
    name: 'Duliajan Field Headquarters Operations Hub Modernization',
    code: 'OIL-DUL-MOD',
    location: 'Duliajan, Dibrugarh District, Assam',
    projectType: 'Plant',
    category: 'Brownfield',
    riskTier: 'B',
    priority: 'P1',
    region: 'Assam East',
    plannedProgress: 100.0,
    actualProgress: 100.0,
    variance: 0.0,
    spi: 1.00,
    health: 'completed',
    delayedActivitiesCount: 0,
    pendingReviewCount: 0,
    evidenceCoverage: 100
  },
  {
    id: 'PRJ-OIL-2026-01',
    name: 'Duliajan Central Gas Gathering Station (CGGS) Expansion',
    code: 'OIL-CGGS-EXP',
    location: 'Duliajan, Dibrugarh District, Assam',
    projectType: 'Plant',
    category: 'Brownfield',
    riskTier: 'A',
    priority: 'P1',
    region: 'Assam East',
    plannedProgress: 68.5,
    actualProgress: 64.0,
    variance: -4.5,
    spi: 0.93,
    health: 'at-risk',
    delayedActivitiesCount: 2,
    pendingReviewCount: 3,
    evidenceCoverage: 94
  },
  {
    id: 'PRJ-OIL-NUM-002',
    name: 'Numaligarh to Siliguri Pipeline Augmentation Phase-2',
    code: 'OIL-NSPL-AUG',
    location: 'Numaligarh, Golaghat District, Assam',
    projectType: 'Pipeline',
    category: 'Linear',
    riskTier: 'B',
    priority: 'P2',
    region: 'Assam Central',
    plannedProgress: 52.0,
    actualProgress: 54.5,
    variance: +2.5,
    spi: 1.05,
    health: 'on-track',
    delayedActivitiesCount: 0,
    pendingReviewCount: 2,
    evidenceCoverage: 98
  },
  {
    id: 'PRJ-OIL-MOR-003',
    name: 'Moran Field Production Infrastructure Modernization',
    code: 'OIL-MOR-MOD',
    location: 'Moran, Charaideo District, Assam',
    projectType: 'Wellhead',
    category: 'Upstream',
    riskTier: 'B',
    priority: 'P2',
    region: 'Upper Assam',
    plannedProgress: 41.0,
    actualProgress: 39.5,
    variance: -1.5,
    spi: 0.96,
    health: 'on-track',
    delayedActivitiesCount: 1,
    pendingReviewCount: 1,
    evidenceCoverage: 89
  }
];

export const ProjectsService = {
  async getProjects() {
    if (navigator.onLine) {
      try {
        const { ApiHttp } = await import('./http.js');
        const remoteProjects = await ApiHttp.request('/projects');
        if (Array.isArray(remoteProjects) && remoteProjects.length > 0) {
          API.projects = remoteProjects;
          API.persist('projects');
          return remoteProjects;
        }
      } catch (err) {
        console.warn('Live projects fetch failed, falling back to local cache:', err.message);
      }
    }
    if (API.projects && API.projects.length > 0) {
      return API.projects;
    }
    return [];
  },

  async getProject(id) {
    if (navigator.onLine && (!API.projects || API.projects.length === 0)) {
      await this.getProjects();
    }
    const list = (API.projects && API.projects.length > 0) ? API.projects : [];
    const prj = list.find(p => p.id === id);
    if (!prj && list.length > 0) return list[0];
    return prj || null;
  },

  async createProject(data, actor) {
    if (!API.useMock && navigator.onLine) {
      const { ApiHttp } = await import('./http.js');
      try {
        const result = await ApiHttp.request('/projects', {
          method: 'POST',
          body: data
        });
        API.projects.unshift(result);
        API.persist('projects');
        return result;
      } catch (err) {
        console.warn('Failed to create project on remote API:', err);
        throw err;
      }
    }
    
    // Offline / Mock fallback
    await API.delay();
    const project = {
      id: `PRJ-OIL-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
      plannedProgress: 0, actualProgress: 0, variance: 0, spi: 1,
      health: 'on-track', delayedActivitiesCount: 0, pendingReviewCount: 0,
      evidenceCoverage: 0, yesterdayChanges: [], ...data
    };
    API.projects.unshift(project);
    API.persist('projects');
    await AuditService.appendAudit({ action: 'PROJECT_CREATED', actor: actor?.name || 'System Administrator', role: actor?.role || 'Admin', detail: `Created project ${project.code}: ${project.name}` });
    return project;
  },

  async updateProject(id, patch, actor) {
    if (!API.useMock && navigator.onLine) {
      const { ApiHttp } = await import('./http.js');
      try {
        const result = await ApiHttp.request(`/projects/${id}`, {
          method: 'PATCH',
          body: patch
        });
        const index = API.projects.findIndex(p => p.id === id);
        if (index !== -1) {
          API.projects[index] = result;
          API.persist('projects');
        }
        return result;
      } catch (err) {
        console.warn('Failed to update project on remote API:', err);
        throw err;
      }
    }

    // Offline / Mock fallback
    await API.delay();
    const index = API.projects.findIndex(project => project.id === id);
    if (index === -1) throw new Error('Project not found');
    API.projects[index] = { ...API.projects[index], ...patch, id };
    API.persist('projects');
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
    if (!API.useMock && navigator.onLine) {
      try {
        const { ApiHttp } = await import('./http.js');
        const result = await ApiHttp.request(`/projects/${id}/location`, { method: 'POST', body: { lat: Number(lat), lng: Number(lng) } });
        const index = API.projects.findIndex(p => p.id === id);
        if (index !== -1) {
          API.projects[index] = result;
          API.persist('projects');
        }
        return result;
      } catch (err) {
        console.warn('Failed to set location on remote API:', err);
      }
    }

    // Offline / Mock fallback
    const index = API.projects.findIndex(project => project.id === id);
    if (index === -1) throw new Error('Project not found');
    API.projects[index] = { ...API.projects[index], lat: Number(lat), lng: Number(lng) };
    API.persist('projects');
    return API.projects[index];
  },

  async suggestLocation(text, projectId = null) {
    if (!API.useMock && navigator.onLine) {
      try {
        const { ApiHttp } = await import('./http.js');
        return await ApiHttp.request('/geo/suggest', {
          method: 'POST',
          body: { text, projectId }
        });
      } catch (err) {
        console.warn('Remote geo suggestion failed, using local gazetteer fallback', err);
      }
    }

    // Local / Offline Gazetteer Fallback
    await API.delay(300);
    const SITES_MOCK = [
      { id: 'SITE-OIL-DUL-01', name: 'Duliajan CGGS Main Complex', lat: 27.3569, lng: 95.3194, chainageRef: 'CH:0+000', confidence: 95, source: 'gazetteer' },
      { id: 'SITE-OIL-DUL-PAD14', name: 'Duliajan CGGS Pad 14 (Foundation B2)', lat: 27.3612, lng: 95.3241, chainageRef: 'Pad 14', confidence: 90, source: 'gazetteer' },
      { id: 'SITE-OIL-DUL-PAD08', name: 'Duliajan CGGS Pad 08 (Substation Area)', lat: 27.3521, lng: 95.3125, chainageRef: 'Pad 08', confidence: 85, source: 'gazetteer' },
      { id: 'SITE-OIL-NUM-01', name: 'Numaligarh Dispatch Terminal', lat: 26.6025, lng: 93.7548, chainageRef: 'CH:0+000', confidence: 92, source: 'gazetteer' },
      { id: 'SITE-OIL-NUM-ROW42', name: 'Numaligarh Feeder RoW (Ch: 42+500)', lat: 26.6842, lng: 93.8912, chainageRef: 'CH:42+500', confidence: 88, source: 'gazetteer' },
      { id: 'SITE-OIL-SIL-01', name: 'Siliguri Receiving Station', lat: 26.7271, lng: 88.3953, chainageRef: 'CH:480+000', confidence: 90, source: 'gazetteer' }
    ];

    const lower = (text || '').toLowerCase();
    const matches = SITES_MOCK.filter(s => lower.includes(s.name.toLowerCase()) || lower.includes((s.chainageRef || '').toLowerCase()) || s.name.toLowerCase().split(' ').some(token => token.length > 4 && lower.includes(token)));
    return {
      candidates: matches.length > 0 ? matches : SITES_MOCK.slice(0, 3),
      source: matches.length > 0 ? 'gazetteer' : 'default-project-site'
    };
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
