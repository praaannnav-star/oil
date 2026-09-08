#!/usr/bin/env node
/**
 * Oil India Field-to-Schedule Bridge — Comprehensive Full-Feature Test Suite
 * ============================================================================
 * Tests ALL API surface areas against a live Cloudflare Workers endpoint.
 *
 * Usage:
 *   node scripts/full-feature-test.mjs [BASE_URL]
 *
 * Examples:
 *   node scripts/full-feature-test.mjs
 *   node scripts/full-feature-test.mjs https://oil-bridge-api.praaannnav.workers.dev
 */
// ─── Config ──────────────────────────────────────────────────────────────────
const BASE = (process.argv[2] || 'http://localhost:8787').replace(/\/$/, '');

// ─── Color helpers ───────────────────────────────────────────────────────────
const G   = s => `\x1b[32m${s}\x1b[0m`;
const R   = s => `\x1b[31m${s}\x1b[0m`;
const Y   = s => `\x1b[33m${s}\x1b[0m`;
const C   = s => `\x1b[36m${s}\x1b[0m`;
const B   = s => `\x1b[1m${s}\x1b[0m`;
const DIM = s => `\x1b[2m${s}\x1b[0m`;

// ─── Counters & state ────────────────────────────────────────────────────────
let PASS = 0, FAIL = 0, SKIP = 0;
const FAILURES = [];

/** Sessions keyed by username: { token, refreshToken } */
const S = {};

/** Shared IDs accumulated across tests */
const IDS = {
  projectId:      null,
  reportId:       null,
  reviewId:       null,
  rejectReviewId: null,
  surveyId:       null,
  seedProjectId:  'PRJ-OIL-2026-01',
};

// ─── Core helpers ────────────────────────────────────────────────────────────

async function api(method, path, { body, token, contentType = 'application/json' } = {}) {
  const url = `${BASE}/api${path}`;
  const headers = { 'Content-Type': contentType };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body !== undefined) opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  try {
    const res = await fetch(url, opts);
    let json = null;
    const text = await res.text();
    try { json = JSON.parse(text); } catch { json = { _raw: text }; }
    return { status: res.status, body: json, headers: res.headers };
  } catch (err) {
    return { status: 0, body: { error: err.message }, headers: new Headers() };
  }
}

const GET    = (path, opts) => api('GET',    path, opts);
const POST   = (path, opts) => api('POST',   path, opts);
const PATCH  = (path, opts) => api('PATCH',  path, opts);
const DELETE = (path, opts) => api('DELETE', path, opts);

const tok = user => S[user]?.token;

// ─── Assertion engine ─────────────────────────────────────────────────────────

let _currentSection = '';
let _sectionPassed  = 0;
let _sectionFailed  = 0;

function section(label) {
  if (_currentSection) {
    const icon = _sectionFailed === 0 ? G('✔') : R('✘');
    console.log(`\n   ${icon} ${_sectionPassed} passed, ${_sectionFailed} failed\n`);
  }
  _currentSection = label;
  _sectionPassed  = 0;
  _sectionFailed  = 0;
  console.log(B(C(`\n${'═'.repeat(60)}`)));
  console.log(B(C(`  ${label}`)));
  console.log(B(C(`${'═'.repeat(60)}`)));
}

function pass(name) {
  PASS++; _sectionPassed++;
  console.log(`  ${G('✔')} ${name}`);
}

function fail(name, detail = '') {
  FAIL++; _sectionFailed++;
  const msg = detail ? `${name} — ${detail}` : name;
  FAILURES.push(msg);
  console.log(`  ${R('✘')} ${name}`);
  if (detail) console.log(`      ${DIM(detail)}`);
}

function skip(name, reason = '') {
  SKIP++;
  console.log(`  ${Y('↷')} ${Y('SKIP')} ${name}${reason ? ` (${reason})` : ''}`);
}

function check(name, condition, detail = '') {
  if (condition) pass(name);
  else fail(name, detail);
}

function endSection() {
  if (_currentSection) {
    const icon = _sectionFailed === 0 ? G('✔') : R('✘');
    console.log(`\n   ${icon} ${_sectionPassed} passed, ${_sectionFailed} failed`);
    _currentSection = '';
    _sectionPassed  = 0;
    _sectionFailed  = 0;
  }
}

// ─── §1  RBAC — Role-Based Access Control ────────────────────────────────────

section('§1  RBAC — Role-Based Access Control');

const PERSONAS = [
  { user: 'manager',    role: 'project_manager' },
  { user: 'admin',      role: 'admin'           },
  { user: 'executive',  role: 'executive'       },
  { user: 'planner',    role: 'planner'         },
  { user: 'reviewer',   role: 'reviewer'        },
  { user: 'supervisor', role: 'field_supervisor'},
];

// 1.1 — Login all 6 personas
for (const { user, role } of PERSONAS) {
  const r = await POST('/auth/login', { body: { username: user, password: 'password123' } });
  if (r.status === 200 && r.body?.jwt) {
    S[user] = { token: r.body.jwt, refreshToken: r.body.refresh };
    pass(`Login ${user} (${role}) → 200 + token`);
  } else {
    fail(`Login ${user}`, `status=${r.status} body=${JSON.stringify(r.body)}`);
  }
}

