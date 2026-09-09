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
    actualProgress: 64.0,
    variance: -4.5,
    spi: 0.93,
    health: 'at-risk',
    delayedActivitiesCount: 2,
    pendingReviewCount: 3,
    evidenceCoverage: 94
  },
  {
    id: 'PRJ-OIL-NUM-002',
    name: 'Numaligarh to Siliguri Pipeline Augmentation Phase-2',
    code: 'OIL-NSPL-AUG',
    location: 'Numaligarh, Golaghat District, Assam',
    projectType: 'Pipeline',
    category: 'Linear',
    riskTier: 'B',
    priority: 'P2',
    region: 'Assam Central',
    plannedProgress: 52.0,
    actualProgress: 54.5,
    variance: +2.5,
    spi: 1.05,
    health: 'on-track',
    delayedActivitiesCount: 0,
    pendingReviewCount: 2,
    evidenceCoverage: 98
  },
  {
    id: 'PRJ-OIL-MOR-003',
    name: 'Moran Field Production Infrastructure Modernization',
    code: 'OIL-MOR-MOD',
    location: 'Moran, Charaideo District, Assam',
    projectType: 'Wellhead',
    category: 'Upstream',
    riskTier: 'B',
    priority: 'P2',
    region: 'Upper Assam',
    plannedProgress: 41.0,
    actualProgress: 39.5,
    variance: -1.5,
    spi: 0.96,
    health: 'on-track',
    delayedActivitiesCount: 1,
    pendingReviewCount: 1,
    evidenceCoverage: 89
  }
];

