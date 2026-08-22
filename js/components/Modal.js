import { Button } from './Button.js';
import { Icons } from './Icons.js';

export function Modal({ title, body, footer = null, onClose }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');

  const content = document.createElement('div');
  content.className = 'modal-content';

  // Header
  const header = document.createElement('div');
  header.className = 'modal-header';

  const titleEl = document.createElement('h3');
  titleEl.className = 'card-title';
  titleEl.textContent = title;
  header.appendChild(titleEl);

  const closeBtn = Button({
    icon: Icons.x(),
    variant: 'ghost',
    size: 'sm',
    onClick: () => {
      document.body.removeChild(backdrop);
      if (onClose) onClose();
    }
  });
  header.appendChild(closeBtn);
  content.appendChild(header);

  // Body
  const bodyEl = document.createElement('div');
  bodyEl.className = 'modal-body';
  if (typeof body === 'string') {
    bodyEl.innerHTML = body;
  } else if (body instanceof HTMLElement) {
    bodyEl.appendChild(body);
  }
  content.appendChild(bodyEl);

  // Footer
  if (footer) {
    const footerEl = document.createElement('div');
    footerEl.className = 'modal-footer';
    if (Array.isArray(footer)) {
      footer.forEach(item => footerEl.appendChild(item));
    } else {
      footerEl.appendChild(footer);
    }
    content.appendChild(footerEl);
  }

  backdrop.appendChild(content);

  // Backdrop click
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      document.body.removeChild(backdrop);
      if (onClose) onClose();
    }
  });

  document.body.appendChild(backdrop);

  return {
    close: () => {
      if (document.body.contains(backdrop)) {
        document.body.removeChild(backdrop);
      }
      if (onClose) onClose();
    }
  };
}