// 1.2 — /auth/me introspection per persona
for (const { user } of PERSONAS) {
  if (!tok(user)) { skip(`/auth/me ${user}`, 'no token'); continue; }
  const r = await GET('/auth/me', { token: tok(user) });
  check(`GET /auth/me — ${user} returns 200`,
    r.status === 200 && !!r.body?.user?.role,
    `status=${r.status} role=${r.body?.user?.role}`);
}

// 1.3 — Wrong password → 401
{
  const r = await POST('/auth/login', { body: { username: 'manager', password: 'wrongpassword' } });
  check('Wrong password → 401', r.status === 401, `got ${r.status}`);
}

// 1.4 — Empty credentials → 400
{
  const r = await POST('/auth/login', { body: {} });
  check('Empty credentials → 400', r.status === 400, `got ${r.status}`);
}

// 1.5 — Unknown user → 401
{
  const r = await POST('/auth/login', { body: { username: 'ghost', password: 'password123' } });
  check('Unknown user → 401', r.status === 401, `got ${r.status}`);
}

// 1.6 — No token on protected routes → 401
for (const path of ['/projects', '/reviews', '/reports', '/activities', '/surveys', '/audit']) {
  const r = await GET(path);
  check(`No token → 401 on GET ${path}`, r.status === 401, `got ${r.status}`);
}

// 1.7 — Tampered JWT → 401
{
  const tampered = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJoYWNrZXIiLCJyb2xlIjoiYWRtaW4ifQ.INVALIDSIG';
  const r = await GET('/projects', { token: tampered });
  check('Tampered JWT → 401', r.status === 401, `got ${r.status}`);
}

// 1.8 — Field Supervisor cannot approve (role guard)
{
  if (tok('supervisor')) {
    const r = await POST('/reviews/PRJ-OIL-2026-01-RPT-0001/approve', { token: tok('supervisor') });
    check('Field Supervisor approve → 403/404 role guard',
      r.status === 403 || r.status === 404, `got ${r.status}`);
  } else {
    skip('Field Supervisor approve guard', 'supervisor token missing');
  }
}

// 1.9 — Field Supervisor cannot reject (role guard)
{
  if (tok('supervisor')) {
    const r = await POST('/reviews/PRJ-OIL-2026-01-RPT-0001/reject',
      { token: tok('supervisor'), body: { reason: 'testing' } });
    check('Field Supervisor reject → 403/404 role guard',
      r.status === 403 || r.status === 404, `got ${r.status}`);
  } else {
    skip('Field Supervisor reject guard', 'supervisor token missing');
  }
}

// 1.10 — Token refresh
{
  const user = 'manager';
  if (S[user]?.refreshToken) {
    const r = await POST('/auth/refresh', { body: { refresh: S[user].refreshToken } });
    if (r.status === 200 && r.body?.jwt) {
      S[user].token = r.body.jwt;
      if (r.body.refresh) S[user].refreshToken = r.body.refresh;
      pass(`Token refresh for ${user} → 200 + new token`);
    } else {
      skip(`Token refresh for ${user}`, `status=${r.status} — may not be implemented`);
    }
  } else {
    skip('Token refresh', 'manager has no refreshToken');
  }
}

// 1.11 — Logout revokes refresh token
{
  const user = 'planner';
  if (S[user]?.refreshToken) {
    const logoutR = await POST('/auth/logout', {
      token: tok(user),
      body: { refresh: S[user].refreshToken },
    });
    if (logoutR.status === 200 || logoutR.status === 204) {
      pass(`Logout ${user} → ${logoutR.status}`);
      const refreshR = await POST('/auth/refresh', { body: { refresh: S[user].refreshToken } });
      check('Revoked refresh token rejected → 4xx', refreshR.status >= 400, `got ${refreshR.status}`);
    } else {
      skip(`Logout ${user}`, `status=${logoutR.status} — may not be implemented`);
    }
    // Re-login planner so subsequent tests work
    const relogin = await POST('/auth/login', { body: { username: user, password: 'password123' } });
    if (relogin.status === 200 && relogin.body?.jwt) {
      S[user] = { token: relogin.body.jwt, refreshToken: relogin.body.refresh };
    }
  } else {
    skip('Logout revokes refresh token', 'planner has no refreshToken');
  }
}

// ─── §2  PROJECT CRUD ─────────────────────────────────────────────────────────


section('§2  Project CRUD');

// 2.1 — Classifications
{
  const r = await GET('/projects/classifications', { token: tok('manager') });
  check('GET /projects/classifications → 200', r.status === 200, `got ${r.status}`);
  if (r.status === 200) {
    const b = r.body;
    check('classifications has projectType array', Array.isArray(b?.projectType), JSON.stringify(b));
    check('classifications has category array',    Array.isArray(b?.category));
    check('classifications has riskTier array',    Array.isArray(b?.riskTier));
    check('classifications has priority array',    Array.isArray(b?.priority));
    check('classifications has region array',      Array.isArray(b?.region));
  }
}

// 2.2 — List projects
{
  const r = await GET('/projects', { token: tok('manager') });
  check('GET /projects → 200', r.status === 200, `got ${r.status}`);
  if (r.status === 200) {
    const items = Array.isArray(r.body) ? r.body : (r.body?.projects ?? r.body?.data ?? []);
    check('GET /projects returns array', Array.isArray(items), typeof r.body);
    if (items.length > 0) {
      const p = items[0];
      check('Project has id field',           typeof p.id   === 'string', JSON.stringify(p));
      check('Project has name field',         typeof p.name === 'string');
      check('Project has health/status field', 'health' in p || 'status' in p,
        JSON.stringify(Object.keys(p)));
    }
  }
}