const BASELINE_ACTIVITIES = [
  // Civil & Structural
  {
    id: 'ACT-2026-001', projectId: 'PRJ-OIL-2026-01', parentId: null,
    level: 'L3', code: 'CIV-01', name: 'Civil Foundations & Earthwork', discipline: 'Civil',
    plannedStart: '2026-08-01', plannedFinish: '2026-10-15', progress: 75, status: 'in-progress', variance: 0
  },
  {
    id: 'ACT-2026-002', projectId: 'PRJ-OIL-2026-01', parentId: 'ACT-2026-001',
    level: 'L5', code: 'FND-B1', name: 'Foundation Block B1 (Compressor)', discipline: 'Civil',
    plannedStart: '2026-08-10', plannedFinish: '2026-08-25', progress: 100, status: 'completed', variance: 0
  },
  {
    id: 'ACT-2026-003', projectId: 'PRJ-OIL-2026-01', parentId: 'ACT-2026-001',
    level: 'L5', code: 'FND-B2', name: 'Foundation Block B2 (Pad 14)', discipline: 'Civil',
    plannedStart: '2026-09-01', plannedFinish: '2026-09-15', progress: 85, status: 'in-progress', variance: 0
  },
  {
    id: 'ACT-2026-004', projectId: 'PRJ-OIL-2026-01', parentId: 'ACT-2026-001',
    level: 'L5', code: 'FND-B3', name: 'Foundation Block B3 (Flare Knockout Drum)', discipline: 'Civil',
    plannedStart: '2026-09-16', plannedFinish: '2026-09-30', progress: 0, status: 'not-started', variance: 0
  },

  // Process Piping
  {
    id: 'ACT-2026-005', projectId: 'PRJ-OIL-2026-01', parentId: null,
    level: 'L3', code: 'PIP-01', name: 'Main Header Piping Integration', discipline: 'Piping',
    plannedStart: '2026-08-20', plannedFinish: '2026-11-01', progress: 60, status: 'in-progress', variance: 0
  },
  {
    id: 'ACT-2026-006', projectId: 'PRJ-OIL-2026-01', parentId: 'ACT-2026-005',
    level: 'L6', code: 'PIP-HDR-16', name: '16" Gas Suction Header (Joint J-44)', discipline: 'Piping',
    plannedStart: '2026-09-05', plannedFinish: '2026-09-20', progress: 100, status: 'completed', variance: 0
  },
  {
    id: 'ACT-2026-007', projectId: 'PRJ-OIL-2026-01', parentId: 'ACT-2026-005',
    level: 'L5', code: 'PIP-MNF-02', name: 'Secondary Manifold Tie-in Spool', discipline: 'Piping',
    plannedStart: '2026-09-10', plannedFinish: '2026-10-05', progress: 45, status: 'in-progress', variance: 0
  },
  {
    id: 'ACT-2026-008', projectId: 'PRJ-OIL-2026-01', parentId: 'ACT-2026-005',
    level: 'L6', code: 'PIP-HYD-04', name: 'Hydrostatic Testing Section 4 (Compressor Bay)', discipline: 'Piping',
    plannedStart: '2026-09-22', plannedFinish: '2026-10-10', progress: 0, status: 'not-started', variance: 0
  },

  // Electrical Works
  {
    id: 'ACT-2026-009', projectId: 'PRJ-OIL-2026-01', parentId: null,
    level: 'L3', code: 'ELE-01', name: 'Electrical Substation & Switchgear', discipline: 'Electrical',
    plannedStart: '2026-09-01', plannedFinish: '2026-12-15', progress: 50, status: 'in-progress', variance: 0
  },
  {
    id: 'ACT-2026-010', projectId: 'PRJ-OIL-2026-01', parentId: 'ACT-2026-009',
    level: 'L5', code: 'ELE-SWG-01', name: '11kV HT Switchgear Panel Termination', discipline: 'Electrical',
    plannedStart: '2026-09-02', plannedFinish: '2026-09-12', progress: 100, status: 'completed', variance: 0
  },
  {
    id: 'ACT-2026-011', projectId: 'PRJ-OIL-2026-01', parentId: 'ACT-2026-009',
    level: 'L5', code: 'ELE-TR-01', name: 'Main Electrical Cable Trench Excavation', discipline: 'Electrical',
    plannedStart: '2026-09-08', plannedFinish: '2026-09-20', progress: 40, status: 'in-progress', variance: 0
  },
  {
    id: 'ACT-2026-012', projectId: 'PRJ-OIL-2026-01', parentId: 'ACT-2026-009',
    level: 'L5', code: 'ELE-TRF-02', name: 'Step-down Transformer Auxiliary Bushing Erection', discipline: 'Electrical',
    plannedStart: '2026-09-25', plannedFinish: '2026-10-15', progress: 0, status: 'not-started', variance: 0
  },

  // Instrumentation & Control
  {
    id: 'ACT-2026-013', projectId: 'PRJ-OIL-2026-01', parentId: null,
    level: 'L3', code: 'INS-01', name: 'Instrumentation & DCS System', discipline: 'Instrumentation',
    plannedStart: '2026-09-05', plannedFinish: '2026-11-20', progress: 35, status: 'in-progress', variance: -5
  },
  {
    id: 'ACT-2026-014', projectId: 'PRJ-OIL-2026-01', parentId: 'ACT-2026-013',
    level: 'L6', code: 'ELE-JB-102', name: 'Junction Box JB-102 Installation & Cable Glanding', discipline: 'Instrumentation',
    plannedStart: '2026-09-05', plannedFinish: '2026-09-10', progress: 100, status: 'completed', variance: 0
  },
  {
    id: 'ACT-2026-015', projectId: 'PRJ-OIL-2026-01', parentId: 'ACT-2026-013',
    level: 'L5', code: 'INS-DCS-IO', name: 'Remote I/O Rack Telemetry Integration', discipline: 'Instrumentation',
    plannedStart: '2026-09-12', plannedFinish: '2026-09-28', progress: 25, status: 'in-progress', variance: 0
  },
  {
    id: 'ACT-2026-016', projectId: 'PRJ-OIL-2026-01', parentId: 'ACT-2026-013',
    level: 'L6', code: 'INS-CAL-03', name: 'Pressure Transmitter Loop Calibration (PT-402/403)', discipline: 'Instrumentation',
    plannedStart: '2026-10-01', plannedFinish: '2026-10-18', progress: 0, status: 'not-started', variance: 0
  },

  // Pipeline Construction
  {
    id: 'ACT-2026-017', projectId: 'PRJ-OIL-NUM-002', parentId: null,
    level: 'L3', code: 'PL-01', name: 'Corridor Right-of-Way Construction', discipline: 'Pipeline',
    plannedStart: '2026-08-15', plannedFinish: '2026-12-30', progress: 65, status: 'in-progress', variance: +3
  },
  {
    id: 'ACT-2026-018', projectId: 'PRJ-OIL-NUM-002', parentId: 'ACT-2026-017',
    level: 'L5', code: 'PL-ROW-SEC1', name: 'Right-of-Way Clearing & Grading (Chainage 12-18)', discipline: 'Pipeline',
    plannedStart: '2026-08-15', plannedFinish: '2026-09-05', progress: 100, status: 'completed', variance: 0
  },
  {
    id: 'ACT-2026-019', projectId: 'PRJ-OIL-NUM-002', parentId: 'ACT-2026-017',
    level: 'L5', code: 'PL-HDD-01', name: 'Dhansiri River Crossing HDD Trenchless Bore', discipline: 'Pipeline',
    plannedStart: '2026-09-01', plannedFinish: '2026-09-30', progress: 55, status: 'in-progress', variance: 0
  },
  {
    id: 'ACT-2026-020', projectId: 'PRJ-OIL-NUM-002', parentId: 'ACT-2026-017',
    level: 'L5', code: 'PL-CP-STN', name: 'Cathodic Protection Deep Well Anode Groundbed', discipline: 'Pipeline',
    plannedStart: '2026-10-05', plannedFinish: '2026-10-25', progress: 0, status: 'not-started', variance: 0
  },

  // HSE & Compliance
  {
    id: 'ACT-2026-021', projectId: 'PRJ-OIL-2026-01', parentId: null,
    level: 'L3', code: 'HSE-01', name: 'HSE & Statutory Compliance Assurance', discipline: 'HSE',
    plannedStart: '2026-08-01', plannedFinish: '2026-12-31', progress: 95, status: 'in-progress', variance: 0
  },
  {
    id: 'ACT-2026-022', projectId: 'PRJ-OIL-2026-01', parentId: 'ACT-2026-021',
    level: 'L5', code: 'HSE-PER-01', name: 'Perimeter Safety Fencing & Muster Point Setup', discipline: 'HSE',
    plannedStart: '2026-08-01', plannedFinish: '2026-08-15', progress: 100, status: 'completed', variance: 0
  },
  {
    id: 'ACT-2026-023', projectId: 'PRJ-OIL-2026-01', parentId: 'ACT-2026-021',
    level: 'L5', code: 'HSE-DEL-02', name: 'Deluge Foam Water Spray System Pre-commissioning', discipline: 'HSE',
    plannedStart: '2026-09-01', plannedFinish: '2026-09-25', progress: 85, status: 'in-progress', variance: 0
  },
  {
    id: 'ACT-2026-024', projectId: 'PRJ-OIL-2026-01', parentId: 'ACT-2026-021',
    level: 'L5', code: 'HSE-AUD-Q3', name: 'Quarterly OISD-179 Statutory Safety Audit', discipline: 'HSE',
    plannedStart: '2026-10-10', plannedFinish: '2026-10-20', progress: 0, status: 'not-started', variance: 0
  }
];

