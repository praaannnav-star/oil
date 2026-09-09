import { API } from './api.js';

function buildSCurve(activities, projects) {
  const now = new Date();
  const currentMonthName = now.toLocaleString('en-US', { month: 'short' });

  const totalActs = activities.length;
  const currentActual = totalActs > 0
    ? Number((activities.reduce((sum, a) => sum + (Number(a.progress) || 0), 0) / totalActs).toFixed(1))
    : (projects.length > 0 ? Number((projects.reduce((s, p) => s + (p.actualProgress || 0), 0) / projects.length).toFixed(1)) : 0);

  const currentPlanned = totalActs > 0
    ? Number((activities.reduce((sum, a) => {
        const start = a.plannedStart ? new Date(a.plannedStart).getTime() : now.getTime();
        const finish = a.plannedFinish ? new Date(a.plannedFinish).getTime() : now.getTime();
        if (now.getTime() >= finish) return sum + 100;
        if (now.getTime() <= start) return sum + 0;
        return sum + ((now.getTime() - start) / Math.max(1, finish - start)) * 100;
      }, 0) / totalActs).toFixed(1))
    : (projects.length > 0 ? Number((projects.reduce((s, p) => s + (p.plannedProgress || 0), 0) / projects.length).toFixed(1)) : 0);

  const points = [];
  const monthOffsets = [-10, -8, -6, -4, -2, 0, 2, 4];

  for (const offset of monthOffsets) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const mName = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    const isCurrent = offset === 0;
    const isPast = offset < 0;

    let plannedPct = 0;
    if (totalActs > 0) {
      const dTime = isCurrent ? now.getTime() : d.getTime();
      const pSum = activities.reduce((sum, a) => {
        const start = a.plannedStart ? new Date(a.plannedStart).getTime() : dTime;
        const finish = a.plannedFinish ? new Date(a.plannedFinish).getTime() : dTime + 86400000;
        if (dTime >= finish) return sum + 100;
        if (dTime <= start) return sum + 0;
        return sum + ((dTime - start) / Math.max(1, finish - start)) * 100;
      }, 0);
      plannedPct = Number((pSum / totalActs).toFixed(1));
    } else {
      plannedPct = isCurrent ? currentPlanned : Math.min(100, Math.max(0, Number((currentPlanned + offset * 7).toFixed(1))));
    }

    let actualPct = null;
    if (isCurrent) {
      actualPct = currentActual;
    } else if (isPast) {
      const ratio = currentPlanned > 0 ? Math.min(1, plannedPct / currentPlanned) : 0;
      actualPct = Number((currentActual * ratio).toFixed(1));
    }

    points.push({
      month: isCurrent ? `Current (${currentMonthName})` : mName,
      planned: plannedPct,
      actual: actualPct,
      ...(isCurrent ? { isCurrent: true } : {})
    });
  }

  return points;
}

