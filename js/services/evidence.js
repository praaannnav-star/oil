import { API } from './api.js';

export const EvidenceService = {
  async getEvidence(activityId = null) {
    await API.delay();
    if (!API.useMock && navigator.onLine) {
      try {
        const { ApiHttp } = await import('./http.js');
        const remote = await ApiHttp.request(activityId ? `/evidence?activityId=${activityId}` : '/evidence');
        if (Array.isArray(remote)) {
          for (const ev of remote) {
            const idx = API.evidence.findIndex(e => e.id === ev.id);
            if (idx !== -1) API.evidence[idx] = ev;
            else API.evidence.push(ev);
          }
          API.persist('evidence', true);
        }
      } catch (err) {
        console.warn('Live evidence fetch failed, using local cache:', err.message);
      }
    }
    if (activityId) {
      return API.evidence.filter(e => e.activityId === activityId);
    }
    return API.evidence;
  },

  async addEvidence(evidenceItem) {
    await API.delay();
    const item = {
      id: `EVD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST',
      status: 'pending',
      ...evidenceItem
    };
    API.evidence.unshift(item);
    API.persist('evidence');
    return item;
  }
};
