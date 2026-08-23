import fs from 'fs';
import { MOCK_PROJECTS } from '../js/data/mock-projects.js';
import { MOCK_ACTIVITIES } from '../js/data/mock-activities.js';

let sql = '';

for (const p of MOCK_PROJECTS) {
  sql += `INSERT OR IGNORE INTO projects (id, code, name, location, project_type, category, risk_tier, priority, region, health, spi, planned_progress, actual_progress, variance, delayed_activities_count, pending_review_count, evidence_coverage) VALUES ('${p.id}', '${p.code}', '${p.name}', '${p.location}', '${p.projectType}', '${p.category}', '${p.riskTier}', '${p.priority}', '${p.region}', '${p.health}', ${p.spi}, ${p.plannedProgress}, ${p.actualProgress}, ${p.variance}, ${p.delayedActivitiesCount}, ${p.pendingReviewCount}, ${p.evidenceCoverage});\n`;
}

for (const a of MOCK_ACTIVITIES) {
  sql += `INSERT OR IGNORE INTO activities (id, project_id, parent_id, level, code, name, discipline, planned_start, planned_finish, actual_start, actual_finish, progress, status, variance) VALUES ('${a.id}', '${a.projectId}', ${a.parentId ? `'${a.parentId}'` : 'NULL'}, '${a.level}', '${a.code}', '${a.name}', '${a.discipline}', ${a.plannedStart ? `'${a.plannedStart}'` : 'NULL'}, ${a.plannedFinish ? `'${a.plannedFinish}'` : 'NULL'}, ${a.actualStart ? `'${a.actualStart}'` : 'NULL'}, ${a.actualFinish ? `'${a.actualFinish}'` : 'NULL'}, ${a.progress || 0}, '${a.status}', ${a.variance || 0});\n`;
}

fs.writeFileSync('worker/seed.sql', sql);
console.log('worker/seed.sql generated');
