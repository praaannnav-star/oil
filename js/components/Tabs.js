// Tabs Navigation component
export function Tabs({ tabs = [], activeTab = '', onTabChange = null }) {
  const nav = document.createElement('div');
  nav.className = 'tabs-nav';

  tabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tab-btn ${tab.id === activeTab ? 'active' : ''}`;
    btn.dataset.tabId = tab.id;

    if (tab.icon) {
      const iconSpan = document.createElement('span');
      iconSpan.innerHTML = tab.icon;
      btn.appendChild(iconSpan.firstElementChild || iconSpan);
    }

    const textSpan = document.createElement('span');
    textSpan.textContent = tab.label;
    btn.appendChild(textSpan);

    if (tab.count !== undefined && tab.count !== null) {
      const badge = document.createElement('span');
      badge.className = 'tab-badge';
      badge.textContent = tab.count;
      btn.appendChild(badge);
    }

    btn.addEventListener('click', () => {
      nav.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      if (onTabChange) onTabChange(tab.id);
    });

    nav.appendChild(btn);
  });

  return nav;
}
