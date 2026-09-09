// GET  /api/surveys/templates          seeded checklists
// GET  /api/surveys?projectId=
// POST /api/surveys                    submit -> survey row + review item + audit
import { json, err } from '../lib/http.js';
import { mapSurvey } from '../lib/d1.js';

// MVP template set per plan decision D1: SiteInspection + ProgressSurvey.
// Mirrors js/data/survey-templates.js so the client can switch sources freely.
const SEED_TEMPLATES = [
  {
    id: 'TPL-SITE-INSPECTION',
    name: 'Site Inspection (Safety & Compliance)',
    type: 'SiteInspection',
    sections: [
      { id: 'q_housekeeping', type: 'radio', label: 'Site housekeeping compliant?', options: ['Yes', 'No', 'Partial'], required: true },
      { id: 'q_ppe', type: 'radio', label: 'PPE compliance observed across workface?', options: ['Yes', 'No', 'Partial'], required: true },
      { id: 'q_permits', type: 'radio', label: 'Work permits displayed & valid?', options: ['Yes', 'No', 'N/A'], required: true },
      { id: 'q_hazards', type: 'text', label: 'Hazards / near-miss observations', placeholder: 'Describe any hazards, near misses or unsafe conditions...', voice: true },
      { id: 'q_overall', type: 'radio', label: 'Overall inspection outcome', options: ['Pass', 'Fail - Action Required', 'Conditional Pass'], required: true }
    ]
  },
  {
    id: 'TPL-PROGRESS-SURVEY',
    name: 'Daily Progress Survey',
    type: 'ProgressSurvey',
    sections: [
      { id: 'q_activity', type: 'text', label: 'Activity / workface covered today', placeholder: 'e.g., Foundation B2 shuttering, Chainage 42-47 trenching...', required: true, voice: true },
      { id: 'q_quantity', type: 'text', label: 'Quantity installed today', placeholder: 'e.g., 45 cum concrete, 380 inch dia welds...', required: true },
      { id: 'q_crew', type: 'number', label: 'Crew size on site', placeholder: 'e.g., 24', required: true },
      { id: 'q_tomorrow', type: 'radio', label: 'Workface ready for tomorrow?', options: ['Yes', 'No - constraint exists'], required: true },
      { id: 'q_constraint', type: 'text', label: 'If blocked, describe the constraint', placeholder: 'Material shortage, weather, equipment breakdown...', voice: true },
      { id: 'q_pct', type: 'number', label: 'Estimated % complete for this activity', placeholder: '0-100' }
    ]
  }
];

async function ensureTemplates(db) {
  const row = await db.prepare('SELECT COUNT(*) AS n FROM survey_templates').first();
  if (row && Number(row.n) > 0) return;
  const stmt = db.prepare('INSERT INTO survey_templates (id, name, type, sections_json) VALUES (?, ?, ?, ?)');
  await db.batch(SEED_TEMPLATES.map(t => stmt.bind(t.id, t.name, t.type, JSON.stringify(t.sections))));
}

