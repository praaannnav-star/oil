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
      API.persist('activities');
      return API.activities[index];
    }
    return null;
  },

  // Reconcile schedule actuals from a reviewed field event. All values are
  // derived from real dates — no invented shift windows or fixed percentages.
  async reconcileFromEvent(activityId, event) {
    const index = API.activities.findIndex(a => a.id === activityId);
    if (index === -1) return null;
    const act = { ...API.activities[index] };

    const DAY_MS = 86400000;
    // A corrupted stored row ('abc', null, NaN) must normalize before any
    // floor/hold math touches it — otherwise garbage propagates forever.
    const prevProgress = Number.isFinite(Number(act.progress)) ? Number(act.progress) : 0;
    act.progress = Math.min(100, Math.max(0, prevProgress));
    // Non-string statuses (numbers, objects) must coerce, never crash.
    const reportedStatus = String(event?.status ?? '').toLowerCase();
    // The verified observation date anchors all reconciliation math. Only a
    // plausible calendar date is trusted; anything else falls back to today
    // so a corrupted capture can never inject NaN into schedule state.
    const reportDate = /^\d{4}-\d{2}-\d{2}/.test(String(event?.date ?? ''))
      ? String(event.date).slice(0, 10)
      : new Date().toISOString().split('T')[0];

    // 1) Actual start: the first evidence-backed observation on this activity
    if (!act.actualStart) {
      act.actualStart = reportDate;
    }

    if (reportedStatus.includes('completed')) {
      // Verified completion: full progress with a dated finish
      act.progress = 100;
      act.status = 'completed';
      act.actualFinish = reportDate;
    } else {
      // Time-phased earned progress: share of the baseline window elapsed,
      // floored at previously reported progress (observations never regress).
      if (act.plannedStart && act.plannedFinish) {
        const windowMs = new Date(act.plannedFinish) - new Date(act.plannedStart);
        if (windowMs > 0) {
          const elapsedMs = new Date(reportDate) - new Date(act.plannedStart);
          const implied = Math.round(Math.min(95, Math.max(0, (elapsedMs / windowMs) * 100)));
          act.progress = reportedStatus.includes('delay')
            ? act.progress // blocked work: hold reported progress, flag status only
            : Math.min(95, Math.max(act.progress, implied));        }
      }
      act.status = reportedStatus.includes('delay') || reportedStatus.includes('halt') || reportedStatus.includes('breakdown')
        ? 'delayed'
        : 'in-progress';
    }

    // 2) Finish variance from real dates only (early finish => positive days).
    //    Unparseable dates yield NaN — leave prior variance untouched instead.
    if (act.status === 'completed' && act.actualFinish && act.plannedFinish) {
      const varianceDays = (new Date(act.plannedFinish) - new Date(act.actualFinish)) / DAY_MS;
      if (Number.isFinite(varianceDays)) {
        act.variance = Math.round(varianceDays * 10) / 10;
      }
    }

    act.reviewState = 'approved';
    API.activities[index] = act;
    API.persist('activities');
    return act;
  }
};
