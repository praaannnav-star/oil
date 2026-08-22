import { Tabs } from '../components/Tabs.js';
import { Table } from '../components/Table.js';
import { Badge } from '../components/Badge.js';
import { Button } from '../components/Button.js';
import { Drawer } from '../components/Drawer.js';
import { ActivityMatchCard } from '../components/ActivityMatchCard.js';
import { Toast } from '../components/Toast.js';
import { Icons } from '../components/Icons.js';
import { ReviewService } from '../services/review.js';
import { EvidenceService } from '../services/evidence.js';
import { AppRouter } from '../router.js';
import { escapeHtml } from '../utils/dom.js';

export async function ReviewQueueView() {
  const container = document.createElement('div');
  container.className = 'view-container';

  // Header
  const header = document.createElement('div');
  header.className = 'd-flex justify-between items-center flex-wrap gap-2';
  header.innerHTML = `
    <div>
      <h1 class="text-2xl font-bold text-primary">Schedule Linking Review Queue</h1>
      <p class="text-xs text-secondary mt-1">Validate and approve AI-extracted execution events and link them to L5/L6 planned schedule baselines</p>
    </div>
  `;

  const newReportBtn = Button({
    text: 'Report Progress',
    icon: Icons.progress(),
    variant: 'primary',
    size: 'sm',
    onClick: () => AppRouter.navigate('/progress/new')
  });
  header.appendChild(newReportBtn);
  container.appendChild(header);

  // Tabs Bar
  let currentTab = 'all';
  const allItems = await ReviewService.getReviewQueue('all');

  const counts = {
    all: allItems.length,
    'high-confidence': allItems.filter(i => i.tabCategory === 'high-confidence').length,
    'needs-review': allItems.filter(i => i.tabCategory === 'needs-review' || i.state === 'needs-review').length,
    'ambiguous': allItems.filter(i => i.tabCategory === 'ambiguous' || i.state === 'ambiguous').length,
    'unmatched': allItems.filter(i => i.tabCategory === 'unmatched' || i.state === 'unmatched').length,
    'rejected': allItems.filter(i => i.tabCategory === 'rejected' || i.state === 'rejected').length
  };

  const tabsNav = Tabs({
    tabs: [
      { id: 'all', label: 'All Items', count: counts.all },
      { id: 'high-confidence', label: 'High Confidence', count: counts['high-confidence'] },
      { id: 'needs-review', label: 'Needs Review', count: counts['needs-review'] },
      { id: 'ambiguous', label: 'Ambiguous', count: counts['ambiguous'] },
      { id: 'unmatched', label: 'Unmatched', count: counts['unmatched'] },
      { id: 'rejected', label: 'Rejected', count: counts['rejected'] }
    ],
    activeTab: currentTab,
    onTabChange: (tabId) => {
      currentTab = tabId;
      renderTable();
    }
  });
  container.appendChild(tabsNav);

  // Table Container
  const tableWrapper = document.createElement('div');
  container.appendChild(tableWrapper);

  async function renderTable() {
    tableWrapper.innerHTML = '';
    const items = await ReviewService.getReviewQueue(currentTab);

    const columns = [
      {
        key: 'discipline',
        label: 'Discipline',
        width: '130px',
        render: (val) => Badge({ label: val || 'Civil', status: 'in-progress' })
      },
      {
        key: 'extractedEvent',
        label: 'Extracted Field Event',
        render: (val, row) => `
          <div class="d-flex flex-col">
            <strong class="text-sm text-primary">${escapeHtml(val?.activity || 'Site Observation')}</strong>
            <span class="text-xs text-muted font-mono">${escapeHtml(row.reporter)} • ${escapeHtml(row.age || 'Today')}</span>
          </div>
        `
      },
      {
        key: 'topMatch',
        label: 'Suggested L5/L6 Activity Match',
        render: (val) => {
          if (!val) {
            return `<span class="badge badge-unmatched">No Match Found</span>`;
          }
          return `
            <div class="d-flex flex-col">
              <span class="text-sm font-semibold text-primary">${escapeHtml(val.name)}</span>
              <span class="text-xs text-muted font-mono">ID: ${escapeHtml(val.code || val.id)} (${escapeHtml(val.level || 'L5')})</span>
            </div>
          `;
        }
      },
      {
        key: 'topMatch',
        label: 'Confidence',
        width: '140px',
        render: (val) => {
          if (!val) return '—';
          const conf = val.confidence || 90;
          let tierClass = conf >= 80 ? 'text-success' : (conf >= 60 ? 'text-warning' : 'text-danger');
          return `
            <div class="d-flex items-center gap-2">
              <div class="confidence-bar-bg" style="width:50px; height:6px;">
                <div class="confidence-bar-fill ${conf >= 80 ? 'confidence-high' : 'confidence-medium'}" style="width:${conf}%;"></div>
              </div>
              <span class="text-xs font-mono font-bold ${tierClass}">${conf}%</span>
            </div>
          `;
        }
      },
      {
        key: 'state',
        label: 'Review State',
        width: '140px',
        render: (val) => {
          let badgeStatus = 'pending';
          if (val === 'approved') badgeStatus = 'on-track';
          else if (val === 'needs-review') badgeStatus = 'at-risk';
          else if (val === 'ambiguous') badgeStatus = 'ambiguous';
          else if (val === 'unmatched') badgeStatus = 'unmatched';
          else if (val === 'rejected') badgeStatus = 'rejected';
          return Badge({ label: val.toUpperCase(), status: badgeStatus });
        }
      }
    ];

    const tableEl = Table({
      columns,
      data: items,
      emptyMessage: 'No items currently in this review queue category.',
      onRowClick: (row) => openReviewDrawer(row)
    });

    tableWrapper.appendChild(tableEl);
  }

  // Open Review Detail Drawer
  async function openReviewDrawer(item) {
    const drawerContent = document.createElement('div');
    drawerContent.className = 'd-flex flex-col gap-4';

    // Section 1: Source & Event Details
    const eventCard = document.createElement('div');
    eventCard.className = 'card p-3 gap-2';
    eventCard.innerHTML = `
      <div class="d-flex justify-between items-center">
        <span class="text-xs font-bold text-muted uppercase">EXTRACTED FIELD OBSERVATION</span>
        <span class="text-xs text-muted font-mono">${escapeHtml(item.reporter)} (${escapeHtml(item.age || 'Today')})</span>
      </div>
      <div class="text-sm font-semibold text-primary">${escapeHtml(item.extractedEvent?.activity || 'Site Observation')}</div>
      <div class="d-flex gap-3 text-xs text-secondary flex-wrap">
        <span>Discipline: <strong>${escapeHtml(item.discipline)}</strong></span>
        <span>Date: <strong>${escapeHtml(item.extractedEvent?.date || 'Today')}</strong></span>
        <span>Status: <strong>${escapeHtml(item.extractedEvent?.status || 'Completed')}</strong></span>
        <span>Blocker: <strong>${escapeHtml(item.extractedEvent?.blocker || 'None')}</strong></span>
      </div>
    `;
    drawerContent.appendChild(eventCard);

    // Section 2: Match Card with Signals & Alternatives
    if (item.topMatch) {
      const matchCard = ActivityMatchCard({
        recommendedActivity: item.topMatch,
        confidence: item.topMatch.confidence || 92,
        signals: item.topMatch.signals || [],
        alternatives: item.alternatives || [],
        showActions: false
      });
      drawerContent.appendChild(matchCard);
    } else {
      const unmatchedBox = document.createElement('div');
      unmatchedBox.className = 'card p-4 text-center text-muted gap-2';
      unmatchedBox.innerHTML = `
        <div class="text-md font-bold text-danger">No L5/L6 Schedule Baseline Match Identified</div>
        <p class="text-xs text-secondary">This observation may represent non-WBS emergency work or require manual schedule activity mapping.</p>
      `;
      drawerContent.appendChild(unmatchedBox);
    }

    // Section 3: Evidence Preview (if linked)
    const evidenceList = await EvidenceService.getEvidence(item.topMatch?.id);
    if (evidenceList && evidenceList.length > 0) {
      const evBox = document.createElement('div');
      evBox.className = 'card p-3 gap-2';
      evBox.innerHTML = `<div class="text-xs font-bold text-muted">LINKED EVIDENCE PHOTOS (${evidenceList.length})</div>`;
      
      const evGrid = document.createElement('div');
      evGrid.className = 'd-grid grid-3 gap-2';
      evidenceList.forEach(e => {
        const thumb = document.createElement('div');
        thumb.innerHTML = `<img src="${e.url}" style="height:70px; width:100%; object-fit:cover; border-radius:4px;" alt="Evidence">`;
        evGrid.appendChild(thumb);
      });
      evBox.appendChild(evGrid);
      drawerContent.appendChild(evBox);
    }

    // Footer Action Buttons
    const footerButtons = [];

    if (item.state !== 'approved') {
      const approveBtn = Button({
        text: 'Approve & Reconcile Schedule',
        variant: 'success',
        icon: Icons.check(),
        onClick: async () => {
          try {
            await ReviewService.approveMatch(item.id);
            Toast.success('Activity match approved! Schedule baseline actuals reconciled.');
            drawer.close();
            renderTable();
          } catch (err) {
            Toast.danger(err.message || 'Approval failed.');
          }
        }
      });
      footerButtons.push(approveBtn);

      const rejectBtn = Button({
        text: 'Reject Match',
        variant: 'danger',
        icon: Icons.x(),
        onClick: async () => {
          try {
            await ReviewService.rejectMatch(item.id, 'Discrepancy identified during planner inspection');
            Toast.warning('Activity match rejected.');
            drawer.close();
            renderTable();
          } catch (err) {
            Toast.danger(err.message || 'Rejection failed.');
          }
        }
      });
      footerButtons.push(rejectBtn);
    } else {
      const statusNote = document.createElement('span');
      statusNote.className = 'text-xs text-success font-semibold';
      statusNote.textContent = `Approved by ${item.reviewer} at ${item.reviewedAt}`;
      footerButtons.push(statusNote);
    }

    const drawer = Drawer({
      title: `Review Item: ${item.id}`,
      body: drawerContent,
      footer: footerButtons,
      width: '620px'
    });
  }

  renderTable();
  return container;
}
