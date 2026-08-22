import { API } from './api.js';
import { ActivitiesService } from './activities.js';
import { AuditService } from './audit.js';

export const ReviewService = {
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

  async approveMatch(reviewId, reviewer = 'Rajesh Baruah, AGM (Projects)') {
    await API.delay();
    const item = API.reviewItems.find(i => i.id === reviewId);
    if (!item) return null;

    item.state = 'approved';
    item.reviewer = reviewer;
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
        action: 'Planner Approved Activity Match',
        actor: reviewer,
        role: 'Lead Planner',
        detail: `Confirmed link to ${item.topMatch.code} (${item.topMatch.name}). Schedule actuals updated.`
      });
    }

    API.persist('reviewItems');
    return item;
  },

  async rejectMatch(reviewId, reason = 'Incorrect activity match', reviewer = 'Rajesh Baruah') {
    await API.delay();
    const item = API.reviewItems.find(i => i.id === reviewId);
    if (!item) return null;

    item.state = 'rejected';
    item.tabCategory = 'rejected';
    item.reviewer = reviewer;
    item.reviewedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
    item.rejectionReason = reason;

    if (item.topMatch) {
      await AuditService.appendAudit({
        activityId: item.topMatch.id,
        action: 'Match Rejected by Planner',
        actor: reviewer,
        role: 'Lead Planner',
        detail: `Reason: ${reason}`
      });
    }

    API.persist('reviewItems');
    return item;
  }
};
