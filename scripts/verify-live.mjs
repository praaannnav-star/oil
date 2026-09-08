#!/usr/bin/env node
// Deployment acceptance gate for the OIL Field-to-Schedule Bridge.
//
// Usage:
//   node scripts/verify-live.mjs [targetUrl] [--strict]
//     targetUrl  default https://master.oil-bridge-pwa.pages.dev
//     --strict   treat header gaps and build drift as failures (for CI post-Gate-0)
//
// Part 1 — capability-probe decision matrix (offline, mocked fetch).
//          Proves ApiService picks the right mode for every backend shape:
//          real JSON API, Pages SPA fallback, 404, 5xx, network death.
// Part 2 — target deployment checks:
//          W1 mode classification (/api/* JSON vs SPA-fallback HTML)
//          W2 build drift (sha256 of key files, local vs deployed)
//          W3 security headers audit (CSP/HSTS/XFO/Permissions-Policy/nosniff)
//          W4 mini live e2e — runs ONLY when a real backend answers:
//             login -> extract -> fixed-id report replay dedupe
// Exit 0 = all mandatory checks green.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { API } from '../js/services/api.js';

const TARGET = (process.argv.find(a => a.startsWith('http')) ||
  'https://master.oil-bridge-pwa.pages.dev').replace(/\/$/, '');
const STRICT = process.argv.includes('--strict');

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0, fail = 0, warn = 0;
function check(name, ok, detail = '', level = 'fail') {
  const tag = ok ? '[ok  ]' : (level === 'warn' && !STRICT ? '[WARN]' : '[FAIL]');
  if (!ok) { if (level === 'warn' && !STRICT) warn++; else fail++; }
  else pass++;
  console.log(`${tag} ${name}${detail ? '  -> ' + detail : ''}`);
}

// ===================================================================
// PART 1 — probe decision matrix (no network: fetch is mocked)
// ===================================================================
async function part1ProbeMatrix() {
  console.log('\n-- Part 1: capability-probe decision matrix (offline) --');
  const realFetch = globalThis.fetch;
  const quietInfo = console.info; console.info = () => {}; // silence mode banners

  const jsonResponse = body => ({
    ok: true, status: 200,
    headers: { get: k => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => body
  });
  const htmlResponse = () => ({
    ok: true, status: 200,
    headers: { get: k => (k.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null) },
    json: async () => { throw new SyntaxError('Unexpected token < in JSON'); }
  });

  // [name, mockFetch impl, expected useMock]
  const CASES = [
    ['V1 real Workers API (JSON 200)',
      async () => jsonResponse({ projects: 2, reports: 240 }), false],
    ['V2 Pages SPA fallback (200 text/html)',
      async () => htmlResponse(), true],
    ['V3 endpoint missing (404)',
      async () => ({ ok: false, status: 404, headers: { get: () => 'application/json' }, json: async () => ({}) }), true],
    ['V4 backend error (500)',
      async () => ({ ok: false, status: 500, headers: { get: () => 'text/plain' }, json: async () => ({}) }), true],
    ['V5 network dead (fetch rejects)',
      async () => { throw new TypeError('fetch failed'); }, true],
    ['V6 JSON body but missing content-type',
      async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ projects: 9 }) }), true]
  ];

  for (const [name, impl, expected] of CASES) {
    globalThis.fetch = impl;
    API._probePromise = null;           // reset memo per case
    try {
      await API._probeBackend();
      check(name, API.useMock === expected, `useMock=${API.useMock}, expected=${expected}`);
    } catch (e) {
      check(name, false, `probe itself threw: ${e.message}`);
    }
  }

  console.info = quietInfo;
  globalThis.fetch = realFetch;         // restore for Part 2
  API._probePromise = null;
}

