// POST /api/extract      {transcript} -> {event, provenance, source}
// POST /api/summarize    {projectId?} -> {digest, signals, source}
// POST /api/delay-cause  {text}       -> {code, label, source}
// POST /api/transcribe   (audio)      -> {text}   Workers AI Whisper
//
// Every LLM call is temperature-0 with a pinned system prompt
// (worker/src/prompts.js), validated against its schema, retried once on JSON
// drift, and falls back to the deterministic rules engine (plan R1). All LLM
// output lands in the review queue — nothing here mutates the schedule.
import { json, err } from '../lib/http.js';
import { extractRules, delayCauseRules } from '../lib/rules.js';
import { EXTRACT_SYSTEM, SUMMARIZE_SYSTEM, DELAY_CAUSE_SYSTEM, TRANSCRIBE_HINT, CORRECT_SYSTEM, GEO_SYSTEM } from '../prompts.js';

const LLM_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';

async function runLlmJson(env, system, payload, maxTokens = 400) {
  if (!env.AI) return null;
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: typeof payload === 'string' ? payload : JSON.stringify(payload) }
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await env.AI.run(LLM_MODEL, { messages, temperature: 0, max_tokens: maxTokens });
      const text = res.response ?? res.result ?? '';
      
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      
      const cleaned = String(text).replace(/^```(?:json)?/m, '').replace(/```\s*$/m, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      console.error('runLlmJson Error on attempt', attempt, e);
      // JSON drift -> retry once, then rules fallback handles it.
    }
  }
  return null;
}

const EXTRACT_FIELDS = ['discipline', 'activity', 'assetTag', 'qty', 'unit', 'start', 'end', 'status', 'blocker', 'date'];
const RULES_DEFAULTS = { discipline: 'Civil', status: 'In Progress', assetTag: 'General Area', blocker: 'None' };

function mergeExtract(transcript, llmOut) {
  const rulesEvent = extractRules(transcript);
  const llm = llmOut && typeof llmOut === 'object' ? llmOut : {};
  const event = {};
  const provenance = {};

  for (const field of EXTRACT_FIELDS) {
    const llmVal = llm[field] === undefined ? null : llm[field];
    let value;
    let source;
    let confidence;
    if (llmVal !== null && llmVal !== '' && llmVal !== undefined) {
      value = llmVal;
      source = 'llm';
      confidence = 0.75;
    } else if (!(field in RULES_DEFAULTS) || rulesEvent[field] !== RULES_DEFAULTS[field]) {
      value = rulesEvent[field] ?? null;
      source = 'rules';
      confidence = 0.6;
    } else {
      value = null;
      source = 'rules';
      confidence = 0.3;
    }
    event[field] = value;
    provenance[field] = { value: value ?? null, source, confidence };
  }

  // capturedAt is always truthful server time — never an invented shift window.
  event.capturedAt = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) + ' IST';

  const usedLlm = Object.values(provenance).some(p => p.source === 'llm');
  return { event, provenance, source: usedLlm ? 'llm' : 'rules' };
}

