// Button component
export function Button({ 
  text = '', 
  variant = 'primary', 
  size = '', 
  icon = null, 
  iconRight = null,
  onClick = null, 
  disabled = false,
  type = 'button',
  cls = '',
  id = ''
}) {
  const btn = document.createElement('button');
  btn.type = type;
  btn.className = `btn btn-${variant} ${size ? 'btn-' + size : ''} ${cls}`;
  if (id) btn.id = id;
  if (disabled) {
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
  }

  if (icon) {
    if (typeof icon === 'string') {
      const span = document.createElement('span');
      span.innerHTML = icon;
      btn.appendChild(span.firstElementChild || span);
    } else {
      btn.appendChild(icon);
    }
  }

  if (text) {
    const span = document.createElement('span');
    span.textContent = text;
    btn.appendChild(span);
  }

  if (iconRight) {
    if (typeof iconRight === 'string') {
      const span = document.createElement('span');
      span.innerHTML = iconRight;
      btn.appendChild(span.firstElementChild || span);
    } else {
      btn.appendChild(iconRight);
    }
  }

  if (onClick) {
    btn.addEventListener('click', onClick);
  }

  return btn;
}
