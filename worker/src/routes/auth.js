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
  { id: 'USR-PM-01', username: 'manager', name: 'Nandita Das', title: 'Project Manager, Capital Projects', role: 'Project Manager', department: 'Projects Delivery Division', avatar: '👷', allowedRoutes: ['/overview', '/manager', '/projects', '/projects/new', '/projects/:id', '/projects/:id/edit', '/schedule', '/activities/:id', '/review', '/surveys', '/ingest', '/evidence', '/analytics', '/memory', '/audit', '/progress', '/progress/new'] },
  { id: 'USR-ADMIN-01', username: 'admin', name: 'Sanjeev Sarmah', title: 'Chief General Manager & System Admin', role: 'Admin', department: 'Corporate IT & Operations Control', avatar: '👨‍💼', allowedRoutes: ['/overview', '/projects', '/projects/:id', '/schedule', '/activities/:id', '/progress', '/progress/new', '/review', '/surveys', '/ingest', '/evidence', '/analytics', '/memory', '/audit'] },
  { id: 'USR-EXEC-01', username: 'executive', name: 'Dr. Ranjit Bora', title: 'Director (Operations & Projects)', role: 'Executive / GM', department: 'Executive Directorate — Duliajan', avatar: '👔', allowedRoutes: ['/overview', '/projects', '/projects/:id', '/schedule', '/activities/:id', '/evidence', '/analytics', '/memory', '/audit', '/progress', '/progress/new', '/ingest'] },
  { id: 'USR-PLAN-01', username: 'planner', name: 'Rajesh Baruah', title: 'Lead Schedule & Planning Engineer', role: 'Planner', department: 'Planning & Project Controls Division', avatar: '📐', allowedRoutes: ['/overview', '/projects', '/projects/:id', '/schedule', '/activities/:id', '/review', '/surveys', '/ingest', '/evidence', '/analytics', '/memory', '/audit', '/progress', '/progress/new'] },
  { id: 'USR-REV-01', username: 'reviewer', name: 'Ananya Dutta', title: 'Senior QA / QC Review Engineer', role: 'Reviewer', department: 'Quality Assurance & Inspection Bureau', avatar: '🔍', allowedRoutes: ['/overview', '/schedule', '/activities/:id', '/review', '/surveys', '/ingest', '/evidence', '/audit', '/progress', '/progress/new'] },
  { id: 'USR-FIELD-01', username: 'supervisor', name: 'Manoj Kalita', title: 'Resident Field Engineer & Site Supervisor', role: 'Field Supervisor', department: 'Field Operations & Construction — Rig 04', avatar: '👷‍♂️', allowedRoutes: ['/overview', '/projects', '/projects/:id', '/progress', '/progress/new', '/surveys', '/ingest', '/evidence', '/activities/:id'] }
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
  const stmt = db.prepare(
    `INSERT INTO users (id, username, password_hash, name, title, role, department, avatar, allowed_routes_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET allowed_routes_json = excluded.allowed_routes_json`
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
  },
  {
    method: 'GET',
    pattern: '/api/users',
    opts: { auth: true },
    async handler({ user, db }) {
      if (user.role !== 'Admin') return err(403, 'Admin access required');
      const { results } = await db.prepare('SELECT * FROM users ORDER BY name ASC').all();
      return json((results || []).map(toClientUser));
    }
  },
  {
    method: 'POST',
    pattern: '/api/users',
    opts: { auth: true },
    async handler({ user, body, db }) {
      if (user.role !== 'Admin') return err(403, 'Admin access required');
      const username = String(body?.username || '').trim().toLowerCase();
      const password = String(body?.password || '');
      const name = String(body?.name || '').trim();
      const role = String(body?.role || 'Field Supervisor').trim();
      const title = String(body?.title || '').trim();
      const department = String(body?.department || 'Operations').trim();
      const avatar = String(body?.avatar || (role.includes('Supervisor') ? '👷‍♂️' : role.includes('Manager') ? '👷' : role.includes('Admin') ? '👨‍💼' : '📐')).trim();
      const allowedRoutes = Array.isArray(body?.allowedRoutes) ? body.allowedRoutes : [];

      if (!username || !password || !name) {
        return err(400, 'Username, password, and full name are required');
      }
      if (password.length < 6) {
        return err(400, 'Password must be at least 6 characters long');
      }

      const existing = await db.prepare('SELECT id FROM users WHERE lower(username) = ?').bind(username).first();
      if (existing) {
        return err(409, `Username "${username}" is already taken`);
      }

      const hash = await hashPassword(password);
      const rolePrefix = role.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'USER';
      const id = `USR-${rolePrefix}-${Date.now().toString().slice(-4)}`;

      await db.prepare(
        `INSERT INTO users (id, username, password_hash, name, title, role, department, avatar, allowed_routes_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, username, hash, name, title, role, department, avatar, JSON.stringify(allowedRoutes)
      ).run();

      const created = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
      return json(toClientUser(created), 201);
    }
  },
  {
    method: 'PATCH',
    pattern: '/api/users/:id',
    opts: { auth: true },
    async handler({ user, params, body, db }) {
      if (user.role !== 'Admin') return err(403, 'Admin access required');
      const target = await db.prepare('SELECT * FROM users WHERE id = ?').bind(params.id).first();
      if (!target) return err(404, 'User not found');

      const name = body?.name !== undefined ? String(body.name).trim() : target.name;
      const title = body?.title !== undefined ? String(body.title).trim() : target.title;
      const role = body?.role !== undefined ? String(body.role).trim() : target.role;
      const department = body?.department !== undefined ? String(body.department).trim() : target.department;
      const avatar = body?.avatar !== undefined ? String(body.avatar).trim() : target.avatar;
      const allowedRoutes = Array.isArray(body?.allowedRoutes) ? body.allowedRoutes : JSON.parse(target.allowed_routes_json || '[]');

      let hash = target.password_hash;
      if (body?.password && String(body.password).trim().length > 0) {
        const pass = String(body.password).trim();
        if (pass.length < 6) return err(400, 'New password must be at least 6 characters long');
        hash = await hashPassword(pass);
      }

      await db.prepare(
        `UPDATE users SET name = ?, title = ?, role = ?, department = ?, avatar = ?, allowed_routes_json = ?, password_hash = ? WHERE id = ?`
      ).bind(
        name, title, role, department, avatar, JSON.stringify(allowedRoutes), hash, params.id
      ).run();

      const updated = await db.prepare('SELECT * FROM users WHERE id = ?').bind(params.id).first();
      return json(toClientUser(updated));
    }
  },
  {
    method: 'DELETE',
    pattern: '/api/users/:id',
    opts: { auth: true },
    async handler({ user, params, db }) {
      if (user.role !== 'Admin') return err(403, 'Admin access required');
      if (user.sub === params.id) return err(400, 'Cannot delete your own active administrator account');

      const target = await db.prepare('SELECT * FROM users WHERE id = ?').bind(params.id).first();
      if (!target) return err(404, 'User not found');

      // Revoke sessions
      await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(params.id).run();
      // Clean up project assignments if any
      await db.prepare('DELETE FROM project_assignments WHERE user_id = ?').bind(params.id).run();
      // Delete user
      await db.prepare('DELETE FROM users WHERE id = ?').bind(params.id).run();

      return json({ ok: true, deleted: params.id });
    }
  }
];
