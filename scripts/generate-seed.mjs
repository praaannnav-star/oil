import fs from 'fs';

const BASELINE_PROJECTS = [
  {
    id: 'PRJ-OIL-2026-01',
    name: 'Duliajan Central Gas Gathering Station (CGGS) Expansion',
    code: 'OIL-CGGS-EXP',
    location: 'Duliajan, Dibrugarh District, Assam',
    projectType: 'Plant',
    category: 'Brownfield',
    riskTier: 'A',
    priority: 'P1',
    region: 'Assam East',
    plannedProgress: 68.5,
    actualProgress: 62.0,
    variance: -6.5,
    spi: 0.91,
    health: 'at-risk',
    delayedActivitiesCount: 4,
    pendingReviewCount: 6,
    evidenceCoverage: 91
  }
];

const BASELINE_ACTIVITIES = [];

let sql = '';

for (const p of BASELINE_PROJECTS) {
  sql += `INSERT OR IGNORE INTO projects (id, code, name, location, project_type, category, risk_tier, priority, region, health, spi, planned_progress, actual_progress, variance, delayed_activities_count, pending_review_count, evidence_coverage) VALUES ('${p.id}', '${p.code}', '${p.name}', '${p.location}', '${p.projectType}', '${p.category}', '${p.riskTier}', '${p.priority}', '${p.region}', '${p.health}', ${p.spi}, ${p.plannedProgress}, ${p.actualProgress}, ${p.variance}, ${p.delayedActivitiesCount}, ${p.pendingReviewCount}, ${p.evidenceCoverage});\n`;
}

for (const a of BASELINE_ACTIVITIES) {
  sql += `INSERT OR IGNORE INTO activities (id, project_id, parent_id, level, code, name, discipline, planned_start, planned_finish, actual_start, actual_finish, progress, status, variance) VALUES ('${a.id}', '${a.projectId}', ${a.parentId ? `'${a.parentId}'` : 'NULL'}, '${a.level}', '${a.code}', '${a.name}', '${a.discipline}', ${a.plannedStart ? `'${a.plannedStart}'` : 'NULL'}, ${a.plannedFinish ? `'${a.plannedFinish}'` : 'NULL'}, ${a.actualStart ? `'${a.actualStart}'` : 'NULL'}, ${a.actualFinish ? `'${a.actualFinish}'` : 'NULL'}, ${a.progress || 0}, '${a.status}', ${a.variance || 0});\n`;
}

fs.writeFileSync('worker/seed.sql', sql);
console.log('worker/seed.sql generated');
