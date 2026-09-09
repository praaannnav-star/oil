// Deterministic rules engine — server-side port of ReportsService.extractEvent,
// classifyDelayCause and matchActivity (js/services/reports.js). Used as the
// offline/degraded fallback behind every LLM endpoint and by /api/classify.

export function extractRules(transcript) {
  const lower = (transcript || '').toLowerCase();

  let discipline = 'Civil';
  if (/pipe|spool|weld|flange/.test(lower)) discipline = 'Piping';
  else if (/cable|junction|sensor|dcs|instrument/.test(lower)) discipline = 'Instrumentation';
  else if (/motor|transformer|switchgear|\bht\b|panel/.test(lower)) discipline = 'Electrical';

  let status = 'In Progress';
  if (/complet|finish|done|poured/.test(lower)) status = 'Completed';
  else if (/delay|halt|shortage|stopped|breakdown/.test(lower)) status = 'Delayed';

  let assetTag = 'General Area';
  // Dynamically extract standard WBS codes like CIV-B2-003, PIP-HDR-014
  const codeMatch = transcript ? transcript.match(/[A-Z]{3,}-[A-Z0-9]+-[0-9]+/i) : null;
  if (codeMatch) {
    assetTag = codeMatch[0].toUpperCase();
  } else if (/foundation b2|\bb2\b/.test(lower)) {
    assetTag = 'Foundation Block B2 (Pad 14)';
  } else if (/foundation b3|\bb3\b/.test(lower)) {
    assetTag = 'Foundation Block B3';
  } else if (/foundation b1|\bb1\b/.test(lower)) {
    assetTag = 'Foundation Block B1';
  } else if (/j-44|suction header|16 inch|16"/.test(lower)) {
    assetTag = '16" Gas Suction Header (Joint J-44)';
  } else if (/jb-?102/.test(lower)) {
    assetTag = 'Junction Box JB-102';
  }

  let blocker = 'None';
  if (/shortage/.test(lower)) blocker = 'Material / parts shortage reported';
  else if (/rain|monsoon/.test(lower)) blocker = 'Weather / rainfall interruption';
  else if (/breakdown/.test(lower)) blocker = 'Equipment breakdown';

  return {
    discipline,
    activity: transcript ? transcript.slice(0, 70) + (transcript.length > 70 ? '...' : '') : 'Site Activity',
    assetTag,
    capturedAt: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) + ' IST',
    status,
    blocker,
    date: new Date().toISOString().split('T')[0]
  };
}

const DELAY_RULES = [
  { code: 'WEATHER', label: 'Weather / Rainfall Interruption', keys: ['rain', 'monsoon', 'weather', 'storm', 'flood'] },
  { code: 'MATERIAL_SHORTAGE', label: 'Material / Parts Shortage', keys: ['shortage', 'material', 'stock', 'supply', 'gland', 'cement'] },
  { code: 'EQUIPMENT_BREAKDOWN', label: 'Equipment Breakdown', keys: ['breakdown', 'machine', 'crane', 'rig', 'compressor failure', 'equipment'] },
  { code: 'LABOUR_SHORTAGE', label: 'Manpower / Labour Shortage', keys: ['labour', 'labor', 'manpower', 'workers', 'crew absent'] },
  { code: 'PERMIT_CLEARANCE', label: 'Permit / Clearance Pending', keys: ['permit', 'clearance', 'approval pending', 'statutory'] },
  { code: 'TECHNICAL', label: 'Technical / Quality Issue', keys: ['rework', 'cube test', 'fail', 'defect', 'rectification'] }
];

export function delayCauseRules(text) {
  const lower = (text || '').toLowerCase();
  for (const rule of DELAY_RULES) {
    if (rule.keys.some(k => lower.includes(k))) return { code: rule.code, label: rule.label };
  }
  if (/delay|halt|stopped/.test(lower)) return { code: 'OTHER', label: 'Other Site Constraint' };
  return { code: 'NONE', label: 'No Blocker Detected' };
}

// Activity matcher over L5/L6 leaf activities. activities: raw D1 rows already
// mapped to client shape ({id, level, code, name, discipline, plannedStart...}).
export function matchActivity(extractedEvent, activities) {
  const pool = (activities || []).filter(a => a.level === 'L5' || a.level === 'L6');
  const lowerAct = (extractedEvent.activity || '').toLowerCase();
  const lowerTag = (extractedEvent.assetTag || '').toLowerCase();
  const today = new Date().toISOString().split('T')[0];

  const scored = pool
    .map(act => {
      let score = 30;
      const signals = [];
      const actCode = (act.code || '').toLowerCase();
      const actName = (act.name || '').toLowerCase();

      if ((act.discipline || '').toLowerCase() === (extractedEvent.discipline || '').toLowerCase()) {
        score += 25;
        signals.push({ label: `Discipline matches (${act.discipline})`, match: true });
      } else {
        signals.push({ label: `Discipline mismatch (${act.discipline} vs ${extractedEvent.discipline})`, match: false });
      }

      // Dynamic WBS Exact Match
      if (actCode && (lowerTag.includes(actCode) || lowerAct.includes(actCode))) {
        score += 55;
        signals.push({ label: `Direct WBS Code match (${act.code})`, match: true });
      } else if (lowerTag.includes('b2') && (actCode.includes('b2') || actName.includes('b2'))) {
        score += 35;
        signals.push({ label: 'Asset identifier verified (Foundation B2)', match: true });
      } else if (lowerTag.includes('jb-102') && (actCode.includes('102') || actName.includes('jb-102'))) {
        score += 35;
        signals.push({ label: 'Equipment tag JB-102 matched', match: true });
      } else if (lowerTag.includes('16') && (actName.includes('16"') || actCode.includes('hdr'))) {
        score += 35;
        signals.push({ label: '16" Gas Suction Header asset verified', match: true });
      }

      if (lowerAct.includes('pour') && actName.includes('pour')) {
        score += 10;
        signals.push({ label: 'Terminology semantic alignment ("pour", "concrete")', match: true });
      }

      const hasWindow = !!(act.plannedStart && act.plannedFinish);
      if (hasWindow && today >= act.plannedStart && today <= act.plannedFinish) {
        score += 10;
        signals.push({ label: `Schedule window active (${act.plannedStart} → ${act.plannedFinish})`, match: true });
      } else {
        signals.push({
          label: hasWindow
            ? `Outside planned window (${act.plannedStart} → ${act.plannedFinish})`
            : 'No planned schedule window defined for this activity',
          match: false
        });
      }

      return { ...act, confidence: Math.min(98, Math.max(25, score)), signals };
    })
    .sort((a, b) => b.confidence - a.confidence);

  const recommended = scored[0] || null;
  return {
    recommended,
    confidence: recommended ? recommended.confidence : 0,
    signals: recommended ? recommended.signals : [],
    alternatives: scored.slice(1, 4)
  };
}
