// GET  /api/activities?projectId=      schedule tree (mapped to client shape)
// GET  /api/reports?projectId=
// POST /api/reports                    create report + review item + evidence links
import { json, err } from '../lib/http.js';
import { mapActivity, mapReport } from '../lib/d1.js';
import { verifyEvidenceWithVision } from '../lib/vision.js';

export default [
  {
    method: 'GET',
    pattern: '/api/activities',
    opts: { auth: true },
    async handler({ db, query }) {
      const stmt = query.projectId
        ? db.prepare('SELECT * FROM activities WHERE project_id = ? ORDER BY code').bind(query.projectId)
        : db.prepare('SELECT * FROM activities ORDER BY code');
      const { results } = await stmt.all();
      return json(results.map(mapActivity));
    }
  },
  {
    method: 'GET',
    pattern: '/api/reports',
    opts: { auth: true },
    async handler({ db, query }) {
      const stmt = query.projectId
        ? db.prepare('SELECT * FROM field_reports WHERE project_id = ? ORDER BY created_at DESC').bind(query.projectId)
        : db.prepare('SELECT * FROM field_reports ORDER BY created_at DESC');
      const { results } = await stmt.all();
      return json(results.map(mapReport));
    }
  },
  {
    method: 'POST',
    pattern: '/api/reports',
    opts: { auth: true },
    async handler({ body, db, user, audit, env, ctx }) {
      if (!body?.rawTranscript) return err(400, 'rawTranscript is required');

      const id = body.id || `REP-${Date.now()}`;

      // Idempotency for offline queue replay (sync.js flushes with the same
      // client-generated id it queued originally).
      const existing = await db.prepare('SELECT id FROM field_reports WHERE id = ?').bind(id).first();
      if (existing) return json({ id, status: 'pending-review', duplicate: true });
      const extracted = body.extractedEvent || {};
      const matched = body.matchedActivity || null;
      const confidence = Number(body.confidence || (matched ? matched.confidence : 90));
      const status = 'pending-review';

      // Evidence items arrive as metadata (photos already uploaded via
      // /api/evidence/sign + confirm, or carried as offline data URLs).
      const evidenceIds = [];
      for (const ev of body.evidenceItems || []) {
        const evId = ev.id || `EVD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        evidenceIds.push(evId);
        await db.prepare(
          `INSERT INTO evidence (id, report_id, activity_id, activity_name, project_id, url, public_id,
             type, filename, location_meta, uploaded_by, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          evId, id, matched?.id || null, matched?.name || null, body.projectId || null,
          ev.url || null, ev.publicId || null, ev.type || null, ev.filename || null,
          ev.locationMeta || null, user.name, ev.status || 'pending'
        ).run();
      }

      await db.prepare(
        `INSERT INTO field_reports (id, project_id, author, raw_transcript, extracted_json,
           matched_activity_id, matched_activity_name, matched_activity_code, confidence, signals_json,
           alternatives_json, status, source, evidence_ids_json, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, body.projectId || null, body.author || user.name, body.rawTranscript, JSON.stringify(extracted),
        matched?.id || null, matched?.name || null, matched?.code || null, confidence,
        JSON.stringify(body.signals || []), JSON.stringify(body.alternatives || []),
        status, body.source || 'user', JSON.stringify(evidenceIds),
        body.isOffline ? new Date().toISOString() : null
      ).run();

      // Provenance triples when the client supplies them (plan §8).
      for (const [field, prov] of Object.entries(body.provenance || {})) {
        await db.prepare(
          `INSERT INTO extractions (report_id, field, value, source, confidence) VALUES (?, ?, ?, ?, ?)`
        ).bind(id, field, String(prov?.value ?? ''), String(prov?.source || 'user'), Number(prov?.confidence ?? 0)).run();
      }

function calculateUrgency(extracted) {
  const blocker = (extracted?.blocker || '').toLowerCase();
  const extStatus = (extracted?.status || '').toLowerCase();
  const hasSevereBlocker = blocker.includes('halt') || blocker.includes('stop') || blocker.includes('hazard') || blocker.includes('breakdown') || blocker.includes('critical') || blocker.includes('failure');
  const hasModerateBlocker = blocker.includes('shortage') || blocker.includes('delay') || blocker.includes('weather') || blocker.includes('rain') || blocker.includes('permit') || extStatus.includes('delay');

  if (hasSevereBlocker) {
    return { priority: 'P1', score: 95, label: 'P1 Critical', reason: extracted.blocker };
  }
  if (hasModerateBlocker) {
    return { priority: 'P2', score: 75, label: 'P2 High', reason: extracted.blocker || 'Activity Delayed' };
  }
  if (extStatus.includes('progress') || extStatus.includes('started')) {
    return { priority: 'P3', score: 45, label: 'P3 Medium', reason: 'Routine Progress' };
  }
  return { priority: 'P4', score: 20, label: 'P4 Info', reason: 'On Track / Completed' };
}

function resolveReviewerRole(discipline) {
  const d = (discipline || '').toLowerCase();
  if (d.includes('elect') || d.includes('mech')) return 'Project Manager';
  if (d.includes('inst') || d.includes('inspect') || d.includes('survey')) return 'QAQC Reviewer';
  return 'Lead Planner';
}

      const reviewCreated = `REV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const urgency = calculateUrgency(extracted);
      const suggestedRole = resolveReviewerRole(extracted.discipline);
      const enrichedExtracted = {
        ...extracted,
        urgency,
        suggestedReviewerRole: suggestedRole
      };

      const initialAiVerification = evidenceIds.length > 0
        ? {
            status: 'pending',
            verified: false,
            confidence: 0,
            suggestedProgress: null,
            reasoning: 'Cloudflare Vision AI Analyzing evidence...'
          }
        : {
            status: 'no_visual_evidence',
            verified: false,
            confidence: 0,
            suggestedProgress: null,
            reasoning: 'No photographic evidence was attached to this report.'
          };

      await db.prepare(
        `INSERT INTO reviews (id, report_id, type, source, reporter, discipline, extracted_json,
           top_match_json, alternatives_json, state, tab_category, age, ai_verification_json)
         VALUES (?, ?, 'report', ?, ?, ?, ?, ?, ?, 'needs-review', ?, 'Just now', ?)`
      ).bind(
        reviewCreated, id, body.sourceLabel || 'Mobile Field App', body.author || user.name,
        extracted.discipline || 'Civil', JSON.stringify(enrichedExtracted),
        JSON.stringify(matched ? { ...matched, confidence, signals: body.signals || [] } : null),
        JSON.stringify(body.alternatives || []),
        confidence >= 80 ? 'high-confidence' : 'needs-review',
        JSON.stringify(initialAiVerification)
      ).run();

      await audit.append({
        id: `AUD-${Date.now()}`,
        activityId: matched?.id || null,
        action: 'Field Progress Report Submitted',
        actor: body.author || user.name,
        role: user.role,
        detail: `Report: "${String(body.rawTranscript).slice(0, 100)}${String(body.rawTranscript).length > 100 ? '...' : ''}"${matched ? ` Linked with ${confidence}% confidence.` : ''}`
      });

      if (evidenceIds.length > 0) {
        ctx.waitUntil(verifyEvidenceWithVision(env, db, reviewCreated, id, body.rawTranscript));
      }

      return json(
        { id, status, reviewItemId: reviewCreated, evidenceIds }, 201
      );
    }
  }
];
