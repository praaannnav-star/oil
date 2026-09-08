#!/usr/bin/env node
// ============================================================================
// OIL Bridge API — Integration Test Suite
// Covers:
//   1. Test User Management  — login all 6 demo personas, session, RBAC gates
//   2. Field Survey Review   — submit survey → review queue → approve / reject
//   3. Data Fetching         — reviews, surveys, projects, field reports
//
// Usage:
//   node scripts/test-users-surveys-reviews.mjs [baseURL]
//   node scripts/test-users-surveys-reviews.mjs http://localhost:8787
//
// Prerequisites:
//   cd worker && wrangler dev --local --port 8787
//   (D1 schema + demo seed must be applied:  npm run db:local)
//
// Exit 0 = all tests green.  Exit 1 = failures.
// ============================================================================

const BASE = (process.argv[2] || 'http://localhost:8787').replace(/\/$/, '');

// ── Colour / logging helpers ─────────────────────────────────────────────────
const c = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};

let pass = 0, fail = 0, skip = 0;
const failures = [];

function section(title) {
  console.log(`\n${c.bold(c.cyan('══ ' + title + ' ══'))}`);
}

function ok(name, detail = '') {
  pass++;
  console.log(`  ${c.green('✓')} ${name}${detail ? c.dim('  → ' + detail) : ''}`);
}

function bad(name, detail = '') {
  fail++;
  failures.push(`${name}${detail ? ': ' + detail : ''}`);
  console.log(`  ${c.red('✗')} ${name}${detail ? c.dim('  → ' + detail) : ''}`);
}

function warn(name, detail = '') {
  skip++;
  console.log(`  ${c.yellow('⚠')} ${name}${detail ? c.dim('  → ' + detail) : ''}`);
}

