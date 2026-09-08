// Project Assignments API — multi-discipline supervisor & manager assignments
import { json, err } from '../lib/http.js';

export default [
  {
    method: 'GET',
    pattern: '/api/assignments',
    opts: { auth: true },
    async handler({ user, db }) {
      if (user.role !== 'Admin') return err(403, 'Admin access required');
      const { results } = await db.prepare(
        `SELECT pa.id, pa.project_id as projectId, pa.user_id as userId, pa.discipline, pa.assigned_at as assignedAt,
                u.name as userName, u.username, u.role as userRole, u.avatar as userAvatar,
                p.name as projectName, p.code as projectCode
         FROM project_assignments pa
         JOIN users u ON pa.user_id = u.id
         JOIN projects p ON pa.project_id = p.id
         ORDER BY pa.project_id, pa.discipline`
      ).all();
      return json(results || []);
    }
  },
  {
    method: 'GET',
    pattern: '/api/projects/:id/assignments',
    opts: { auth: true },
    async handler({ params, db }) {
      const { results } = await db.prepare(
        `SELECT pa.id, pa.project_id as projectId, pa.user_id as userId, pa.discipline, pa.assigned_at as assignedAt,
                u.name as userName, u.username, u.role as userRole, u.avatar as userAvatar, u.title as userTitle
         FROM project_assignments pa
         JOIN users u ON pa.user_id = u.id
         WHERE pa.project_id = ?
         ORDER BY pa.assigned_at DESC`
      ).bind(params.id).all();
      return json(results || []);
    }
  },
  {
    method: 'POST',
    pattern: '/api/projects/:id/assignments',
    opts: { auth: true },
    async handler({ user, params, body, db }) {
      if (user.role !== 'Admin') return err(403, 'Admin access required');
      const projectId = params.id;
      const userId = String(body?.userId || '').trim();
      const discipline = String(body?.discipline || 'All').trim();

      if (!userId) return err(400, 'userId is required');

      const project = await db.prepare('SELECT id, name, code FROM projects WHERE id = ?').bind(projectId).first();
      if (!project) return err(404, 'Project not found');

      const targetUser = await db.prepare('SELECT id, name, username, role, avatar, title FROM users WHERE id = ?').bind(userId).first();
      if (!targetUser) return err(404, 'User not found');

      const existing = await db.prepare(
        'SELECT id FROM project_assignments WHERE project_id = ? AND user_id = ? AND discipline = ?'
      ).bind(projectId, userId, discipline).first();

      if (existing) {
        return err(409, `${targetUser.name} is already assigned to ${discipline} on this project`);
      }

      const id = `ASN-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
      await db.prepare(
        `INSERT INTO project_assignments (id, project_id, user_id, discipline)
         VALUES (?, ?, ?, ?)`
      ).bind(id, projectId, userId, discipline).run();

      return json({
        id,
        projectId,
        userId,
        discipline,
        userName: targetUser.name,
        username: targetUser.username,
        userRole: targetUser.role,
        userAvatar: targetUser.avatar,
        projectName: project.name,
        projectCode: project.code,
        assignedAt: new Date().toISOString()
      }, 201);
    }
  },
  {
    method: 'DELETE',
    pattern: '/api/projects/:id/assignments/:assignmentId',
    opts: { auth: true },
    async handler({ user, params, db }) {
      if (user.role !== 'Admin') return err(403, 'Admin access required');
      const { id: projectId, assignmentId } = params;

      const existing = await db.prepare(
        'SELECT id FROM project_assignments WHERE id = ? AND project_id = ?'
      ).bind(assignmentId, projectId).first();

      if (!existing) return err(404, 'Assignment not found');

      await db.prepare(
        'DELETE FROM project_assignments WHERE id = ? AND project_id = ?'
      ).bind(assignmentId, projectId).run();

      return json({ ok: true, deleted: assignmentId });
    }
  }
];
