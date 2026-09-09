// Template activity packages based on project types: Plant, Pipeline, Roads, Wellhead, Other
export const PROJECT_WBS_TEMPLATES = {
  Plant: [
    { code: 'CIV-01', level: 'L3', name: 'Civil Works & Foundations', discipline: 'Civil', parentCode: null },
    { code: 'CIV-FND-01', level: 'L5', name: 'Equipment Foundation Excavation & Reinforcement', discipline: 'Civil', parentCode: 'CIV-01' },
    { code: 'CIV-CON-02', level: 'L5', name: 'Foundation Concrete Pouring & Curing', discipline: 'Civil', parentCode: 'CIV-01' },
    { code: 'CIV-STR-03', level: 'L6', name: 'Superstructure Grouting & Load Testing', discipline: 'Civil', parentCode: 'CIV-01' },
    { code: 'PIP-01', level: 'L3', name: 'Process & Utility Piping', discipline: 'Piping', parentCode: null },
    { code: 'PIP-FAB-01', level: 'L5', name: 'Spool Pre-fabrication & Fit-up', discipline: 'Piping', parentCode: 'PIP-01' },
    { code: 'PIP-WLD-02', level: 'L5', name: 'Header Tie-in Welding & NDT Radiography', discipline: 'Piping', parentCode: 'PIP-01' },
    { code: 'PIP-HYD-03', level: 'L6', name: 'Hydrostatic Pressure Testing & De-watering', discipline: 'Piping', parentCode: 'PIP-01' },
    { code: 'ELE-01', level: 'L3', name: 'Electrical Substation & Power', discipline: 'Electrical', parentCode: null },
    { code: 'ELE-TR-01', level: 'L5', name: 'Transformer Placement & Busbar Installation', discipline: 'Electrical', parentCode: 'ELE-01' },
    { code: 'ELE-SWG-02', level: 'L5', name: 'HT Switchgear Panel Termination & Testing', discipline: 'Electrical', parentCode: 'ELE-01' },
    { code: 'ELE-CBL-03', level: 'L6', name: 'Armored Power Cable Trenching & Glanding', discipline: 'Electrical', parentCode: 'ELE-01' },
    { code: 'INS-01', level: 'L3', name: 'Instrumentation & Telemetry', discipline: 'Instrumentation', parentCode: null },
    { code: 'INS-JB-01', level: 'L5', name: 'Marshalling Junction Box Termination', discipline: 'Instrumentation', parentCode: 'INS-01' },
    { code: 'INS-DCS-02', level: 'L5', name: 'SCADA DCS Loop Checking & Telemetry Integration', discipline: 'Instrumentation', parentCode: 'INS-01' },
    { code: 'INS-CAL-03', level: 'L6', name: 'Pressure Transmitter Field Calibration', discipline: 'Instrumentation', parentCode: 'INS-01' },
    { code: 'HSE-01', level: 'L3', name: 'Safety & Statutory Compliance', discipline: 'HSE', parentCode: null },
    { code: 'HSE-AUD-01', level: 'L5', name: 'Pre-commissioning Safety & Fire Deluge Audit', discipline: 'HSE', parentCode: 'HSE-01' }
  ],
  Pipeline: [
    { code: 'ROW-01', level: 'L3', name: 'Right of Way Clearing & Grading', discipline: 'Pipeline', parentCode: null },
    { code: 'ROW-CLR-01', level: 'L5', name: 'Route Clearing & Topsoil Stripping', discipline: 'Pipeline', parentCode: 'ROW-01' },
    { code: 'ROW-GRD-02', level: 'L5', name: 'Bench Grading & Leveling', discipline: 'Pipeline', parentCode: 'ROW-01' },
    { code: 'PIP-TR-01', level: 'L3', name: 'Mainline Trenching & Stringing', discipline: 'Pipeline', parentCode: null },
    { code: 'PIP-STR-01', level: 'L5', name: 'Line Pipe Hauling & Stringing', discipline: 'Pipeline', parentCode: 'PIP-TR-01' },
    { code: 'PIP-TRN-02', level: 'L5', name: 'Trench Excavation & Padding', discipline: 'Pipeline', parentCode: 'PIP-TR-01' },
    { code: 'PIP-WLD-03', level: 'L6', name: 'Automatic / Manual Line-up & Mainline Welding', discipline: 'Pipeline', parentCode: 'PIP-TR-01' },
    { code: 'PIP-NDT-04', level: 'L6', name: 'Ultrasonic & Radiographic Weld Inspection', discipline: 'Pipeline', parentCode: 'PIP-TR-01' },
    { code: 'PIP-LWR-05', level: 'L5', name: 'Pipe Lowering & Tie-in Joint Wrapping', discipline: 'Pipeline', parentCode: 'PIP-TR-01' },
    { code: 'PIP-CRS-01', level: 'L3', name: 'River & Highway Crossings (HDD)', discipline: 'Pipeline', parentCode: null },
    { code: 'PL-HDD-01', level: 'L5', name: 'Horizontal Directional Drilling Pilot Bore', discipline: 'Pipeline', parentCode: 'PIP-CRS-01' },
    { code: 'PL-HDD-02', level: 'L6', name: 'Reaming & Pipeline Pullback', discipline: 'Pipeline', parentCode: 'PIP-CRS-01' },
    { code: 'CP-01', level: 'L3', name: 'Cathodic Protection & Monitoring', discipline: 'Pipeline', parentCode: null },
    { code: 'PL-CP-01', level: 'L5', name: 'Deep Well Anode Groundbed Installation', discipline: 'Pipeline', parentCode: 'CP-01' },
    { code: 'PL-CP-02', level: 'L6', name: 'Test Lead Station Wiring & Potential Survey', discipline: 'Pipeline', parentCode: 'CP-01' },
    { code: 'PIP-TST-01', level: 'L3', name: 'Hydrotesting & Pre-commissioning', discipline: 'Pipeline', parentCode: null },
    { code: 'PIP-HYD-01', level: 'L5', name: 'Sectional Hydrostatic Pressure Test', discipline: 'Pipeline', parentCode: 'PIP-TST-01' },
    { code: 'PIP-DRY-02', level: 'L6', name: 'Air Drying & Nitrogen Blanketing', discipline: 'Pipeline', parentCode: 'PIP-TST-01' }
  ],
  Roads: [
    { code: 'EAR-01', level: 'L3', name: 'Earthwork & Subgrade Preparation', discipline: 'Civil', parentCode: null },
    { code: 'EAR-SUB-01', level: 'L5', name: 'Clearing, Grubbing & Topsoil Stripping', discipline: 'Civil', parentCode: 'EAR-01' },
    { code: 'EAR-EMB-02', level: 'L5', name: 'Embankment Fill & Subgrade Compaction', discipline: 'Civil', parentCode: 'EAR-01' },
    { code: 'PAV-01', level: 'L3', name: 'Granular Sub-base & Paving', discipline: 'Civil', parentCode: null },
    { code: 'PAV-GSB-01', level: 'L5', name: 'Granular Sub-Base (GSB) Layer Laying', discipline: 'Civil', parentCode: 'PAV-01' },
    { code: 'PAV-WMM-02', level: 'L5', name: 'Wet Mix Macadam (WMM) Base Construction', discipline: 'Civil', parentCode: 'PAV-01' },
    { code: 'PAV-DBM-03', level: 'L6', name: 'Dense Bituminous Macadam (DBM) Surfacing', discipline: 'Civil', parentCode: 'PAV-01' },
    { code: 'PAV-BC-04', level: 'L6', name: 'Bituminous Concrete (BC) Final Wearing Course', discipline: 'Civil', parentCode: 'PAV-01' },
    { code: 'STR-01', level: 'L3', name: 'Culverts, Bridges & Retaining Walls', discipline: 'Civil', parentCode: null },
    { code: 'STR-BOX-01', level: 'L5', name: 'RCC Box Culvert Foundation & Raft', discipline: 'Civil', parentCode: 'STR-01' },
    { code: 'STR-PIER-02', level: 'L5', name: 'Flyover Pier & Pier Cap Reinforcement', discipline: 'Civil', parentCode: 'STR-01' },
    { code: 'STR-GIRD-03', level: 'L6', name: 'Precast PSC Girder Launching & Deck Slab Pouring', discipline: 'Civil', parentCode: 'STR-01' },
    { code: 'DRN-01', level: 'L3', name: 'Drainage & Roadway Safety Furniture', discipline: 'Civil', parentCode: null },
    { code: 'DRN-MED-01', level: 'L5', name: 'RCC Median Drain & Side Drain Construction', discipline: 'Civil', parentCode: 'DRN-01' },
    { code: 'DRN-SGN-02', level: 'L6', name: 'Crash Barrier Installation & Road Signage', discipline: 'Civil', parentCode: 'DRN-01' }
  ]
};

export async function seedProjectActivities(db, projectId, projectType = 'Plant', startDate = '2026-08-01', targetFinish = '2026-11-30') {
  const tpl = PROJECT_WBS_TEMPLATES[projectType] || PROJECT_WBS_TEMPLATES.Plant;
  const codeToId = {};
  
  for (const item of tpl) {
    codeToId[item.code] = `ACT-${projectId}-${item.code}`.replace(/\s+/g, '-').replace(/\t/g, '');
  }

  for (const item of tpl) {
    const actId = codeToId[item.code];
    const parentId = item.parentCode ? codeToId[item.parentCode] : null;
    const progress = item.level === 'L5' || item.level === 'L6' ? 20 : 35;
    
    await db.prepare(
      `INSERT OR REPLACE INTO activities (id, project_id, parent_id, level, code, name, discipline, planned_start, planned_finish, progress, status, variance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      actId,
      projectId,
      parentId,
      item.level,
      item.code,
      item.name,
      item.discipline,
      startDate || '2026-08-01',
      targetFinish || '2026-11-30',
      progress,
      'in-progress',
      0
    ).run();
  }
}
