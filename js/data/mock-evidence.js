// SVG data URIs for realistic construction/infrastructure site evidence
const makeSvgThumb = (title, color, sub) => `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260"><rect width="400" height="260" fill="%23111D35"/><rect x="10" y="10" width="380" height="240" rx="8" fill="%23162040" stroke="%231E2D4A" stroke-width="2"/><circle cx="200" cy="100" r="40" fill="${color}" opacity="0.2"/><path d="M180 100 L200 80 L220 100 L210 100 L210 120 L190 120 L190 100 Z" fill="${color}"/><text x="200" y="165" fill="%23F0F4FA" font-family="sans-serif" font-size="15" font-weight="bold" text-anchor="middle">${title}</text><text x="200" y="190" fill="%2394A9CA" font-family="sans-serif" font-size="12" text-anchor="middle">${sub}</text><text x="200" y="225" fill="%2338BDF8" font-family="monospace" font-size="11" text-anchor="middle">GEO: 27.3512° N, 95.3218° E (OIL Duliajan Site)</text></svg>`;

export const MOCK_EVIDENCE = [
  {
    id: 'EVD-001',
    activityId: 'ACT-CIV-B2-003',
    activityName: 'Foundation B2 Concrete Pouring',
    url: makeSvgThumb('Concrete Pouring Batch #4', '%2322C55E', 'M40 Pour In Progress • 240 m³ Complete'),
    type: 'image/jpeg',
    filename: 'IMG_20260818_CIV_B2_POUR.jpg',
    createdAt: '2026-08-18 17:15 IST',
    uploadedBy: 'T. Gogoi (Site Supervisor)',
    locationMeta: 'Zone East - Pad 14 (Compressor Plinth B2)',
    status: 'approved'
  },
  {
    id: 'EVD-002',
    activityId: 'ACT-CIV-B2-003',
    activityName: 'Foundation B2 Concrete Pouring',
    url: makeSvgThumb('Slump Cone & Cube Moulds', '%2338BDF8', 'Slump 120mm • 6 Cube Samples Collected'),
    type: 'image/jpeg',
    filename: 'IMG_20260818_SLUMP_QC.jpg',
    createdAt: '2026-08-18 10:45 IST',
    uploadedBy: 'T. Gogoi (Site Supervisor)',
    locationMeta: 'Zone East - Batching Plant QC Station',
    status: 'approved'
  },
  {
    id: 'EVD-003',
    activityId: 'ACT-CIV-B2-003',
    activityName: 'Foundation B2 Concrete Pouring',
    url: makeSvgThumb('Curing Membrane Application', '%23F59E0B', 'Aliphatic Curing Compound Sprayed'),
    type: 'image/jpeg',
    filename: 'IMG_20260819_CURING_B2.jpg',
    createdAt: '2026-08-19 08:30 IST',
    uploadedBy: 'M. Bordoloi (Executive Eng.)',
    locationMeta: 'Zone East - Pad 14',
    status: 'approved'
  },
  {
    id: 'EVD-004',
    activityId: 'ACT-PIP-HDR-014',
    activityName: '16" Gas Suction Header Spool Erection',
    url: makeSvgThumb('16-inch Spool Fit-up & Root Pass', '%236366F1', 'Joint J-44 Root Run GTAW Completed'),
    type: 'image/jpeg',
    filename: 'IMG_20260822_WELD_J44.jpg',
    createdAt: '2026-08-22 14:10 IST',
    uploadedBy: 'R. K. Hazarika (Welding Insp.)',
    locationMeta: 'Manifold Rack Bay 3',
    status: 'approved'
  },
  {
    id: 'EVD-005',
    activityId: 'ACT-INS-DCS-002',
    activityName: 'Field Junction Box JB-102 Marshalling',
    url: makeSvgThumb('JB-102 Tray Run & Tag Verification', '%23EF4444', 'Trays In Place • Gland Shortage Logged'),
    type: 'image/jpeg',
    filename: 'IMG_20260821_JB102_TRAY.jpg',
    createdAt: '2026-08-21 16:30 IST',
    uploadedBy: 'S. K. Saikia (Lead Inst)',
    locationMeta: 'Compressor Sub-panel Room',
    status: 'pending'
  }
];
