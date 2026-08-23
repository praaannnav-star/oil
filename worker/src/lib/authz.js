// Request auth context: Bearer JWT verification, refresh-token issuance,
// RBAC gate. Route permissions live in the JWT claim (plan §3) — the client
// router guard stays a UI convenience only.
import { verifyJwt } from './jwt.js';
import { HttpError } from './http.js';

export function bearerToken(request) {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

export async function requireAuth(request, env) {
  const payload = await verifyJwt(bearerToken(request), env.JWT_SECRET);
  if (!payload) throw new HttpError(401, 'Authentication required');
  return payload; // { sub, username, name, role, allowedRoutes }
}

const ROLE_RANK = {
  'Field Supervisor': 0,
  'Reviewer': 1,
  'Planner': 2,
  'Project Manager': 3,
  'Executive / GM': 4,
  'Admin': 5
};

export function requireRole(user, minimumRole) {
  const have = ROLE_RANK[user.role] ?? -1;
  const need = ROLE_RANK[minimumRole] ?? 99;
  if (have < need) throw new HttpError(403, `Role "${user.role}" is not permitted to perform this action`);
}

// Write actions (submit reports/surveys/evidence) require any signed-in user;
// review actions require Reviewer rank or above — mirrors client RBAC gates.
export function canReview(user) {
  return ['Admin', 'Executive / GM', 'Project Manager', 'Planner', 'Reviewer'].includes(user.role);
}
