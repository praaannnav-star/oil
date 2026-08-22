// Card & MetricCard components
export function Card({ title = '', subtitle = '', action = null, children = [], cls = '' }) {
  const card = document.createElement('div');
  card.className = `card ${cls}`;

  if (title || subtitle || action) {
    const header = document.createElement('div');
    header.className = 'card-header';

    const titleGroup = document.createElement('div');
    if (title) {
      const titleEl = document.createElement('h3');
      titleEl.className = 'card-title';
      titleEl.innerHTML = title;
      titleGroup.appendChild(titleEl);
    }
    if (subtitle) {
      const subEl = document.createElement('div');
      subEl.className = 'card-subtitle';
      subEl.textContent = subtitle;
      titleGroup.appendChild(subEl);
    }
    header.appendChild(titleGroup);

    if (action) {
      header.appendChild(action);
    }

    card.appendChild(header);
  }

  if (Array.isArray(children)) {
    children.forEach(child => {
      if (child) card.appendChild(child);
    });
  } else if (children) {
    card.appendChild(children);
  }

  return card;
}

export function MetricCard({ label, value, subtext = '', status = '', icon = null, trend = null }) {
  const card = document.createElement('div');
  card.className = 'metric-card';

  const labelRow = document.createElement('div');
  labelRow.className = 'd-flex justify-between items-center';

  const labelEl = document.createElement('span');
  labelEl.className = 'metric-label';
  labelEl.textContent = label;
  labelRow.appendChild(labelEl);

  if (icon) {
    const iconEl = document.createElement('span');
    iconEl.innerHTML = icon;
    iconEl.className = 'text-muted';
    labelRow.appendChild(iconEl);
  }

  card.appendChild(labelRow);

  const valueEl = document.createElement('div');
  valueEl.className = 'metric-value';
  if (status) {
    valueEl.classList.add(`text-${status}`);
  }
  valueEl.textContent = value;
  card.appendChild(valueEl);

  if (subtext || trend) {
    const footer = document.createElement('div');
    footer.className = 'metric-footer';
    if (trend) {
      const trendEl = document.createElement('span');
      trendEl.className = trend.positive ? 'text-success font-semibold' : 'text-danger font-semibold';
      trendEl.textContent = trend.text;
      footer.appendChild(trendEl);
    }
    if (subtext) {
      const subEl = document.createElement('span');
      subEl.textContent = subtext;
      footer.appendChild(subEl);
    }
    card.appendChild(footer);
  }

  return card;
}
