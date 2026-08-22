export const MOCK_REVIEW_ITEMS = [
  {
    id: 'REV-001',
    reportId: 'REP-2026-0818-01',
    source: 'Mobile Field App (Voice)',
    reporter: 'T. Gogoi (Site Supervisor)',
    discipline: 'Civil',
    extractedEvent: {
      activity: 'Foundation B2 concrete pouring & testing',
      date: '2026-08-18',
      status: 'Completed',
      blocker: 'None'
    },
    topMatch: {
      id: 'ACT-CIV-B2-003',
      code: 'CIV-B2-003',
      name: 'Foundation B2 Concrete Pouring & Ultrasonic Integrity Testing',
      discipline: 'Civil',
      level: 'L5',
      confidence: 94,
      plannedStart: '2026-08-10',
      plannedFinish: '2026-08-16',
      signals: [
        { label: 'Discipline strictly matches (Civil Works)', match: true },
        { label: 'Asset identifier verified (Foundation B2)', match: true },
        { label: 'Semantic similarity score: 96%', match: true },
        { label: 'Location coordinates match (Pad 14)', match: true }
      ]
    },
    alternatives: [
      { id: 'ACT-CIV-B2-002', code: 'CIV-B2-002', name: 'Rebar Cage Tying B2', discipline: 'Civil', confidence: 68 },
      { id: 'ACT-CIV-B3-003', code: 'CIV-B3-003', name: 'Foundation B3 Mass Concrete', discipline: 'Civil', confidence: 42 }
    ],
    state: 'approved',
    tabCategory: 'high-confidence', // high-confidence, needs-review, ambiguous, unmatched, rejected
    reviewer: 'Rajesh Baruah, AGM (Projects)',
    reviewedAt: '2026-08-18 18:05 IST',
    age: '4d ago'
  },
  {
    id: 'REV-002',
    reportId: 'REP-2026-0821-03',
    source: 'Mobile Field App (Text)',
    reporter: 'S. K. Saikia (Lead Inst)',
    discipline: 'Instrumentation',
    extractedEvent: {
      activity: 'JB-102 Marshalling & Multi-pair Cable Pulling',
      date: '2026-08-21',
      status: 'Delayed (Gland shortage)',
      blocker: 'Shortage of flameproof cable glands'
    },
    topMatch: {
      id: 'ACT-INS-DCS-002',
      code: 'INS-DCS-002',
      name: 'Field Junction Box JB-102 Marshalling & Multi-pair Cable Pulling',
      discipline: 'Instrumentation',
      level: 'L5',
      confidence: 78,
      plannedStart: '2026-08-16',
      plannedFinish: '2026-08-25',
      signals: [
        { label: 'Discipline matches (Instrumentation)', match: true },
        { label: 'Equipment tag JB-102 matched', match: true },
        { label: 'Active schedule item in progress', match: true }
      ]
    },
    alternatives: [
      { id: 'ACT-INS-DCS-001', code: 'INS-DCS-001', name: 'Control Room Marshalling Rack MR-01', discipline: 'Instrumentation', confidence: 45 }
    ],
    state: 'needs-review',
    tabCategory: 'needs-review',
    reviewer: null,
    reviewedAt: null,
    age: '18h ago'
  },
  {
    id: 'REV-003',
    reportId: 'REP-2026-0822-04',
    source: 'Mobile Field App (Voice)',
    reporter: 'A. K. Nath (Civil Foreman)',
    discipline: 'Civil',
    extractedEvent: {
      activity: 'Plinth anchor bolt realignment and grouting',
      date: '2026-08-22',
      status: 'In Progress (40%)',
      blocker: 'Awaiting survey check verification'
    },
    topMatch: {
      id: 'ACT-CIV-B1-002',
      code: 'CIV-B1-002',
      name: 'Foundation B1 Turbo-Expander Anchor Bolt Alignment',
      discipline: 'Civil',
      level: 'L5',
      confidence: 58,
      plannedStart: '2026-08-15',
      plannedFinish: '2026-08-20',
      signals: [
        { label: 'Discipline matches (Civil)', match: true },
        { label: 'Partial tag match (Plinth anchor vs B1 Anchor)', match: false },
        { label: 'Uncertain whether B1 or B3 skid plinth is referenced', match: false }
      ]
    },
    alternatives: [
      { id: 'ACT-CIV-B3-003', code: 'CIV-B3-003', name: 'Foundation B3 Condensate Cooler Plinth', discipline: 'Civil', confidence: 54 },
      { id: 'ACT-CIV-B2-003', code: 'CIV-B2-003', name: 'Foundation B2 Concrete Pouring', discipline: 'Civil', confidence: 35 }
    ],
    state: 'ambiguous',
    tabCategory: 'ambiguous',
    reviewer: null,
    reviewedAt: null,
    age: '4h ago'
  },
  {
    id: 'REV-004',
    reportId: 'REP-2026-0822-05',
    source: 'Mobile Field App (Text)',
    reporter: 'M. Bordoloi (Executive Eng.)',
    discipline: 'Safety / Environmental',
    extractedEvent: {
      activity: 'Stormwater retention sump emergency pumping & silt removal',
      date: '2026-08-22',
      status: 'Completed',
      blocker: 'Unplanned flash flood event'
    },
    topMatch: null,
    alternatives: [],
    state: 'unmatched',
    tabCategory: 'unmatched',
    reviewer: null,
    reviewedAt: null,
    age: '2h ago'
  }
];
