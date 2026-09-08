import { execSync } from 'child_process';
import crypto from 'crypto';

function calculateUrgency(extracted) {
  const blocker = (extracted?.blocker || '').toLowerCase();
  const extStatus = (extracted?.status || '').toLowerCase();
  const hasSevereBlocker = blocker.includes('halt') || blocker.includes('stop') || blocker.includes('hazard') || blocker.includes('breakdown') || blocker.includes('critical') || blocker.includes('failure');
  const hasModerateBlocker = blocker.includes('shortage') || blocker.includes('delay') || blocker.includes('weather') || blocker.includes('rain') || blocker.includes('permit') || extStatus.includes('delay');

  if (hasSevereBlocker) {
    return { priority: 'P1', score: 95, label: 'P1 Critical', reason: extracted.blocker };
  }
  if (hasModerateBlocker) {
    return { priority: 'P2', score: 75, label: 'P2 High', reason: extracted.blocker || 'Activity Delayed' };
  }
  if (extStatus.includes('progress') || extStatus.includes('started')) {
    return { priority: 'P3', score: 45, label: 'P3 Medium', reason: 'Routine Progress' };
  }
  return { priority: 'P4', score: 20, label: 'P4 Info', reason: 'On Track / Completed' };
}

function resolveReviewerRole(discipline) {
  const d = (discipline || '').toLowerCase();
  if (d.includes('elect') || d.includes('mech')) return 'Project Manager';
  if (d.includes('inst') || d.includes('inspect') || d.includes('survey')) return 'QAQC Reviewer';
  return 'Lead Planner';
}

console.log('Fetching orphaned reports...');
const output = execSync('npx wrangler d1 execute oil-field-db --remote --json --command "SELECT * FROM field_reports WHERE id NOT IN (SELECT report_id FROM reviews WHERE type=\'report\')"');
const data = JSON.parse(output.toString());

const reports = data[0].results;
if (!reports || reports.length === 0) {
  console.log('No orphaned reports found.');
  process.exit(0);
}

console.log(`Found ${reports.length} orphaned reports. Generating SQL backfill...`);

let sql = '';
for (const row of reports) {
  let extracted = {};
  try {
    extracted = JSON.parse(row.extracted_json || '{}');
  } catch(e) {}

  let matched = null;
  if (row.matched_activity_id) {
     matched = {
       id: row.matched_activity_id,
       name: row.matched_activity_name,
       code: row.matched_activity_code
     };
  }
  
  const confidence = row.confidence || 90;
  const reviewCreated = `REV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const urgency = calculateUrgency(extracted);
  const suggestedRole = resolveReviewerRole(extracted.discipline);
  
  const enrichedExtracted = {
    ...extracted,
    urgency,
    suggestedReviewerRole: suggestedRole
  };

  const topMatchJson = matched ? { ...matched, confidence, signals: JSON.parse(row.signals_json || '[]') } : null;

  sql += `INSERT INTO reviews (id, report_id, type, source, reporter, discipline, extracted_json, top_match_json, alternatives_json, state, tab_category, age) VALUES ('${reviewCreated}', '${row.id}', 'report', 'Mobile Field App', '${row.author.replace(/'/g, "''")}', '${(extracted.discipline || 'Civil').replace(/'/g, "''")}', '${JSON.stringify(enrichedExtracted).replace(/'/g, "''")}', '${topMatchJson ? JSON.stringify(topMatchJson).replace(/'/g, "''") : 'null'}', '${row.alternatives_json ? row.alternatives_json.replace(/'/g, "''") : '[]'}', 'needs-review', '${confidence >= 80 ? 'high-confidence' : 'needs-review'}', 'Just now');\n`;
}

console.log('Executing backfill SQL...');
import { writeFileSync } from 'fs';
writeFileSync('backfill.sql', sql);
execSync('npx wrangler d1 execute oil-field-db --remote --file=backfill.sql', { stdio: 'inherit' });

console.log('Backfill complete!');
