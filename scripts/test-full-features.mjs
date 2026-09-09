#!/usr/bin/env node
// ============================================================
// OIL Bridge API — Full Feature Integration Test
// Run against wrangler dev:  node scripts/test-full-features.mjs
// Or against a remote URL:   BASE_URL=https://... node scripts/test-full-features.mjs
// ============================================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:8787';

// ─── ANSI colours ────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
  magenta:'\x1b[35m',
  blue:   '\x1b[34m',
};

// ─── State ───────────────────────────────────────────────────
const tokens = {};          // { supervisor, reviewer, manager, planner, admin, executive }
const state  = {};          // dynamic IDs collected during the run
let pass = 0, fail = 0, warn = 0;

// ─── Helpers ─────────────────────────────────────────────────
function hdr(title) {
  console.log(`\n${C.bold}${C.cyan}${'═'.repeat(60)}${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ${title}${C.reset}`);
  console.log(`${C.cyan}${'═'.repeat(60)}${C.reset}`);
}

function ok(label, detail = '') {
  pass++;
  console.log(`  ${C.green}✔${C.reset}  ${label}${detail ? C.gray + '  ' + detail + C.reset : ''}`);
}

function ko(label, detail = '') {
  fail++;
  console.log(`  ${C.red}✘${C.reset}  ${C.bold}${label}${C.reset}${detail ? '\n     ' + C.red + detail + C.reset : ''}`);
}

function wn(label, detail = '') {
  warn++;
  console.log(`  ${C.yellow}⚠${C.reset}  ${label}${detail ? C.gray + '  ' + detail + C.reset : ''}`);
}

function info(msg) {
  console.log(`  ${C.blue}ℹ${C.reset}  ${C.gray}${msg}${C.reset}`);
}

