// Client-side navigation policy. The API remains the authority for data and
// write permissions; this module keeps the SPA's route decisions consistent.
export function normalizeRoute(route = '/') {
  const [path] = String(route).split('?');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized.replace(/\/+$/, '') || '/';
}

export function routeMatches(pattern, route) {
  const expected = normalizeRoute(pattern).split('/').filter(Boolean);
  const actual = normalizeRoute(route).split('/').filter(Boolean);
  // Reserve named creation routes so they cannot be consumed by a dynamic id.
  if (actual.includes('new') && !expected.includes('new')) return false;
  return expected.length === actual.length && expected.every((part, index) =>
    part.startsWith(':') || part === actual[index]
  );
}

export function canAccessRoute(user, route) {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  const requested = normalizeRoute(route);
  const routes = Array.isArray(user.allowedRoutes) ? user.allowedRoutes : [];
  return routes.some(pattern => routeMatches(pattern, requested));
}

export function getDefaultRoute(user) {
  if (!user) return '/login';
  const preferred = user.homeRoute || '/overview';
  return canAccessRoute(user, preferred) ? preferred : '/overview';
}
