import { API } from './api.js';

export const EvidenceService = {
  async getEvidence(activityId = null) {
    await API.delay();
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