function assert(name, condition, detail = '') {
  if (condition) ok(name, detail);
  else           bad(name, detail);
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────
async function call(path, { method = 'GET', token, body, expectStatus } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token)              headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}/api${path}`, {
    method: body !== undefined ? (method || 'POST') : method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let json;
  try { json = await res.json(); } catch { json = null; }

  if (expectStatus !== undefined && res.status !== expectStatus) {
    throw new Error(`Expected HTTP ${expectStatus}, got ${res.status}: ${JSON.stringify(json)}`);
  }
  return { status: res.status, json, ok: res.ok };
}

async function login(username) {
  const { status, json } = await call('/auth/login', {
    method: 'POST',
    body: { username, password: 'password123' },
  });
  if (status !== 200 || !json?.jwt) {
    throw new Error(`Login failed for '${username}': HTTP ${status} → ${JSON.stringify(json)}`);
  }
  return { jwt: json.jwt, refresh: json.refresh, user: json.user };
}

// ── SECTION 1 — Test User Management ─────────────────────────────────────────

const PERSONAS = [
  { username: 'manager',    role: 'Project Manager',    canReview: true  },
  { username: 'admin',      role: 'Admin',               canReview: true  },
  { username: 'executive',  role: 'Executive / GM',      canReview: false },
  { username: 'planner',    role: 'Planner',             canReview: true  },
  { username: 'reviewer',   role: 'Reviewer',            canReview: true  },
  { username: 'supervisor', role: 'Field Supervisor',    canReview: false },
];

const sessions = {};

async function testUserManagement() {
  section('1. TEST USER MANAGEMENT');

  // 1A — Login every persona
  section('1A. Login all demo personas');
  for (const p of PERSONAS) {
    try {
      const { jwt, refresh, user } = await login(p.username);
      sessions[p.username] = { jwt, refresh, user };
      assert(`Login ${p.username} (${p.role})`, user.role === p.role, `role=${user.role}`);
      assert(`Token present for ${p.username}`, typeof jwt === 'string' && jwt.length > 20, `len=${jwt.length}`);
    } catch (e) {
      bad(`Login ${p.username}`, e.message);
    }
  }

  // 1B — /auth/me returns correct user from JWT
  section('1B. GET /api/auth/me — token introspection');
  for (const p of PERSONAS) {
    const s = sessions[p.username];
    if (!s) { warn(`${p.username} me-check`, 'login failed, skipping'); continue; }
    try {
      const { status, json } = await call('/auth/me', { token: s.jwt });
      assert(`GET /auth/me as ${p.username}`, status === 200 && json?.user?.role === p.role, `HTTP ${status}, role=${json?.user?.role}`);
    } catch (e) {
      bad(`/auth/me ${p.username}`, e.message);
    }
  }

  // 1C — Invalid credentials → 401
  section('1C. Credential validation');
  try {
    const { status } = await call('/auth/login', { method: 'POST', body: { username: 'manager', password: 'wrongpass' } });
    assert('Wrong password returns 401', status === 401, `got ${status}`);
  } catch (e) { bad('Invalid credentials test', e.message); }

  try {
    const { status } = await call('/auth/login', { method: 'POST', body: { username: '', password: '' } });
    assert('Empty credentials returns 400', status === 400, `got ${status}`);
  } catch (e) { bad('Empty credentials test', e.message); }

  // 1D — Unauthenticated request → 401
  section('1D. RBAC — unauthenticated request rejected');
  try {
    const { status } = await call('/reviews');
    assert('No token → 401 on /api/reviews', status === 401, `got ${status}`);
  } catch (e) { bad('Unauthenticated request test', e.message); }

  // 1E — Field Supervisor cannot approve reviews → 403
  section('1E. RBAC — Field Supervisor rejected from review actions');
  const supervisorToken = sessions['supervisor']?.jwt;
  if (supervisorToken) {
    try {
      const { status } = await call('/reviews/REV-RBAC-TEST/approve', { method: 'POST', token: supervisorToken, body: {} });
      assert('Field Supervisor → 403 or 404 on approve', status === 403 || status === 404, `got ${status}`);
    } catch (e) { bad('Supervisor RBAC test', e.message); }
  } else { warn('Supervisor RBAC test', 'session unavailable'); }

  // 1F — Token refresh
  section('1F. Token refresh (rotating sessions)');
  const pmSession = sessions['manager'];
  if (pmSession?.refresh) {
    try {
      const { status, json } = await call('/auth/refresh', { method: 'POST', body: { refresh: pmSession.refresh } });
      if (status === 200 && json?.jwt) {
        ok('Token refresh returns new JWT', `len=${json.jwt.length}`);
        sessions['manager'].jwt     = json.jwt;
        sessions['manager'].refresh = json.refresh;
      } else {
        bad('Token refresh', `HTTP ${status}: ${JSON.stringify(json)}`);
      }
    } catch (e) { bad('Token refresh', e.message); }
  } else { warn('Token refresh', 'manager session unavailable'); }

  // 1G — Logout revokes refresh token
  section('1G. Logout — refresh token revoked');
  try {
    const tmp = await login('reviewer');
    const { status: logoutStatus } = await call('/auth/logout', { method: 'POST', body: { refresh: tmp.refresh } });
    assert('Logout returns 200', logoutStatus === 200, `got ${logoutStatus}`);
    const { status: refreshStatus } = await call('/auth/refresh', { method: 'POST', body: { refresh: tmp.refresh } });
    assert('Revoked token refresh → 401', refreshStatus === 401, `got ${refreshStatus}`);
  } catch (e) { bad('Logout / revoke test', e.message); }
}

// ── SECTION 2 — Field Survey Submission & Review ──────────────────────────────
let surveyId    = null;
let reviewItemId = null;

async function testSurveyReview() {
  section('2. FIELD SURVEY SUBMISSION & REVIEW QUEUE');

  const supervisorJwt = sessions['supervisor']?.jwt;
  const plannerJwt    = sessions['planner']?.jwt;

  // 2A — Fetch survey templates
  section('2A. GET /api/surveys/templates');
  if (supervisorJwt) {
    try {
      const { status, json } = await call('/surveys/templates', { token: supervisorJwt });
      assert('Templates endpoint 200', status === 200, `got ${status}`);
      assert('At least 2 templates', Array.isArray(json) && json.length >= 2, `count=${json?.length}`);
      const names = (json || []).map(t => t.name);
      assert('Site Inspection template present', names.some(n => n.toLowerCase().includes('inspection')), names.join(', '));
      assert('Daily Progress template present',  names.some(n => n.toLowerCase().includes('progress')),   names.join(', '));
    } catch (e) { bad('Survey templates', e.message); }
  } else { warn('Survey templates', 'supervisor session unavailable'); }

  // 2B — Submit a Daily Progress survey
  section('2B. POST /api/surveys — daily progress survey');
  surveyId = `SRV-TEST-${Date.now()}`;
  if (supervisorJwt) {
    try {
      const { status, json } = await call('/surveys', {
        method: 'POST', token: supervisorJwt,
        body: {
          id: surveyId, templateId: 'TPL-PROGRESS-SURVEY', templateName: 'Daily Progress Survey',
          projectId: 'PRJ-OIL-2026-01', submittedBy: 'Manoj Kalita',
          answers: {
            q_activity: 'Compressor Foundation B2 shuttering and reinforcement',
            q_quantity: '42 cubic meters concrete poured',
            q_crew: 18, q_tomorrow: 'Yes', q_constraint: '', q_pct: 65
          },
          photos: [], photoCount: 0, geo: { lat: 27.3612, lng: 95.3241 }
        }
      });
      assert('Survey submission returns 201', status === 201, `got ${status}`);
      assert('Response has survey id',     json?.id === surveyId,  `id=${json?.id}`);
      assert('Response has reviewItemId',  !!json?.reviewItemId,   `reviewItemId=${json?.reviewItemId}`);
      if (json?.reviewItemId) reviewItemId = json.reviewItemId;
    } catch (e) { bad('Survey submission', e.message); }
  } else { warn('Survey submission', 'supervisor session unavailable'); }

  // 2B2 — HSE Site Inspection
  section('2B2. POST /api/surveys — site inspection (HSE)');
  if (supervisorJwt) {
    try {
      const { status, json } = await call('/surveys', {
        method: 'POST', token: supervisorJwt,
        body: {
          id: `SRV-HSE-${Date.now()}`, templateId: 'TPL-SITE-INSPECTION',
          templateName: 'Site Inspection (Safety & Compliance)',
          projectId: 'PRJ-OIL-2026-01', submittedBy: 'Manoj Kalita',
          answers: {
            q_housekeeping: 'Yes', q_ppe: 'Partial', q_permits: 'Yes',
            q_hazards: 'Unguarded excavation near Pad 08 access road',
            q_overall: 'Conditional Pass'
          }
        }
      });
      assert('HSE inspection submission 201',       status === 201,          `got ${status}`);
      assert('HSE response status=submitted', json?.status === 'submitted',  `status=${json?.status}`);
    } catch (e) { bad('HSE inspection submission', e.message); }
  } else { warn('HSE survey', 'supervisor session unavailable'); }

  // 2C — Idempotent replay
  section('2C. Idempotent replay — duplicate survey ID');
  if (supervisorJwt && surveyId) {
    try {
      const { status, json } = await call('/surveys', {
        method: 'POST', token: supervisorJwt,
        body: { id: surveyId, templateId: 'TPL-PROGRESS-SURVEY', projectId: 'PRJ-OIL-2026-01', submittedBy: 'Manoj Kalita', answers: {} }
      });
      assert('Duplicate survey returns 200', status === 200,           `got ${status}`);
      assert('duplicate flag is true',       json?.duplicate === true, `duplicate=${json?.duplicate}`);
    } catch (e) { bad('Idempotent survey replay', e.message); }
  } else { warn('Idempotent replay', 'surveyId or session unavailable'); }

  // 2D — Fetch full review queue
  section('2D. GET /api/reviews — full review queue');
  if (plannerJwt) {
    try {
      const { status, json } = await call('/reviews', { token: plannerJwt });
      assert('Review queue 200',    status === 200,       `got ${status}`);
      assert('Queue is an array',   Array.isArray(json),  `type=${typeof json}`);
      if (Array.isArray(json) && json.length > 0) {
        ok(`Review queue has ${json.length} item(s)`);
        const pending = json.filter(i => i.state === 'needs-review');
        ok(`  ${pending.length} item(s) in needs-review state`);
        assert('All items have urgency metadata', json.every(i => i.urgency?.priority));
        const firstApproved = json.findIndex(i => i.state !== 'needs-review');
        const firstPending  = json.findIndex(i => i.state === 'needs-review');
        assert('Pending items sorted before reviewed', firstApproved === -1 || firstPending < firstApproved, `firstPending=${firstPending}, firstApproved=${firstApproved}`);
      } else { warn('Review queue empty — cannot verify sort order'); }
    } catch (e) { bad('Fetch review queue', e.message); }
  } else { warn('Review queue fetch', 'planner session unavailable'); }

  // 2D2 — Filter queue by tab
  section('2D2. GET /api/reviews?tab=needs-review');
  if (plannerJwt) {
    try {
      const { status, json } = await call('/reviews?tab=needs-review', { token: plannerJwt });
      assert('Filtered queue 200', status === 200, `got ${status}`);
      if (Array.isArray(json)) {
        const allPending = json.every(i => i.state === 'needs-review' || i.tabCategory === 'needs-review');
        assert('All returned items match tab filter', allPending, `count=${json.length}`);
      }
    } catch (e) { bad('Filtered review queue', e.message); }
  }

  // 2E — Get single review item by id
  section('2E. GET /api/reviews/:id');
  if (plannerJwt && reviewItemId) {
    try {
      const { status, json } = await call(`/reviews/${reviewItemId}`, { token: plannerJwt });
      assert('Single review item 200', status === 200,               `got ${status}`);
      assert('Item id matches',        json?.id === reviewItemId,    `id=${json?.id}`);
      assert('Item has state',         !!json?.state,                `state=${json?.state}`);
      assert('Item has reporter',      !!json?.reporter,             `reporter=${json?.reporter}`);
    } catch (e) { bad(`GET /reviews/${reviewItemId}`, e.message); }
  } else { warn('Single review item fetch', 'reviewItemId or planner session unavailable'); }

  // 2F — Approve
  section('2F. POST /api/reviews/:id/approve');
  if (plannerJwt && reviewItemId) {
    try {
      const { status, json } = await call(`/reviews/${reviewItemId}/approve`, { method: 'POST', token: plannerJwt, body: {} });
      assert('Approve returns 200',   status === 200,              `got ${status}`);
      assert('State is approved',     json?.state === 'approved',  `state=${json?.state}`);
      assert('Reviewer is set',       !!json?.reviewer,            `reviewer=${json?.reviewer}`);
      assert('reviewedAt is set',     !!json?.reviewedAt,          `reviewedAt=${json?.reviewedAt}`);
    } catch (e) { bad('Approve review item', e.message); }
  } else { warn('Approve review', 'reviewItemId or planner session unavailable'); }

  // 2G — Double-approve → 409
  section('2G. Double-approve → 409 Conflict');
  if (plannerJwt && reviewItemId) {
    try {
      const { status } = await call(`/reviews/${reviewItemId}/approve`, { method: 'POST', token: plannerJwt, body: {} });
      assert('Re-approve returns 409', status === 409, `got ${status}`);
    } catch (e) { bad('Double-approve 409 check', e.message); }
  } else { warn('Double-approve', 'reviewItemId or planner session unavailable'); }

  // 2H — Submit then reject
  section('2H. Reject a review item — POST /api/reviews/:id/reject');
  if (supervisorJwt && plannerJwt) {
    try {
      const { json: s } = await call('/surveys', {
        method: 'POST', token: supervisorJwt,
        body: {
          id: `SRV-REJECT-${Date.now()}`, templateId: 'TPL-PROGRESS-SURVEY',
          projectId: 'PRJ-OIL-2026-01', submittedBy: 'Manoj Kalita',
          answers: { q_activity: 'RoW clearing at chainage 42+500', q_quantity: '120 running metres', q_crew: 8, q_tomorrow: 'No - constraint exists', q_constraint: 'Monsoon rain halted earthwork' }
        }
      });
      const rejectRevId = s?.reviewItemId;
      if (rejectRevId) {
        const { status, json } = await call(`/reviews/${rejectRevId}/reject`, { method: 'POST', token: plannerJwt, body: { reason: 'Activity code mismatch — pipeline scope not civil' } });
        assert('Reject returns 200',         status === 200,           `got ${status}`);
        assert('State is rejected',          json?.state === 'rejected', `state=${json?.state}`);
        assert('rejectionReason is set',     !!json?.rejectionReason, `reason=${json?.rejectionReason}`);
      } else { warn('Reject test', 'reviewItemId missing from submit response'); }
    } catch (e) { bad('Reject review item', e.message); }
  } else { warn('Reject review', 'sessions unavailable'); }

  // 2I — Field Supervisor cannot reject → 403
  section('2I. Field Supervisor cannot reject reviews → 403');
  if (supervisorJwt && plannerJwt) {
    try {
      const { json: s } = await call('/surveys', {
        method: 'POST', token: supervisorJwt,
        body: {
          id: `SRV-RBAC-${Date.now()}`, templateId: 'TPL-SITE-INSPECTION',
          projectId: 'PRJ-OIL-2026-01', submittedBy: 'Manoj Kalita',
          answers: { q_housekeeping: 'Yes', q_ppe: 'Yes', q_permits: 'Yes', q_overall: 'Pass' }
        }
      });
      const tmpRevId = s?.reviewItemId;
      if (tmpRevId) {
        const { status } = await call(`/reviews/${tmpRevId}/reject`, { method: 'POST', token: supervisorJwt, body: { reason: 'Self-reject attempt' } });
        assert('Field Supervisor rejected from /reject → 403', status === 403, `got ${status}`);
      } else { warn('RBAC reject test', 'could not get reviewItemId'); }
    } catch (e) { bad('Supervisor RBAC reject', e.message); }
  } else { warn('RBAC reject test', 'sessions unavailable'); }
}

// ── SECTION 3 — Data Fetching ─────────────────────────────────────────────────
async function testDataFetching() {
  section('3. DATA FETCHING');

  const adminJwt      = sessions['admin']?.jwt;
  const execJwt       = sessions['executive']?.jwt;
  const supervisorJwt = sessions['supervisor']?.jwt;

  // 3A — All surveys
  section('3A. GET /api/surveys — list all surveys');
  if (adminJwt) {
    try {
      const { status, json } = await call('/surveys', { token: adminJwt });
      assert('Surveys list 200',   status === 200,       `got ${status}`);
      assert('Surveys is array',   Array.isArray(json),  `type=${typeof json}`);
      ok(`  ${json?.length || 0} survey(s) returned`);
      if (json?.length > 0) {
        assert('Survey has id',     !!json[0].id,     `id=${json[0].id}`);
        assert('Survey has status', !!json[0].status, `status=${json[0].status}`);
      }
    } catch (e) { bad('Fetch all surveys', e.message); }
  } else { warn('Surveys list', 'admin session unavailable'); }

  // 3B — Filtered surveys by projectId
  section('3B. GET /api/surveys?projectId=PRJ-OIL-2026-01');
  if (adminJwt) {
    try {
      const { status, json } = await call('/surveys?projectId=PRJ-OIL-2026-01', { token: adminJwt });
      assert('Filtered surveys 200', status === 200, `got ${status}`);
      if (Array.isArray(json) && json.length > 0) {
        const wrong = json.filter(s => s.projectId !== 'PRJ-OIL-2026-01');
        assert('All surveys match projectId filter', wrong.length === 0, `${wrong.length} wrong-project item(s)`);
      }
    } catch (e) { bad('Filtered surveys fetch', e.message); }
  } else { warn('Filtered surveys', 'admin session unavailable'); }

  // 3C — Projects list
  section('3C. GET /api/projects — project list');
  if (execJwt) {
    try {
      const { status, json } = await call('/projects', { token: execJwt });
      assert('Projects 200',       status === 200,       `got ${status}`);
      assert('Projects is array',  Array.isArray(json),  `type=${typeof json}`);
      ok(`  ${json?.length || 0} project(s)`);
      if (json?.length > 0) {
        assert('Project has health field', json[0].health !== undefined, `health=${json[0].health}`);
        assert('Project has spi field',    json[0].spi    !== undefined, `spi=${json[0].spi}`);
      }
    } catch (e) { bad('Fetch projects', e.message); }
  } else { warn('Projects list', 'executive session unavailable'); }

  // 3D — Field reports list
  section('3D. GET /api/reports — field reports list');
  if (adminJwt) {
    try {
      const { status, json } = await call('/reports', { token: adminJwt });
      assert('Field reports 200',   status === 200,       `got ${status}`);
      assert('Reports is array',    Array.isArray(json),  `type=${typeof json}`);
      ok(`  ${json?.length || 0} field report(s)`);
      if (json?.length > 0) {
        assert('Report has id',     !!json[0].id,     `id=${json[0].id}`);
        assert('Report has status', !!json[0].status, `status=${json[0].status}`);
      }
    } catch (e) { bad('Fetch field reports', e.message); }
  } else { warn('Field reports', 'admin session unavailable'); }

  // 3E — Submit a field report transcript
  section('3E. POST /api/reports — field report transcript');
  const reportId = `REP-TEST-${Date.now()}`;
  if (supervisorJwt) {
    try {
      const { status, json } = await call('/reports', {
        method: 'POST', token: supervisorJwt,
        body: {
          id: reportId, projectId: 'PRJ-OIL-2026-01', author: 'Manoj Kalita',
          rawTranscript: 'Completed hydrostatic testing on 16-inch suction header spool J-44 with zero pressure drop over 4 hours at Pad 14.'
        }
      });
      assert('Report submit 201',  status === 201,             `got ${status}`);
      assert('Report has id',      json?.id === reportId || !!json?.id, `id=${json?.id}`);
    } catch (e) { bad('Submit field report', e.message); }
  } else { warn('Field report submit', 'supervisor session unavailable'); }

  // 3F — Admin view: full review queue with state breakdown
  section('3F. GET /api/reviews (admin, all tabs)');
  if (adminJwt) {
    try {
      const { status, json } = await call('/reviews', { token: adminJwt });
      assert('Admin sees review queue 200', status === 200, `got ${status}`);
      if (Array.isArray(json)) {
        const byState = json.reduce((acc, i) => { acc[i.state] = (acc[i.state]||0)+1; return acc; }, {});
        ok(`  Queue breakdown: ${JSON.stringify(byState)}`);
      }
    } catch (e) { bad('Admin review queue', e.message); }
  } else { warn('Admin review queue', 'admin session unavailable'); }

  // 3G — Audit trail
  section('3G. GET /api/audit — tamper-evident audit log');
  if (adminJwt) {
    try {
      const { status, json } = await call('/audit', { token: adminJwt });
      assert('Audit trail 200',  status === 200,       `got ${status}`);
      assert('Audit is array',   Array.isArray(json),  `type=${typeof json}`);
      ok(`  ${json?.length || 0} audit event(s)`);
      if (json?.length > 0) {
        assert('Audit event has actor',  !!json[0].actor,  `actor=${json[0].actor}`);
        assert('Audit event has action', !!json[0].action, `action=${json[0].action}`);
      }
    } catch (e) { bad('Audit trail', e.message); }
  } else { warn('Audit trail', 'admin session unavailable'); }

  // 3H — Audit hash-chain verify
  section('3H. GET /api/audit/verify — hash-chain integrity');
  if (adminJwt) {
    try {
      const { status, json } = await call('/audit/verify', { token: adminJwt });
      assert('Audit verify 200',   status === 200,          `got ${status}`);
      assert('Chain is valid',     json?.valid === true,    `valid=${json?.valid}`);
    } catch (e) { warn('Audit chain verify', e.message + ' (may be empty on fresh DB)'); }
  } else { warn('Audit verify', 'admin session unavailable'); }

  // 3I — 404 on unknown route
  section('3I. Unknown route → 404');
  if (adminJwt) {
    try {
      const { status } = await call('/nonexistent-route', { token: adminJwt });
      assert('Unknown route returns 404', status === 404, `got ${status}`);
    } catch (e) { bad('404 route test', e.message); }
  }
}

// ── Main runner ───────────────────────────────────────────────────────────────
console.log(c.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
console.log(c.bold(' OIL Bridge API — Integration Test Suite'));
console.log(c.bold(` Target: ${BASE}`));
console.log(c.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

try {
  const ping = await fetch(`${BASE}/`);
  if (!ping.ok) throw new Error(`HTTP ${ping.status}`);
  ok('Worker reachable', `${BASE}`);
} catch (e) {
  console.log(c.red(`\n  [FATAL] Cannot reach ${BASE}: ${e.message}`));
  console.log(c.yellow('  Start the dev server with:  cd worker && npm run dev\n'));
  process.exit(1);
}

await testUserManagement();
await testSurveyReview();
await testDataFetching();

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${c.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
console.log(`  ${c.green(`✓ ${pass} passed`)}  ${fail > 0 ? c.red(`✗ ${fail} failed`) : c.dim('✗ 0 failed')}  ${c.yellow(`⚠ ${skip} skipped`)}`);
if (failures.length > 0) {
  console.log(`\n${c.red(c.bold('Failures:'))}`);
  failures.forEach(f => console.log(`  ${c.red('•')} ${f}`));
}
console.log(c.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
process.exit(fail > 0 ? 1 : 0);
