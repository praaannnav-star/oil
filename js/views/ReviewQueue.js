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
import { ReportsService } from '../services/reports.js';
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

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'd-flex items-center gap-2';

  const refreshBtn = Button({
    text: 'Refresh Queue',
    variant: 'secondary',
    size: 'sm',
    onClick: async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Refreshing...';
      await renderTable();
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Refresh Queue';
    }
  });
  actionsDiv.appendChild(refreshBtn);

  const newReportBtn = Button({
    text: 'Report Progress',
    icon: Icons.progress(),
    variant: 'primary',
    size: 'sm',
    onClick: () => AppRouter.navigate('/progress/new')
  });
  actionsDiv.appendChild(newReportBtn);
  header.appendChild(actionsDiv);
  container.appendChild(header);

  // Tabs Bar Container
  let currentTab = 'all';
  const tabsContainer = document.createElement('div');
  container.appendChild(tabsContainer);

  function updateTabs(allItems) {
    tabsContainer.innerHTML = '';
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
        renderTable(false);
      }
    });
    tabsContainer.appendChild(tabsNav);
  }

  // Table Container
  const tableWrapper = document.createElement('div');
  container.appendChild(tableWrapper);

  async function renderTable(fetchFresh = true) {
    tableWrapper.innerHTML = '<div class="p-4 text-center text-muted font-mono">Loading review queue...</div>';
    const all = await ReviewService.getReviewQueue('all');
    updateTabs(all);
    const items = currentTab === 'all' 
      ? all 
      : all.filter(i => i.tabCategory === currentTab || i.state === currentTab);
    tableWrapper.innerHTML = '';

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
        render: (val, row) => {
          const urg = row.urgency || { priority: 'P4', label: 'P4 Info' };
          const role = row.suggestedReviewerRole || 'Lead Planner';
          return `
            <div class="d-flex flex-col gap-1">
              <div class="d-flex items-center gap-2 flex-wrap">
                <strong class="text-sm text-primary">${escapeHtml(val?.activity || 'Site Observation')}</strong>
                ${urg.priority === 'P1' ? '<span class="badge badge-rejected" style="font-size:10px; padding:1px 6px;">P1 CRITICAL</span>' : ''}
                ${urg.priority === 'P2' ? '<span class="badge badge-warning" style="font-size:10px; padding:1px 6px;">P2 HIGH</span>' : ''}
                ${urg.priority === 'P3' ? '<span class="badge badge-in-progress" style="font-size:10px; padding:1px 6px;">P3 MEDIUM</span>' : ''}
              </div>
              <div class="d-flex items-center gap-2 text-xs text-muted font-mono flex-wrap">
                <span>${escapeHtml(row.reporter)} • ${escapeHtml(row.age || 'Today')}</span>
                <span class="badge badge-neutral" style="font-size:10px; padding:1px 6px;">👤 Reviewer: ${escapeHtml(role)}</span>
              </div>
            </div>
          `;
        }
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

    const urg = item.urgency || { priority: 'P4', label: 'P4 Info', reason: 'Routine' };
    const role = item.suggestedReviewerRole || 'Lead Planner';

    // Section 1: Source & Event Details
    const eventCard = document.createElement('div');
    eventCard.className = 'card p-3 gap-2';
    eventCard.innerHTML = `
      <div class="d-flex justify-between items-center flex-wrap gap-1">
        <div class="d-flex items-center gap-2">
          <span class="text-xs font-bold text-muted uppercase">EXTRACTED FIELD OBSERVATION</span>
          ${urg.priority === 'P1' ? '<span class="badge badge-rejected" style="font-size:10px;">P1 CRITICAL</span>' : ''}
          ${urg.priority === 'P2' ? '<span class="badge badge-warning" style="font-size:10px;">P2 HIGH</span>' : ''}
          ${urg.priority === 'P3' ? '<span class="badge badge-in-progress" style="font-size:10px;">P3 MEDIUM</span>' : ''}
        </div>
        <span class="text-xs text-muted font-mono">${escapeHtml(item.reporter)} (${escapeHtml(item.age || 'Today')})</span>
      </div>
      <div class="text-sm font-semibold text-primary" data-field="activity">${escapeHtml(item.extractedEvent?.activity || 'Site Observation')}</div>
      <div class="d-flex gap-3 text-xs text-secondary flex-wrap">
        <span>Discipline: <strong data-field="discipline">${escapeHtml(item.discipline)}</strong></span>
        <span>Date: <strong data-field="date">${escapeHtml(item.extractedEvent?.date || 'Today')}</strong></span>
        <span>Status: <strong data-field="status">${escapeHtml(item.extractedEvent?.status || 'Completed')}</strong></span>
        <span>Blocker: <strong data-field="blocker">${escapeHtml(item.extractedEvent?.blocker || 'None')}</strong></span>
      </div>
      <div class="d-flex items-center gap-2 pt-1 border-t border-border text-xs text-muted">
        <span>Suggested Reviewer:</span>
        <span class="badge badge-neutral font-semibold">👤 ${escapeHtml(role)}</span>
        ${urg.reason && urg.reason !== 'None' ? `<span class="text-muted ml-auto">Urgency note: <em>${escapeHtml(urg.reason)}</em></span>` : ''}
      </div>
    `;
    drawerContent.appendChild(eventCard);

    // Section 1b: AI Correction Assist
    if (item.state !== 'approved') {
      const correctCard = document.createElement('div');
      correctCard.className = 'card p-3 gap-3';
      correctCard.innerHTML = `
        <div class="text-xs font-bold text-muted uppercase">SUGGEST CORRECTION (AI ASSIST)</div>
        <div class="d-flex gap-2">
          <input type="text" id="correction-notes" class="input flex-1" placeholder="e.g. Change discipline to Electrical...">
          <button id="btn-correct" class="btn btn-secondary btn-sm">Suggest</button>
        </div>
        <div id="correction-diff-mount" class="d-flex flex-col gap-2 mt-2 d-none"></div>
      `;
      drawerContent.appendChild(correctCard);

      const btnCorrect = correctCard.querySelector('#btn-correct');
      const inputNotes = correctCard.querySelector('#correction-notes');
      const diffMount = correctCard.querySelector('#correction-diff-mount');

      btnCorrect.addEventListener('click', async () => {
        const notes = inputNotes.value.trim();
        if (!notes) return Toast.info('Please enter correction notes.');
        btnCorrect.disabled = true;
        btnCorrect.textContent = '...';
        try {
          const res = await ReportsService.correctReport(item.reportId || item.id, notes);
          diffMount.innerHTML = '';
          diffMount.classList.remove('d-none');
          
          let hasChanges = false;
          const oldEvent = item.extractedEvent || {};
          const newEvent = res.event || {};
          
          Object.keys(newEvent).forEach(key => {
            const oldVal = oldEvent[key];
            const newVal = newEvent[key];
            if (oldVal !== newVal) {
              hasChanges = true;
              const row = document.createElement('div');
              row.className = 'd-flex justify-between items-center p-2 rounded';
              row.style.background = 'var(--color-surface-hover)';
              row.innerHTML = `
                <div class="text-xs d-flex align-center gap-2">
                  <span class="text-muted font-mono uppercase">${key}:</span>
                  <span style="text-decoration:line-through; color:var(--color-danger)">${escapeHtml(String(oldVal || 'null'))}</span>
                  <span>→</span>
                  <span class="font-bold text-success">${escapeHtml(String(newVal || 'null'))}</span>
                </div>
                <div class="d-flex gap-1">
                  <button class="btn btn-ghost btn-sm text-success btn-accept" data-val="${escapeHtml(String(newVal || ''))}">Accept</button>
                  <button class="btn btn-ghost btn-sm text-danger btn-discard">Discard</button>
                </div>
              `;
              diffMount.appendChild(row);
              
              row.querySelector('.btn-accept').addEventListener('click', () => {
                item.extractedEvent[key] = newVal;
                const fieldEl = eventCard.querySelector(`[data-field="${key}"]`);
                if (fieldEl) fieldEl.textContent = String(newVal || '');
                row.remove();
                if (diffMount.children.length === 0) diffMount.classList.add('d-none');
                Toast.success(`Accepted new ${key}`);
              });
              
              row.querySelector('.btn-discard').addEventListener('click', () => {
                row.remove();
                if (diffMount.children.length === 0) diffMount.classList.add('d-none');
              });
            }
          });
          
          if (!hasChanges) {
            diffMount.innerHTML = '<span class="text-xs text-muted">No schema fields changed based on notes.</span>';
          }
        } catch (err) {
          Toast.danger('Correction failed: ' + err.message);
        } finally {
          btnCorrect.disabled = false;
          btnCorrect.textContent = 'Suggest';
        }
      });
    }

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

    // Section 2b: Survey Answers (first-class survey submissions)
    if (item.surveyAnswers && Object.keys(item.surveyAnswers).length > 0) {
      const srvBox = document.createElement('div');
      srvBox.className = 'card p-3 gap-2';
      srvBox.innerHTML = `<div class="text-xs font-bold text-muted">SURVEY RESPONSES</div>`;
      Object.entries(item.surveyAnswers).forEach(([qId, ans]) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'd-flex justify-between text-xs gap-3';
        const qLabel = qId.replace(/^q_/, '').replace(/_/g, ' ');
        rowEl.innerHTML = `
          <span class="text-muted" style="text-transform:capitalize;">${escapeHtml(qLabel)}</span>
          <strong class="text-primary text-right">${escapeHtml(String(ans || '—'))}</strong>
        `;
        srvBox.appendChild(rowEl);
      });
      drawerContent.appendChild(srvBox);
    }

    // Section 3: Evidence Preview & AI Verification
    const [activityEvidence, allEvidence] = await Promise.all([
      EvidenceService.getEvidence(item.topMatch?.id),
      EvidenceService.getEvidence()
    ]);
    const evidenceById = new Map();
    [...(activityEvidence || []), ...(allEvidence || []).filter(e => e.reportId === item.reportId)]
      .forEach(e => evidenceById.set(e.id, e));
    const evidenceList = Array.from(evidenceById.values());

    const evBox = document.createElement('div');
    evBox.className = 'card p-3 gap-3';
    
    // AI Verification Result Header
    const aiStatus = item.aiVerification?.status;
    const isPending = !item.aiVerification || aiStatus === 'pending';
    const isNoEvidence = aiStatus === 'no_visual_evidence';
    const isError = aiStatus === 'error';

    if (isPending) {
      evBox.innerHTML = `
        <div class="d-flex items-center gap-2 mb-2 p-2 rounded" style="background:var(--color-surface-hover); border:1px dashed var(--color-primary-dim);">
          <span style="font-size:1.2rem;" class="animate-pulse">⏳</span>
          <div class="d-flex flex-col flex-1">
            <strong class="text-xs text-primary">Cloudflare Vision AI Analyzing...</strong>
            <span class="text-xs text-muted font-mono">${escapeHtml(item.aiVerification?.reasoning || 'Cross-referencing photo pixels with transcript claim.')}</span>
          </div>
          <button id="btn-refresh-ai" class="btn btn-ghost btn-sm" title="Refresh Status">🔄 Refresh</button>
        </div>
      `;
    } else if (isNoEvidence) {
      evBox.innerHTML = `
        <div class="d-flex items-center gap-2 mb-2 p-2 rounded" style="background:var(--color-surface-hover); border:1px solid var(--color-warning);">
          <span style="font-size:1.2rem;">⚠️</span>
          <div class="d-flex flex-col flex-1">
            <strong class="text-xs text-warning">No Visual Evidence Attached</strong>
            <span class="text-xs text-muted font-mono">${escapeHtml(item.aiVerification?.reasoning || 'No photographic evidence was attached to this report.')}</span>
          </div>
        </div>
      `;
    } else if (isError) {
      evBox.innerHTML = `
        <div class="d-flex items-center gap-2 mb-2 p-2 rounded" style="background:var(--color-surface-hover); border:1px solid var(--color-danger);">
          <span style="font-size:1.2rem;">⚠️</span>
          <div class="d-flex flex-col flex-1">
            <strong class="text-xs text-danger">Vision AI Analysis Error</strong>
            <span class="text-xs text-muted mt-1 font-mono">${escapeHtml(item.aiVerification?.reasoning || 'Error processing image evidence.')}</span>
          </div>
          <button id="btn-refresh-ai" class="btn btn-ghost btn-sm" title="Retry">🔄 Retry</button>
        </div>
      `;
    } else {
      const { verified, confidence, reasoning } = item.aiVerification;
      const badgeColor = verified ? (confidence >= 80 ? 'success' : 'warning') : 'danger';
      const icon = verified ? '✅' : '❌';
      evBox.innerHTML = `
        <div class="d-flex items-center gap-2 mb-2 p-2 rounded" style="background:var(--color-surface-hover); border:1px solid var(--color-${badgeColor});">
          <span style="font-size:1.2rem;">${icon}</span>
          <div class="d-flex flex-col flex-1">
            <strong class="text-xs text-${badgeColor}">AI Visual Analysis: ${verified ? 'Verified Match' : 'Mismatch detected'} (${confidence || 0}% Confidence)</strong>
            <span class="text-xs text-muted mt-1 font-mono">${escapeHtml(reasoning || '')}</span>
          </div>
          <button id="btn-refresh-ai" class="btn btn-ghost btn-sm" title="Refresh Status">🔄 Refresh</button>
        </div>
      `;
    }

    if (evidenceList.length > 0) {
      const evHeader = document.createElement('div');
      evHeader.className = 'text-xs font-bold text-muted mb-1';
      evHeader.textContent = `LINKED EVIDENCE PHOTOS (${evidenceList.length})`;
      evBox.appendChild(evHeader);
      
      const evGrid = document.createElement('div');
      evGrid.className = 'd-grid grid-3 gap-2';
      evidenceList.forEach(e => {
        const thumb = document.createElement('div');
        thumb.innerHTML = `<img src="${e.url}" style="height:70px; width:100%; object-fit:cover; border-radius:4px;" alt="Evidence">`;
        evGrid.appendChild(thumb);
      });
      evBox.appendChild(evGrid);
    }
    drawerContent.appendChild(evBox);

    const refreshBtn = evBox.querySelector('#btn-refresh-ai');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = '...';
        cleanupPoll();
        await ReviewService.getReviewQueue(currentTab); // trigger a pull
        drawer.close();
        // Re-open this specific drawer by simulating a click or re-rendering it
        const updatedItem = await ReviewService.getReviewItem(item.id);
        if (updatedItem) openReviewDrawer(updatedItem);
        renderTable(); // Keep background table fresh
      });
    }

    // Section 4: Verified Progress Assessor (Slider)
    let progressVal = item.extractedEvent?.status === 'Completed' ? 100 : (item.topMatch?.progress || 0);
    let aiSuggestedProgress = item.aiVerification?.suggestedProgress;
    let wasAutoCorrected = false;

    if (aiSuggestedProgress !== undefined && aiSuggestedProgress !== null) {
      progressVal = aiSuggestedProgress;
      wasAutoCorrected = true;
    } else if (progressVal < 100 && item.extractedEvent?.status === 'In Progress') {
      progressVal = Math.min(100, progressVal + 10);
    }
    
    if (item.state !== 'approved' && item.topMatch?.id) {
      const progBox = document.createElement('div');
      progBox.className = 'card p-3 gap-2 mt-3';
      progBox.style.border = '1px solid var(--color-primary-dim)';
      progBox.style.background = 'var(--color-surface-el)';
      progBox.innerHTML = `
        <div class="d-flex justify-between items-center">
          <label class="text-xs font-bold text-primary">Verified Progress Implemented (%)</label>
          <span class="badge badge-pending font-mono" id="slider-val-display">${progressVal}%</span>
        </div>
        ${wasAutoCorrected ? `<span class="text-xs text-primary mt-1 font-semibold">✨ AI Vision adjusted to ${progressVal}% based on photo evidence.</span>` : ''}
        <input type="range" id="progress-slider" min="0" max="100" step="5" value="${progressVal}" class="w-full mt-2" style="cursor:ew-resize;">
        <div class="d-flex justify-between text-xs text-muted mt-1 font-mono">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
        <p class="text-xs text-secondary mt-1">Adjust slider based on visual evidence before approving.</p>
      `;
      drawerContent.appendChild(progBox);

      const slider = progBox.querySelector('#progress-slider');
      const display = progBox.querySelector('#slider-val-display');
      slider.addEventListener('input', (e) => {
        display.textContent = e.target.value + '%';
        progressVal = Number(e.target.value);
      });
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
            await ReviewService.approveMatch(item.id, progressVal); // Pass progressVal here!
            Toast.success('Activity match approved! Schedule baseline actuals reconciled.');
            cleanupPoll();
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
            cleanupPoll();
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

    let pollInterval = null;
    function cleanupPoll() {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    }

    const drawer = Drawer({
      title: `Review Item: ${item.id}`,
      body: drawerContent,
      footer: footerButtons,
      onClose: cleanupPoll,
      width: '620px'
    });

    // Auto-poll if AI analysis is currently pending
    if (isPending) {
      let pollCount = 0;
      pollInterval = setInterval(async () => {
        pollCount++;
        if (pollCount > 15) {
          cleanupPoll();
          return;
        }
        try {
          const fresh = await ReviewService.getReviewItem(item.id);
          if (fresh?.aiVerification && fresh.aiVerification.status !== 'pending') {
            cleanupPoll();
            drawer.close();
            openReviewDrawer(fresh);
            renderTable();
          }
        } catch (e) {
          // ignore transient poll errors
        }
      }, 3500);
    }
  }

  renderTable();
  return container;
}

