// GET  /api/reviews?tab=          review queue
// GET  /api/reviews/:id
// POST /api/reviews/:id/approve   session-bound approve + reconciliation + audit
// POST /api/reviews/:id/reject    {reason}
import { json, err } from '../lib/http.js';
import { canReview } from '../lib/authz.js';
import { mapReview, mapActivity, mapProject, activityToRow, projectToRow } from '../lib/d1.js';
import { reconcileActivity, rollupAll } from '../lib/reconcile.js';

async function loadReview(db, id) {
  const row = await db.prepare('SELECT * FROM reviews WHERE id = ?').bind(id).first();
  return row;
}

export default [
  {
    method: 'GET',
    pattern: '/api/reviews',
    opts: { auth: true },
    async handler({ db, query }) {
      const tab = query.tab && query.tab !== 'all' ? query.tab : null;
      const stmt = tab
        ? db.prepare('SELECT * FROM reviews WHERE tab_category = ? OR state = ? ORDER BY created_at DESC').bind(tab, tab)
        : db.prepare('SELECT * FROM reviews ORDER BY created_at DESC');
      const { results } = await stmt.all();
      const mapped = results.map(mapReview);

      // Prioritized Queue: needs-review items sorted by urgency score descending, followed by reviewed items
      mapped.sort((a, b) => {
        const aPending = a.state === 'needs-review' ? 1 : 0;
        const bPending = b.state === 'needs-review' ? 1 : 0;
        if (aPending !== bPending) return bPending - aPending;
        const scoreA = a.urgency?.score || 0;
        const scoreB = b.urgency?.score || 0;
        return scoreB - scoreA;
      });

      return json(mapped);
    }
  },
  {
    method: 'GET',
    pattern: '/api/reviews/:id',
    opts: { auth: true },
    async handler({ db, params }) {
      const row = await loadReview(db, params.id);
      if (!row) return err(404, 'Review item not found');
      return json(mapReview(row));
    }
  },
  {
    method: 'POST',
    pattern: '/api/reviews/:id/approve',
    opts: { auth: true },
    async handler({ db, params, user, audit }) {
      if (!canReview(user)) {
        return err(403, `Role "${user.role}" is not permitted to approve matches.`);
      }
      const row = await loadReview(db, params.id);
      if (!row) return err(404, 'Review item not found');
      if (row.state !== 'needs-review') return err(409, `Item already ${row.state}`);

      const reviewedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
      const reviewerLabel = `${user.name} — ${user.title || user.role}`;

      const topMatch = JSON.parse(row.top_match_json || 'null');

      // Approved match with a schedule target reconciles real actuals (plan A3).
      if (topMatch?.id) {
        const actRow = await db.prepare('SELECT * FROM activities WHERE id = ?').bind(topMatch.id).first();
        if (!actRow) return err(404, `Matched activity ${topMatch.id} no longer exists`);
        const extracted = JSON.parse(row.extracted_json || '{}');
        const updatedAct = reconcileActivity(mapActivity(actRow), extracted);
        await db.prepare(
          `UPDATE activities SET actual_start=?, actual_finish=?, progress=?, status=?, variance=? WHERE id=?`
        ).bind(updatedAct.actualStart, updatedAct.actualFinish, updatedAct.progress, updatedAct.status,
               updatedAct.variance ?? null, topMatch.id).run();

        // Parent/project rollups
        const allActRows = (await db.prepare('SELECT * FROM activities').all()).results.map(mapActivity);
        const projRows = (await db.prepare('SELECT * FROM projects').all()).results.map(mapProject);
        const rolled = rollupAll(allActRows, projRows);
        for (const act of rolled.activities) {
          const r = activityToRow(act);
          await db.prepare(`UPDATE activities SET progress=?, status=?, variance=? WHERE id=?`)
            .bind(r.progress, r.status, r.variance, r.id).run();
        }
        for (const p of rolled.projects) {
          const pr = projectToRow(p);
          await db.prepare(
            `UPDATE projects SET delayed_activities_count=?, actual_progress=?, variance=?, spi=?, health=? WHERE id=?`
          ).bind(pr.delayed_activities_count, pr.actual_progress, pr.variance, pr.spi, pr.health, pr.id).run();
        }

        // Mark the source report approved.
        if (row.report_id) {
          await db.prepare('UPDATE field_reports SET status=?, reviewer=?, reviewed_at=? WHERE id=?')
            .bind('approved', reviewerLabel, reviewedAt, row.report_id).run();
        }

        await audit.append({
          id: `AUD-${Date.now()}`,
          activityId: topMatch.id,
          action: 'Activity Match Approved',
          actor: user.name,
          role: user.role,
          detail: `Confirmed link to ${topMatch.code} (${topMatch.name}). Schedule actuals updated.`
        });
      } else if (row.report_id) {
        // Survey-only or unlinked approvals still close the report out.
        await db.prepare('UPDATE field_reports SET status=?, reviewer=?, reviewed_at=? WHERE id=?')
          .bind('approved', reviewerLabel, reviewedAt, row.report_id).run();
        if (row.type === 'survey') {
          await db.prepare('UPDATE surveys SET status=? WHERE id=?').bind('reviewed', row.report_id).run();
        }
      }

      await db.prepare(
        'UPDATE reviews SET state=?, tab_category=?, reviewer=?, reviewed_at=? WHERE id=?'
      ).bind('approved', 'approved', reviewerLabel, reviewedAt, params.id).run();

      return json(mapReview(await loadReview(db, params.id)));
    }
  },
  {
    method: 'POST',
    pattern: '/api/reviews/:id/reject',
    opts: { auth: true },
    async handler({ db, params, body, user, audit }) {
      if (!canReview(user)) {
        return err(403, `Role "${user.role}" is not permitted to reject matches.`);
      }
      const row = await loadReview(db, params.id);
      if (!row) return err(404, 'Review item not found');
      if (row.state !== 'needs-review') return err(409, `Item already ${row.state}`);

      const reason = String(body?.reason || 'Incorrect activity match');
      const reviewedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
      const reviewerLabel = `${user.name} — ${user.title || user.role}`;

      await db.prepare(
        'UPDATE reviews SET state=?, tab_category=?, reviewer=?, reviewed_at=?, rejection_reason=? WHERE id=?'
      ).bind('rejected', 'rejected', reviewerLabel, reviewedAt, reason, params.id).run();

      if (row.report_id) {
        await db.prepare('UPDATE field_reports SET status=?, reviewer=?, reviewed_at=? WHERE id=?')
          .bind('rejected', reviewerLabel, reviewedAt, row.report_id).run();
      }

      const topMatch = JSON.parse(row.top_match_json || 'null');
      if (topMatch?.id) {
        await audit.append({
          id: `AUD-${Date.now()}`,
          activityId: topMatch.id,
          action: 'Activity Match Rejected',
          actor: user.name,
          role: user.role,
          detail: `Reason: ${reason}`
        });
      }

      return json(mapReview(await loadReview(db, params.id)));
    }
  },

  {
    method: 'GET',
    pattern: '/api/audit',
    opts: { auth: true },
    async handler({ db, query }) {
      const stmt = query.activityId
        ? db.prepare('SELECT * FROM audit_events WHERE activity_id = ? OR activity_id IS NULL ORDER BY seq DESC').bind(query.activityId)
        : db.prepare('SELECT * FROM audit_events ORDER BY seq DESC LIMIT 500');
      const { results } = await stmt.all();
      return json(results.map(r => ({
        seq: r.seq, id: r.id, activityId: r.activity_id, timestamp: r.created_at,
        actor: r.actor, role: r.role, action: r.action, detail: r.detail
      })));
    }
  },
  {
    method: 'GET',
    pattern: '/api/audit/verify',
    opts: { auth: true },
    async handler({ audit }) {
      return json(await audit.verify());
    }
  }
];
