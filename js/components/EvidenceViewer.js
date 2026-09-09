import { Modal } from './Modal.js';
import { Icons } from './Icons.js';
import { escapeHtml } from '../utils/dom.js';

export function EvidenceViewer({ items = [], onAdd = null }) {
  const container = document.createElement('div');
  container.className = 'd-flex flex-col gap-3';

  if (!items || items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'p-4 text-center text-muted text-sm rounded';
    empty.style.background = 'var(--color-surface)';
    empty.style.border = '1px dashed var(--color-border)';
    empty.textContent = 'No evidence files attached.';
    container.appendChild(empty);
    return container;
  }

  const grid = document.createElement('div');
  grid.className = 'd-grid grid-3 gap-3';

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card p-2 gap-2';
    card.style.background = 'var(--color-surface-el)';
    card.style.cursor = 'pointer';

    // Thumbnail
    const thumbBox = document.createElement('div');
    thumbBox.style.height = '120px';
    thumbBox.style.borderRadius = 'var(--radius-sm)';
    thumbBox.style.overflow = 'hidden';
    thumbBox.style.background = '#000';
    thumbBox.style.display = 'flex';
    thumbBox.style.alignItems = 'center';
    thumbBox.style.justifyContent = 'center';

    if (item.url) {
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = item.filename || 'Evidence Photo';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      thumbBox.appendChild(img);
    } else {
      thumbBox.innerHTML = Icons.camera('text-muted');
    }
    card.appendChild(thumbBox);

    // Meta
    const meta = document.createElement('div');
    meta.className = 'd-flex flex-col gap-1';
    meta.innerHTML = `
      <span class="text-xs font-semibold text-primary truncate">${escapeHtml(item.filename || 'Photo Evidence')}</span>
      <span class="text-xs text-muted font-mono">${escapeHtml(item.createdAt || 'Today')} • ${escapeHtml(item.uploadedBy || 'Site Eng.')}</span>
      ${item.locationMeta ? `<span class="text-xs text-info truncate">📍 ${escapeHtml(item.locationMeta)}</span>` : ''}
    `;
    card.appendChild(meta);

    // Click to expand
    card.addEventListener('click', () => {
      const previewEl = document.createElement('div');
      previewEl.className = 'd-flex flex-col gap-3';

      if (item.url) {
        const fullImg = document.createElement('img');
        fullImg.src = item.url;
        fullImg.style.maxHeight = '420px';
        fullImg.style.width = '100%';
        fullImg.style.objectFit = 'contain';
        fullImg.style.borderRadius = 'var(--radius-sm)';
        previewEl.appendChild(fullImg);
      }

      const metaBox = document.createElement('div');
      metaBox.className = 'card p-3 gap-1';
      metaBox.innerHTML = `
        <div class="text-sm font-bold text-primary">${escapeHtml(item.filename || 'Site Evidence Photo')}</div>
        <div class="text-xs text-secondary">Uploaded by: <strong>${escapeHtml(item.uploadedBy || 'Field Supervisor')}</strong></div>
        <div class="text-xs text-secondary">Timestamp: <strong>${escapeHtml(item.createdAt || 'N/A')}</strong></div>
        <div class="text-xs text-secondary">Activity Link: <strong>${escapeHtml(item.activityName || 'CIV-B2-003')}</strong></div>
        ${item.locationMeta ? `<div class="text-xs text-info">Geo-tag: <strong>${escapeHtml(item.locationMeta)}</strong></div>` : ''}
      `;
      previewEl.appendChild(metaBox);

      const actionsBox = document.createElement('div');
      actionsBox.className = 'd-flex justify-end gap-2 mt-2';
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger btn-sm';
      deleteBtn.textContent = 'Delete Evidence';
      deleteBtn.onclick = async () => {
        if (confirm('Are you sure you want to delete this evidence?')) {
          deleteBtn.textContent = 'Deleting...';
          deleteBtn.disabled = true;
          const { EvidenceService } = await import('../services/evidence.js');
          await EvidenceService.deleteEvidence(item.id);
          modalInstance.close();
          card.remove(); // Removes from grid
          
          // If grid is empty after removal
          if (grid.children.length === 0) {
            grid.parentElement.innerHTML = '<div class="p-4 text-center text-muted text-sm rounded" style="background:var(--color-surface); border:1px dashed var(--color-border);">No evidence files attached.</div>';
          }
        }
      };
      
      actionsBox.appendChild(deleteBtn);
      previewEl.appendChild(actionsBox);

      const modalInstance = Modal({
        title: 'Evidence Detail & Verification',
        body: previewEl
      });
    });

    grid.appendChild(card);
  });

  container.appendChild(grid);
  return container;
}