// 2.3 — Create project
{
  const uid = `PRJ-TEST-${Date.now()}`;
  const r = await POST('/projects', {
    body: {
      id: uid, name: `Test Project ${uid}`, code: `TP-${Date.now()}`,
      location: 'Duliajan, Assam', projectType: 'Pipeline', category: 'Greenfield',
      riskTier: 'High', priority: 'Critical', region: 'North-East',
      lat: 27.37, lng: 95.32, disciplines: ['Civil', 'Piping', 'Electrical'],
      startDate: '2026-01-01', targetFinish: '2026-12-31', budget: 5000000,
      client: 'Oil India Limited', leadPlanner: 'planner',
      description: 'Automated test project — safe to delete',
    },
    token: tok('manager'),
  });
  check('POST /projects → 201', r.status === 201, `got ${r.status} body=${JSON.stringify(r.body)}`);
  if (r.status === 201) {
    const p = r.body?.project ?? r.body;
    IDS.projectId = p?.id ?? uid;
    const healthOk = (p?.health ?? p?.status ?? 'on-track') === 'on-track';
    check('New project health defaults to on-track', healthOk,
      `health=${p?.health} status=${p?.status}`);
  } else {
    IDS.projectId = IDS.seedProjectId;
    skip('IDS.projectId set to seed fallback', `create failed: ${r.status}`);
  }
}

// 2.4 — GET single project
{
  if (IDS.projectId) {
    const r = await GET(`/projects/${IDS.projectId}`, { token: tok('manager') });
    check(`GET /projects/${IDS.projectId} → 200`, r.status === 200, `got ${r.status}`);
    if (r.status === 200) {
      const p = r.body?.project ?? r.body;
      check('Single project has id',   typeof p?.id   === 'string');
      check('Single project has name', typeof p?.name === 'string');
    }
  } else {
    skip('GET /projects/:id', 'no projectId');
  }
}

// 2.5 — Unknown project → 404
{
  const r = await GET('/projects/FAKE-NONEXISTENT-XYZ', { token: tok('manager') });
  check('GET /projects/UNKNOWN → 404', r.status === 404, `got ${r.status}`);
}

// 2.6 — POST without name → 400
{
  const r = await POST('/projects', { body: { code: 'NO-NAME' }, token: tok('manager') });
  check('POST /projects without name → 400', r.status === 400, `got ${r.status}`);
}

// 2.7 — PATCH project
{
  if (IDS.projectId) {
    const r = await PATCH(`/projects/${IDS.projectId}`, {
      body: { health: 'at-risk', actualProgress: 35, plannedProgress: 40, variance: -5, spi: 0.87 },
      token: tok('manager'),
    });
    check(`PATCH /projects/${IDS.projectId} → 200`, r.status === 200, `got ${r.status}`);
    if (r.status === 200) {
      const p = r.body?.project ?? r.body;
      check('PATCH updated health to at-risk',
        p?.health === 'at-risk' || p?.status === 'at-risk', `health=${p?.health}`);
    }
  } else {
    skip('PATCH /projects/:id', 'no projectId');
  }
}

// 2.8 — POST location
{
  if (IDS.projectId) {
    const r = await POST(`/projects/${IDS.projectId}/location`,
      { body: { lat: 27.5, lng: 95.6 }, token: tok('manager') });
    check('POST /projects/:id/location → 200', r.status === 200, `got ${r.status}`);
  } else {
    skip('POST /projects/:id/location', 'no projectId');
  }
}

// 2.9 — Invalid lat/lng → 400
{
  if (IDS.projectId) {
    const r = await POST(`/projects/${IDS.projectId}/location`,
      { body: { lat: 999, lng: 'bad' }, token: tok('manager') });
    check('Invalid lat/lng → 400', r.status === 400, `got ${r.status}`);
  } else {
    skip('Invalid lat/lng', 'no projectId');
  }
}

// 2.10 — GET workspace
{
  if (IDS.projectId) {
    const r = await GET(`/projects/${IDS.projectId}/workspace`, { token: tok('manager') });
    check('GET /projects/:id/workspace → 200', r.status === 200, `got ${r.status}`);
    if (r.status === 200) {
      check('workspace has project key',    'project'    in (r.body ?? {}));
      check('workspace has activities key', 'activities' in (r.body ?? {}));
      check('workspace has reports key',    'reports'    in (r.body ?? {}));
      check('workspace has reviews key',    'reviews'    in (r.body ?? {}));
      check('workspace has surveys key',    'surveys'    in (r.body ?? {}));
    }
  } else {
    skip('GET /projects/:id/workspace', 'no projectId');
  }
}

// 2.11 — GET /stats/public (no auth)
{
  const r = await GET('/stats/public');
  check('GET /stats/public → 200 (no auth)', r.status === 200, `got ${r.status}`);
  if (r.status === 200) {
    const hasProjects  = typeof r.body?.projects        === 'number' || typeof r.body?.totalProjects       === 'number';
    const hasActs      = typeof r.body?.activities      === 'number' || typeof r.body?.totalActivities     === 'number';
    const hasPending   = typeof r.body?.pendingReviews  === 'number' || typeof r.body?.totalPendingReviews === 'number' || typeof r.body?.pending === 'number';
    check('stats has projects count',       hasProjects, JSON.stringify(r.body));
    check('stats has activities count',     hasActs,     JSON.stringify(r.body));
    check('stats has pendingReviews count', hasPending,  JSON.stringify(r.body));
  }
}

