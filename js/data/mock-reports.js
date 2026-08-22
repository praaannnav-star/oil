export const MOCK_REPORTS = [
  {
    id: 'REP-2026-0818-01',
    projectId: 'PRJ-OIL-2026-01',
    author: 'T. Gogoi (Site Supervisor, Civil)',
    timestamp: '2026-08-18 17:30 IST',
    rawTranscript: 'Foundation B2 concreting completed today. Started batching at 8:30 in the morning and finished the final pour by 5:15 PM with 240 cubic meters of M40 grade concrete. Slump test and 6 cube test specimens taken. No aggregate blockage encountered.',
    extractedEvent: {
      discipline: 'Civil',
      activity: 'Foundation B2 concrete pouring & testing',
      assetTag: 'Foundation Block B2 (Pad 14)',
      volume: '240 m³ M40',
      startTime: '08:30 IST',
      endTime: '17:15 IST',
      status: 'Completed',
      blocker: 'None (resolved previous pump breakdown)',
      date: '2026-08-18'
    },
    matchedActivityId: 'ACT-CIV-B2-003',
    matchedActivityName: 'Foundation B2 Concrete Pouring & Ultrasonic Integrity Testing',
    matchedActivityCode: 'CIV-B2-003',
    confidence: 94,
    signals: [
      { label: 'Discipline strictly matches (Civil Works)', match: true },
      { label: 'Foundation identifier matches WBS asset (Foundation B2)', match: true },
      { label: 'Terminology semantic alignment ("concreting", "pour", "M40"): 96%', match: true },
      { label: 'Site location coordinates match Compressor Area Pad 14', match: true },
      { label: 'Schedule window is open and waiting for actual finish', match: true }
    ],
    status: 'approved',
    reviewer: 'Rajesh Baruah, AGM (Projects)',
    reviewedAt: '2026-08-18 18:05 IST',
    evidenceIds: ['EVD-001', 'EVD-002']
  },
  {
    id: 'REP-2026-0822-02',
    projectId: 'PRJ-OIL-2026-01',
    author: 'R. K. Hazarika (Welding Inspector)',
    timestamp: '2026-08-22 14:40 IST',
    rawTranscript: 'Completed root and hot pass welding on 16 inch suction header spool joint J-44. Preheating maintained at 150 degrees C. Visual inspection passed, radiographic testing crew scheduled for night shift.',
    extractedEvent: {
      discipline: 'Piping',
      activity: '16" Gas Suction Header Spool Erection & Butt-Weld Tie-in',
      assetTag: 'Spool Joint J-44 (16" Header)',
      startTime: '09:00 IST',
      endTime: '14:30 IST',
      status: 'In Progress (70% complete)',
      blocker: 'None',
      date: '2026-08-22'
    },
    matchedActivityId: 'ACT-PIP-HDR-014',
    matchedActivityName: '16" Gas Suction Header Spool Erection & Butt-Weld Tie-in',
    matchedActivityCode: 'PIP-HDR-014',
    confidence: 91,
    signals: [
      { label: 'Discipline matches (Piping & Mechanical)', match: true },
      { label: 'Line size and tag match (16" Suction Header)', match: true },
      { label: 'Welding step corresponds to schedule WBS item', match: true }
    ],
    status: 'approved',
    reviewer: 'Rajesh Baruah, AGM (Projects)',
    reviewedAt: '2026-08-22 15:10 IST',
    evidenceIds: ['EVD-004']
  },
  {
    id: 'REP-2026-0821-03',
    projectId: 'PRJ-OIL-2026-01',
    author: 'S. K. Saikia (Lead Instrumentation)',
    timestamp: '2026-08-21 17:00 IST',
    rawTranscript: 'Field Junction Box JB-102 cable trays erected in compressor sub-panel room. Pulling of 24-pair signal cable halted due to shortage of certified flameproof double compression cable glands.',
    extractedEvent: {
      discipline: 'Instrumentation',
      activity: 'JB-102 Marshalling & Multi-pair Cable Pulling',
      assetTag: 'Junction Box JB-102',
      startTime: '08:00 IST',
      endTime: '16:30 IST',
      status: 'Delayed (Blocker reported)',
      blocker: 'Shortage of flameproof double-compression cable glands',
      date: '2026-08-21'
    },
    matchedActivityId: 'ACT-INS-DCS-002',
    matchedActivityName: 'Field Junction Box JB-102 Marshalling & Multi-pair Cable Pulling',
    matchedActivityCode: 'INS-DCS-002',
    confidence: 78,
    signals: [
      { label: 'Discipline matches (Instrumentation)', match: true },
      { label: 'Equipment tag JB-102 matched', match: true },
      { label: 'Activity in progress with reported variance', match: true }
    ],
    status: 'needs-review',
    reviewer: null,
    reviewedAt: null,
    evidenceIds: ['EVD-005']
  }
];