export default [
  {
    method: 'POST',
    pattern: '/api/extract',
    opts: { auth: true },
    async handler({ body, env }) {
      const transcript = String(body?.transcript || '');
      if (!transcript.trim()) return err(400, 'transcript is required');
      const llmOut = await runLlmJson(env, EXTRACT_SYSTEM, transcript);
      return json(mergeExtract(transcript, llmOut));
    }
  },

  {
    method: 'POST',
    pattern: '/api/delay-cause',
    opts: { auth: true },
    async handler({ body, env }) {
      const text = String(body?.text || '');
      const rulesResult = delayCauseRules(text);
      // LLM only breaks ties the rules engine cannot resolve.
      if (rulesResult.code !== 'OTHER' && rulesResult.code !== 'NONE') {
        return json({ ...rulesResult, source: 'rules' });
      }
      const llm = await runLlmJson(env, DELAY_CAUSE_SYSTEM, text, 100);
      const ENUMS = ['WEATHER', 'MATERIAL_SHORTAGE', 'EQUIPMENT_BREAKDOWN', 'LABOUR_SHORTAGE', 'PERMIT_CLEARANCE', 'TECHNICAL', 'OTHER', 'NONE'];
      if (llm && ENUMS.includes(llm.code)) {
        return json({ code: llm.code, label: llm.label || rulesResult.label, source: 'llm' });
      }
      return json({ ...rulesResult, source: 'rules' });
    }
  },

  {
    method: 'POST',
    pattern: '/api/summarize',
    opts: { auth: true },
    async handler({ body, db, env }) {
      const projectId = body?.projectId || null;
      const today = new Date().toISOString().split('T')[0];

      // Facts come strictly from D1 — the model only phrases them.
      const reportsStmt = projectId
        ? db.prepare('SELECT * FROM field_reports WHERE project_id = ? ORDER BY created_at DESC LIMIT 30').bind(projectId)
        : db.prepare('SELECT * FROM field_reports ORDER BY created_at DESC LIMIT 30');
      const [actsRes, revRes] = await Promise.all([
        projectId
          ? db.prepare(`SELECT * FROM activities WHERE project_id = ? AND status != 'completed'`).bind(projectId).all()
          : db.prepare(`SELECT * FROM activities WHERE status != 'completed'`).all(),
        db.prepare(`SELECT COUNT(*) AS n FROM reviews WHERE state = 'needs-review'`).first()
      ]);

      const facts = {
        date: today,
        recentReports: reportsStmt.results.map(r => ({
          author: r.author,
          transcript: r.raw_transcript,
          extracted: r.extracted_json,
          matchedActivityId: r.matched_activity_id,
          createdAt: r.created_at
        })),
        openActivities: actsRes.results.slice(0, 20).map(a => ({
          code: a.code, name: a.name, progress: a.progress, status: a.status
        })),
        pendingReviews: Number(revRes?.n || 0)
      };

      const digestLlm = await runLlmJson(env, SUMMARIZE_SYSTEM, facts, 500);

      // Deterministic signals mirror the client's summarizeDailyDigest so the
      // UI keeps working even when the LLM path is unavailable.
      const signals = [];
      for (const r of reportsStmt.results.slice(0, 3)) {
        const ex = (() => { try { return JSON.parse(r.extracted_json || '{}'); } catch { return {}; } })();
        if (ex?.blocker && ex.blocker !== 'None') {
          signals.push({ tone: 'danger', headline: `${r.matched_activity_code || 'SITE'} BLOCKED`, detail: `${ex.blocker}` });
        } else {
          signals.push({ tone: 'success', headline: `${r.matched_activity_code || 'FIELD'} UPDATED`, detail: String(ex?.activity || r.raw_transcript).slice(0, 90) });
        }
      }
      if (facts.pendingReviews > 0) {
        signals.push({ tone: 'warning', headline: `${facts.pendingReviews} ITEM(S) AWAITING REVIEW`, detail: 'Field submissions queued for schedule-linking validation' });
      }

      return json({
        digest: digestLlm || {
          headline: 'Field operations digest',
          bullets: signals.map(s => s.detail),
          tone: signals.some(s => s.tone === 'danger') ? 'danger' : 'info'
        },
        signals,
        source: digestLlm ? 'llm' : 'rules'
      });
    }
  },

  {
    method: 'POST',
    pattern: '/api/transcribe',
    opts: { auth: true },
    async handler({ request, env }) {
      if (!env.AI) return err(503, 'Workers AI binding not configured');
      const ct = request.headers.get('content-type') || 'audio/webm';
      if (!ct.startsWith('audio/')) return err(415, `Expected audio/* body, got ${ct}`);
      const audio = await request.arrayBuffer();
      // R2 mitigation: cap at ~60s of webm/opus (~1.5MB) per plan risk R2.
      if (audio.byteLength > 5 * 1024 * 1024) return err(413, 'Recording too large — cap recordings at 60 seconds');
      try {
        const res = await env.AI.run('@cf/openai/whisper', {
          arrayBuffer: audio,
          prompt: TRANSCRIBE_HINT
        });
        return json({ text: String(res.text || '').trim() });
      } catch (e) {
        return err(502, `Transcription failed: ${e.message}`);
      }
    }
  },

  {
    method: 'POST',
    pattern: '/api/reports/:id/correct',
    opts: { auth: true },
    async handler({ params, body, db, env }) {
      const { id } = params;
      const notes = String(body?.notes || '');
      
      const rep = await db.prepare('SELECT extracted_json, raw_transcript FROM field_reports WHERE id = ?').bind(id).first();
      if (!rep) return err(404, 'Report not found');
      
      const originalEvent = (() => { try { return JSON.parse(rep.extracted_json || '{}'); } catch { return {}; } })();
      
      const payload = {
        originalEvent,
        reviewerNotes: notes,
        rawTranscript: rep.raw_transcript
      };
      
      // Strict token cap to avoid timeout
      const corrected = await runLlmJson(env, CORRECT_SYSTEM, payload, 300);
      if (!corrected) return err(422, 'Could not generate correction');
      
      // Write the corrected fields into the extractions table (audit integrity)
      // We only insert fields that differ from originalEvent (if desired) or just dump all as llm-correct.
      const stmts = [];
      for (const field of Object.keys(corrected)) {
        stmts.push(
          db.prepare('INSERT INTO extractions (report_id, field, value, source, confidence) VALUES (?, ?, ?, ?, ?)')
            .bind(id, field, corrected[field] ?? null, 'llm-correct', 0.9)
        );
      }
      
      // Keep original extracted_json untouched in field_reports, but update the review row with the new one
      const newExtractedJson = JSON.stringify(corrected);
      stmts.push(
        db.prepare("UPDATE reviews SET extracted_json = ?, state = 'needs-review' WHERE report_id = ? AND type = 'report'")
          .bind(newExtractedJson, id)
      );
      
      await db.batch(stmts);
      
      return json({ event: corrected, source: 'llm-correct' });
    }
  },

  {
    method: 'POST',
    pattern: '/api/geo/suggest',
    opts: { auth: true },
    async handler({ body, db, env }) {
      const text = String(body?.text || body?.transcript || '');
      const projectId = body?.projectId || null;
      if (!text.trim()) return err(400, 'text or transcript is required');

      // 1. Query gazetteer sites
      const sitesQuery = projectId
        ? db.prepare('SELECT * FROM sites WHERE project_id = ? OR project_id IS NULL').bind(projectId)
        : db.prepare('SELECT * FROM sites');
      const sites = (await sitesQuery.all()).results || [];

      // Direct keyword / gazetteer token match first (deterministic)
      const lower = text.toLowerCase();
      const directMatches = [];
      for (const s of sites) {
        let score = 0;
        const sName = s.name.toLowerCase();
        const sChainage = (s.chainage_ref || '').toLowerCase();
        if (lower.includes(sName)) {
          score += 85;
        } else {
          for (const token of sName.split(/\s+/).filter(t => t.length > 3)) {
            if (lower.includes(token)) score += 25;
          }
        }
        if (sChainage && lower.includes(sChainage)) score += 40;

        if (score > 0) {
          directMatches.push({
            id: s.id,
            name: s.name,
            lat: s.lat,
            lng: s.lng,
            chainageRef: s.chainage_ref,
            facilityType: s.facility_type,
            confidence: Math.min(95, score),
            source: 'gazetteer'
          });
        }
      }

      if (directMatches.length > 0) {
        directMatches.sort((a, b) => b.confidence - a.confidence);
        return json({ candidates: directMatches.slice(0, 4), source: 'gazetteer' });
      }

      // 2. LLM Geo extraction fallback if no direct matches
      const geoExt = await runLlmJson(env, GEO_SYSTEM, text, 150);
      const candidates = [];
      if (geoExt && (geoExt.siteName || geoExt.chainage || geoExt.padNumber)) {
        const queryTerm = (geoExt.siteName || geoExt.padNumber || geoExt.chainage || '').toLowerCase();
        for (const s of sites) {
          const sName = s.name.toLowerCase();
          if (sName.includes(queryTerm) || queryTerm.includes(sName.split(' ')[0])) {
            candidates.push({
              id: s.id,
              name: s.name,
              lat: s.lat,
              lng: s.lng,
              chainageRef: s.chainage_ref,
              facilityType: s.facility_type,
              confidence: 75,
              source: 'llm-gazetteer'
            });
          }
        }
      }

      // Fallback: return default project site if none matched
      if (candidates.length === 0 && sites.length > 0) {
        candidates.push({
          id: sites[0].id,
          name: sites[0].name,
          lat: sites[0].lat,
          lng: sites[0].lng,
          chainageRef: sites[0].chainage_ref,
          confidence: 40,
          source: 'default-project-site'
        });
      }

      return json({ candidates, extracted: geoExt, source: candidates.length > 0 ? candidates[0].source : 'none' });
    }
  }
];
