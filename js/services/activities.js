import { API } from './api.js';

export const ActivitiesService = {
  async getActivities(projectId = null, filters = {}) {
    await API.delay();
    let list = API.activities;
    if (projectId) {
      list = list.filter(a => a.projectId === projectId);
    }
    if (filters.discipline && filters.discipline !== 'All') {
      list = list.filter(a => a.discipline === filters.discipline);
    }
    if (filters.status && filters.status !== 'All') {
      list = list.filter(a => a.status === filters.status);
    }
    if (filters.level && filters.level !== 'All') {
      list = list.filter(a => a.level === filters.level);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(a => 
        a.name.toLowerCase().includes(q) || 
        a.code.toLowerCase().includes(q) ||
        (a.id && a.id.toLowerCase().includes(q))
      );
    }
    return list;
  },

  async getActivity(id) {
    await API.delay();
    return API.activities.find(a => a.id === id || a.code === id) || null;
  },

  async updateActivity(id, patch) {
    await API.delay();
    const index = API.activities.findIndex(a => a.id === id || a.code === id);
    if (index !== -1) {
      API.activities[index] = { ...API.activities[index], ...patch };
      return API.activities[index];
    }
    return null;
  }
};