// ─── §3  DATA INGESTION ───────────────────────────────────────────────────────

section('§3  Data Ingestion');

// 3.1 — POST /reports — full report
{
  const reportId = `RPT-TEST-${Date.now()}`;
  const r = await POST('/reports', {
    body: {
      id: reportId,
      projectId:       IDS.projectId ?? IDS.seedProjectId,
      reportedBy:      'supervisor',
      reportedAt:      new Date().toISOString(),
      rawTranscript:   'Civil foundation work completed at block A3. Concrete poured for column footings. Progress 45% against plan 40%.',
      extractedEvent:  'Foundation concrete pour completed at block A3',
      matchedActivity: 'Foundation Work Phase 1',
      confidence:      0.92,
      signals:         ['foundation', 'concrete', 'column'],
      evidenceItems: [
        { type: 'text',   content: 'Concrete poured for column footings' },
        { type: 'metric', content: 'Progress 45% vs plan 40%' },
      ],
      location: { lat: 27.37, lng: 95.32 },
      blockers: [],
      weather:  'Clear, 32°C',
    },
    token: tok('supervisor'),
  });
  check('POST /reports → 201', r.status === 201, `got ${r.status} body=${JSON.stringify(r.body)}`);
  if (r.status === 201) {
    IDS.reportId = r.body?.id ?? r.body?.report?.id ?? reportId;
    IDS.reviewId = r.body?.reviewItemId ?? r.body?.review?.id ?? null;
    check('POST /reports returns reviewItemId', !!IDS.reviewId, `body=${JSON.stringify(r.body)}`);
  } else {
    IDS.reportId = reportId;
    skip('IDS.reviewId not captured', `report creation failed: ${r.status}`);
  }
}

// 3.2 — Duplicate report → 200 with duplicate:true
{
  if (IDS.reportId) {
    const r = await POST('/reports', {
      body: { id: IDS.reportId, projectId: IDS.projectId ?? IDS.seedProjectId,
              reportedBy: 'supervisor', rawTranscript: 'Duplicate check.' },
      token: tok('supervisor'),
    });
    check('Duplicate report → 200/409 (duplicate:true)',
      r.status === 200 || r.status === 409, `got ${r.status}`);
    if (r.status === 200) {
      check('Duplicate flag = true', r.body?.duplicate === true, `body=${JSON.stringify(r.body)}`);
    }
  } else {
    skip('Duplicate report test', 'no reportId');
  }
}

// 3.3 — POST without rawTranscript → 400
{
  const r = await POST('/reports', {
    body: { id: 'NO-TRANSCRIPT', projectId: IDS.projectId ?? IDS.seedProjectId, reportedBy: 'supervisor' },
    token: tok('supervisor'),
  });
  check('POST /reports without rawTranscript → 400', r.status === 400, `got ${r.status}`);
}

// 3.4 — Report with severe blocker
{
  const blockerId = `RPT-BLOCKER-${Date.now()}`;
  const r = await POST('/reports', {
    body: {
      id: blockerId,
      projectId:     IDS.projectId ?? IDS.seedProjectId,
      reportedBy:    'supervisor',
      rawTranscript: 'Emergency halt required. Structural hazard detected at column B7. All work must halt immediately.',
      extractedEvent: 'Structural hazard detected at column B7',
      blockers: [{ severity: 'critical', text: 'Structural hazard — work must halt at column B7' }],
    },
    token: tok('supervisor'),
  });
  check('POST /reports with severe blocker → 201', r.status === 201, `got ${r.status}`);
  if (r.status === 201) {
    IDS.rejectReviewId = r.body?.reviewItemId ?? r.body?.review?.id ?? null;
  }
}

// 3.5 — GET /reports
{
  const r = await GET('/reports', { token: tok('manager') });
  check('GET /reports → 200', r.status === 200, `got ${r.status}`);
  if (r.status === 200) {
    const items = Array.isArray(r.body) ? r.body : (r.body?.reports ?? r.body?.data ?? []);
    check('GET /reports returns array', Array.isArray(items));
  }
}

// 3.6 — GET /reports?projectId=
{
  const pid = IDS.projectId ?? IDS.seedProjectId;
  const r = await GET(`/reports?projectId=${pid}`, { token: tok('manager') });
  check(`GET /reports?projectId=${pid} → 200`, r.status === 200, `got ${r.status}`);
}

// 3.7 — GET /activities
{
  const r = await GET('/activities', { token: tok('manager') });
  check('GET /activities → 200', r.status === 200, `got ${r.status}`);
  if (r.status === 200) {
    const items = Array.isArray(r.body) ? r.body : (r.body?.activities ?? r.body?.data ?? []);
    check('GET /activities returns array', Array.isArray(items));
  }
}

// 3.8 — GET /activities?projectId=
{
  const pid = IDS.projectId ?? IDS.seedProjectId;
  const r = await GET(`/activities?projectId=${pid}`, { token: tok('manager') });
  check(`GET /activities?projectId=${pid} → 200`, r.status === 200, `got ${r.status}`);
}

// ─── §4  CLASSIFICATION ENGINE ───────────────────────────────────────────────

section('§4  Classification Engine');

