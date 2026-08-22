import { API } from './api.js';
import { ActivitiesService } from './activities.js';
import { AuditService } from './audit.js';
import { Auth, USER_ROLES } from './auth.js';

const REVIEW_ALLOWED_ROLES = [
  USER_ROLES.ADMIN,
  USER_ROLES.PROJECT_MANAGER,
  USER_ROLES.PLANNER,
  USER_ROLES.REVIEWER
];

export const ReviewService = {
  // Review actions are bound to the signed-in session — no anonymous or
  // hardcoded reviewer attribution is permitted.
  _resolveReviewer(explicitReviewer, action) {
    if (explicitReviewer) {
      return { name: explicitReviewer, label: explicitReviewer, role: 'Lead Planner' };
    }
    const user = Auth.getUser();
    if (!user) {
      throw new Error('You must be signed in to review items.');
    }
    if (!REVIEW_ALLOWED_ROLES.includes(user.role)) {
      throw new Error(`Role "${user.role}" is not permitted to ${action} matches.`);
    }
    return {
      name: user.name,
      label: `${user.name} — ${user.title}`,
      role: user.role
    };
  },

  async getReviewQueue(tabCategory = 'all') {
    await API.delay();
    if (tabCategory && tabCategory !== 'all') {
      return API.reviewItems.filter(item => item.tabCategory === tabCategory || item.state === tabCategory);
    }
    return API.reviewItems;
  },

  async getReviewItem(id) {
    await API.delay();
    return API.reviewItems.find(i => i.id === id) || null;
  },

  async approveMatch(reviewId, reviewer = null) {
    await API.delay();
    const actor = this._resolveReviewer(reviewer, 'approve');
    const item = API.reviewItems.find(i => i.id === reviewId);
    if (!item) return null;

    item.state = 'approved';
    item.reviewer = actor.label;
    item.reviewedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
    item.tabCategory = 'approved';

    // Update the corresponding activity actuals if match exists
    if (item.topMatch) {
      const isCompleted = item.extractedEvent?.status?.toLowerCase().includes('completed');
      await ActivitiesService.updateActivity(item.topMatch.id, {
        progress: isCompleted ? 100 : 75,
        status: isCompleted ? 'completed' : 'in-progress',
        actualFinish: isCompleted ? item.extractedEvent.date : null,
        reviewState: 'approved'
      });

      // Append Audit Log
      await AuditService.appendAudit({
        activityId: item.topMatch.id,
        action: 'Activity Match Approved',
        actor: actor.name,
        role: actor.role,
        detail: `Confirmed link to ${item.topMatch.code} (${item.topMatch.name}). Schedule actuals updated.`
      });
    }

    API.persist('reviewItems');
    return item;
  },

  async rejectMatch(reviewId, reason = 'Incorrect activity match', reviewer = null) {
    await API.delay();
    const actor = this._resolveReviewer(reviewer, 'reject');
    const item = API.reviewItems.find(i => i.id === reviewId);
    if (!item) return null;

    item.state = 'rejected';
    item.tabCategory = 'rejected';
    item.reviewer = actor.label;
    item.reviewedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
    item.rejectionReason = reason;

    if (item.topMatch) {
      await AuditService.appendAudit({
        activityId: item.topMatch.id,
        action: 'Activity Match Rejected',
        actor: actor.name,
        role: actor.role,
        detail: `Reason: ${reason}`
      });
    }

    API.persist('reviewItems');
    return item;
  }
};