const BASELINE_REVIEWS = [
  {
    id: 'REV-2026-001',
    report_id: 'REP-2026-001',
    type: 'report',
    source: 'Civil Team Daily Log',
    reporter: 'Ranjan Saikia (Site Eng)',
    discipline: 'Civil',
    state: 'approved',
    tab_category: 'high-confidence',
    reviewer: 'Devraj Borah — Lead Planner',
    reviewed_at: '2026-09-08 14:30:00',
    created_at: '2026-09-08 10:15:00',
    top_match_json: JSON.stringify({ id: 'ACT-2026-002', name: 'Foundation Block B1 (Compressor)', code: 'FND-B1', confidence: 96, discipline: 'Civil' }),
    extracted_json: JSON.stringify({ activity: 'Finished compressor block B1 pouring and 14-day curing certificate verified', progress: 100, status: 'Completed', discipline: 'Civil' })
  },
  {
    id: 'REV-2026-002',
    report_id: 'REP-2026-002',
    type: 'report',
    source: 'Piping Inspection Log',
    reporter: 'Dipankar Neog (Welding Inspector)',
    discipline: 'Piping',
    state: 'approved',
    tab_category: 'high-confidence',
    reviewer: 'Devraj Borah — Lead Planner',
    reviewed_at: '2026-09-07 16:45:00',
    created_at: '2026-09-07 11:20:00',
    top_match_json: JSON.stringify({ id: 'ACT-2026-006', name: '16" Gas Suction Header (Joint J-44)', code: 'PIP-HDR-16', confidence: 94, discipline: 'Piping' }),
    extracted_json: JSON.stringify({ activity: 'Radiography test RT passed with zero weld defects on suction header joint J-44', progress: 100, status: 'Completed', discipline: 'Piping' })
  },
  {
    id: 'REV-2026-003',
    report_id: 'REP-2026-003',
    type: 'report',
    source: 'Electrical Shift Report',
    reporter: 'Bikash Gogoi (Electrical Foreman)',
    discipline: 'Electrical',
    state: 'approved',
    tab_category: 'high-confidence',
    reviewer: 'Devraj Borah — Lead Planner',
    reviewed_at: '2026-09-06 18:10:00',
    created_at: '2026-09-06 14:00:00',
    top_match_json: JSON.stringify({ id: 'ACT-2026-010', name: '11kV HT Switchgear Panel Termination', code: 'ELE-SWG-01', confidence: 92, discipline: 'Electrical' }),
    extracted_json: JSON.stringify({ activity: 'HT switchgear panel busbar torquing and insulation megger test verified at 100M-ohm', progress: 100, status: 'Completed', discipline: 'Electrical' })
  },
  {
    id: 'REV-2026-004',
    report_id: 'REP-2026-004',
    type: 'report',
    source: 'Instrumentation Daily Sheet',
    reporter: 'Pranjal Hazarika (Instrumentation Tech)',
    discipline: 'Instrumentation',
    state: 'approved',
    tab_category: 'needs-review',
    reviewer: 'Manoj Baruah — QAQC Reviewer',
    reviewed_at: '2026-09-05 17:30:00',
    created_at: '2026-09-05 12:45:00',
    top_match_json: JSON.stringify({ id: 'ACT-2026-014', name: 'Junction Box JB-102 Installation', code: 'ELE-JB-102', confidence: 88, discipline: 'Instrumentation' }),
    extracted_json: JSON.stringify({ activity: 'JB-102 flameproof glanding and armored cable termination completed', progress: 100, status: 'Completed', discipline: 'Instrumentation' })
  },
  {
    id: 'REV-2026-005',
    report_id: 'REP-2026-005',
    type: 'report',
    source: 'Pipeline Survey Team',
    reporter: 'Kishore Das (Surveyor)',
    discipline: 'Pipeline',
    state: 'approved',
    tab_category: 'high-confidence',
    reviewer: 'Devraj Borah — Lead Planner',
    reviewed_at: '2026-09-04 15:20:00',
    created_at: '2026-09-04 10:00:00',
    top_match_json: JSON.stringify({ id: 'ACT-2026-018', name: 'Right-of-Way Clearing & Grading (Chainage 12-18)', code: 'PL-ROW-SEC1', confidence: 95, discipline: 'Pipeline' }),
    extracted_json: JSON.stringify({ activity: 'Completed RoW strip clearing across chainage 12 to 18 km with no landowner disputes', progress: 100, status: 'Completed', discipline: 'Pipeline' })
  },
  {
    id: 'REV-2026-006',
    report_id: 'REP-2026-006',
    type: 'survey',
    source: 'HSE Officer Weekly Walkthrough',
    reporter: 'Naba Kumar Deka (Safety Officer)',
    discipline: 'HSE',
    state: 'approved',
    tab_category: 'high-confidence',
    reviewer: 'Devraj Borah — Lead Planner',
    reviewed_at: '2026-09-03 16:00:00',
    created_at: '2026-09-03 11:30:00',
    top_match_json: JSON.stringify({ id: 'ACT-2026-022', name: 'Perimeter Safety Fencing & Muster Point Setup', code: 'HSE-PER-01', confidence: 98, discipline: 'HSE' }),
    extracted_json: JSON.stringify({ activity: 'All boundary razor wire fencing and designated emergency muster points signposted', progress: 100, status: 'Completed', discipline: 'HSE' })
  },
  {
    id: 'REV-2026-007',
    report_id: 'REP-2026-007',
    type: 'report',
    source: 'Civil Daily Log',
    reporter: 'Ranjan Saikia (Site Eng)',
    discipline: 'Civil',
    state: 'needs-review',
    tab_category: 'needs-review',
    reviewer: null,
    reviewed_at: null,
    created_at: '2026-09-09 07:30:00',
    top_match_json: JSON.stringify({ id: 'ACT-2026-003', name: 'Foundation Block B2 (Pad 14)', code: 'FND-B2', confidence: 87, discipline: 'Civil' }),
    extracted_json: JSON.stringify({ activity: 'Shuttering removal and surface finishing for compressor foundation B2 at Pad 14. Progress reaching 85%', progress: 85, status: 'In Progress', discipline: 'Civil' })
  },
  {
    id: 'REV-2026-008',
    report_id: 'REP-2026-008',
    type: 'report',
    source: 'Piping Field Team',
    reporter: 'Dipankar Neog (Welding Inspector)',
    discipline: 'Piping',
    state: 'needs-review',
    tab_category: 'needs-review',
    reviewer: null,
    reviewed_at: null,
    created_at: '2026-09-09 07:45:00',
    top_match_json: JSON.stringify({ id: 'ACT-2026-007', name: 'Secondary Manifold Tie-in Spool', code: 'PIP-MNF-02', confidence: 82, discipline: 'Piping' }),
    extracted_json: JSON.stringify({ activity: 'Pre-fabrication fit-up of 8-inch secondary manifold branch spool ready for NDT', progress: 45, status: 'In Progress', discipline: 'Piping' })
  },
  {
    id: 'REV-2026-009',
    report_id: 'REP-2026-009',
    type: 'report',
    source: 'Electrical Crew Observation',
    reporter: 'Bikash Gogoi (Electrical Foreman)',
    discipline: 'Electrical',
    state: 'needs-review',
    tab_category: 'needs-review',
    reviewer: null,
    reviewed_at: null,
    created_at: '2026-09-09 08:00:00',
    top_match_json: JSON.stringify({ id: 'ACT-2026-011', name: 'Main Electrical Cable Trench Excavation', code: 'ELE-TR-01', confidence: 84, discipline: 'Electrical' }),
    extracted_json: JSON.stringify({ activity: 'Excavated 120m of electrical cable trench adjacent to control room. Progress advanced to 40%', progress: 40, status: 'In Progress', discipline: 'Electrical' })
  },
  {
    id: 'REV-2026-010',
    report_id: 'REP-2026-010',
    type: 'report',
    source: 'Material Receiving Log',
    reporter: 'Store Supervisor',
    discipline: 'Instrumentation',
    state: 'rejected',
    tab_category: 'rejected',
    reviewer: 'Manoj Baruah — QAQC Reviewer',
    reviewed_at: '2026-09-02 11:15:00',
    created_at: '2026-09-02 09:30:00',
    top_match_json: JSON.stringify({ id: 'ACT-2026-014', name: 'Junction Box JB-102 Installation', code: 'ELE-JB-102', confidence: 61, discipline: 'Instrumentation' }),
    extracted_json: JSON.stringify({ activity: 'Received partial shipment of non-certified glands. Returned to vendor.', progress: 0, status: 'Delayed', discipline: 'Instrumentation' })
  }
];

