// Toast notification manager
class ToastManager {
  constructor() {
    this.container = null;
  }

  ensureContainer() {
    if (!this.container || !document.body.contains(this.container)) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      document.body.appendChild(this.container);
    }
  }

  show({ message, type = 'info', duration = 3500 }) {
    this.ensureContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const iconSpan = document.createElement('span');
    if (type === 'success') iconSpan.textContent = '✓';
    else if (type === 'error') iconSpan.textContent = '✕';
    else if (type === 'warning') iconSpan.textContent = '⚠';
    else iconSpan.textContent = 'ℹ';
    
    const msgSpan = document.createElement('span');
    msgSpan.className = 'flex-1';
    msgSpan.textContent = message;

    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 200ms ease-out';
      setTimeout(() => {
        if (this.container && this.container.contains(toast)) {
          this.container.removeChild(toast);
        }
      }, 200);
    }, duration);
  }

  success(msg, duration) { this.show({ message: msg, type: 'success', duration }); }
  error(msg, duration) { this.show({ message: msg, type: 'error', duration }); }
  danger(msg, duration) { this.error(msg, duration); }
  info(msg, duration) { this.show({ message: msg, type: 'info', duration }); }
  warning(msg, duration) { this.show({ message: msg, type: 'warning', duration }); }
}

export const Toast = new ToastManager();
