import { EvidenceService } from '../services/evidence.js';
import { EvidenceViewer } from '../components/EvidenceViewer.js';
import { Button } from '../components/Button.js';
import { Icons } from '../components/Icons.js';
import { AppRouter } from '../router.js';

export async function EvidenceView() {
  const container = document.createElement('div');
  container.className = 'view-container';

  const header = document.createElement('div');
  header.className = 'd-flex justify-between items-center flex-wrap gap-2';
  header.innerHTML = `
    <div>
      <h1 class="text-2xl font-bold text-primary">Evidence & Quality Records</h1>
      <p class="text-xs text-secondary mt-1">Geo-tagged photos, quality test reports, and visual verification linked to L5/L6 activities</p>
    </div>
  `;

  const reportBtn = Button({
    text: 'Capture Evidence',
    icon: Icons.camera(),
    variant: 'primary',
    size: 'sm',
    onClick: () => AppRouter.navigate('/progress/new')
  });
  header.appendChild(reportBtn);
  container.appendChild(header);

  // Evidence Viewer Container
  const evidenceList = await EvidenceService.getEvidence();
  const mainCard = document.createElement('div');
  mainCard.className = 'card p-4 gap-4';

  const filterRow = document.createElement('div');
  filterRow.className = 'd-flex justify-between items-center flex-wrap gap-2';
  filterRow.innerHTML = `
    <div class="text-sm font-semibold text-primary">Verified Evidence Packets (${evidenceList.length})</div>
    <span class="text-xs text-muted">Filtered by: Current Project (Duliajan CGGS)</span>
  `;
  mainCard.appendChild(filterRow);

  const viewer = EvidenceViewer({ items: evidenceList });
  mainCard.appendChild(viewer);
  container.appendChild(mainCard);

  return container;
}