export const AnalyticsService = {
  async getLiveAnalytics(projectId = null) {
    if (!API.useMock && navigator.onLine) {
      try {
        const { ApiHttp } = await import('./http.js');
        const url = projectId ? `/analytics?projectId=${encodeURIComponent(projectId)}` : '/analytics';
        const data = await ApiHttp.request(url);
        if (data && data.kpis) {
          return data;
        }
      } catch (err) {
        console.warn('Live analytics API call failed, calculating locally:', err.message);
      }
    }

    // Local / Offline calculation from client-side API state
    const projects = projectId ? API.projects.filter(p => p.id === projectId) : API.projects;
    const activities = projectId ? API.activities.filter(a => a.projectId === projectId) : API.activities;
    const reviews = API.reviewItems;

    let totalSpi = 0;
    let spiCount = 0;
    projects.forEach(p => {
      if (p.spi) { totalSpi += Number(p.spi); spiCount++; }
    });
    const portfolioSpi = spiCount > 0 ? Number((totalSpi / spiCount).toFixed(2)) : 0.94;
    const spiDrag = Number(((1.0 - portfolioSpi) * 100).toFixed(1));

    const highConfidenceCount = reviews.filter(r => (r.topMatch?.confidence || 0) >= 80).length;
    const firstPassAccuracyPct = reviews.length > 0 ? Number(((highConfidenceCount / reviews.length) * 100).toFixed(1)) : 89.4;

    const DISCIPLINES = [
      { key: 'Civil', label: 'Civil & Structural (WBS-100)', plan: 81, act: 78 },
      { key: 'Piping', label: 'Process Piping & Manifolds (WBS-200)', plan: 58, act: 54 },
      { key: 'Electrical', label: 'Electrical Substation & Cabling (WBS-300)', plan: 47, act: 48 },
      { key: 'Instrumentation', label: 'Instrumentation & Control (WBS-400)', plan: 46, act: 35 },
      { key: 'Pipeline', label: 'Pipeline & RoW Construction (WBS-500)', plan: 65, act: 62 },
      { key: 'HSE', label: 'HSE & Compliance Assurance', plan: 95, act: 93 }
    ];

    const disciplineBreakdown = DISCIPLINES.map(d => {
      const discActs = activities.filter(a => a.discipline && a.discipline.toLowerCase().includes(d.key.toLowerCase()));
      const actProg = discActs.length > 0
        ? Number((discActs.reduce((acc, a) => acc + (Number(a.progress) || 0), 0) / discActs.length).toFixed(1))
        : d.act;
      const plannedProg = d.plan;
      const variance = Number((actProg - plannedProg).toFixed(1));
      const status = variance >= 0 ? 'on-track' : (variance >= -6 ? 'at-risk' : 'delayed');

      const discRevs = reviews.filter(r =>
        (r.discipline && r.discipline.toLowerCase().includes(d.key.toLowerCase())) ||
        (r.topMatch?.discipline && r.topMatch.discipline.toLowerCase().includes(d.key.toLowerCase()))
      );
      const avgConf = discRevs.length > 0
        ? Math.round(discRevs.reduce((acc, r) => acc + (r.topMatch?.confidence || 85), 0) / discRevs.length)
        : 88;

      return {
        key: d.key,
        label: d.label,
        activityCount: discActs.length,
        actualProgress: actProg,
        plannedProgress: plannedProg,
        variance,
        status,
        avgConfidence: avgConf,
        reviewCount: discRevs.length
      };
    });

    const confidenceHeatmap = DISCIPLINES.map(d => {
      const discRevs = reviews.filter(r =>
        (r.discipline && r.discipline.toLowerCase().includes(d.key.toLowerCase())) ||
        (r.topMatch?.discipline && r.topMatch.discipline.toLowerCase().includes(d.key.toLowerCase()))
      );
      const total = discRevs.length;
      const approved = discRevs.filter(r => r.state === 'approved').length;
      const rejected = discRevs.filter(r => r.state === 'rejected').length;
      const pending = discRevs.filter(r => r.state === 'needs-review').length;
      const rate = (approved + rejected) > 0 ? Math.round((approved / (approved + rejected)) * 100) : (total > 0 ? 100 : 0);
      const avgConf = total > 0
        ? Math.round(discRevs.reduce((acc, r) => acc + (r.topMatch?.confidence || 85), 0) / total)
        : 88;

      return {
        discipline: d.key,
        label: d.label.split(' (')[0],
        totalSubmissions: total,
        approvedCount: approved,
        rejectedCount: rejected,
        pendingCount: pending,
        acceptanceRate: rate,
        avgConfidence: avgConf
      };
    });

    const sCurve = buildSCurve(activities, projects);

    let completedCount = 0;
    let inProgressCount = 0;
    let startedCount = 0;

    if (activities.length > 0) {
      for (const a of activities) {
        const s = (a.status || '').toLowerCase().trim();
        const p = Number(a.progress) || 0;
        if (s === 'completed' || p >= 100) {
          completedCount++;
        } else if (s === 'in-progress' || s === 'in progress' || (p > 0 && p < 100)) {
          inProgressCount++;
        } else {
          startedCount++;
        }
      }
    }

    const totalTracked = (completedCount + inProgressCount + startedCount) || 1;
    const activityStatusBreakdown = {
      completed: {
        count: completedCount,
        pct: Number(((completedCount / totalTracked) * 100).toFixed(1))
      },
      inProgress: {
        count: inProgressCount,
        pct: Number(((inProgressCount / totalTracked) * 100).toFixed(1))
      },
      started: {
        count: startedCount,
        pct: Number(((startedCount / totalTracked) * 100).toFixed(1))
      },
      total: completedCount + inProgressCount + startedCount
    };

    return {
      kpis: {
        portfolioSpi,
        spiDrag,
        reviewVelocityHours: reviews.length > 0 ? Number((reviews.reduce((acc, r) => acc + (r.durationHours || 3.8), 0) / reviews.length).toFixed(1)) : null,
        fieldReportAdoptionPct: activities.length > 0 ? Math.min(100, Math.round(((API.reports || []).length / activities.length) * 100)) : 0,
        firstPassAccuracyPct,
        delayedActivitiesCount: activities.filter(a => a.status === 'delayed').length,
        pendingReviewsCount: reviews.filter(r => r.state === 'needs-review').length
      },
      disciplineBreakdown,
      confidenceHeatmap,
      sCurve,
      activityStatusBreakdown,
      meta: {
        totalProjects: projects.length,
        totalActivities: activities.length,
        totalReviews: reviews.length,
        computedAt: new Date().toISOString()
      }
    };
  },

  async getExecutiveMetrics() {
    const data = await this.getLiveAnalytics();
    return data.kpis;
  },

  async getExecutionMemoryData() {
    await API.delay();
    const reports = API.reports || [];
    const activities = API.activities || [];

    // Derive delay causes dynamically from field reports with blockers
    const blockerReports = reports.filter(r => r.extractedEvent?.blocker && r.extractedEvent.blocker !== 'None');

    const categoryMap = {
      'Weather & Environmental': { count: 0, impactDays: 0, discipline: 'Civil', keywords: ['rain', 'monsoon', 'downpour', 'flood', 'waterlog', 'weather'] },
      'Vendor Supply & Logistics': { count: 0, impactDays: 0, discipline: 'Instrumentation', keywords: ['vendor', 'dispatch', 'delivery', 'spares', 'parts', 'material', 'shipment', 'transit'] },
      'Inspection & Quality Signoff': { count: 0, impactDays: 0, discipline: 'Piping', keywords: ['ndt', 'radiography', 'weld', 'inspection', 'testing', 'hydrotest', 'qc', 'qa'] },
      'Manpower & Crew Availability': { count: 0, impactDays: 0, discipline: 'Civil', keywords: ['crew', 'manpower', 'gang', 'labor', 'welder', 'operator', 'strike'] },
      'Right-of-Use & PTW Clearances': { count: 0, impactDays: 0, discipline: 'Pipeline', keywords: ['ptw', 'permit', 'clearance', 'row', 'land', 'forest', 'statutory'] }
    };

    let totalClassified = 0;
    for (const r of blockerReports) {
      const bText = (r.extractedEvent.blocker || '').toLowerCase();
      const disc = r.extractedEvent.discipline || 'General';
      let matched = false;
      for (const [catName, cat] of Object.entries(categoryMap)) {
        if (cat.keywords.some(k => bText.includes(k))) {
          cat.count++;
          cat.impactDays += 7;
          if (disc && disc !== 'General') cat.discipline = disc;
          matched = true;
          totalClassified++;
          break;
        }
      }
      if (!matched) {
        categoryMap['Weather & Environmental'].count++;
        categoryMap['Weather & Environmental'].impactDays += 5;
        totalClassified++;
      }
    }

    const historicalDelayCauses = [];
    if (totalClassified > 0) {
      for (const [catName, cat] of Object.entries(categoryMap)) {
        if (cat.count > 0) {
          historicalDelayCauses.push({
            cause: catName,
            count: cat.count,
            pct: Math.round((cat.count / totalClassified) * 100),
            impactDays: cat.impactDays,
            discipline: cat.discipline
          });
        }
      }
      historicalDelayCauses.sort((a, b) => b.count - a.count);
    }

    // Dynamic discipline performance from actual activities
    const discMap = new Map();
    for (const a of activities) {
      const d = a.discipline || 'General';
      if (!discMap.has(d)) {
        discMap.set(d, { sampleActivities: 0, totalPlannedDays: 0, totalActualDays: 0 });
      }
      const entry = discMap.get(d);
      entry.sampleActivities++;

      const pStart = a.plannedStart ? new Date(a.plannedStart).getTime() : 0;
      const pFinish = a.plannedFinish ? new Date(a.plannedFinish).getTime() : 0;
      const plannedDays = (pStart && pFinish && pFinish > pStart) ? Math.round((pFinish - pStart) / 86400000) : 60;
      entry.totalPlannedDays += plannedDays;

      const actProgress = Number(a.progress) || 0;
      const actDays = actProgress > 0 && actProgress < 100
        ? Math.round(plannedDays * (1 + (a.status === 'delayed' ? 0.15 : -0.02)))
        : plannedDays;
      entry.totalActualDays += actDays;
    }

    const disciplinePerformance = [];
    for (const [discipline, data] of discMap.entries()) {
      const avgPlanned = Math.round(data.totalPlannedDays / Math.max(1, data.sampleActivities));
      const avgActual = Math.round(data.totalActualDays / Math.max(1, data.sampleActivities));
      const variancePct = avgPlanned > 0
        ? Number((((avgPlanned - avgActual) / avgPlanned) * 100).toFixed(1))
        : 0;
      disciplinePerformance.push({
        discipline,
        plannedDays: avgPlanned,
        actualAvgDays: avgActual,
        variancePct,
        sampleActivities: data.sampleActivities
      });
    }

    return {
      historicalDelayCauses,
      disciplinePerformance
    };
  }
};
