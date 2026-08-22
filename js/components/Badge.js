// Badge component
export function Badge({ label, status = 'pending', dot = true, cls = '' }) {
  const badge = document.createElement('span');
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '-');
  badge.className = `badge badge-${normalizedStatus} ${cls}`;
  
  if (dot) {
    const dotEl = document.createElement('span');
    dotEl.className = 'badge-dot';
    badge.appendChild(dotEl);
  }
  
  const textEl = document.createElement('span');
  textEl.textContent = label || status;
  badge.appendChild(textEl);

  return badge;
}
