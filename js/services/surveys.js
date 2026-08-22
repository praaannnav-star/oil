// Survey service — first-class inspection/progress submissions that enter the
// review queue alongside field reports. Offline submissions queue through the
// same pendingReports store with type='survey' and are promoted by SyncManager.
import { API } from './api.js';
import { DB } from '../db.js';
import { AuditService } from './audit.js';
import { Auth } from './auth.js';

export const SurveyService = {
  async getTemplates() {
    const { SURVEY_TEMPLATES } = await import('../data/survey-templates.js');
    return SURVEY_TEMPLATES;
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

    if (isOffline) {
      // Queue through the offline pipeline; SyncManager promotes it.
      await DB.addPendingReport(submission);
      return submission;
    }

    API.surveys.unshift(submission);
    API.persist('surveys');

    API.reviewItems.unshift({
      id: `REV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      reportId: submission.id,
      source: `Survey — ${templateName}`,
      reporter: submission.submittedBy,
      discipline: 'HSE / Progress',
      extractedEvent: {
        activity: Object.values(answers).find(v => typeof v === 'string' && v.length > 12)?.slice(0, 70) || templateName,
        status: String(answers.q_overall || answers.q_tomorrow || 'Submitted'),
        blocker: 'None'
      },
      topMatch: null,
      alternatives: [],
      surveyAnswers: { ...answers },
      state: 'needs-review',
      tabCategory: 'needs-review',
      reviewer: null,
      reviewedAt: null,
      age: 'Just now'
    });
    API.persist('reviewItems');

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
