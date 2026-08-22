import { Button } from './Button.js';

export function EmptyState({ icon = '📋', title = 'No data available', description = '', actionText = '', onAction = null }) {
  const container = document.createElement('div');
  container.className = 'd-flex flex-col items-center justify-center p-5 text-center gap-3';
  container.style.minHeight = '240px';

  const iconEl = document.createElement('div');
  iconEl.style.fontSize = '2.5rem';
  iconEl.innerHTML = icon;
  container.appendChild(iconEl);

  const titleEl = document.createElement('h4');
  titleEl.className = 'text-md font-bold text-primary';
  titleEl.textContent = title;
  container.appendChild(titleEl);

  if (description) {
    const descEl = document.createElement('p');
    descEl.className = 'text-sm text-secondary';
    descEl.style.maxWidth = '400px';
    descEl.textContent = description;
    container.appendChild(descEl);
  }

  if (actionText && onAction) {
    const btn = Button({
      text: actionText,
      variant: 'primary',
      size: 'sm',
      onClick: onAction
    });
    container.appendChild(btn);
  }

  return container;
}