// ===================================================================
// PART 2 — target deployment checks
// ===================================================================
async function part2Target() {
  console.log(`\n-- Part 2: deployment ${TARGET} --`);

  // ---- W1: mode classification ------------------------------------------
  let liveMode = false;
  try {
    const r = await fetch(`${TARGET}/api/stats/public`, { headers: { Accept: 'application/json' } });
    const ct = r.headers.get('content-type') || '';
    liveMode = r.ok && ct.includes('application/json');
    check('W1 mode classification',
      true,
      liveMode ? 'LIVE backend answering JSON -> app will run live mode'
               : `no live API (${r.status} ${ct.split(';')[0] || 'unknown'}) -> app will stay in mock mode`);
  } catch (e) {
    check('W1 mode classification', false, `unreachable: ${e.message}`);
  }

  // ---- W2: build drift (local vs deployed sha256) ------------------------
  const KEY_FILES = ['service-worker.js', 'js/services/api.js', 'js/services/reports.js', 'js/services/activities.js'];
  const sha = s => createHash('sha256').update(s).digest('hex').slice(0, 12);
  let drifted = [];
  for (const f of KEY_FILES) {
    try {
      const local = readFileSync(join(repoRoot, f), 'utf8');
      const remote = await (await fetch(`${TARGET}/${f}`)).text();
      if (sha(local) !== sha(remote)) drifted.push(f);
    } catch {
      drifted.push(`${f} (unfetchable)`);
    }
  }
  check('W2 build freshness (key files match deployed)', drifted.length === 0,
    drifted.length ? `DRIFTED: ${drifted.join(', ')} — redeploy required to ship current fixes` : `all ${KEY_FILES.length} identical`,
    'warn');

  // ---- W3: security headers ----------------------------------------------
  try {
    const page = await fetch(TARGET);
    const H = k => (page.headers.get(k) || '').toLowerCase();
    check('W3a X-Content-Type-Options: nosniff', H('x-content-type-options') === 'nosniff', H('x-content-type-options') || 'absent', 'warn');
    check('W3b X-Frame-Options: deny', H('x-frame-options') === 'deny', H('x-frame-options') || 'absent', 'warn');
    check('W3c Strict-Transport-Security present', H('strict-transport-security').includes('max-age'), H('strict-transport-security') || 'absent', 'warn');
    check('W3d Permissions-Policy present', H('permissions-policy').length > 0, H('permissions-policy') || 'absent', 'warn');
    const csp = H('content-security-policy');
    const cspRo = H('content-security-policy-report-only');
    check('W3e CSP present (enforced or report-only)', csp.length > 0 || cspRo.length > 0,
      csp ? 'enforced' : (cspRo ? 'report-only' : 'absent'), 'warn');
  } catch (e) {
    check('W3 security headers', false, `page unreachable: ${e.message}`);
  }

  // ---- W4: mini live e2e (only when a real backend exists) ----------------
  if (!liveMode) {
    check('W4 live e2e', true, 'skipped — no live backend yet (expected pre-Gate-0)');
    return;
  }
  console.log('   live backend detected — running mini e2e...');
  const call = async (path, { method, token, body } = {}) => {
    const res = await fetch(`${TARGET}/api${path}`, {
      method: method || (body ? 'POST' : 'GET'),
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
    return res.json();
  };

  let tok;
  try {
    tok = (await call('/auth/login', { method: 'POST', body: { username: 'admin', password: 'password123' } })).jwt;
    check('W4a login', true);
  } catch (e) { check('W4a login', false, e.message); return; }

  try {
    const ex = await call('/extract', { method: 'POST', token: tok, body: { transcript: 'Welding completed near J-44, B2 pad' } });
    check('W4b extraction returns structured event', !!(ex.activity || ex.assetTag || ex.status), JSON.stringify(ex).slice(0, 80));
  } catch (e) { check('W4b extraction', false, e.message); }

  try {
    const id = `REP-VERIFY-${Date.now()}`;
    await call('/reports', { method: 'POST', token: tok, body: { id, projectId: 'PRJ-OIL-2026-01', author: 'verify-live', rawTranscript: 'acceptance gate replay probe' } });
    const replay = await call('/reports', { method: 'POST', token: tok, body: { id, projectId: 'PRJ-OIL-2026-01', author: 'verify-live', rawTranscript: 'acceptance gate replay probe' } });
    check('W4c report idempotency (fixed-id replay dedupes)', replay.duplicate === true, `duplicate=${replay.duplicate}`);
  } catch (e) { check('W4c idempotency', false, e.message); }
}

// ===================================================================
console.log('Deployment acceptance gate — verify-live.mjs');
await part1ProbeMatrix();
await part2Target();

console.log(`\n${pass} passed, ${fail} failed${warn ? `, ${warn} warning(s)` : ''}` +
  (STRICT ? ' [--strict: warnings counted as failures]' : ''));
process.exit(fail > 0 ? 1 : 0);
