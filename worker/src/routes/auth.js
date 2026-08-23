// POST /api/auth/login    {username,password} -> {jwt, refresh, user}
// POST /api/auth/refresh  {refresh}           -> {jwt, refresh}   (rotating)
// POST /api/auth/logout   {refresh}           -> {ok:true}        (revokes row)
// GET  /api/auth/me                           -> {user}
import { json, err } from '../lib/http.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signJwt } from '../lib/jwt.js';
import { canReview } from '../lib/authz.js';

// Demo personas seeded on first boot when DEMO_MODE=1 (plan D4 default).
const DEMO_USERS = [
  { id: 'USR-PM-01', username: 'manager', name: 'Nandita Das', title: 'Project Manager, Capital Projects', role: 'Project Manager', department: 'Projects Delivery Division', avatar: '👷', allowedRoutes: ['/overview', '/manager', '/projects', '/projects/new', '/projects/:id', '/projects/:id/edit', '/schedule', '/activities/:id', '/review', '/surveys', '/evidence', '/analytics', '/memory', '/audit'] },
  { id: 'USR-ADMIN-01', username: 'admin', name: 'Sanjeev Sarmah', title: 'Chief General Manager & System Admin', role: 'Admin', department: 'Corporate IT & Operations Control', avatar: '👨‍💼', allowedRoutes: ['/overview', '/projects', '/projects/:id', '/schedule', '/activities/:id', '/progress', '/progress/new', '/review', '/surveys', '/evidence', '/analytics', '/memory', '/audit'] },
  { id: 'USR-EXEC-01', username: 'executive', name: 'Dr. Ranjit Bora', title: 'Director (Operations & Projects)', role: 'Executive / GM', department: 'Executive Directorate — Duliajan', avatar: '👔', allowedRoutes: ['/overview', '/projects', '/projects/:id', '/schedule', '/activities/:id', '/evidence', '/analytics', '/memory', '/audit'] },
  { id: 'USR-PLAN-01', username: 'planner', name: 'Rajesh Baruah', title: 'Lead Schedule & Planning Engineer', role: 'Planner', department: 'Planning & Project Controls Division', avatar: '📐', allowedRoutes: ['/overview', '/projects', '/projects/:id', '/schedule', '/activities/:id', '/review', '/surveys', '/evidence', '/analytics', '/memory', '/audit'] },
  { id: 'USR-REV-01', username: 'reviewer', name: 'Ananya Dutta', title: 'Senior QA / QC Review Engineer', role: 'Reviewer', department: 'Quality Assurance & Inspection Bureau', avatar: '🔍', allowedRoutes: ['/overview', '/schedule', '/activities/:id', '/review', '/surveys', '/evidence', '/audit'] },
  { id: 'USR-FIELD-01', username: 'supervisor', name: 'Manoj Kalita', title: 'Resident Field Engineer & Site Supervisor', role: 'Field Supervisor', department: 'Field Operations & Construction — Rig 04', avatar: '👷‍♂️', allowedRoutes: ['/overview', '/progress', '/progress/new', '/surveys', '/evidence', '/activities/:id'] }
];

export function toClientUser(u) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    title: u.title,
    role: u.role,
    department: u.department,
    avatar: u.avatar,
    allowedRoutes: JSON.parse(u.allowed_routes_json || '[]'),
    canReview: canReview({ role: u.role })
  };
}

async function ensureDemoSeed(db, env) {
  if (String(env.DEMO_MODE) !== '1') return;
  const row = await db.prepare('SELECT COUNT(*) AS n FROM users').first();
  if (row && Number(row.n) > 0) return;
  const stmt = db.prepare(
    `INSERT INTO users (id, username, password_hash, name, title, role, department, avatar, allowed_routes_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const hash = await hashPassword('password123');
  await db.batch(DEMO_USERS.map(u => stmt.bind(
    u.id, u.username, hash, u.name, u.title, u.role, u.department, u.avatar, JSON.stringify(u.allowedRoutes)
  )));
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function issueTokens(db, env, user) {
  const jwt = await signJwt(
    {
      sub: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      allowedRoutes: JSON.parse(user.allowed_routes_json || '[]')
    },
    env.JWT_SECRET,
    Number(env.ACCESS_TTL_SECONDS || 900)
  );
  // Rotating refresh token — previous rows are revoked at refresh time.
  const refresh = randomToken();
  const expiresAt = new Date(Date.now() + Number(env.REFRESH_TTL_DAYS || 30) * 86400000).toISOString();
  await db
    .prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(refresh, user.id, expiresAt)
    .run();
  return { jwt, refresh };
}

export default [
  {
    method: 'POST',
    pattern: '/api/auth/login',
    async handler({ body, db, env }) {
      const username = String(body?.username || '').trim().toLowerCase();
      const password = String(body?.password || '');
      if (!username || !password) return err(400, 'username and password are required');

      await ensureDemoSeed(db, env);

      const user = await db.prepare('SELECT * FROM users WHERE lower(username) = ?').bind(username).first();
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        return err(401, 'Invalid username or password');
      }
      const tokens = await issueTokens(db, env, user);
      return json({ ...tokens, user: toClientUser(user) });
    }
  },
  {
    method: 'POST',
    pattern: '/api/auth/refresh',
    async handler({ body, db, env }) {
      const refresh = String(body?.refresh || '');
      if (!refresh) return err(400, 'refresh token required');
      const session = await db.prepare('SELECT * FROM sessions WHERE token = ? AND revoked = 0').bind(refresh).first();
      if (!session || new Date(session.expires_at).getTime() < Date.now()) {
        return err(401, 'Refresh session expired or revoked');
      }
      const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first();
      if (!user) return err(401, 'User no longer exists');
      // Rotation: revoke old row, issue a fresh pair.
      await db.prepare('UPDATE sessions SET revoked = 1 WHERE token = ?').bind(refresh).run();
      const tokens = await issueTokens(db, env, user);
      return json(tokens);
    }
  },
  {
    method: 'POST',
    pattern: '/api/auth/logout',
    async handler({ body, db }) {
      const refresh = String(body?.refresh || '');
      if (refresh) {
        await db.prepare('UPDATE sessions SET revoked = 1 WHERE token = ?').bind(refresh).run();
      }
      return json({ ok: true });
    }
  },
  {
    method: 'GET',
    pattern: '/api/auth/me',
    opts: { auth: true },
    async handler({ user, db }) {
      const fresh = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.sub).first();
      return json({ user: fresh ? toClientUser(fresh) : null });
    }
  }
];