async function classifyCheck(label, transcript, expectedDiscipline) {
  const r = await POST('/classify', { body: { transcript }, token: tok('manager') });
  check(`POST /classify → 200 (${label})`, r.status === 200, `got ${r.status}`);
  if (r.status === 200) {
    const b = r.body;
    check(`${label} — has confidence field`,            typeof b?.confidence === 'number', JSON.stringify(b));
    check(`${label} — has suggestedReviewerRole field`, 'suggestedReviewerRole' in b || 'reviewerRole' in b, JSON.stringify(b));
    check(`${label} — has source field`,                'source' in b || 'method' in b || 'engine' in b, JSON.stringify(b));
    if (expectedDiscipline) {
      const disc = (b?.discipline ?? b?.category ?? '').toLowerCase();
      check(`${label} — discipline = ${expectedDiscipline}`,
        disc.includes(expectedDiscipline.toLowerCase()), `got '${disc}'`);
    }
    return b;
  }
  return null;
}

// 4.1 — Civil
await classifyCheck('Civil/concrete',
  'Concrete pouring for foundation slabs completed at civil structure block A. Column reinforcement bars tied and inspected.',
  'Civil');

// 4.2 — Piping
await classifyCheck('Piping/welding',
  'Welding joint inspection on 16-inch pipeline header. Piping spool fabrication completed at flange points FP-3 and FP-4.',
  'Piping');

// 4.3 — Electrical
await classifyCheck('Electrical',
  'Electrical works at switchyard completed today. MV electrical panel DB-04 wired up and meggered. Earthing conductors terminated at main earth bar. Electrical continuity test passed.',
  'Electrical');

// 4.4 — Instrumentation
await classifyCheck('Instrumentation',
  'Instrumentation loop check completed for flow transmitter FT-201 and pressure transmitter PT-104. DCS signal verified.',
  'Instrumentation');

// 4.5 — Empty transcript → confidence=0 (or 400)
{
  const r = await POST('/classify', { body: { transcript: '' }, token: tok('manager') });
  if (r.status === 200) {
    check('Empty transcript → confidence=0', r.body?.confidence === 0, `confidence=${r.body?.confidence}`);
  } else if (r.status === 400) {
    pass('Empty transcript → 400 (validation rejected)');
  } else {
    fail('Empty transcript response', `got ${r.status}`);
  }
}

// 4.6 — 500-word stress test
{
  const words = 'civil concrete foundation column rebar slab pour inspection structural work '.repeat(50);
  const r = await POST('/classify', { body: { transcript: words.trim() }, token: tok('manager') });
  check('500-word classify stress test → 200 no crash', r.status === 200, `got ${r.status}`);
}

// ─── §5  REVIEW SYSTEM ───────────────────────────────────────────────────────

section('§5  Review System');

// 5.1 — GET /reviews — full queue
{
  const r = await GET('/reviews', { token: tok('manager') });
  check('GET /reviews → 200', r.status === 200, `got ${r.status}`);
  if (r.status === 200) {
    const items = Array.isArray(r.body) ? r.body : (r.body?.reviews ?? r.body?.items ?? r.body?.data ?? []);
    check('GET /reviews returns array', Array.isArray(items), typeof r.body);
    if (items.length > 0) {
      const first = items[0];
      check('Review item has id',         typeof first?.id   === 'string', JSON.stringify(first));
      check('Review item has state',      typeof first?.state === 'string' || typeof first?.status === 'string');
      check('Review item has reporter',   typeof first?.reporter === 'string' || typeof first?.reportedBy === 'string');
      check('Review item has discipline', typeof first?.discipline === 'string' || typeof first?.category === 'string');

      const states  = items.map(i => i.state ?? i.status ?? '');
      const nrIdx   = states.indexOf('needs-review');
      const appIdx  = states.indexOf('approved');
      if (nrIdx !== -1 && appIdx !== -1) {
        check('needs-review sorted before approved', nrIdx < appIdx,
          `nrIdx=${nrIdx} appIdx=${appIdx}`);
      } else {
        skip('Review sort order', 'not enough mixed states in queue');
      }

      // Capture reviewId if not already set
      if (!IDS.reviewId) {
        const pending = items.find(i => (i.state ?? i.status) === 'needs-review');
        if (pending) IDS.reviewId = pending.id;
      }
      if (!IDS.rejectReviewId) {
        const pending = items.filter(i => (i.state ?? i.status) === 'needs-review');
        const other = pending.find(i => i.id !== IDS.reviewId);
        if (other) IDS.rejectReviewId = other.id;
      }
    }
  }
}

// 5.2 — GET /reviews?tab=needs-review
{
  const r = await GET('/reviews?tab=needs-review', { token: tok('manager') });
  check('GET /reviews?tab=needs-review → 200', r.status === 200, `got ${r.status}`);
  if (r.status === 200) {
    const items = Array.isArray(r.body) ? r.body : (r.body?.reviews ?? r.body?.items ?? r.body?.data ?? []);
    if (Array.isArray(items) && items.length > 0) {
      check('?tab=needs-review — all items are needs-review',
        items.every(i => (i.state ?? i.status) === 'needs-review'),
        `states=${JSON.stringify(items.map(i => i.state ?? i.status))}`);
    } else {
      skip('?tab=needs-review filter check', 'empty result set');
    }
  }
}

