// POST /api/classify {transcript} -> {projectId?, activityId?, discipline?, confidence, source}
// Rules engine first (discipline keywords + asset-tag matching over live D1
// activities), LLM tie-breaker only below the confidence threshold (plan §7).
import { json } from '../lib/http.js';
import { extractRules } from '../lib/rules.js';
import { CLASSIFY_SYSTEM } from '../prompts.js';

const TIE_BREAKER_THRESHOLD = 60;

async function llmTieBreaker(env, transcript, candidates) {
  if (!env.AI) return null;
  try {
    const res = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: CLASSIFY_SYSTEM },
        {
          role: 'user',
          content: JSON.stringify({
            transcript,
            candidates: candidates.map(c => ({
              projectId: c.projectId,
              activityId: c.id,
              code: c.code,
              name: c.name,
              discipline: c.discipline
            }))
          })
        }
      ],
      temperature: 0,
      max_tokens: 200
    });
    return JSON.parse(res.response || res.result || '{}');
  } catch {
    return null;
  }
}

function getSuggestedReviewerRole(discipline) {
  const d = (discipline || '').toLowerCase();
  if (d.includes('elect') || d.includes('mech')) return 'Project Manager';
  if (d.includes('inst') || d.includes('inspect') || d.includes('survey')) return 'QAQC Reviewer';
  return 'Lead Planner';
}

export default [
  {
    method: 'POST',
    pattern: '/api/classify',
    opts: { auth: true },
    async handler({ body, db, env }) {
      const transcript = String(body?.transcript || '');
      if (!transcript.trim()) {
        return json({
          projectId: null,
          activityId: null,
          discipline: null,
          suggestedReviewerRole: 'Lead Planner',
          confidence: 0,
          source: 'rules'
        });
      }

      const event = extractRules(transcript);
      const leaves = await db.prepare(`SELECT * FROM activities WHERE level IN ('L5','L6')`).all();
      const pool = (leaves.results || []).map(r => ({
        id: r.id,
        projectId: r.project_id,
        code: r.code,
        name: r.name,
        discipline: r.discipline
      }));

      // Rules pass: score by discipline echo + asset-tag/name token overlap.
      const lowerAct = (event.activity || '').toLowerCase();
      const lowerTag = (event.assetTag || '').toLowerCase();
      let best = null;
      for (const c of pool) {
        let score = event.discipline && (c.discipline || '').toLowerCase() === event.discipline.toLowerCase() ? 55 : 25;
        const hay = `${c.code || ''} ${c.name || ''}`.toLowerCase();
        if (lowerTag !== 'general area' && hay.includes(lowerTag.split(' (')[0].toLowerCase())) score += 30;
        for (const word of lowerAct.split(/\s+/).filter(w => w.length > 4)) {
          if (hay.includes(word)) score += 6;
        }
        if (!best || score > best.score) best = { ...c, score };
      }

      if (best && best.score >= TIE_BREAKER_THRESHOLD) {
        const disc = best.discipline || event.discipline;
        return json({
          projectId: best.projectId,
          activityId: best.id,
          discipline: disc,
          suggestedReviewerRole: getSuggestedReviewerRole(disc),
          confidence: Math.min(95, best.score),
          source: 'rules'
        });
      }

      const llm = await llmTieBreaker(env, transcript, pool);
      if (llm && llm.confidence >= 40 && llm.activityId) {
        const chosen = pool.find(c => c.id === llm.activityId);
        if (chosen) {
          const disc = chosen.discipline || llm.discipline || event.discipline;
          return json({
            projectId: chosen.projectId ?? llm.projectId,
            activityId: chosen.id,
            discipline: disc,
            suggestedReviewerRole: llm.suggestedReviewerRole || getSuggestedReviewerRole(disc),
            confidence: Math.round(Number(llm.confidence)),
            source: 'llm'
          });
        }
      }

      const disc = best?.discipline || event.discipline;
      return json({
        projectId: best?.projectId ?? null,
        activityId: best?.id ?? null,
        discipline: disc,
        suggestedReviewerRole: getSuggestedReviewerRole(disc),
        confidence: best ? Math.min(50, best.score) : 0,
        source: 'rules'
      });
    }
  }
];
