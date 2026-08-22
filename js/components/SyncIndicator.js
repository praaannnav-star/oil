// Sync Status Indicator
export function SyncIndicator({ status = 'online', pendingCount = 0, onClick = null }) {
  const badge = document.createElement('div');
  const normalized = status.toLowerCase();
  badge.className = `sync-indicator sync-${normalized}`;
  if (onClick) {
    badge.style.cursor = 'pointer';
    badge.addEventListener('click', onClick);
  }

  const dot = document.createElement('span');
  dot.className = 'sync-dot';
  badge.appendChild(dot);

  const text = document.createElement('span');
  if (normalized === 'online') {
    text.textContent = 'ONLINE';
  } else if (normalized === 'offline') {
    text.textContent = pendingCount > 0 ? `OFFLINE (${pendingCount} Queued)` : 'OFFLINE (Local)';
  } else if (normalized === 'syncing') {
    text.textContent = `SYNCING (${pendingCount})`;
  } else {
    text.textContent = 'SYNC FAILED';
  }
  badge.appendChild(text);

  return badge;
}
