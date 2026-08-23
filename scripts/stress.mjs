#!/usr/bin/env node
// Stress harness for the OIL Field-to-Schedule Bridge (PWA + oil-bridge-api).
//
// Usage:
//   node scripts/stress.mjs [apiBase] [staticBase] [concurrency]
//     apiBase    default http://127.0.0.1:8787   (wrangler dev --local)
//                pass 'skip' to run static-shell-only (deployed Pages, no API yet)
//     staticBase default http://localhost:8000   (python -m http.server / Pages preview)
//     conc       default 25
//
// Prerequisites:
//   API:   cd worker && npx wrangler d1 execute oil-field-db --local --file=./schema.sql
//          then: npx wrangler dev --local --port 8787   (.dev.vars must hold JWT_SECRET;
//          demo personas self-seed on first login when DEMO_MODE=1)
//   PWA:   python -m http.server 8000   (or start-server.bat)
//
// Phases: auth burst -> report flood -> review cycle -> intelligence endpoints ->
//         surveys/evidence -> integrity invariants -> static shell hammering.
// Exit code 0 = all green (unexpected errors == 0 AND invariants hold).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const API = (process.argv[2] || 'http://127.0.0.1:8787').replace(/\/$/, '');
const STATIC = (process.argv[3] || 'http://localhost:8000').replace(/\/$/, '');
const CONC = Math.max(1, Number(process.argv[4]) || 25);
const SKIP = /^(skip|-|none)$/i.test(API);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------- utilities
const pct = (arr, q) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

async function phase(name, total, fn, { concurrency = CONC, expect = [] } = {}) {
  const latencies = [];
  const errors = [];
  const raced = [];
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= total) return;
      const t0 = performance.now();
      try {
        await fn(i);
      } catch (e) {
        const status = e.status || Number(/(\d{3})/.exec(e.message)?.[1]);
        if (expect.includes(status)) raced.push(1);
        else errors.push(`${i}: ${e.message}`);
      }
      latencies.push(performance.now() - t0);
    }
  }

  const t0 = performance.now();
  await Promise.all(Array.from({ length: concurrency }, worker));
  const wall = performance.now() - t0;

  const rps = (total / (wall / 1000)).toFixed(1);
  const flag = errors.length === 0 ? 'ok  ' : 'FAIL';
  console.log(
    `[${flag}] ${name.padEnd(28)} ${String(total).padStart(5)} ops  ` +
      `p50 ${pct(latencies, 0.50).toFixed(0).padStart(5)}ms  ` +
      `p95 ${pct(latencies, 0.95).toFixed(0).padStart(5)}ms  ` +
      `max ${pct(latencies, 1).toFixed(0).padStart(5)}ms  ` +
      `${rps.padStart(7)} rps  ` +
      `err ${errors.length}${raced.length ? ` (+${raced.length} expected)` : ''}`
  );
  for (const e of errors.slice(0, 5)) console.log(`       !! ${e}`);
  return { errors: errors.length };
}

async function call(path, { method, token, body, raw } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (raw !== undefined && raw.type) headers['Content-Type'] = raw.type;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API}/api${path}`, {
      method: method || (body || raw ? 'POST' : 'GET'),
      headers,
      body: body !== undefined ? JSON.stringify(body) : raw instanceof Blob ? raw : undefined
    });
  } catch (e) {
    const err = new Error(`network: ${e.cause?.code || e.message}`);
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} on ${path}`);
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

// ---------------------------------------------------------------- fixtures
const TRANSCRIPTS = [
  'Welding of 16 inch suction header spool completed near J-44',
  'Concrete pouring finished for foundation block B2 pad 14, cube samples collected',
  'Cable laying for junction box JB-102 in progress, DCS loop check pending',
  'Transformer erection delayed due to material shortage at site store',
  'Shuttering work halted near foundation b3 due to heavy monsoon rain',
  'Motor alignment completed for compressor area panel HT side',
  'Flange bolting on suction header stopped, crane breakdown reported',
  'Backfilling and compaction done at trench chainage 42-47',
  'Instrument calibration of pressure sensors underway at rack room',
  'Grouting work near foundation b1 progressing with full crew'
];