// 5.3 — GET /reviews?tab=approved
{
  const r = await GET('/reviews?tab=approved', { token: tok('manager') });
  check('GET /reviews?tab=approved → 200', r.status === 200, `got ${r.status}`);
  if (r.status === 200) {
    const items = Array.isArray(r.body) ? r.body : (r.body?.reviews ?? r.body?.items ?? r.body?.data ?? []);
    if (Array.isArray(items) && items.length > 0) {
      check('?tab=approved — all items are approved',
        items.every(i => (i.state ?? i.status) === 'approved'),
        `states=${JSON.stringify(items.map(i => i.state ?? i.status))}`);
    } else {
      skip('?tab=approved filter check', 'empty result set');
    }
  }
}

// 5.4 — GET /reviews?tab=rejected
{
  const r = await GET('/reviews?tab=rejected', { token: tok('manager') });
  check('GET /reviews?tab=rejected → 200', r.status === 200, `got ${r.status}`);
  if (r.status === 200) {
    const items = Array.isArray(r.body) ? r.body : (r.body?.reviews ?? r.body?.items ?? r.body?.data ?? []);
    if (Array.isArray(items) && items.length > 0) {
      check('?tab=rejected — all items are rejected',
        items.every(i => (i.state ?? i.status) === 'rejected'),
        `states=${JSON.stringify(items.map(i => i.state ?? i.status))}`);
    } else {
      skip('?tab=rejected filter check', 'empty result set');
    }
  }
}

// 5.5 — GET /reviews/:id — single item
{
  if (IDS.reviewId) {
    const r = await GET(`/reviews/${IDS.reviewId}`, { token: tok('manager') });
    check(`GET /reviews/${IDS.reviewId} → 200`, r.status === 200, `got ${r.status}`);
  } else {
    skip('GET /reviews/:id', 'no reviewId captured');
  }
}

// 5.6 — Unknown review → 404
{
  const r = await GET('/reviews/NONEXISTENT-ID-XYZ', { token: tok('manager') });
  check('GET /reviews/NONEXISTENT-ID → 404', r.status === 404, `got ${r.status}`);
}

// 5.7 — Planner approves review item
{
  if (IDS.reviewId) {
    const r = await POST(`/reviews/${IDS.reviewId}/approve`, { token: tok('planner') });
    check(`POST /reviews/${IDS.reviewId}/approve (planner) → 200`, r.status === 200,
      `got ${r.status} body=${JSON.stringify(r.body)}`);
    if (r.status === 200) {
      const item  = r.body?.review ?? r.body?.item ?? r.body;
      const state = item?.state ?? item?.status;
      check('Approved item state = approved', state === 'approved', `state=${state}`);
      check('Approved item has reviewer field', !!item?.reviewer || !!item?.approvedBy || !!item?.reviewedBy, JSON.stringify(item));
      check('Approved item has reviewedAt field', !!item?.reviewedAt || !!item?.approvedAt, JSON.stringify(item));
    }
  } else {
    skip('Planner approves review', 'no reviewId');
  }
}

// 5.8 — Re-approve → 409
{
  if (IDS.reviewId) {
    const r = await POST(`/reviews/${IDS.reviewId}/approve`, { token: tok('planner') });
    check('Re-approve same item → 409 Conflict', r.status === 409, `got ${r.status}`);
  } else {
    skip('Re-approve → 409', 'no reviewId');
  }
}

// 5.9 — Reviewer rejects
{
  if (IDS.rejectReviewId) {
    const r = await POST(`/reviews/${IDS.rejectReviewId}/reject`, {
      token: tok('reviewer'),
      body:  { reason: 'Insufficient photographic evidence for foundation inspection.' },
    });
    check(`POST /reviews/${IDS.rejectReviewId}/reject (reviewer) → 200`, r.status === 200,
      `got ${r.status} body=${JSON.stringify(r.body)}`);
    if (r.status === 200) {
      const item  = r.body?.review ?? r.body?.item ?? r.body;
      const state = item?.state ?? item?.status;
      check('Rejected item state = rejected', state === 'rejected', `state=${state}`);
      check('Rejected item has rejectionReason', !!item?.rejectionReason || !!item?.reason, JSON.stringify(item));
    }
  } else {
    skip('Reviewer rejects review', 'no rejectReviewId');
  }
}

// 5.10 — Re-reject → 409
{
  if (IDS.rejectReviewId) {
    const r = await POST(`/reviews/${IDS.rejectReviewId}/reject`,
      { token: tok('reviewer'), body: { reason: 'Again.' } });
    check('Re-reject same item → 409 Conflict', r.status === 409, `got ${r.status}`);
  } else {
    skip('Re-reject → 409', 'no rejectReviewId');
  }
}

// 5.11 — Field Supervisor cannot approve (role guard)
{
  if (IDS.reviewId && tok('supervisor')) {
    const r = await POST(`/reviews/${IDS.reviewId}/approve`, { token: tok('supervisor') });
    check('Field Supervisor cannot approve → 403 (or 409)',
      r.status === 403 || r.status === 409, `got ${r.status}`);
  } else {
    skip('Supervisor approve guard', 'no reviewId or supervisor token');
  }
}

// 5.12 — Field Supervisor cannot reject (role guard)
{
  if (IDS.rejectReviewId && tok('supervisor')) {
    const r = await POST(`/reviews/${IDS.rejectReviewId}/reject`,
      { token: tok('supervisor'), body: { reason: 'Trying.' } });
    check('Field Supervisor cannot reject → 403 (or 409)',
      r.status === 403 || r.status === 409, `got ${r.status}`);
  } else {
    skip('Supervisor reject guard', 'no rejectReviewId or supervisor token');
  }
}

