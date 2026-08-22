// Confidence Indicator Gauge (Accessible, percentage bar + label)
export function ConfidenceIndicator({ confidence = 0, showLabel = true, size = 'md' }) {
  const container = document.createElement('div');
  container.className = 'confidence-gauge';
  container.setAttribute('role', 'meter');
  container.setAttribute('aria-valuenow', confidence);
  container.setAttribute('aria-valuemin', '0');
  container.setAttribute('aria-valuemax', '100');
  container.setAttribute('aria-label', `Match confidence: ${confidence}%`);

  let tier = 'low';
  let tierLabel = 'LOW CONFIDENCE';
  if (confidence >= 80) {
    tier = 'high';
    tierLabel = 'HIGH CONFIDENCE';
  } else if (confidence >= 60) {
    tier = 'medium';
    tierLabel = 'MEDIUM CONFIDENCE';
  }

  if (showLabel) {
    const meta = document.createElement('div');
    meta.className = 'confidence-meta';

    const labelSpan = document.createElement('span');
    labelSpan.className = `confidence-${tier}`;
    labelSpan.textContent = tierLabel;

    const valueSpan = document.createElement('span');
    valueSpan.className = 'font-mono';
    valueSpan.textContent = `${confidence}%`;

    meta.appendChild(labelSpan);
    meta.appendChild(valueSpan);
    container.appendChild(meta);
  }

  const barBg = document.createElement('div');
  barBg.className = 'confidence-bar-bg';

  const barFill = document.createElement('div');
  barFill.className = `confidence-bar-fill confidence-${tier}`;
  barFill.style.width = `${Math.min(100, Math.max(0, confidence))}%`;

  barBg.appendChild(barFill);
  container.appendChild(barBg);

  return container;
}