async function api(method, path, { body, token, expectStatus } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

function assert(label, condition, failDetail = '') {
  if (condition) ok(label);
  else ko(label, failDetail);
  return condition;
}

function assertField(obj, field, label) {
  const ok_ = obj && obj[field] !== undefined && obj[field] !== null;
  if (ok_) ok(label || `has field "${field}"`);
  else ko(label || `has field "${field}"`, `got: ${JSON.stringify(obj?.[field])}`);
  return ok_;
}

// ─────────────────────────────────────────────────────────────
// SECTION 0 — Health check
// ─────────────────────────────────────────────────────────────
async function testHealth() {
  hdr('0 · Service Health');
  const { status, data } = await api('GET', '/');
  assert('Root endpoint returns 200', status === 200, `status=${status}`);
  assert('Service name matches', data?.service === 'oil-bridge-api', `got: ${data?.service}`);
  assert('Status is ok', data?.status === 'ok', `got: ${data?.status}`);
  assertField(data, 'time', 'Response includes timestamp');
}

// ─────────────────────────────────────────────────────────────
// SECTION 1 — Auth: login all six demo personas
// ─────────────────────────────────────────────────────────────
async function testAuth() {
  hdr('1 · Authentication');

  const personas = [
    { username: 'supervisor',  role: 'Field Supervisor'   },
    { username: 'reviewer',    role: 'Reviewer'           },
    { username: 'manager',     role: 'Project Manager'    },
    { username: 'planner',     role: 'Planner'            },
    { username: 'admin',       role: 'Admin'              },
    { username: 'executive',   role: 'Executive / GM'     },
  ];

  for (const p of personas) {
    const { status, data } = await api('POST', '/api/auth/login', {
      body: { username: p.username, password: 'password123' }
    });
    if (assert(`Login: ${p.username} (${p.role})`, status === 200, `status=${status} ${data?.error||''}`)) {
      tokens[p.username] = data.jwt;
      if (!state.refreshToken) state.refreshToken = data.refresh;
      assert(`  → JWT issued`, !!data.jwt, 'no jwt in response');
      assert(`  → Refresh token issued`, !!data.refresh, 'no refresh in response');
      assert(`  → Role matches`, data.user?.role === p.role, `got role: ${data.user?.role}`);
      assert(`  → canReview flag correct`,
        ['Reviewer','Project Manager','Planner','Admin'].includes(p.role)
          ? data.user?.canReview === true
          : data.user?.canReview === false,
        `canReview=${data.user?.canReview} for role=${p.role}`
      );
    }
  }

  // Bad password
  const { status: s401 } = await api('POST', '/api/auth/login', {
    body: { username: 'supervisor', password: 'wrongpass' }
  });
  assert('Login with wrong password → 401', s401 === 401, `status=${s401}`);

  // Token refresh rotation
  const { status: sRef, data: dRef } = await api('POST', '/api/auth/refresh', {
    body: { refresh: state.refreshToken }
  });
  assert('Refresh token rotation → new JWT', sRef === 200 && !!dRef?.jwt, `status=${sRef}`);
  if (dRef?.refresh) state.refreshToken = dRef.refresh;

  // GET /me
  const { status: sMe, data: dMe } = await api('GET', '/api/auth/me', {
    token: tokens.supervisor
  });
  assert('/api/auth/me → returns user profile', sMe === 200 && !!dMe?.user, `status=${sMe}`);

  // Unauthenticated access
  const { status: s403 } = await api('GET', '/api/projects');
  assert('Protected route without token → 401/403', [401,403].includes(s403), `status=${s403}`);
}

// ─────────────────────────────────────────────────────────────
// SECTION 2 — Projects CRUD
// ─────────────────────────────────────────────────────────────
async function testProjects() {
  hdr('2 · Projects');

  // List
  const { status: sL, data: dL } = await api('GET', '/api/projects', { token: tokens.manager });
  assert('GET /api/projects → 200', sL === 200, `status=${sL}`);
  assert('Returns array', Array.isArray(dL), `type=${typeof dL}`);
  if (Array.isArray(dL) && dL.length > 0) {
    state.projectId = dL[0].id;
    info(`Using existing project: ${dL[0].id} — ${dL[0].name}`);
    const p = dL[0];
    assertField(p, 'id',     'Project has id');
    assertField(p, 'name',   'Project has name');
    assertField(p, 'health', 'Project has health');
  }

  // Classifications
  const { status: sCls, data: dCls } = await api('GET', '/api/projects/classifications', { token: tokens.manager });
  assert('GET /api/projects/classifications → 200', sCls === 200, `status=${sCls}`);
  assert('projectType array present', Array.isArray(dCls?.projectType), JSON.stringify(dCls));

  // Create
  const newProj = {
    name:         'Test Pipeline (Auto-Test)',
    code:         `TP-TEST-${Date.now()}`,
    location:     'Duliajan Test Yard',
    projectType:  'Pipeline',
    category:     'Greenfield',
    riskTier:     'B',
    priority:     'P2',
    region:       'Assam East',
    startDate:    '2026-09-01',
    targetFinish: '2027-06-30'
  };
  const { status: sCr, data: dCr } = await api('POST', '/api/projects', {
    token: tokens.manager, body: newProj
  });
  assert('POST /api/projects → 201', sCr === 201, `status=${sCr} err=${JSON.stringify(dCr)}`);
  if (sCr === 201 && dCr?.id) {
    state.testProjectId = dCr.id;
    info(`Created test project: ${dCr.id}`);
  }
  if (!state.testProjectId) state.testProjectId = state.projectId;

  // GET single
  if (state.testProjectId) {
    const { status: sG, data: dG } = await api('GET', `/api/projects/${state.testProjectId}`, { token: tokens.manager });
    assert('GET /api/projects/:id → 200', sG === 200, `status=${sG}`);
    assertField(dG, 'id', 'Single project has id');

    // PATCH
    const { status: sPa, data: dPa } = await api('PATCH', `/api/projects/${state.testProjectId}`, {
      token: tokens.manager, body: { name: 'Test Pipeline (Updated)' }
    });
    assert('PATCH /api/projects/:id → 200', sPa === 200, `status=${sPa}`);
    assert('Name was updated', dPa?.name === 'Test Pipeline (Updated)', `got: ${dPa?.name}`);

    // Not found
    const { status: s404 } = await api('GET', '/api/projects/NOT-EXIST', { token: tokens.manager });
    assert('GET non-existent project → 404', s404 === 404, `status=${s404}`);
  }

  // Public stats
  const { status: sSt, data: dSt } = await api('GET', '/api/stats/public');
  assert('GET /api/stats/public → 200', sSt === 200, `status=${sSt}`);
  assertField(dSt, 'projects', 'Stats has projects count');
}

// ─────────────────────────────────────────────────────────────
// SECTION 3 — Activities
// ─────────────────────────────────────────────────────────────
async function testActivities() {
  hdr('3 · Activities');

  const { status, data } = await api('GET', '/api/activities', { token: tokens.planner });
  assert('GET /api/activities → 200', status === 200, `status=${status}`);
  assert('Returns array', Array.isArray(data), `type=${typeof data}`);

  if (Array.isArray(data) && data.length > 0) {
    state.activityId = data[0].id;
    const a = data[0];
    assertField(a, 'id',       'Activity has id');
    assertField(a, 'code',     'Activity has code');
    assertField(a, 'name',     'Activity has name');
    assertField(a, 'progress', 'Activity has progress');
    assertField(a, 'status',   'Activity has status');
    info(`Sample activity: ${a.id} — ${a.name} [${a.status}] ${a.progress}%`);
  } else {
    wn('No activities in DB — reconciliation tests will be skipped');
  }

  if (state.testProjectId) {
    const { status: sP, data: dP } = await api('GET', `/api/activities?projectId=${state.testProjectId}`, { token: tokens.planner });
    assert('GET /api/activities?projectId= → 200', sP === 200, `status=${sP}`);
    assert('Returns filtered array', Array.isArray(dP), `type=${typeof dP}`);
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION 4 — Survey Templates
// ─────────────────────────────────────────────────────────────
async function testSurveyTemplates() {
  hdr('4 · Survey Templates');

  const { status, data } = await api('GET', '/api/surveys/templates', { token: tokens.supervisor });
  assert('GET /api/surveys/templates → 200', status === 200, `status=${status}`);
  assert('Returns array', Array.isArray(data), `type=${typeof data}`);
  assert('At least 2 templates', Array.isArray(data) && data.length >= 2, `count=${data?.length}`);

  if (Array.isArray(data)) {
    for (const tpl of data) {
      assertField(tpl, 'id',   `Template "${tpl.name}" has id`);
      assertField(tpl, 'name', `Template "${tpl.id}" has name`);
      const questions = tpl.questions || tpl.sections;
      assert(`Template "${tpl.id}" has questions/sections`, Array.isArray(questions) && questions.length > 0,
        `questions=${JSON.stringify(questions)}`);
    }
    const siteTpl = data.find(t => t.id === 'TPL-SITE-INSPECTION') || data[0];
    state.templateId   = siteTpl.id;
    state.templateName = siteTpl.name;
    info(`Will use template: ${state.templateId} — ${state.templateName}`);
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION 5 — Survey Submission → Review Queue (KEY FLOW)
// ─────────────────────────────────────────────────────────────
async function testSurveySubmission() {
  hdr('5 · Survey Submission → Review Queue  ★ KEY FLOW');

  if (!state.testProjectId) { wn('No project ID — skipping survey submission'); return; }
  if (!state.templateId)    { wn('No template ID — skipping survey submission'); return; }

  const surveyPayload = {
    projectId:    state.testProjectId,
    templateId:   state.templateId,
    templateName: state.templateName,
    submittedBy:  'Manoj Kalita',
    answers: {
      q_housekeeping: 'Yes',
      q_ppe:          'Yes',
      q_permits:      'Yes',
      q_hazards:      'Minor oil spill at pump plinth area — sand bagged and contained',
      q_overall:      'Conditional Pass'
    },
    photos:     [],
    photoCount: 0,
    geo:        { lat: 27.3569, lng: 95.3194 },
    isOffline:  false
  };

  console.log(`\n  ${C.magenta}[SURVEY POST]${C.reset} Submitting survey as field supervisor...`);
  const { status: sSrv, data: dSrv } = await api('POST', '/api/surveys', {
    token: tokens.supervisor, body: surveyPayload
  });

  assert('POST /api/surveys → 201', sSrv === 201, `status=${sSrv}  body=${JSON.stringify(dSrv)}`);
  assert('Survey response has id',           !!dSrv?.id,                     `got: ${JSON.stringify(dSrv)}`);
  assert('Survey response status=submitted', dSrv?.status === 'submitted',   `status=${dSrv?.status}`);
  assert('Survey response has reviewItemId', !!dSrv?.reviewItemId,           `got: ${JSON.stringify(dSrv)}`);

  if (dSrv?.id) {
    state.surveyId      = dSrv.id;
    state.reviewItemId  = dSrv.reviewItemId;
    info(`Survey ID:      ${state.surveyId}`);
    info(`Review Item ID: ${state.reviewItemId}`);
  }

  // Idempotency
  if (state.surveyId) {
    const { status: sIdem, data: dIdem } = await api('POST', '/api/surveys', {
      token: tokens.supervisor, body: { ...surveyPayload, id: state.surveyId }
    });
    assert('Duplicate survey POST → 200 with duplicate:true',
      sIdem === 200 && dIdem?.duplicate === true,
      `status=${sIdem} dup=${dIdem?.duplicate}`);
  }

  // Verify survey appears in GET /api/surveys
  console.log(`\n  ${C.magenta}[SURVEY GET]${C.reset} Checking survey appears in list...`);
  const { status: sGL, data: dGL } = await api('GET', '/api/surveys', { token: tokens.reviewer });
  assert('GET /api/surveys → 200', sGL === 200, `status=${sGL}`);
  assert('Returns array', Array.isArray(dGL), `type=${typeof dGL}`);

  if (state.surveyId && Array.isArray(dGL)) {
    const found = dGL.find(s => s.id === state.surveyId);
    assert('Submitted survey present in GET /api/surveys', !!found,
      `surveyId=${state.surveyId} not in [${dGL.slice(0,3).map(s=>s.id).join(', ')}...]`);
    if (found) {
      assertField(found, 'projectId',   'Survey has projectId');
      assertField(found, 'templateId',  'Survey has templateId');
      assertField(found, 'submittedBy', 'Survey has submittedBy');
      assertField(found, 'answers',     'Survey has answers object');
      assert('Survey answers not empty', Object.keys(found.answers || {}).length > 0,
        `answers=${JSON.stringify(found.answers)}`);
    }
  }

  // ─── KEY CHECK: survey review item must appear in GET /api/reviews ────
  console.log(`\n  ${C.magenta}[REVIEW GET]${C.reset} Verifying survey data reached review queue...`);
  const { status: sRQ, data: dRQ } = await api('GET', '/api/reviews', { token: tokens.reviewer });
  assert('GET /api/reviews → 200', sRQ === 200, `status=${sRQ}`);
  assert('Review queue returns array', Array.isArray(dRQ), `type=${typeof dRQ}`);

  if (state.reviewItemId && Array.isArray(dRQ)) {
    const revItem = dRQ.find(r => r.id === state.reviewItemId);
    assert(
      '★ Survey review item present in /api/reviews',
      !!revItem,
      `reviewItemId=${state.reviewItemId} NOT FOUND in queue of ${dRQ.length} items.\n` +
      `     First 5 IDs: [${dRQ.slice(0,5).map(r=>r.id).join(', ')}${dRQ.length>5?'...':''}]`
    );

    if (revItem) {
      assert('Review item type = "survey"',        revItem.type === 'survey',          `type=${revItem.type}`);
      assert('Review item state = "needs-review"', revItem.state === 'needs-review',   `state=${revItem.state}`);
      assert('Review item has reporter',           !!revItem.reporter,                 `reporter=${revItem.reporter}`);
      assert('Review item source contains Survey', (revItem.source||'').includes('Survey'), `source="${revItem.source}"`);
      assert('Review item has surveyAnswers',       !!revItem.surveyAnswers,
        `surveyAnswers=${JSON.stringify(revItem.surveyAnswers)}`);
      assert('surveyAnswers not empty',
        Object.keys(revItem.surveyAnswers || {}).length > 0,
        `surveyAnswers=${JSON.stringify(revItem.surveyAnswers)}`);
      info(`Review item: ${revItem.id}  source="${revItem.source}"  reporter="${revItem.reporter}"`);
    }
  } else if (Array.isArray(dRQ)) {
    const survRevs = dRQ.filter(r => r.type === 'survey');
    wn(`reviewItemId not captured, found ${survRevs.length} survey-type items in queue`);
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION 6 — Review Queue: tabs & single-item fetch
// ─────────────────────────────────────────────────────────────
async function testReviewQueue() {
  hdr('6 · Review Queue — tabs & single item');

  const tabs = ['needs-review', 'high-confidence', 'approved', 'rejected', 'all'];
  for (const tab of tabs) {
    const { status, data } = await api('GET', `/api/reviews?tab=${tab}`, { token: tokens.reviewer });
    assert(`GET /api/reviews?tab=${tab} → 200`, status === 200, `status=${status}`);
    assert(`tab=${tab} returns array`, Array.isArray(data), `type=${typeof data}`);
  }

  if (state.reviewItemId) {
    const { status, data } = await api('GET', `/api/reviews/${state.reviewItemId}`, { token: tokens.reviewer });
    assert('GET /api/reviews/:id → 200', status === 200, `status=${status}`);
    assertField(data, 'id',    'Review item has id');
    assertField(data, 'state', 'Review item has state');
  }

  const { status: s404 } = await api('GET', '/api/reviews/REV-9999999', { token: tokens.reviewer });
  assert('GET non-existent review → 404', s404 === 404, `status=${s404}`);
}

// ─────────────────────────────────────────────────────────────
// SECTION 7 — Field Reports
// ─────────────────────────────────────────────────────────────
async function testFieldReports() {
  hdr('7 · Field Reports');

  if (!state.testProjectId) { wn('No project — skipping'); return; }

  const payload = {
    projectId:      state.testProjectId,
    author:         'Manoj Kalita',
    rawTranscript:  'Completed concrete pouring for compressor pad B2 — 42 cum poured, surface finishing in progress. No blockers.',
    extractedEvent: {
      activity:   'Concrete Pouring — Compressor Pad B2',
      status:     'In Progress',
      blocker:    'None',
      discipline: 'Civil'
    },
    matchedActivity: state.activityId ? {
      id:         state.activityId,
      name:       'Activity from DB',
      code:       'ACT-TEST',
      confidence: 88
    } : null,
    confidence:   88,
    signals:      ['pad', 'B2', 'concrete', 'compressor'],
    alternatives: [],
    evidenceItems: [],
    sourceLabel:  'Mobile Field App',
    isOffline:    false
  };

  const { status, data } = await api('POST', '/api/reports', {
    token: tokens.supervisor, body: payload
  });
  assert('POST /api/reports → 201', status === 201, `status=${status} body=${JSON.stringify(data)}`);
  assertField(data, 'id',           'Report response has id');
  assertField(data, 'reviewItemId', 'Report response has reviewItemId');

  if (data?.id) {
    state.reportId           = data.id;
    state.reportReviewItemId = data.reviewItemId;
    info(`Report ID: ${state.reportId}  ReviewItem: ${state.reportReviewItemId}`);
  }

  const { status: sL, data: dL } = await api('GET', '/api/reports', { token: tokens.planner });
  assert('GET /api/reports → 200', sL === 200, `status=${sL}`);
  assert('Returns array', Array.isArray(dL), `type=${typeof dL}`);

  if (state.reportId) {
    const { status: sI, data: dI } = await api('POST', '/api/reports', {
      token: tokens.supervisor, body: { ...payload, id: state.reportId }
    });
    assert('Duplicate report POST → 200 with duplicate:true',
      sI === 200 && dI?.duplicate === true,
      `status=${sI} dup=${dI?.duplicate}`);
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION 8 — Approve & Reject Reviews (RBAC)
// ─────────────────────────────────────────────────────────────
async function testReviewActions() {
  hdr('8 · Review Approve / Reject (RBAC)');

  if (state.reviewItemId) {
    // Field Supervisor cannot approve
    const { status: sForbid } = await api('POST', `/api/reviews/${state.reviewItemId}/approve`, {
      token: tokens.supervisor, body: {}
    });
    assert('Field Supervisor approve → 403', sForbid === 403, `status=${sForbid}`);

    // Reviewer approves the survey review
    const { status: sApp, data: dApp } = await api('POST', `/api/reviews/${state.reviewItemId}/approve`, {
      token: tokens.reviewer, body: {}
    });
    assert('Reviewer approve survey review → 200', sApp === 200, `status=${sApp} body=${JSON.stringify(dApp)}`);
    assert('State = approved',   dApp?.state === 'approved', `state=${dApp?.state}`);
    assert('reviewer field set', !!dApp?.reviewer,           `reviewer=${dApp?.reviewer}`);
    assert('reviewedAt set',     !!dApp?.reviewedAt,         `reviewedAt=${dApp?.reviewedAt}`);

    // Double-approve → 409
    const { status: sDbl } = await api('POST', `/api/reviews/${state.reviewItemId}/approve`, {
      token: tokens.reviewer, body: {}
    });
    assert('Double-approve → 409', sDbl === 409, `status=${sDbl}`);
  }

  if (state.reportReviewItemId) {
    const { status: sRej, data: dRej } = await api('POST', `/api/reviews/${state.reportReviewItemId}/reject`, {
      token: tokens.planner, body: { reason: 'Activity match incorrect — verify chainage' }
    });
    assert('Planner reject field report review → 200', sRej === 200, `status=${sRej}`);
    assert('State = rejected',         dRej?.state === 'rejected', `state=${dRej?.state}`);
    assert('rejectionReason persisted', !!dRej?.rejectionReason,   `rejectionReason=${dRej?.rejectionReason}`);
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION 9 — Evidence
// ─────────────────────────────────────────────────────────────
async function testEvidence() {
  hdr('9 · Evidence');

  if (!state.testProjectId) { wn('No project — skipping'); return; }

  const { status, data } = await api('GET', '/api/evidence', { token: tokens.reviewer });
  assert('GET /api/evidence → 200', status === 200, `status=${status}`);
  assert('Returns array', Array.isArray(data), `type=${typeof data}`);

  const { status: sSign, data: dSign } = await api('POST', '/api/evidence/sign', {
    token: tokens.supervisor,
    body: { filename: 'test-photo.jpg', type: 'image/jpeg', projectId: state.testProjectId }
  });
  if (sSign === 200) {
    ok('POST /api/evidence/sign → 200 (Cloudinary configured)');
    assertField(dSign, 'uploadUrl', 'Sign response has uploadUrl');
  } else if ([400, 503].includes(sSign)) {
    wn(`POST /api/evidence/sign → ${sSign} (Cloudinary not configured — expected in local dev)`);
  } else {
    ko(`POST /api/evidence/sign → unexpected ${sSign}`, JSON.stringify(dSign));
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION 10 — Audit Trail
// ─────────────────────────────────────────────────────────────
async function testAudit() {
  hdr('10 · Audit Trail');

  const { status, data } = await api('GET', '/api/audit', { token: tokens.manager });
  assert('GET /api/audit → 200', status === 200, `status=${status}`);
  assert('Returns array', Array.isArray(data), `type=${typeof data}`);

  if (Array.isArray(data) && data.length > 0) {
    const e = data[0];
    assertField(e, 'id',     'Audit event has id');
    assertField(e, 'action', 'Audit event has action');
    assertField(e, 'actor',  'Audit event has actor');
    info(`Latest audit: [${e.action}] by ${e.actor} (${e.role})`);

    const srvAudit = data.find(ev => ev.action === 'Survey Submitted');
    assert('Survey Submitted audit event recorded', !!srvAudit,
      `No "Survey Submitted" in last ${data.length} events`);
  }

  const { status: sV, data: dV } = await api('GET', '/api/audit/verify', { token: tokens.admin });
  assert('GET /api/audit/verify → 200', sV === 200, `status=${sV}`);
  assert('Audit chain valid', dV?.valid === true, `valid=${dV?.valid} brokenAt=${dV?.brokenAtSeq}`);
  info(`Chain length: ${dV?.chainLength || 'n/a'}`);
}

// ─────────────────────────────────────────────────────────────
// SECTION 11 — Admin User Management
// ─────────────────────────────────────────────────────────────
async function testUserManagement() {
  hdr('11 · Admin User Management');

  const { status: sL, data: dL } = await api('GET', '/api/users', { token: tokens.admin });
  assert('GET /api/users (admin) → 200', sL === 200, `status=${sL}`);
  assert('Returns array', Array.isArray(dL), `type=${typeof dL}`);

  const { status: sFb } = await api('GET', '/api/users', { token: tokens.supervisor });
  assert('GET /api/users (non-admin) → 403', sFb === 403, `status=${sFb}`);

  const newUser = {
    username:      `testuser_${Date.now()}`,
    password:      'testpass123',
    name:          'Test User Auto',
    role:          'Field Supervisor',
    title:         'Test Field Engineer',
    department:    'Test Operations',
    allowedRoutes: ['/overview', '/surveys', '/progress']
  };
  const { status: sCr, data: dCr } = await api('POST', '/api/users', {
    token: tokens.admin, body: newUser
  });
  assert('POST /api/users (admin) → 201', sCr === 201, `status=${sCr} body=${JSON.stringify(dCr)}`);

  if (dCr?.id) {
    state.testUserId = dCr.id;
    assertField(dCr, 'username', 'Created user has username');
    assertField(dCr, 'role',     'Created user has role');

    const { status: sPa } = await api('PATCH', `/api/users/${state.testUserId}`, {
      token: tokens.admin, body: { title: 'Updated Title' }
    });
    assert('PATCH /api/users/:id → 200', sPa === 200, `status=${sPa}`);

    const { status: sDe } = await api('DELETE', `/api/users/${state.testUserId}`, { token: tokens.admin });
    assert('DELETE /api/users/:id → 200', sDe === 200, `status=${sDe}`);

    const { status: sLg } = await api('POST', '/api/auth/login', {
      body: { username: newUser.username, password: newUser.password }
    });
    assert('Deleted user login → 401', sLg === 401, `status=${sLg}`);
  }

  const { status: sDup } = await api('POST', '/api/users', {
    token: tokens.admin,
    body: { ...newUser, username: 'supervisor' }
  });
  assert('Duplicate username → 409', sDup === 409, `status=${sDup}`);

  const { status: sShort } = await api('POST', '/api/users', {
    token: tokens.admin,
    body: { ...newUser, username: `short_${Date.now()}`, password: '123' }
  });
  assert('Short password → 400', sShort === 400, `status=${sShort}`);
}

// ─────────────────────────────────────────────────────────────
// SECTION 12 — Assignments
// ─────────────────────────────────────────────────────────────
async function testAssignments() {
  hdr('12 · Project Assignments');

  if (!state.testProjectId) { wn('No project — skipping'); return; }

  const { status: sL } = await api('GET', `/api/projects/${state.testProjectId}/assignments`, { token: tokens.manager });
  assert('GET /api/projects/:id/assignments → 200', sL === 200, `status=${sL}`);

  const { status: sA, data: dA } = await api('POST', `/api/projects/${state.testProjectId}/assignments`, {
    token: tokens.admin,
    body: { userId: 'USR-REV-01', discipline: 'Civil' }
  });
  assert('POST /api/projects/:id/assignments → 200/201', [200,201].includes(sA), `status=${sA}`);

  const { status: sI } = await api('POST', `/api/projects/${state.testProjectId}/assignments`, {
    token: tokens.admin,
    body: { userId: 'USR-REV-01', discipline: 'Civil' }
  });
  assert('Duplicate assignment idempotent → 200/201/409', [200,201,409].includes(sI), `status=${sI}`);

  if (dA && dA.id) {
    const { status: sU } = await api('DELETE', `/api/projects/${state.testProjectId}/assignments/${dA.id}`, {
      token: tokens.admin
    });
    assert('DELETE /api/projects/:id/assignments/:assignmentId → 200', sU === 200, `status=${sU}`);
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION 13 — Project Workspace aggregate
// ─────────────────────────────────────────────────────────────
async function testWorkspace() {
  hdr('13 · Project Workspace Aggregate');

  if (!state.testProjectId) { wn('No project — skipping'); return; }

  const { status, data } = await api('GET', `/api/projects/${state.testProjectId}/workspace`, { token: tokens.planner });
  assert('GET /api/projects/:id/workspace → 200', status === 200, `status=${status}`);
  assertField(data, 'project',    'Workspace has project');
  assertField(data, 'activities', 'Workspace has activities array');
  assertField(data, 'reports',    'Workspace has reports array');
  assertField(data, 'reviews',    'Workspace has reviews array');
  assertField(data, 'surveys',    'Workspace has surveys array');
  assert('surveys is array', Array.isArray(data?.surveys), `type=${typeof data?.surveys}`);
  assert('reviews is array', Array.isArray(data?.reviews), `type=${typeof data?.reviews}`);
}

// ─────────────────────────────────────────────────────────────
// SECTION 14 — LLM Classification (optional)
// ─────────────────────────────────────────────────────────────
async function testClassify() {
  hdr('14 · LLM Classification (optional — needs AI binding)');

  if (!state.testProjectId) { wn('No project — skipping'); return; }

  const { status, data } = await api('POST', '/api/classify', {
    token: tokens.supervisor,
    body: {
      transcript: 'Hydrostatic testing on 16 inch header spool completed with zero pressure drop.',
      projectId:  state.testProjectId
    }
  });

  if (status === 200) {
    ok('POST /api/classify → 200 (AI binding available)');
    assertField(data, 'extractedEvent', 'Classify returns extractedEvent');
    assert('Classify includes topMatch key', data && 'topMatch' in data, `missing topMatch`);
  } else if (status === 503) {
    wn('POST /api/classify → 503 (AI binding not available in local dev — expected)');
  } else {
    ko(`POST /api/classify → unexpected ${status}`, JSON.stringify(data));
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION 15 — Logout
// ─────────────────────────────────────────────────────────────
async function testLogout() {
  hdr('15 · Auth Logout');

  const { status: sOut } = await api('POST', '/api/auth/logout', {
    token: tokens.supervisor,
    body: { refresh: state.refreshToken }
  });
  assert('POST /api/auth/logout → 200', sOut === 200, `status=${sOut}`);

  if (state.refreshToken) {
    const { status: sExp } = await api('POST', '/api/auth/refresh', {
      body: { refresh: state.refreshToken }
    });
    assert('Revoked refresh token → 401', sExp === 401, `status=${sExp}`);
  }
}

// ─────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────
function summary() {
  const total = pass + fail + warn;
  console.log(`\n${C.bold}${'═'.repeat(60)}${C.reset}`);
  console.log(`${C.bold}  TEST SUMMARY${C.reset}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Total:    ${total}`);
  console.log(`  ${C.green}Passed:   ${pass}${C.reset}`);
  console.log(`  ${C.red}Failed:   ${fail}${C.reset}`);
  console.log(`  ${C.yellow}Warnings: ${warn}${C.reset}`);
  console.log(`${'═'.repeat(60)}`);

  if (fail === 0) {
    console.log(`\n${C.bold}${C.green}  ✅  ALL CHECKS PASSED!${C.reset}\n`);
  } else {
    console.log(`\n${C.bold}${C.red}  ❌  ${fail} CHECK(S) FAILED — see ✘ lines above.${C.reset}`);
    console.log(`${C.yellow}  Hint: Section 5 tests the survey → review queue flow.${C.reset}`);
    console.log(`${C.yellow}  If ★ KEY CHECK fails: POST /api/surveys must INSERT into reviews table.${C.reset}\n`);
  }

  process.exit(fail > 0 ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.bold}${C.magenta}╔══════════════════════════════════════════════════════════╗`);
  console.log(`║   OIL Bridge API — Full Feature Integration Test Suite  ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝${C.reset}`);
  console.log(`  Target: ${C.cyan}${BASE_URL}${C.reset}`);
  console.log(`  Time:   ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST\n`);

  try {
    await testHealth();
    await testAuth();
    await testProjects();
    await testActivities();
    await testSurveyTemplates();
    await testSurveySubmission();    // ← Key survey→review flow
    await testReviewQueue();
    await testFieldReports();
    await testReviewActions();
    await testEvidence();
    await testAudit();
    await testUserManagement();
    await testAssignments();
    await testWorkspace();
    await testClassify();
    await testLogout();
  } catch (e) {
    console.error(`\n${C.red}${C.bold}FATAL TEST ERROR:${C.reset}`, e);
    fail++;
  }

  summary();
}

main();
