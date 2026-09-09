// Discipline auto-classifier using Llama-3.1 with deterministic rules fallback
import { DISCIPLINE_CLASSIFY_SYSTEM } from '../prompts.js';

const DISCIPLINE_KEYWORDS = {
  'Civil': ['civil', 'concrete', 'foundation', 'rebar', 'shuttering', 'excavation', 'grading', 'paving', 'earthwork', 'subgrade', 'trench'],
  'Piping': ['piping', 'pipe', 'weld', 'welding', 'spool', 'flange', 'valve', 'hydrotest', 'hydrostatic', 'tie-in', 'manifold'],
  'Electrical': ['electrical', 'cable', 'transformer', 'substation', 'switchgear', 'earthing', 'conduit', 'breaker', 'panel', 'lighting', 'power'],
  'Instrumentation': ['instrumentation', 'dcs', 'plc', 'scada', 'transmitter', 'sensor', 'gauge', 'loop check', 'calibration', 'control valve', 'tubing'],
  'Pipeline': ['pipeline', 'row', 'stringing', 'lowering', 'crossing', 'chainage', 'coating', 'hdd', 'ditch'],
  'HSE': ['hse', 'safety', 'housekeeping', 'ppe', 'hazard', 'permit', 'near-miss', 'spill', 'fire', 'inspection']
};

export function classifyDisciplineRules(text = '') {
  const lower = text.toLowerCase();
  for (const [disc, words] of Object.entries(DISCIPLINE_KEYWORDS)) {
    for (const w of words) {
      if (lower.includes(w)) {
        return { discipline: disc, confidence: 85, source: 'rules' };
      }
    }
  }
  return { discipline: 'Civil', confidence: 60, source: 'fallback' };
}

export async function classifyDisciplineWithLlm(env, text = '') {
  if (!text.trim()) return classifyDisciplineRules(text);

  if (env?.AI) {
    try {
      const messages = [
        { role: 'system', content: DISCIPLINE_CLASSIFY_SYSTEM },
        { role: 'user', content: `Activity or observation: "${text.slice(0, 300)}"` }
      ];
      const res = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
        messages,
        temperature: 0,
        max_tokens: 60
      });
      const rawText = res.response ?? res.result ?? '';
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed?.discipline) {
          return {
            discipline: parsed.discipline,
            confidence: Number(parsed.confidence) || 88,
            source: 'llm'
          };
        }
      }
    } catch (err) {
      console.warn('LLM discipline classification error, falling back to rules:', err.message);
    }
  }

  return classifyDisciplineRules(text);
}