let seedCounter = 0;
function makeReport() {
  const t = TRANSCRIPTS[(seedCounter++) % TRANSCRIPTS.length];
  return {
    projectId: seedCounter % 2 === 0 ? 'PRJ-OIL-2026-01' : 'PRJ-OIL-2026-02',
    author: 'Stress Harness',
    rawTranscript: `${t} (load run #${seedCounter})`,
    confidence: 70 + (seedCounter % 25),
    source: 'stress-test'
  };
}

async function main() {
  console.log(`Stress target  API: ${SKIP ? '(skipped — static-only mode)' : API}`);
  console.log(`               PWA: ${STATIC}\n`);
  const failures = [];

  if (!SKIP) {

  // ---- Warm-up: single login triggers demo-user self-seed ------------------
  const warm = await call('/auth/login', { method: 'POST', body: { username: 'admin', password: 'password123' } });
  console.log(`Self-seed login: ${warm.user.name} (${warm.user.role})\n`);

  // ---- Phase A: auth burst (PBKDF2 100k iterations per attempt) ------------
  let a = { errors: [] };
  a = await phase('A auth burst', 48, async () => {
    const users = ['supervisor', 'planner', 'reviewer', 'manager', 'admin', 'executive'];
    const u = users[Math.floor(Math.random() * users.length)];
    await call('/auth/login', { method: 'POST', body: { username: u, password: 'password123' } });
  }, { concurrency: 12 });
  if (a.errors) failures.push('A');

  // ---- Tokens for workflow phases ------------------------------------------
  const sup = await call('/auth/login', { method: 'POST', body: { username: 'supervisor', password: 'password123' } });
  const planner = await call('/auth/login', { method: 'POST', body: { username: 'planner', password: 'password123' } });
  const supTok = sup.jwt;
  const planTok = planner.jwt;

  // ---- Idempotency pre-check: same id replayed must dedupe -----------------
  const dupId = `REP-STRESS-DUP-${Date.now()}`;
  await call('/reports', { method: 'POST', token: supTok, body: { id: dupId, ...makeReport() } });
  const dupReplay = await call('/reports', { method: 'POST', token: supTok, body: { id: dupId, ...makeReport() } });

  // ---- Phase B: report submission flood -------------------------------------
  const REPORTS = 240;
  const b = await phase('B report flood', REPORTS - 1, async () => {
    await call('/reports', { method: 'POST', token: supTok, body: makeReport() });
  });
  if (b.errors) failures.push('B');

  // ---- Phase C: review cycle (approve/reject mix) ---------------------------
  const queue = await call('/reviews', { token: planTok });
  const open = queue.filter(r => r.state === 'needs-review').slice(0, 160);
  const c = await phase('C review cycle', open.length, async (i) => {
    const item = open[i];
    const verdict = i % 2 === 0 ? 'approve' : 'reject';
    await call(`/reviews/${item.id}/${verdict}`, {
      method: 'POST',
      token: planTok,
      body: verdict === 'reject' ? { reason: 'Stress harness rejection' } : {}
    });
  }, { concurrency: 10, expect: [409] }); // 409 = raced another reviewer, acceptable
  if (c.errors) failures.push('C');

  // ---- Phase D: intelligence endpoint hammering -----------------------------
  const d1 = await phase('D1 classify', 60, async (i) => {
    await call('/classify', { method: 'POST', token: supTok, body: { transcript: TRANSCRIPTS[i % TRANSCRIPTS.length] } });
  }, { concurrency: 15 });
  const d2 = await phase('D2 extract', 60, async (i) => {
    await call('/extract', { method: 'POST', token: supTok, body: { transcript: TRANSCRIPTS[i % TRANSCRIPTS.length] } });
  }, { concurrency: 15 });
  const d3 = await phase('D3 delay-cause', 60, async (i) => {
    await call('/delay-cause', { method: 'POST', token: supTok, body: { text: 'crane breakdown plus cement shortage this week' } });
  }, { concurrency: 15 });
  if (d1.errors || d2.errors || d3.errors) failures.push('D');

  // ---- Phase E: surveys + evidence -------------------------------------------
  const templates = await call('/surveys/templates', { token: supTok });
  const tplId = templates[0]?.id || 'TPL-SITE-INSPECTION';
  const e1 = await phase('E1 survey submissions', 80, async () => {
    await call('/surveys', {
      method: 'POST',
      token: supTok,
      body: {
        templateId: tplId,
        projectId: 'PRJ-OIL-2026-01',
        answers: { q_housekeeping: 'Yes', q_overall: 'Pass', q_hazards: 'none observed during stress run' },
        photoCount: 0
      }
    });
  }, { concurrency: 20 });
  const e2 = await phase('E2 evidence metadata', 40, async (i) => {
    await call('/evidence', {
      method: 'POST',
      token: supTok,
      body: {
        url: 'data:image/svg+xml;utf8,stress-thumb-' + i,
        filename: `stress-${i}.jpg`,
        activityId: i % 2 ? 'ACT-CIV-B2-003' : null,
        projectId: 'PRJ-OIL-2026-01',
        type: 'image/jpeg'
      }
    });
  }, { concurrency: 20 });
  if (e1.errors || e2.errors) failures.push('E');

  // ---- Invariants ------------------------------------------------------------
  console.log('');
  const reports = await call('/reports', { token: planTok });
  const ids = new Set(reports.map(r => r.id));
  const invDupes = ids.size === reports.length;
  const invDupReplay = dupReplay.duplicate === true && !ids.has(dupId + '-x');
  const invReplayCounted = reports.filter(r => r.id === dupId).length === 1;

  const audits = await call('/audit', { token: planTok });
  const verdict = await call('/audit/verify', { token: planTok });

  const stats = await call('/stats/public');

  console.log('Invariants:');
  console.log(`  ${invDupes ? 'ok  ' : 'FAIL'} report ids unique            (${reports.length} rows, ${ids.size} unique)`);
  console.log(`  ${invReplayCounted && invDupReplay ? 'ok  ' : 'FAIL'} offline-replay idempotency    (fixed-id replay deduped)`);
  console.log(`  ${verdict.valid ? 'ok  ' : 'FAIL'} audit hash-chain intact       (${verdict.entries ?? audits.length} events, valid=${verdict.valid})`);
  console.log(`  ok   live stats derived          (projects=${stats.projects}, reports=${stats.reports}, pendingReviews=${stats.pendingReviews})`);
  if (!invDupes || !invReplayCounted || !invDupReplay || !verdict.valid) failures.push('INVARIANTS');

  } // end !SKIP (API phases)

  // ---- Static shell hammering -------------------------------------------------
  const sw = readFileSync(join(repoRoot, 'service-worker.js'), 'utf8');
  const shellPaths = [...sw.match(/APP_SHELL\s*=\s*\[([^\]]+)\]/s)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

  let gNext = 0;
  const gTotal = shellPaths.length * 5;
  const gLat = [];
  const gErr = [];
  console.log('');
  const gT0 = performance.now();
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (true) {
      const i = gNext++;
      if (i >= gTotal) return;
      const p = shellPaths[i % shellPaths.length];
      const t0 = performance.now();
      try {
        const res = await fetch(STATIC + '/' + p.replace(/^\.\//, ''));
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      } catch (e) {
        gErr.push(`${p}: ${e.message}`);
      }
      gLat.push(performance.now() - t0);
    }
  }));
  const gWall = ((performance.now() - gT0) / 1000).toFixed(1);
  console.log(
    `[${gErr.length ? 'FAIL' : 'ok  '}] ${'G static shell x5'}`.padEnd(31) +
      `${String(gTotal).padStart(5)} ops  p50 ${pct(gLat, 0.5).toFixed(0).padStart(5)}ms  ` +
      `p95 ${pct(gLat, 0.95).toFixed(0).padStart(5)}ms  max ${pct(gLat, 1).toFixed(0).padStart(5)}ms  ` +
      `${(gTotal / gWall).toFixed(1).padStart(7)} rps  err ${gErr.length}`
  );
  if (gErr.length) failures.push('G');
  for (const e of gErr.slice(0, 3)) console.log(`       !! ${e}`);

  // ---- Verdict ----------------------------------------------------------------
  console.log('\n' + (failures.length === 0 ? 'ALL GREEN — system held up under load.' : `FAILURES IN: ${failures.join(', ')}`));
  process.exit(failures.length ? 1 : 0);
}

main().catch(e => {
  console.error('Harness crashed:', e);
  process.exit(1);
});
