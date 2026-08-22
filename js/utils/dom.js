// Shared XSS-safe DOM interpolation helpers.
// Use escapeHtml() for ANY string of service/user origin interpolated into
// innerHTML template literals. Static developer-authored markup does not need it.

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
