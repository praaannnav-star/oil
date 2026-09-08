export const MOCK_PROJECTS = [
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
    lat: 27.1882,
    lng: 95.3132,
    disciplines: ['Civil', 'Mechanical', 'Piping', 'Electrical', 'Instrumentation'],
    startDate: '2025-11-01',
    targetFinish: '2026-12-15',
    plannedProgress: 68.5,
    actualProgress: 62.0,
    variance: -6.5,
    spi: 0.91, // Schedule Performance Index
    health: 'at-risk', // on-track, at-risk, delayed
    delayedActivitiesCount: 4,
    pendingReviewCount: 6,
    evidenceCoverage: 91,
    budget: '₹ 385 Cr',
    client: 'Oil India Limited (OIL)',
    leadPlanner: 'Rajesh Baruah, AGM (Projects)',
    description: 'Brownfield expansion of Gas Compression & Dehydration Unit with 4.5 MMSCMD handling capacity.',
    yesterdayChanges: [
      { type: 'update', text: '7 L5/L6 activities updated from field reports' },
      { type: 'evidence', text: '4 evidence photo packets verified by Site Engineer' },
      { type: 'delay', text: '2 activities flagged delayed (Compressor Skid B foundation curing)' },
      { type: 'milestone', text: 'Milestone MS-3 (Compressor Deck Handover) slipped by 3 days' },
      { type: 'deviation', text: '1 deviation resolved with revised curing compound specification' },
      { type: 'blocker', text: 'Heavy rainfall alert logged at Sector 4 drainage trench' }
    ]
  }
];
