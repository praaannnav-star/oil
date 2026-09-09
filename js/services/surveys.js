// Survey service — first-class inspection/progress submissions that enter the
// review queue alongside field reports. Offline submissions queue through the
// same pendingReports store with type='survey' and are promoted by SyncManager.
import { API } from './api.js';
import { DB } from '../db.js';
import { AuditService } from './audit.js';
import { Auth } from './auth.js';

const DEFAULT_TEMPLATES = [
  {
    id: 'TPL-SITE-INSPECTION',
    name: 'Site Inspection (Safety & Compliance)',
    icon: '🛡️',
    description: 'Structured HSE walkthrough checklist with photo evidence',
    questions: [
      { id: 'q_housekeeping', type: 'radio', label: 'Site housekeeping compliant?', options: ['Yes', 'No', 'Partial'], required: true },
      { id: 'q_ppe', type: 'radio', label: 'PPE compliance observed across workface?', options: ['Yes', 'No', 'Partial'], required: true },
      { id: 'q_permits', type: 'radio', label: 'Work permits displayed & valid?', options: ['Yes', 'No', 'N/A'], required: true },
      { id: 'q_hazards', type: 'text', label: 'Hazards / near-miss observations', placeholder: 'Describe any hazards, near misses or unsafe conditions...', voice: true },
      { id: 'q_overall', type: 'radio', label: 'Overall inspection outcome', options: ['Pass', 'Fail - Action Required', 'Conditional Pass'], required: true }
    ]
  },
  {
    id: 'TPL-PROGRESS-SURVEY',
    name: 'Daily Progress Survey',
    icon: '📊',
    description: 'Quantitative daily workfront status for schedule reconciliation',
    questions: [
      { id: 'q_activity', type: 'text', label: 'Activity / workface covered today', placeholder: 'e.g., Foundation B2 shuttering, Chainage 42-47 trenching...', required: true, voice: true },
      { id: 'q_quantity', type: 'text', label: 'Quantity installed today', placeholder: 'e.g., 45 cum concrete, 380 inch dia welds...', required: true },
      { id: 'q_crew', type: 'number', label: 'Crew size on site', placeholder: 'e.g., 24', required: true },
      { id: 'q_tomorrow', type: 'radio', label: 'Workface ready for tomorrow?', options: ['Yes', 'No - constraint exists'], required: true },
      { id: 'q_constraint', type: 'text', label: 'If blocked, describe the constraint', placeholder: 'Material shortage, weather, equipment breakdown...', voice: true },
      { id: 'q_pct', type: 'number', label: 'Estimated % complete for this activity', placeholder: '0-100' }
    ]
  }
];

export const SurveyService = {
  async getTemplates() {
    try {
      const { ApiHttp } = await import('./http.js');
      const data = await ApiHttp.request('/surveys/templates');
      if (Array.isArray(data) && data.length > 0) {
        return data.map(t => ({
          ...t,
          icon: t.icon || (t.id.includes('SITE') ? '🛡️' : '📊'),
          description: t.description || (t.id.includes('SITE') ? 'Structured HSE walkthrough checklist with photo evidence' : 'Quantitative daily workfront status for schedule reconciliation'),
          questions: t.questions || t.sections || []
        }));
      }
    } catch (e) {
      console.warn('Using default survey templates (API unavailable or offline):', e.message);
    }
    return DEFAULT_TEMPLATES;
  },

  async getSurveys(projectId = null) {
    await API.delay();
    if (projectId) return API.surveys.filter(s => s.projectId === projectId);
    return API.surveys;
  },

  async submitSurvey({ projectId, templateId, templateName, answers, photos = [], geo = null, isOffline = false }) {
    await API.delay();
    const user = Auth.getUser();
    const submission = {
      type: 'survey',
      id: `SRV-${Date.now()}`,
      projectId,
      templateId,
      templateName,
      submittedBy: user?.name || 'Field Staff',
      answers,
      photos: isOffline ? photos : [],
      photoCount: photos.length,
      geo,
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST',
      status: isOffline ? 'pending-sync' : 'submitted'
    };

    // Always queue through the offline pipeline to ensure durability; SyncManager promotes it to the backend.
    await DB.addPendingReport(submission);

    // If online, immediately trigger the sync engine to push to backend
    if (!isOffline && navigator.onLine) {
      import('../sync.js').then(({ Sync }) => {
        if (Sync.syncPending) Sync.syncPending().catch(e => console.warn('Background sync failed:', e));
      });
    }

    await AuditService.appendAudit({
      activityId: 'GENERAL',
      action: 'Survey Submitted',
      actor: submission.submittedBy,
      role: user?.role || 'Field Staff',
      detail: `${templateName} (${Object.keys(answers).length} responses${photos.length ? `, ${photos.length} photo(s)` : ''})`
    });

    return submission;
  }
};