let sql = '-- Autorun generated database seed for OIL Project Analytics & Progress Tracking\n\n';

for (const p of BASELINE_PROJECTS) {
  sql += `INSERT OR REPLACE INTO projects (id, code, name, location, project_type, category, risk_tier, priority, region, health, spi, planned_progress, actual_progress, variance, delayed_activities_count, pending_review_count, evidence_coverage) VALUES ('${p.id}', '${p.code}', '${p.name.replace(/'/g, "''")}', '${p.location.replace(/'/g, "''")}', '${p.projectType}', '${p.category}', '${p.riskTier}', '${p.priority}', '${p.region}', '${p.health}', ${p.spi}, ${p.plannedProgress}, ${p.actualProgress}, ${p.variance}, ${p.delayedActivitiesCount}, ${p.pendingReviewCount}, ${p.evidenceCoverage});\n`;
}

sql += '\n';

for (const a of BASELINE_ACTIVITIES) {
  sql += `INSERT OR REPLACE INTO activities (id, project_id, parent_id, level, code, name, discipline, planned_start, planned_finish, actual_start, actual_finish, progress, status, variance) VALUES ('${a.id}', '${a.projectId}', ${a.parentId ? `'${a.parentId}'` : 'NULL'}, '${a.level}', '${a.code}', '${a.name.replace(/'/g, "''")}', '${a.discipline}', ${a.plannedStart ? `'${a.plannedStart}'` : 'NULL'}, ${a.plannedFinish ? `'${a.plannedFinish}'` : 'NULL'}, ${a.actualStart ? `'${a.actualStart}'` : 'NULL'}, ${a.actualFinish ? `'${a.actualFinish}'` : 'NULL'}, ${a.progress || 0}, '${a.status}', ${a.variance || 0});\n`;
}

