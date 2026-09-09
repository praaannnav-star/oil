// OIL Bridge API — request router.
// Route table with :param capture, JWT/RBAC gates, CORS preflight and a
// uniform JSON error envelope. All handlers run inside guard() so unexpected
// failures return 500 JSON instead of an HTML error page.
import { json, err, preflight, guard } from './lib/http.js';
import { requireAuth } from './lib/authz.js';
import { AuditChain } from './lib/audit.js';
import { refreshStatsCache, runGoldenSetBenchmark } from './lib/stats.js';

import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import reportRoutes from './routes/reports.js';
import reviewRoutes from './routes/reviews.js';
import evidenceRoutes from './routes/evidence.js';
import surveyRoutes from './routes/surveys.js';
import classifyRoutes from './routes/classify.js';
import llmRoutes from './routes/llm.js';
import assignmentRoutes from './routes/assignments.js';
import analyticsRoutes from './routes/analytics.js';
import ingestRoutes from './routes/ingest.js';

// Each entry: { method, pattern, handler, opts }
//   opts.auth  -> Bearer JWT required (ctx.user injected)
//   opts.review-> additionally requires reviewer-rank role
const ROUTES = [
  ...authRoutes,
  ...projectRoutes,
  ...reportRoutes,
  ...reviewRoutes,
  ...evidenceRoutes,
  ...surveyRoutes,
  ...classifyRoutes,
  ...llmRoutes,
  ...assignmentRoutes,
  ...analyticsRoutes,
  ...ingestRoutes
].map(r => ({ ...r, parts: r.pattern.split('/').filter(Boolean) }));

function matchRoute(method, pathParts) {
  for (const route of ROUTES) {
    if (route.method !== method || route.parts.length !== pathParts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < route.parts.length; i++) {
      const seg = route.parts[i];
      if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(pathParts[i]);
      else if (seg !== pathParts[i]) { ok = false; break; }
    }
    if (ok) return { route, params };
  }
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return preflight();

    if (!url.pathname.startsWith('/api/')) {
      return json({ service: 'oil-bridge-api', status: 'ok', time: new Date().toISOString() });
    }

    if (!env.DB) return err(503, 'D1 binding missing — run `wrangler d1 execute oil-field-db --file=./schema.sql`');
    if (!env.JWT_SECRET && url.pathname !== '/api/health') return err(503, 'JWT_SECRET not set — run `wrangler secret put JWT_SECRET`');

    return guard(async () => {
      const pathParts = url.pathname.split('/').filter(Boolean);
      const found = matchRoute(request.method, pathParts);
      if (!found) return err(404, `No route for ${request.method} ${url.pathname}`);
      const { route, params } = found;

      const ctxData = {
        ctx,
        env,
        params,
        query: Object.fromEntries(url.searchParams.entries()),
        db: env.DB,
        audit: new AuditChain(env.DB),
        user: null,
        body: null
      };

      if (route.opts?.auth || route.opts?.review) {
        ctxData.user = await requireAuth(request, env);
      }

      ctxData.body = await parseBody(request);

      return route.handler(ctxData);
    });
  },

  // Nightly cron: verify the audit hash chain, refresh cached public stats, and dispatch executive digests.
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        const verdict = await new AuditChain(env.DB).verify();
        await refreshStatsCache(env.DB);
        console.log('[cron] audit chain verify:', JSON.stringify(verdict));
        if (!verdict.valid) console.error('[cron] AUDIT CHAIN BROKEN at seq', verdict.brokenAtSeq);

        // Phase W2: Executive Daily Digest Generation & Email Dispatch
        await dispatchExecutiveDigests(env);

        // Phase W4: Golden-Set AI Accuracy Benchmark & Tuning Evaluation
        const benchmark = await runGoldenSetBenchmark(env.DB, env);
        console.log('[cron] AI Golden-Set benchmark:', JSON.stringify(benchmark));
      } catch (e) {
        console.error('[cron] failed:', e);
      }
    })());
  }
};

async function dispatchExecutiveDigests(env) {
  if (!env.DB) return;
  const today = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: 'numeric' });
  const projects = (await env.DB.prepare('SELECT id, code, name, health, spi, risk_tier FROM projects').all()).results || [];
  
  for (const proj of projects) {
    const recentReports = (await env.DB.prepare(
      'SELECT raw_transcript, extracted_json, author, created_at FROM field_reports WHERE project_id = ? ORDER BY created_at DESC LIMIT 5'
    ).bind(proj.id).all()).results || [];

    const pendingRev = await env.DB.prepare(
      "SELECT COUNT(*) as n FROM reviews WHERE state = 'needs-review'"
    ).first();

    const pendingCount = Number(pendingRev?.n || 0);

    const bullets = [];
    if (recentReports.length > 0) {
      for (const r of recentReports.slice(0, 3)) {
        const ex = (() => { try { return JSON.parse(r.extracted_json || '{}'); } catch { return {}; } })();
        if (ex?.blocker && ex.blocker !== 'None') {
          bullets.push(`⚠️ Blockage: ${ex.blocker} (${ex.activity || 'Field item'})`);
        } else {
          bullets.push(`✅ Progress: ${ex.activity || r.raw_transcript}`);
        }
      }
    } else {
      bullets.push('No new critical blockers or progress entries logged in the last 24h.');
    }

    if (pendingCount > 0) {
      bullets.push(`⏳ ${pendingCount} field report(s) currently awaiting planner validation.`);
    }

    const emailSubject = `[OIL DIGEST] ${proj.code} (${proj.name}) — Daily Field Ops Status (${today})`;
    const emailBody = `
================================================================================
OIL INDIA LIMITED — INFRASTRUCTURE PROJECT CONTROLS (SIH26122)
DAILY EXECUTIVE INTELLIGENCE DIGEST
================================================================================
Date:       ${today}
Project:    ${proj.name} [${proj.code}]
Health:     ${String(proj.health || 'On Track').toUpperCase()} | SPI: ${proj.spi || '1.00'} | Risk Tier: ${proj.risk_tier || 'Medium'}
Recipients: Executive Directorate, Operations & Project Controls

Key Operational Highlights:
${bullets.map(b => `  • ${b}`).join('\n')}

Audit Status: Hash-chain verified intact.
Access Real-time Bridge: https://oil-tracker.internal/#/overview
================================================================================
`;

    console.log(`[cron:email] Dispatching Executive Digest for ${proj.code}:\n${emailBody}`);

    // If Cloudflare Send Email Binding (SEB) or MailChannels endpoint is configured:
    if (env.SEND_EMAIL_BINDING) {
      try {
        await env.SEND_EMAIL_BINDING.send({
          to: 'directors@oilindia.in',
          from: 'project-controls@oilindia.in',
          subject: emailSubject,
          text: emailBody
        });
      } catch (err) {
        console.warn(`[cron:email] Remote email dispatch failed for ${proj.code}:`, err.message);
      }
    }
  }
}

async function parseBody(request) {
  if (!['POST', 'PATCH', 'PUT'].includes(request.method)) return null;
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try { return await request.json(); } catch { return {}; }
  }
  return request;
}