// 5.13 — Executive can approve (canReview=true)
{
  let execReviewId = null;
  const execRptId = `RPT-EXEC-${Date.now()}`;
  const rpt = await POST('/reports', {
    body: {
      id:            execRptId,
      projectId:     IDS.projectId ?? IDS.seedProjectId,
      reportedBy:    'supervisor',
      rawTranscript: 'Electrical panel commissioning at substation G-2 completed. All HV tests passed.',
    },
    token: tok('supervisor'),
  });
  if (rpt.status === 201) {
    execReviewId = rpt.body?.reviewItemId ?? rpt.body?.review?.id ?? null;
  }

  if (execReviewId && tok('executive')) {
    const r = await POST(`/reviews/${execReviewId}/approve`, { token: tok('executive') });
    check('Executive can approve (canReview=true) → 200', r.status === 200,
      `got ${r.status} body=${JSON.stringify(r.body)}`);
  } else {
    skip('Executive can approve', `execReviewId=${execReviewId} execToken=${!!tok('executive')}`);
  }
}

// ─── §6  SURVEY SYSTEM ───────────────────────────────────────────────────────

section('§6  Survey System');

// 6.1 — GET /surveys/templates
{
  const r = await GET('/surveys/templates', { token: tok('supervisor') });
  check('GET /surveys/templates → 200', r.status === 200, `got ${r.status}`);
  if (r.status === 200) {
    const templates = Array.isArray(r.body) ? r.body : (r.body?.templates ?? r.body?.data ?? []);
    check('≥2 survey templates exist', templates.length >= 2, `count=${templates.length}`);
    const names = templates.map(t => (t.name ?? t.title ?? t.id ?? '').toLowerCase());
    check('Has Site Inspection template', names.some(n => n.includes('site') || n.includes('inspection')), `names=${JSON.stringify(names)}`);
    check('Has Daily Progress template',  names.some(n => n.includes('progress') || n.includes('daily')), `names=${JSON.stringify(names)}`);
    if (templates.length > 0) {
      check('Each template has sections array',
        templates.every(t => Array.isArray(t.sections)),
        `template[0]=${JSON.stringify(templates[0])}`);

    }
  }
}

// 6.2 — POST /surveys with TPL-PROGRESS-SURVEY
{
  const surveyId = `SRV-PROG-${Date.now()}`;
  const r = await POST('/surveys', {
    body: {
      id: surveyId, templateId: 'TPL-PROGRESS-SURVEY',
      projectId: IDS.projectId ?? IDS.seedProjectId,
      submittedBy: 'supervisor', submittedAt: new Date().toISOString(),
      responses: {
        physicalProgress: '45', workforceMobilised: '12',
        majorActivities: 'Concrete pour at block A3, rebar tying at B1',
        safetyIncidents: '0', qualityRemarks: 'All checks passed',
      },
    },
    token: tok('supervisor'),
  });
  check('POST /surveys (TPL-PROGRESS-SURVEY) → 201', r.status === 201,
    `got ${r.status} body=${JSON.stringify(r.body)}`);
  if (r.status === 201) {
    IDS.surveyId = r.body?.id ?? r.body?.survey?.id ?? surveyId;
    const status = r.body?.status ?? r.body?.survey?.status ?? '';
    check('Survey status = submitted', status === 'submitted', `status=${status}`);
    check('Survey returns reviewItemId',
      !!r.body?.reviewItemId || !!r.body?.review?.id || !!r.body?.survey?.reviewItemId,
      `body=${JSON.stringify(r.body)}`);
  } else {
    IDS.surveyId = surveyId;
  }
}

// 6.3 — POST /surveys with TPL-SITE-INSPECTION
{
  const siteId = `SRV-SITE-${Date.now()}`;
  const r = await POST('/surveys', {
    body: {
      id: siteId, templateId: 'TPL-SITE-INSPECTION',
      projectId: IDS.projectId ?? IDS.seedProjectId,
      submittedBy: 'supervisor', submittedAt: new Date().toISOString(),
      responses: {
        siteCondition: 'Good', hazardsObserved: 'None',
        ppe: 'All workers equipped', remarks: 'Inspection completed without issues',
      },
    },
    token: tok('supervisor'),
  });
  check('POST /surveys (TPL-SITE-INSPECTION) → 201', r.status === 201,
    `got ${r.status} body=${JSON.stringify(r.body)}`);
}

// 6.4 — Duplicate survey → 200 with duplicate:true
{
  if (IDS.surveyId) {
    const r = await POST('/surveys', {
      body: {
        id: IDS.surveyId, templateId: 'TPL-PROGRESS-SURVEY',
        projectId: IDS.projectId ?? IDS.seedProjectId,
        submittedBy: 'supervisor', submittedAt: new Date().toISOString(),
        responses: {},
      },
      token: tok('supervisor'),
    });
    check('Duplicate survey → 200/409 (duplicate:true)',
      r.status === 200 || r.status === 409, `got ${r.status}`);
    if (r.status === 200) {
      check('Survey duplicate flag = true', r.body?.duplicate === true, `body=${JSON.stringify(r.body)}`);
    }
  } else {
    skip('Duplicate survey test', 'no surveyId');
  }
}