export default [
  {
    method: 'GET',
    pattern: '/api/surveys/templates',
    opts: { auth: true },
    async handler({ db }) {
      await ensureTemplates(db);
      const { results } = await db.prepare('SELECT * FROM survey_templates').all();
      if (!results || results.length === 0) return json(SEED_TEMPLATES);
      return json(results.map(r => ({
        id: r.id,
        name: r.name,
        type: r.type,
        sections: JSON.parse(r.sections_json || '[]')
      })));
    }
  },
  {
    method: 'GET',
    pattern: '/api/surveys',
    opts: { auth: true },
    async handler({ db, query }) {
      const stmt = query.projectId
        ? db.prepare('SELECT * FROM surveys WHERE project_id = ? ORDER BY created_at DESC').bind(query.projectId)
        : db.prepare('SELECT * FROM surveys ORDER BY created_at DESC');
      const { results } = await stmt.all();
      return json(results.map(mapSurvey));
    }
  },
  {
    method: 'POST',
    pattern: '/api/surveys',
    opts: { auth: true },
    async handler({ body, db, user, audit }) {
      if (!body?.templateId || !body?.projectId) {
        return err(400, 'templateId and projectId are required');
      }

      const id = body.id || `SRV-${Date.now()}`;
      // Idempotent replay for offline queue drain.
      const existing = await db.prepare('SELECT id FROM surveys WHERE id = ?').bind(id).first();
      if (existing) return json({ id, status: 'submitted', duplicate: true });

      const tplRow = await db.prepare('SELECT * FROM survey_templates WHERE id = ?').bind(body.templateId).first();
      const templateName = tplRow?.name || body.templateName || body.templateId;
      const answers = body.answers || {};
      let photos = Array.isArray(body.photos) ? body.photos : [];
      // Enforce single photo limit per report
      if (photos.length > 1) {
        photos = [photos[0]];
      }

      await db.prepare(
        `INSERT INTO surveys (id, project_id, template_id, template_name, submitted_by, answers_json,
           photos_json, photo_count, geo_json, status, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, body.projectId, body.templateId, templateName, body.submittedBy || user.name,
        JSON.stringify(answers), JSON.stringify(photos), Number(photos.length),
        JSON.stringify(body.geo || null), 'submitted', body.isOffline ? new Date().toISOString() : null
      ).run();

      // First-class review item alongside field reports.
      const reviewId = `REV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const firstNarrative = Object.values(answers).find(v => typeof v === 'string' && v.length > 12);
      const reportedProgress = answers.q_pct !== undefined && answers.q_pct !== ''
        ? Number(answers.q_pct)
        : (answers.progress !== undefined && answers.progress !== '' ? Number(answers.progress) : undefined);

      // Attempt matching target activity if provided in survey
      let topMatchJson = null;
      const targetActId = body.matchedActivityId || body.activityId || answers.activity_id;
      if (targetActId) {
        const actRow = await db.prepare('SELECT id, name, code, discipline FROM activities WHERE id = ?').bind(targetActId).first();
        if (actRow) {
          topMatchJson = JSON.stringify({ id: actRow.id, name: actRow.name, code: actRow.code, discipline: actRow.discipline, confidence: 95 });
        }
      }

      await db.prepare(
        `INSERT INTO reviews (id, report_id, type, source, reporter, discipline, extracted_json,
           top_match_json, alternatives_json, survey_answers_json, state, tab_category, age)
         VALUES (?, ?, 'survey', ?, ?, 'HSE / Progress', ?, ?, '[]', ?, 'needs-review', 'needs-review', 'Just now')`
      ).bind(
        reviewId, id, `Survey — ${templateName}`, body.submittedBy || user.name,
        JSON.stringify({
          activity: firstNarrative?.slice(0, 70) || templateName,
          status: String(answers.q_overall || answers.q_tomorrow || 'Submitted'),
          blocker: answers.q_constraint || 'None',
          progress: reportedProgress !== undefined && !isNaN(reportedProgress) ? reportedProgress : undefined
        }),
        topMatchJson,
        JSON.stringify(answers)
      ).run();

      await audit.append({
        id: `AUD-${Date.now()}`,
        activityId: null,
        action: 'Survey Submitted',
        actor: body.submittedBy || user.name,
        role: user.role,
        detail: `${templateName} (${Object.keys(answers).length} responses${photos.length ? `, ${photos.length} photo(s)` : ''})`
      });

      // Insert photos into the evidence table so they can be viewed uniformly
      for (const photo of photos) {
        const evId = `EVD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await db.prepare(
          `INSERT INTO evidence (id, report_id, activity_id, activity_name, project_id, url, public_id,
             type, filename, location_meta, uploaded_by, status)
           VALUES (?, ?, NULL, NULL, ?, ?, NULL, ?, ?, ?, ?, 'pending')`
        ).bind(
          evId, id, body.projectId, photo.url, photo.type || null, photo.filename || 'Survey Photo',
          body.geo ? `Lat: ${body.geo.lat}, Lng: ${body.geo.lng}` : null, body.submittedBy || user.name
        ).run();
      }

      return json({ id, status: 'submitted', reviewItemId: reviewId }, 201);
    }
  }
];
