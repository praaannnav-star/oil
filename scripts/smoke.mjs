#!/usr/bin/env node
// Zero-dependency smoke test for the OIL Field-to-Schedule Bridge PWA.
// Verifies that every precached app-shell asset actually resolves on a running
// server — the #1 cause of broken offline installs is SW cache drift.
//
// Usage:
//   node scripts/smoke.mjs [baseURL]     (default: http://localhost:8000)
// Exit code 0 = all green, 1 = failures found.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const base = (process.argv[2] || 'http://localhost:8000').replace(/\/$/, '');
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function extractShellPaths() {
  const sw = readFileSync(join(repoRoot, 'service-worker.js'), 'utf8');
  const match = sw.match(/APP_SHELL\s*=\s*\[([^\]]+)\]/s);
  if (!match) throw new Error('APP_SHELL not found in service-worker.js');
  return [...match[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
}

async function checkUrl(path) {
  const res = await fetch(base + path.replace(/^\.\//, '/'));
  if (!res.ok) return { path, ok: false, detail: `HTTP ${res.status}` };
  const ct = res.headers.get('content-type') || '';
  // A dev server returning index.html for missing JS is a classic silent failure
  if (/\.js$/.test(path) && !/javascript|module/i.test(ct)) {
    return { path, ok: false, detail: `content-type "${ct}" is not JS (HTML fallback for a missing file?)` };
  }
  return { path, ok: true, detail: `${res.status} ${ct.split(';')[0]}` };
}

const shell = extractShellPaths();
console.log(`Smoke testing ${shell.length} app-shell assets against ${base}\n`);

const results = [];
for (const p of shell) {
  try {
    results.push(await checkUrl(p));
  } catch (err) {
    results.push({ path: p, ok: false, detail: err.message });
  }
}

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.path}${r.ok ? '' : '  -> ' + r.detail}`);
}

// Manifest sanity
try {
  const manifest = JSON.parse(readFileSync(join(repoRoot, 'manifest.json'), 'utf8'));
  const iconPaths = manifest.icons.map(i => '/' + i.src.replace(/^\.\//, ''));
  for (const ip of iconPaths) {
    try {
      const r = await checkUrl(ip);
      results.push(r);
      if (!r.ok) failed++;
      console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${ip} (manifest icon)${r.ok ? '' : '  -> ' + r.detail}`);
    } catch (err) {
      failed++;
      console.log(`FAIL  ${ip} (manifest icon)  -> ${err.message}`);
    }
  }
} catch (err) {
  console.log(`WARN  manifest.json unreadable: ${err.message}`);
}

// App-shell completeness: every js/css asset shipped in the repo must be
// precached, otherwise an installed PWA breaks offline on first navigation.
let drift = 0;
try {
  const shellSet = new Set(shell.map(p => '/' + p.replace(/^\.\//, '')));
  for (const dir of ['js', 'css']) {
    const absDir = join(repoRoot, dir);
    const walk = (d) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const full = join(d, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.(js|css)$/.test(entry.name)) continue;
        const rel = '/' + relative(repoRoot, full).split(/[\\/]/).join('/');
        if (!shellSet.has(rel)) {
          drift++;
          console.log(`FAIL  ${rel} exists in repo but is NOT in APP_SHELL (offline cache drift)`);
        }
      }
    };
    walk(absDir);
  }
} catch (err) {
  console.log(`WARN  could not audit APP_SHELL completeness: ${err.message}`);
}

console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed + drift > 0 ? 1 : 0);