sql += '\n';

for (const r of BASELINE_REVIEWS) {
  const topMatch = r.top_match_json.replace(/'/g, "''");
  const extracted = r.extracted_json.replace(/'/g, "''");
  const revAt = r.reviewed_at ? `'${r.reviewed_at}'` : 'NULL';
  const rev = r.reviewer ? `'${r.reviewer.replace(/'/g, "''")}'` : 'NULL';

  sql += `INSERT OR REPLACE INTO reviews (id, report_id, type, source, reporter, discipline, state, tab_category, reviewer, reviewed_at, created_at, top_match_json, extracted_json) VALUES ('${r.id}', '${r.report_id}', '${r.type}', '${r.source.replace(/'/g, "''")}', '${r.reporter.replace(/'/g, "''")}', '${r.discipline}', '${r.state}', '${r.tab_category}', ${rev}, ${revAt}, '${r.created_at}', '${topMatch}', '${extracted}');\n`;

  sql += `INSERT OR REPLACE INTO field_reports (id, project_id, author, raw_transcript, extracted_json, status, created_at) VALUES ('${r.report_id}', 'PRJ-OIL-2026-01', '${r.reporter.replace(/'/g, "''")}', '${r.source.replace(/'/g, "''")}', '${extracted}', '${r.state === 'approved' ? 'approved' : 'pending-review'}', '${r.created_at}');\n`;
}

fs.writeFileSync('worker/seed.sql', sql);
console.log(`✅ worker/seed.sql generated with ${BASELINE_PROJECTS.length} projects, ${BASELINE_ACTIVITIES.length} activities, and ${BASELINE_REVIEWS.length} reviews.`);

