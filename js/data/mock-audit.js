export const MOCK_AUDIT_LOG = [
  {
    id: 'AUD-001',
    activityId: 'ACT-CIV-B2-003',
    timestamp: '2026-08-18 17:30 IST',
    actor: 'T. Gogoi',
    role: 'Site Supervisor (Civil)',
    action: 'Field Report Submitted',
    detail: 'Voice report submitted via Mobile PWA: "Foundation B2 concreting completed today... 240 m3 M40 poured". Two evidence photos attached.'
  },
  {
    id: 'AUD-002',
    activityId: 'ACT-CIV-B2-003',
    timestamp: '2026-08-18 17:31 IST',
    actor: 'System (NLP Extraction)',
    role: 'Automated Extraction Engine',
    action: 'Event Entities Extracted',
    detail: 'Discipline: Civil | Activity: Foundation B2 concrete pouring | Volume: 240 m³ | Status: Completed | Blockers: None.'
  },
  {
    id: 'AUD-003',
    activityId: 'ACT-CIV-B2-003',
    timestamp: '2026-08-18 17:31 IST',
    actor: 'System (Schedule Linking Layer)',
    role: 'L5/L6 Match Classifier',
    action: 'Matched to L5 Activity CIV-B2-003',
    detail: 'Confidence: 94%. Matched signals: discipline (Civil), asset tag (B2), semantic similarity (96%), active schedule window.'
  },
  {
    id: 'AUD-004',
    activityId: 'ACT-CIV-B2-003',
    timestamp: '2026-08-18 18:05 IST',
    actor: 'Rajesh Baruah',
    role: 'AGM (Projects) / Lead Planner',
    action: 'Human Review & Approval',
    detail: 'Match approved. Schedule actual finish date confirmed as 2026-08-18. Deviation (+2 days variance) approved with corrective accelerated curing.'
  },
  {
    id: 'AUD-005',
    activityId: 'ACT-CIV-B2-003',
    timestamp: '2026-08-18 18:06 IST',
    actor: 'Schedule Bridge Service',
    role: 'Core Integration Worker',
    action: 'L5 Schedule Baseline Actuals Reconciled',
    detail: 'Activity CIV-B2-003 updated to Status: COMPLETED (100%). Downstream dependent activity CIV-B2-004 activated.'
  },
  {
    id: 'AUD-006',
    activityId: 'ACT-PIP-HDR-014',
    timestamp: '2026-08-22 15:10 IST',
    actor: 'Rajesh Baruah',
    role: 'AGM (Projects)',
    action: 'Piping Fit-up Progress Approved',
    detail: 'Joint J-44 fit-up actual progress updated to 70%. Radiographic examination shift scheduled.'
  }
];
