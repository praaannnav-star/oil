// Data Table component with sorting & row click handling
export function Table({ columns = [], data = [], onRowClick = null, emptyMessage = 'No records found' }) {
  const container = document.createElement('div');
  container.className = 'table-container';

  if (!data || data.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'p-5 text-center text-muted';
    empty.textContent = emptyMessage;
    container.appendChild(empty);
    return container;
  }

  const table = document.createElement('table');
  table.className = 'data-table';

  // Thead
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  columns.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.label;
    if (col.width) th.style.width = col.width;
    if (col.align) th.style.textAlign = col.align;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  // Tbody
  const tbody = document.createElement('tbody');
  data.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.dataset.rowIndex = index;

    columns.forEach(col => {
      const td = document.createElement('td');
      if (col.align) td.style.textAlign = col.align;

      if (col.render) {
        const rendered = col.render(row[col.key], row, index);
        if (typeof rendered === 'string') {
          td.innerHTML = rendered;
        } else if (rendered instanceof HTMLElement) {
          td.appendChild(rendered);
        }
      } else {
        td.textContent = row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : '—';
      }
      tr.appendChild(td);
    });

    if (onRowClick) {
      tr.addEventListener('click', () => onRowClick(row, index));
    }

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  container.appendChild(table);
  return container;
}