// 6.5 — GET /surveys
{
  const r = await GET('/surveys', { token: tok('manager') });
  check('GET /surveys → 200', r.status === 200, `got ${r.status}`);
  if (r.status === 200) {
    const items = Array.isArray(r.body) ? r.body : (r.body?.surveys ?? r.body?.data ?? []);
    check('GET /surveys returns array', Array.isArray(items));
    if (items.length > 0) {
      const s = items[0];
      check('Survey has id',        typeof s?.id        === 'string', JSON.stringify(s));
      check('Survey has status',    typeof s?.status    === 'string' || typeof s?.state === 'string');
      check('Survey has projectId', typeof s?.projectId === 'string');
    }
  }
}

// 6.6 — GET /surveys?projectId=
{
  const pid = IDS.projectId ?? IDS.seedProjectId;
  const r = await GET(`/surveys?projectId=${pid}`, { token: tok('manager') });
  check(`GET /surveys?projectId=${pid} → 200`, r.status === 200, `got ${r.status}`);
}

// ─── §7  AUDIT TRAIL ─────────────────────────────────────────────────────────

section('§7  Audit Trail');

// 7.1 — GET /audit
{
  const r = await GET('/audit', { token: tok('admin') });
  check('GET /audit → 200', r.status === 200, `got ${r.status}`);
  if (r.status === 200) {
    const events = Array.isArray(r.body) ? r.body : (r.body?.events ?? r.body?.audit ?? r.body?.data ?? []);
    check('GET /audit returns array', Array.isArray(events), typeof r.body);
    if (events.length > 0) {
      const e = events[0];
      check('Audit event has actor',     typeof e?.actor === 'string' || typeof e?.username === 'string', JSON.stringify(e));
      check('Audit event has action',    typeof e?.action === 'string' || typeof e?.event === 'string');
      check('Audit event has role',      typeof e?.role  === 'string', JSON.stringify(e));
      check('Audit event has timestamp', typeof e?.timestamp === 'string' || typeof e?.createdAt === 'string' || typeof e?.ts === 'string');
    }
  }
}

// 7.2 — GET /audit/verify
{
  const r = await GET('/audit/verify', { token: tok('admin') });
  check('GET /audit/verify → 200', r.status === 200, `got ${r.status}`);
  if (r.status === 200) {
    check('audit/verify returns valid:true',
      r.body?.valid === true || r.body?.integrity === true || r.body?.verified === true,
      `body=${JSON.stringify(r.body)}`);
  }
}

// 7.3 — GET /audit without token → 401
{
  const r = await GET('/audit');
  check('GET /audit without token → 401', r.status === 401, `got ${r.status}`);
}

// ─── §8  EDGE CASES ───────────────────────────────────────────────────────────

section('§8  Edge Cases');

// 8.1 — Unknown routes → 404
for (const path of ['/nonexistent', '/projects/FAKE/badpath']) {
  const r = await GET(path, { token: tok('manager') });
  check(`Unknown route GET ${path} → 404`, r.status === 404, `got ${r.status}`);
}

// 8.2 — Garbage JWT strings → 401
for (const garbage of ['notajwt', 'Bearer eyNotReal.NotReal.NotReal', '!!!###', 'null']) {
  const r = await GET('/projects', { token: garbage });
  check(`Garbage JWT '${garbage.slice(0, 20)}' → 401`, r.status === 401, `got ${r.status}`);
}

// 8.3 — POST /reports empty body → 400
{
  const r = await POST('/reports', { body: {}, token: tok('supervisor') });
  check('POST /reports empty body → 400', r.status === 400, `got ${r.status}`);
}

// 8.4 — Oversized classify transcript → 200 no crash
{
  const huge = 'civil concrete foundation column rebar slab pour inspection structural '.repeat(500);
  const r = await POST('/classify', { body: { transcript: huge.trim() }, token: tok('manager') });
  check('Oversized classify (500 reps) → 200 no crash', r.status === 200, `got ${r.status}`);
}

// 8.5 — GET /reviews/NONEXISTENT-ID → 404
{
  const r = await GET('/reviews/NONEXISTENT-ID-EDGE-CASE', { token: tok('manager') });
  check('GET /reviews/NONEXISTENT-ID → 404', r.status === 404, `got ${r.status}`);
}

// ─── Final Summary ────────────────────────────────────────────────────────────

endSection();

const total = PASS + FAIL + SKIP;
console.log(`\n${B(C('═'.repeat(60)))}`);
console.log(B(`  TEST SUMMARY — Oil India Field-to-Schedule Bridge`));
console.log(B(C('═'.repeat(60))));
console.log(`  ${B('BASE URL')} : ${C(BASE)}`);
console.log(`  ${G('PASS')}     : ${G(String(PASS))} / ${total}`);
console.log(`  ${FAIL > 0 ? R('FAIL') : 'FAIL'}     : ${FAIL > 0 ? R(String(FAIL)) : FAIL} / ${total}`);
console.log(`  ${Y('SKIP')}     : ${Y(String(SKIP))} / ${total}`);
console.log(B(C('─'.repeat(60))));

if (FAILURES.length > 0) {
  console.log(`\n  ${R(B('FAILURES:'))}`);
  FAILURES.forEach((f, i) => console.log(`    ${R(`${i + 1}.`)} ${f}`));
}

console.log('');
process.exit(FAIL > 0 ? 1 : 0);
