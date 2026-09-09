// GET  /api/projects                     list
// GET  /api/projects/classifications     enum taxonomy (before :id match)
// GET  /api/projects/:id
// POST /api/projects
// PATCH/PUT /api/projects/:id            partial update
// POST /api/projects/:id/location        {lat,lng}
// GET  /api/stats/public                 landing live-pipeline numbers
import { json, err } from '../lib/http.js';
import { mapProject, projectToRow, mapActivity, mapReview, mapReport, mapSurvey } from '../lib/d1.js';
import { getPublicStats, getBenchmarkStats } from '../lib/stats.js';
import { seedProjectActivities } from '../lib/wbs-seed.js';

const CLASSIFICATIONS = {
  projectType: ['Pipeline', 'Plant', 'Substation', 'Roads', 'Drilling', 'Other'],
  category: ['Brownfield', 'Greenfield', 'Maintenance', 'Emergency'],
  riskTier: ['A', 'B', 'C'],
  priority: ['P1', 'P2', 'P3', 'P4'],
  region: ['Assam East', 'Assam West', 'Rajasthan', 'Andhra', 'Other']
};

function insertProject(db) {
  return db.prepare(
    `INSERT INTO projects (id, code, name, location, project_type, category, risk_tier, priority, region,
       lat, lng, start_date, target_finish, health, spi, planned_progress, actual_progress, variance,
       delayed_activities_count, pending_review_count, evidence_coverage, extras_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
}

export default [
  {
    method: 'GET',
    pattern: '/api/stats/public',
    async handler({ db }) {
      return json(await getPublicStats(db));
    }
  },
  {
    method: 'GET',
    pattern: '/api/stats/benchmark',
    async handler({ db }) {
      return json(await getBenchmarkStats(db));
    }
  },
  {
    method: 'GET',
    pattern: '/api/projects/classifications',
    opts: { auth: true },
    async handler() {
      return json(CLASSIFICATIONS);
    }
  },
  {
    method: 'GET',
    pattern: '/api/projects',
    opts: { auth: true },
    async handler({ db }) {
      const { results } = await db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
      return json(results.map(mapProject));
    }
  },
  {
    method: 'GET',
    pattern: '/api/projects/:id',
    opts: { auth: true },
    async handler({ db, params }) {
      const row = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(params.id).first();
      if (!row) return err(404, 'Project not found');
      return json(mapProject(row));
    }
  },
  {
    method: 'POST',
    pattern: '/api/projects',
    opts: { auth: true, review: false },
    async handler({ body, db, user, audit }) {
      if (!body?.name) return err(400, 'name is required');
      const p = projectToRow({
        health: 'on-track',
        spi: 1,
        plannedProgress: 0,
        actualProgress: 0,
        variance: 0,
        delayedActivitiesCount: 0,
        pendingReviewCount: 0,
        evidenceCoverage: 0,
        ...body,
        id: body.id || `PRJ-OIL-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`
      });
      await insertProject(db).bind(
        p.id, p.code, p.name, p.location, p.project_type, p.category, p.risk_tier, p.priority, p.region,
        p.lat, p.lng, p.start_date, p.target_finish, p.health, p.spi, p.planned_progress, p.actual_progress,
        p.variance, p.delayed_activities_count, p.pending_review_count, p.evidence_coverage, p.extras_json
      ).run();

      // Automatically generate realistic baseline L1-L6 WBS activities for the new project
      try {
        await seedProjectActivities(db, p.id, p.project_type || 'Plant', p.start_date, p.target_finish);
      } catch (seedErr) {
        console.warn('Auto-seed activities for new project failed:', seedErr);
      }

      await audit.append({
        id: `AUD-${Date.now()}`,
        activityId: null,
        action: 'PROJECT_CREATED',
        actor: user.name,
        role: user.role,
        detail: `Created project ${p.code || ''}: ${p.name}`
      });
      return json(mapProject(await db.prepare('SELECT * FROM projects WHERE id = ?').bind(p.id).first()), 201);
    }
  },
  {
    method: 'PATCH',
    pattern: '/api/projects/:id',
    opts: { auth: true },
    async handler({ body, db, params, user, audit }) {
      const existing = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(params.id).first();
      if (!existing) return err(404, 'Project not found');
      const merged = projectToRow({ ...mapProject(existing), ...body, id: params.id });
      await db.prepare(
        `UPDATE projects SET code=?, name=?, location=?, project_type=?, category=?, risk_tier=?, priority=?,
           region=?, lat=?, lng=?, start_date=?, target_finish=?, health=?, spi=?, planned_progress=?,
           actual_progress=?, variance=?, delayed_activities_count=?, pending_review_count=?,
           evidence_coverage=?, extras_json=? WHERE id=?`
      ).bind(
        merged.code, merged.name, merged.location, merged.project_type, merged.category, merged.risk_tier,
        merged.priority, merged.region, merged.lat, merged.lng, merged.start_date, merged.target_finish,
        merged.health, merged.spi, merged.planned_progress, merged.actual_progress, merged.variance,
        merged.delayed_activities_count, merged.pending_review_count, merged.evidence_coverage,
        merged.extras_json, params.id
      ).run();
      await audit.append({
        id: `AUD-${Date.now()}`,
        activityId: null,
        action: 'PROJECT_UPDATED',
        actor: user.name,
        role: user.role,
        detail: `Updated project ${merged.code || params.id}: ${merged.name}`
      });
      return json(mapProject(await db.prepare('SELECT * FROM projects WHERE id = ?').bind(params.id).first()));
    }
  },
  {
    method: 'POST',
    pattern: '/api/projects/:id/location',
    opts: { auth: true },
    async handler({ body, db, params }) {
      const lat = Number(body?.lat), lng = Number(body?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return err(400, 'lat and lng must be numbers');
      const res = await db.prepare('UPDATE projects SET lat = ?, lng = ? WHERE id = ?').bind(lat, lng, params.id).run();
      if (!res.success || res.meta.changes === 0) return err(404, 'Project not found');
      return json(mapProject(await db.prepare('SELECT * FROM projects WHERE id = ?').bind(params.id).first()));
    }
  },
  {
    method: 'POST',
    pattern: '/api/activities/:id/location',
    opts: { auth: true },
    async handler({ body, db, params }) {
      const lat = Number(body?.lat), lng = Number(body?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return err(400, 'lat and lng must be numbers');
      const res = await db.prepare('UPDATE activities SET lat = ?, lng = ? WHERE id = ?').bind(lat, lng, params.id).run();
      if (!res.success || res.meta.changes === 0) return err(404, 'Activity not found');
      return json(mapActivity(await db.prepare('SELECT * FROM activities WHERE id = ?').bind(params.id).first()));
    }
  },

  // Project detail aggregate: activities + reports + reviews + surveys in one call.
  {
    method: 'GET',
    pattern: '/api/projects/:id/workspace',
    opts: { auth: true },
    async handler({ db, params }) {
      const projectRow = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(params.id).first();
      if (!projectRow) return err(404, 'Project not found');
      const [acts, reps, revs, srvs] = await Promise.all([
        db.prepare('SELECT * FROM activities WHERE project_id = ? ORDER BY code').bind(params.id).all(),
        db.prepare('SELECT * FROM field_reports WHERE project_id = ? ORDER BY created_at DESC').bind(params.id).all(),
        db.prepare(`SELECT r.* FROM reviews r LEFT JOIN field_reports f ON f.id = r.report_id WHERE COALESCE(f.project_id, '') = ? OR EXISTS (SELECT 1 FROM surveys s WHERE s.id = r.report_id AND s.project_id = ?) ORDER BY r.created_at DESC`).bind(params.id, params.id).all(),
        db.prepare('SELECT * FROM surveys WHERE project_id = ? ORDER BY created_at DESC').bind(params.id).all()
      ]);
      return json({
        project: mapProject(projectRow),
        activities: acts.results.map(mapActivity),
        reports: reps.results.map(mapReport),
        reviews: revs.results.map(mapReview),
        surveys: srvs.results.map(mapSurvey)
      });
    }
  }
];
