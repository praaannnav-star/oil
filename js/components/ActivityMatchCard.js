import { ConfidenceIndicator } from './ConfidenceIndicator.js';
import { Button } from './Button.js';
import { Badge } from './Badge.js';
import { Icons } from './Icons.js';
import { escapeHtml } from '../utils/dom.js';

export function ActivityMatchCard({
  recommendedActivity,
  confidence = 94,
  signals = [],
  alternatives = [],
  onApprove = null,
  onChooseAlternative = null,
  onMarkUnmatched = null,
  showActions = true
}) {
  const card = document.createElement('div');
  card.className = 'match-card recommended';

  // Header: Badge + Confidence
  const header = document.createElement('div');
  header.className = 'd-flex justify-between items-center';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'd-flex items-center gap-2';

  const starIcon = document.createElement('span');
  starIcon.className = 'text-primary';
  starIcon.innerHTML = Icons.sparkle();
  titleGroup.appendChild(starIcon);

  const title = document.createElement('strong');
  title.className = 'text-sm text-primary';
  title.textContent = 'RECOMMENDED L5/L6 ACTIVITY MATCH';
  titleGroup.appendChild(title);

  header.appendChild(titleGroup);

  const disciplineBadge = Badge({
    label: recommendedActivity.discipline || 'Civil',
    status: 'in-progress',
    dot: false
  });
  header.appendChild(disciplineBadge);
  card.appendChild(header);

  // Recommended Activity Name & Code
  const actBody = document.createElement('div');
  actBody.className = 'd-flex flex-col gap-1 mt-1';

  const actName = document.createElement('div');
  actName.className = 'text-md font-bold text-primary';
  actName.textContent = recommendedActivity.name;
  actBody.appendChild(actName);

  const actMeta = document.createElement('div');
  actMeta.className = 'd-flex items-center gap-3 text-xs text-muted font-mono';
  actMeta.innerHTML = `
    <span>ID: <strong>${escapeHtml(recommendedActivity.code || recommendedActivity.id)}</strong></span>
    <span>•</span>
    <span>Level: <strong>${escapeHtml(recommendedActivity.level || 'L5')}</strong></span>
    <span>•</span>
    <span>Planned: ${escapeHtml(recommendedActivity.plannedStart || 'N/A')} → ${escapeHtml(recommendedActivity.plannedFinish || 'N/A')}</span>
  `;
  actBody.appendChild(actMeta);
  card.appendChild(actBody);

  // Confidence Gauge
  const gauge = ConfidenceIndicator({ confidence, showLabel: true });
  card.appendChild(gauge);

  // Explainability Signals: WHY THIS MATCH?
  const signalsBox = document.createElement('div');
  signalsBox.className = 'match-signals';

  const signalsTitle = document.createElement('div');
  signalsTitle.className = 'text-xs font-bold text-muted';
  signalsTitle.style.letterSpacing = '0.05em';
  signalsTitle.textContent = 'EXPLAINABILITY SIGNALS (WHY THIS MATCH?)';
  signalsBox.appendChild(signalsTitle);

  const signalItems = signals.length > 0 ? signals : [
    { label: 'Discipline matches field report (Civil Engineering)', match: true },
    { label: 'Asset identifier verified (Foundation Block B2)', match: true },
    { label: 'Terminology semantic similarity: 96%', match: true },
    { label: 'Spatial location compatible (Pad 14, Zone East)', match: true },
    { label: 'Schedule window active and expecting progress', match: true }
  ];

  signalItems.forEach(sig => {
    const row = document.createElement('div');
    row.className = 'signal-item';
    row.innerHTML = `
      <span class="${sig.match ? 'signal-icon-match' : 'signal-icon-partial'}">
        ${sig.match ? '✓' : '•'}
      </span>
      <span>${escapeHtml(sig.label)}</span>
    `;
    signalsBox.appendChild(row);
  });
  card.appendChild(signalsBox);

  // Alternative Candidates (if any)
  if (alternatives && alternatives.length > 0) {
    const altBox = document.createElement('div');
    altBox.className = 'd-flex flex-col gap-2 mt-2';

    const altTitle = document.createElement('div');
    altTitle.className = 'text-xs font-bold text-muted';
    altTitle.textContent = 'ALTERNATIVE CANDIDATES';
    altBox.appendChild(altTitle);

    alternatives.forEach(alt => {
      const altRow = document.createElement('div');
      altRow.className = 'd-flex justify-between items-center p-2 rounded';
      altRow.style.background = 'var(--color-surface)';
      altRow.style.border = '1px solid var(--color-border)';

      const altInfo = document.createElement('div');
      altInfo.className = 'd-flex flex-col';
      altInfo.innerHTML = `
        <span class="text-sm font-semibold text-primary">${escapeHtml(alt.name)}</span>
        <span class="text-xs text-muted font-mono">${escapeHtml(alt.code || alt.id)} • ${escapeHtml(alt.discipline)}</span>
      `;
      altRow.appendChild(altInfo);

      const altRight = document.createElement('div');
      altRight.className = 'd-flex items-center gap-2';

      const conf = document.createElement('span');
      conf.className = 'text-xs font-mono font-bold text-warning';
      conf.textContent = `${alt.confidence}%`;
      altRight.appendChild(conf);

      if (showActions && onChooseAlternative) {
        const chooseBtn = Button({
          text: 'Select',
          variant: 'secondary',
          size: 'sm',
          onClick: () => onChooseAlternative(alt)
        });
        altRight.appendChild(chooseBtn);
      }

      altRow.appendChild(altRight);
      altBox.appendChild(altRow);
    });

    card.appendChild(altBox);
  }

  // Action Buttons
  if (showActions) {
    const actionRow = document.createElement('div');
    actionRow.className = 'd-flex items-center gap-2 mt-3 flex-wrap';

    if (onApprove) {
      const approveBtn = Button({
        text: 'Approve Match',
        variant: 'success',
        icon: Icons.check(),
        onClick: () => onApprove(recommendedActivity)
      });
      actionRow.appendChild(approveBtn);
    }

    if (onMarkUnmatched) {
      const unmatchedBtn = Button({
        text: 'Mark Unmatched',
        variant: 'ghost',
        size: 'sm',
        onClick: () => onMarkUnmatched(recommendedActivity)
      });
      actionRow.appendChild(unmatchedBtn);
    }

    card.appendChild(actionRow);
  }

  return card;
}
