// Schedule-derived reconciliation — server-side port of
// ActivitiesService.reconcileFromEvent (js/services/activities.js).
// Runs inside POST /api/reviews/:id/approve so approved matches update D1.

const DAY_MS = 86400000;

export function reconcileActivity(act, event) {
  const next = { ...act };
  const reportedStatus = String(event?.status || '').toLowerCase();
  const reportDate = event?.date || new Date().toISOString().split('T')[0];

  if (!next.actualStart) next.actualStart = reportDate;

  if (reportedStatus.includes('completed')) {
    next.progress = 100;
    next.status = 'completed';
    next.actualFinish = reportDate;
  } else {
    if (next.plannedStart && next.plannedFinish) {
      const windowMs = new Date(next.plannedFinish).getTime() - new Date(next.plannedStart).getTime();
      if (windowMs > 0) {
        const elapsedMs = new Date(reportDate).getTime() - new Date(next.plannedStart).getTime();
        const implied = Math.round(Math.min(95, Math.max(0, (elapsedMs / windowMs) * 100)));
        next.progress = reportedStatus.includes('delay')
          ? Number(next.progress) || 0
          : Math.min(95, Math.max(Number(next.progress) || 0, implied));
      }
    }
    next.status = reportedStatus.includes('delay') ? 'delayed' : 'in-progress';
  }

  // Real finish variance in days for completed work (positive = late).
  if (next.actualFinish && next.plannedFinish) {
    next.variance = Math.round((new Date(next.actualFinish).getTime() - new Date(next.plannedFinish).getTime()) / DAY_MS);
  } else if (next.plannedProgress != null && next.progress != null) {
    next.variance = Math.round((Number(next.progress) - Number(next.plannedProgress)) * 10) / 10;
  }

  return next;
}

// Roll leaf actuals up the WBS chain and refresh project KPIs.
// activities: full mapped list; returns {activities, projects} patch lists.
export function rollupAll(activities, projects) {
  const byId = new Map(activities.map(a => [a.id, a]));
  const childrenOf = id => activities.filter(a => a.parentId === id);

  function rollup(act) {
    const kids = childrenOf(act.id);
    if (kids.length === 0) return act;
    for (const kid of kids) rollup(kid);
    act.progress = Math.round(kids.reduce((s, k) => s + (Number(k.progress) || 0), 0) / kids.length);
    act.status = kids.every(k => k.status === 'completed')
      ? 'completed'
      : kids.some(k => k.status === 'delayed')
        ? 'delayed'
        : 'in-progress';
    return act;
  }

  const roots = activities.filter(a => !a.parentId);
  for (const root of roots) rollup(root);

  const delayedByProject = {};
  for (const a of activities) {
    if (a.projectId == null) continue;
    delayedByProject[a.projectId] = delayedByProject[a.projectId] || { count: 0, sum: 0, n: 0 };
    if ((a.level === 'L5' || a.level === 'L6')) {
      delayedByProject[a.projectId].sum += Number(a.progress) || 0;
      delayedByProject[a.projectId].n += 1;
      if (a.status === 'delayed') delayedByProject[a.projectId].count += 1;
    }
  }

  const updatedProjects = [];
  for (const p of projects) {
    const agg = delayedByProject[p.id];
    if (!agg) continue;
    const patch = {
      ...p,
      delayedActivitiesCount: agg.count,
      actualProgress: agg.n ? Math.round(agg.sum / agg.n) : Number(p.actualProgress) || 0
    };
    const planned = Number(patch.plannedProgress) || 0;
    patch.variance = patch.actualProgress - planned;
    patch.spi = planned > 0 ? Math.round((patch.actualProgress / planned) * 100) / 100 : 1;
    patch.health = patch.spi >= 0.95 ? 'on-track' : patch.spi >= 0.85 ? 'at-risk' : 'delayed';
    updatedProjects.push(patch);
  }

  return { activities, projects: updatedProjects };
}
