// Skeleton loading placeholders
export function Skeleton({ width = '100%', height = '20px', radius = 'var(--radius-xs)', cls = '' }) {
  const el = document.createElement('div');
  el.className = `skeleton ${cls}`;
  el.style.width = width;
  el.style.height = height;
  el.style.borderRadius = radius;
  return el;
}

export function SkeletonCard() {
  const card = document.createElement('div');
  card.className = 'card gap-3';
  card.appendChild(Skeleton({ width: '40%', height: '24px' }));
  card.appendChild(Skeleton({ width: '100%', height: '16px' }));
  card.appendChild(Skeleton({ width: '80%', height: '16px' }));
  card.appendChild(Skeleton({ width: '60%', height: '32px' }));
  return card;
}
