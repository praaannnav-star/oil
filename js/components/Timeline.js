// Timeline Component for Audit Logs & History
export function Timeline({ events = [], renderDetail = null }) {
  const container = document.createElement('div');
  container.className = 'timeline';

  if (!events || events.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-muted text-sm p-3';
    empty.textContent = 'No timeline events recorded.';
    container.appendChild(empty);
    return container;
  }

  events.forEach(event => {
    const item = document.createElement('div');
    item.className = 'timeline-item';

    const dot = document.createElement('div');
    dot.className = 'timeline-dot';
    item.appendChild(dot);

    const content = document.createElement('div');
    content.className = 'timeline-content';

    const header = document.createElement('div');
    header.className = 'd-flex justify-between items-center';

    const action = document.createElement('strong');
    action.className = 'text-sm text-primary';
    action.textContent = event.action || event.title;
    header.appendChild(action);

    const time = document.createElement('span');
    time.className = 'text-xs text-muted font-mono';
    time.textContent = event.timestamp || event.time || 'Just now';
    header.appendChild(time);

    content.appendChild(header);

    if (event.actor) {
      const actor = document.createElement('div');
      actor.className = 'text-xs text-secondary';
      actor.textContent = `By ${event.actor} (${event.role || 'Site Staff'})`;
      content.appendChild(actor);
    }

    if (event.detail) {
      const detail = document.createElement('div');
      detail.className = 'text-sm text-primary mt-1';
      detail.textContent = event.detail;
      content.appendChild(detail);
    }

    if (renderDetail) {
      const custom = renderDetail(event);
      if (custom) content.appendChild(custom);
    }

    item.appendChild(content);
    container.appendChild(item);
  });

  return container;
}
