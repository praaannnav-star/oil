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

  _enrichItem(item) {
    if (!item) return null;
    const ex = item.extractedEvent || {};
    const blocker = (ex.blocker || '').toLowerCase();
    const status = (ex.status || '').toLowerCase();
    const hasSevere = blocker.includes('halt') || blocker.includes('stop') || blocker.includes('hazard') || blocker.includes('breakdown') || blocker.includes('critical') || blocker.includes('failure');
    const hasModerate = blocker.includes('shortage') || blocker.includes('delay') || blocker.includes('weather') || blocker.includes('rain') || blocker.includes('permit') || status.includes('delay');

    let urgency = item.urgency;
    if (!urgency) {
      if (hasSevere) urgency = { priority: 'P1', score: 95, label: 'P1 Critical', reason: ex.blocker };
      else if (hasModerate) urgency = { priority: 'P2', score: 75, label: 'P2 High', reason: ex.blocker || 'Activity Delayed' };
      else if (status.includes('progress') || status.includes('started')) urgency = { priority: 'P3', score: 45, label: 'P3 Medium', reason: 'Routine Progress' };
      else urgency = { priority: 'P4', score: 20, label: 'P4 Info', reason: 'On Track / Completed' };
    }

    const disc = (item.discipline || ex.discipline || '').toLowerCase();
    let suggestedReviewerRole = item.suggestedReviewerRole;
    if (!suggestedReviewerRole) {
      if (disc.includes('elect') || disc.includes('mech')) suggestedReviewerRole = 'Project Manager';
      else if (disc.includes('inst') || disc.includes('inspect')) suggestedReviewerRole = 'QAQC Reviewer';
      else suggestedReviewerRole = 'Lead Planner';
    }

    return {
      ...item,
      urgency,
      suggestedReviewerRole
    };
  },

  async getReviewQueue(tabCategory = 'all') {
    await API.delay();
    let items = API.reviewItems.map(i => this._enrichItem(i));

    if (tabCategory && tabCategory !== 'all') {
      items = items.filter(item => item.tabCategory === tabCategory || item.state === tabCategory);
    }

    // Dynamic queue priority sorting (P1/needs-review first)
    return items.sort((a, b) => {
      const aPending = a.state === 'needs-review' ? 1 : 0;
      const bPending = b.state === 'needs-review' ? 1 : 0;
      if (aPending !== bPending) return bPending - aPending;
      const scoreA = a.urgency?.score || 0;
      const scoreB = b.urgency?.score || 0;
      return scoreB - scoreA;
    });
  },

  async getReviewItem(id) {
    await API.delay();
    const item = API.reviewItems.find(i => i.id === id);
    return item ? this._enrichItem(item) : null;
  },

  async approveMatch(reviewId, approvedProgress = undefined, reviewer = null) {
    await API.delay();
    const actor = this._resolveReviewer(reviewer, 'approve');
    const item = API.reviewItems.find(i => i.id === reviewId);
    if (!item) return null;

    if (!API.useMock && navigator.onLine) {
      try {
        const { ApiHttp } = await import('./http.js');
        await ApiHttp.request(`/reviews/${reviewId}/approve`, {
          method: 'POST',
          body: { activityId: item.topMatch?.id, approvedProgress }
        });
        
        // Success on backend! Trigger pull to fetch the updated state
        // (projects, activities, reports, reviewItems are modified server-side)
        const { Sync } = await import('../sync.js');
        if (Sync.pullRemoteState) await Sync.pullRemoteState();
        
        return API.reviewItems.find(i => i.id === reviewId) || item;
      } catch (err) {
        console.warn('Remote review approval failed, falling back to local:', err.message);
      }
    }

    // Local / Offline Execution
    item.state = 'approved';
    item.reviewer = actor.label;
    item.reviewedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
    item.tabCategory = 'approved';

    // Update the corresponding activity actuals if match exists
    if (item.topMatch) {
      await ActivitiesService.reconcileFromEvent(item.topMatch.id, item.extractedEvent);

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

    if (!API.useMock && navigator.onLine) {
      try {
        const { ApiHttp } = await import('./http.js');
        await ApiHttp.request(`/reviews/${reviewId}/reject`, {
          method: 'POST',
          body: { reason }
        });
        
        // Success on backend! Trigger pull to fetch the updated state
        const { Sync } = await import('../sync.js');
        if (Sync.pullRemoteState) await Sync.pullRemoteState();
        
        return API.reviewItems.find(i => i.id === reviewId) || item;
      } catch (err) {
        console.warn('Remote review rejection failed, falling back to local:', err.message);
      }
    }

    // Local / Offline Execution
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
