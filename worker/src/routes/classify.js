// POST /api/classify {transcript, hasPhoto, photoCount, geo, userDiscipline, projectId}
// Upgraded Mathematical Classification Engine:
// 1. Levenshtein + token fuzzy matching for superior L5/L6 detection
// 2. Candidate pruning to Top 5 before LLM tie-breaker
// 3. Deterministic Multi-Variable Confidence Engine (+15 visual, +10 geo, +15 discipline, -20 timeline variance)
import { json } from '../lib/http.js';
import { extractRules } from '../lib/rules.js';
import { CLASSIFY_SYSTEM } from '../prompts.js';

const TIE_BREAKER_THRESHOLD = 65;

function levenshteinSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (a === b) return 1.0;
  if (a.includes(b) || b.includes(a)) return 0.85;

  const lenA = a.length;
  const lenB = b.length;
  if (Math.abs(lenA - lenB) > Math.max(lenA, lenB) * 0.6) return 0;

  const matrix = [];
  for (let i = 0; i <= lenA; i++) matrix[i] = [i];
  for (let j = 0; j <= lenB; j++) matrix[0][j] = j;

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  const maxLen = Math.max(lenA, lenB);
  return maxLen === 0 ? 1 : Math.max(0, 1 - matrix[lenA][lenB] / maxLen);
}

// Compute bonus and penalty adjustments for multi-variable confidence
function calculateConfidenceBonus({ hasPhoto, photoCount, geo, userDiscipline, activityDiscipline, plannedFinish }) {
  let delta = 0;

  // Visual evidence bonus (+15 pts for single photo attachment)
  if (hasPhoto || photoCount === 1) {
    delta += 15;
  }

  // Geo-spatial verification bonus (+10 pts)
  if (geo && typeof geo.lat === 'number' && typeof geo.lng === 'number') {
    delta += 10;
  }

  // Discipline match bonus (+15 pts)
  if (userDiscipline && activityDiscipline &&
      userDiscipline.toLowerCase().trim() === activityDiscipline.toLowerCase().trim()) {
    delta += 15;
  }

  // Timeline variance penalty (-20 pts if scheduled > 180 days ago)
  if (plannedFinish) {
    const finishTime = new Date(plannedFinish).getTime();
    if (!isNaN(finishTime) && (Date.now() - finishTime) > 180 * 86400000) {
      delta -= 20;
    }
  }

  return delta;
}

async function llmTieBreaker(env, transcript, candidates) {
  if (!env.AI || candidates.length === 0) return null;
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

export default [
  {
    method: 'POST',
    pattern: '/api/classify',
    opts: { auth: true },
    async handler({ body, db, env, user }) {
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
        discipline: r.discipline,
        plannedFinish: r.planned_finish
      }));

      const lowerAct = (event.activity || '').toLowerCase();
      const lowerTag = (event.assetTag || '').toLowerCase().split(' (')[0].trim();
      const lowerTranscript = transcript.toLowerCase();

      // Multi-variable scoring pass
      const scoredCandidates = pool.map(c => {
        let score = 0;
        const cName = (c.name || '').toLowerCase();
        const cCode = (c.code || '').toLowerCase();
        const cDisc = (c.discipline || '').toLowerCase();
        const eventDisc = (event.discipline || '').toLowerCase();

        // 1. Discipline baseline match
        if (eventDisc && cDisc === eventDisc) {
          score += 25;
        }

        // 2. Asset tag exact or fuzzy match
        if (lowerTag && lowerTag !== 'general area') {
          if (cCode.includes(lowerTag) || cName.includes(lowerTag)) {
            score += 35;
          } else {
            const simTag = Math.max(levenshteinSimilarity(lowerTag, cCode), levenshteinSimilarity(lowerTag, cName));
            if (simTag > 0.6) score += Math.round(simTag * 30);
          }
        }

        // 3. Keyword / Token overlap
        const words = lowerAct.split(/\s+/).filter(w => w.length > 3);
        for (const word of words) {
          if (cName.includes(word)) score += 8;
          if (cCode.includes(word)) score += 12;
        }

        // 4. Whole phrase fuzzy similarity
        const simPhrase = levenshteinSimilarity(lowerAct, cName);
        if (simPhrase > 0.5) {
          score += Math.round(simPhrase * 25);
        }

        // 5. Raw transcript direct match check
        if (cCode && lowerTranscript.includes(cCode)) score += 20;

        return { ...c, score };
      });

      // Sort candidates by match score descending
      scoredCandidates.sort((a, b) => b.score - a.score);
      const best = scoredCandidates[0] || null;

      // Calculate external confidence modifier (+15 for photo, +10 geo, +15 user role discipline, -20 late)
      const bonus = calculateConfidenceBonus({
        hasPhoto: body?.hasPhoto || (Array.isArray(body?.photos) && body.photos.length > 0),
        photoCount: Number(body?.photoCount || (Array.isArray(body?.photos) ? body.photos.length : 0)),
        geo: body?.geo,
        userDiscipline: body?.userDiscipline || user?.discipline || user?.role,
        activityDiscipline: best?.discipline,
        plannedFinish: best?.plannedFinish
      });

      // High-confidence rules hit (>= TIE_BREAKER_THRESHOLD)
      if (best && best.score >= TIE_BREAKER_THRESHOLD) {
        const disc = best.discipline || event.discipline;
        const finalConfidence = Math.min(99, Math.max(10, Math.round(best.score + bonus)));
        return json({
          extractedEvent: { ...event, discipline: disc },
          topMatch: {
            id: best.id,
            projectId: best.projectId,
            discipline: disc,
            name: best.name,
            code: best.code,
            confidence: finalConfidence
          },
          source: 'rules'
        });
      }

      // Prune pool to Top 5 candidates for LLM tie-breaking to avoid hallucination & reduce token load
      const top5Candidates = scoredCandidates.slice(0, 5);
      const llm = await llmTieBreaker(env, transcript, top5Candidates);
      if (llm && llm.confidence >= 40 && llm.activityId) {
        const chosen = pool.find(c => c.id === llm.activityId);
        if (chosen) {
          const disc = chosen.discipline || llm.discipline || event.discipline;
          const finalConfidence = Math.min(99, Math.max(10, Math.round(Number(llm.confidence) + bonus)));
          return json({
            extractedEvent: { ...event, discipline: disc },
            topMatch: {
              id: chosen.id,
              projectId: chosen.projectId ?? llm.projectId,
              discipline: disc,
              name: chosen.name,
              code: chosen.code,
              confidence: finalConfidence
            },
            source: 'llm'
          });
        }
      }

      // Fallback: return best rules candidate or null
      const disc = best?.discipline || event.discipline;
      const fallbackConfidence = best ? Math.min(65, Math.max(15, Math.round((best.score * 0.6) + bonus))) : 0;
      return json({
        extractedEvent: { ...event, discipline: disc },
        topMatch: best ? {
          id: best.id,
          projectId: best.projectId,
          discipline: disc,
          name: best.name,
          code: best.code,
          confidence: fallbackConfidence
        } : null,
        source: 'rules'
      });
    }
  }
];
