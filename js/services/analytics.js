import { API } from './api.js';

export const AnalyticsService = {
  async getExecutiveMetrics() {
    await API.delay();
    const projects = API.projects;
    const totalProjects = projects.length;
    const atRiskCount = projects.filter(p => p.health === 'at-risk' || p.health === 'delayed').length;
    const totalDelayedActs = projects.reduce((acc, p) => acc + p.delayedActivitiesCount, 0);
    const pendingReviews = API.reviewItems.filter(r => r.state === 'needs-review' || r.state === 'ambiguous').length;
    const avgCoverage = Math.round(projects.reduce((acc, p) => acc + p.evidenceCoverage, 0) / (totalProjects || 1));

    return {
      totalProjects,
      atRiskCount,
      totalDelayedActs,
      pendingReviews,
      avgCoverage
    };
  },

  async getExecutionMemoryData() {
    await API.delay();
    return {
      historicalDelayCauses: [
        { cause: 'Monsoon Heavy Downpour & Waterlogging', count: 18, pct: 34, impactDays: 42, discipline: 'Civil' },
        { cause: 'Vendor Part Dispatch & Logistics (Kolkata/Guwahati)', count: 12, pct: 23, impactDays: 28, discipline: 'Instrumentation' },
        { cause: 'Radiography / NDT Night Shift Approval Window', count: 9, pct: 17, impactDays: 14, discipline: 'Piping' },
        { cause: 'Sub-contractor Rebar Crew Availability', count: 8, pct: 15, impactDays: 16, discipline: 'Civil' },
        { cause: 'Site Right-of-Use / Permit to Work (PTW) Issuance', count: 6, pct: 11, impactDays: 9, discipline: 'Pipeline' }
      ],
      disciplinePerformance: [
        { discipline: 'Civil & Structural', plannedDays: 180, actualAvgDays: 194, variancePct: -7.8, sampleActivities: 34 },
        { discipline: 'Piping & Fabrication', plannedDays: 140, actualAvgDays: 146, variancePct: -4.3, sampleActivities: 28 },
        { discipline: 'Electrical Works', plannedDays: 90, actualAvgDays: 89, variancePct: +1.1, sampleActivities: 16 },
        { discipline: 'Instrumentation & DCS', plannedDays: 110, actualAvgDays: 122, variancePct: -10.9, sampleActivities: 19 }
      ]
    };
  }
};
