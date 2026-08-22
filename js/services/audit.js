import { API } from './api.js';

export const AuditService = {
  async getAuditLogs(activityId = null) {
    await API.delay();
    if (activityId) {
      return API.auditLogs.filter(a => a.activityId === activityId || a.activityId === 'GENERAL');
    }
    return API.auditLogs;
  },

  async appendAudit({ activityId = 'GENERAL', action, actor, role = 'Site Staff', detail }) {
    const entry = {
      id: `AUD-${Date.now()}`,
      activityId,
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST',
      actor,
      role,
      action,
      detail
    };
    API.auditLogs.unshift(entry);
    API.persist('auditLogs');
    return entry;
  }
};
