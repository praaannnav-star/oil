// GET  /api/evidence?activityId=|projectId=
// POST /api/evidence           metadata record (offline-synced data URLs)
// POST /api/evidence/sign      -> Cloudinary signed direct-upload params
// POST /api/evidence/confirm   -> persist record after client PUT to Cloudinary
import { json, err } from '../lib/http.js';
import { mapEvidence } from '../lib/d1.js';

async function sha1Hex(text) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export default [
  {
    method: 'GET',
    pattern: '/api/evidence',
    opts: { auth: true },
    async handler({ db, query }) {
      const stmt = query.activityId
        ? db.prepare('SELECT * FROM evidence WHERE activity_id = ? ORDER BY created_at DESC').bind(query.activityId)
        : db.prepare('SELECT * FROM evidence ORDER BY created_at DESC');
      const { results } = await stmt.all();
      return json(results.map(mapEvidence));
    }
  },

  // Metadata-only record for offline photos still carried as data URLs.
  {
    method: 'POST',
    pattern: '/api/evidence',
    opts: { auth: true },
    async handler({ body, db, user }) {
      if (!body?.url) return err(400, 'url is required');
      const id = body.id || `EVD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await db.prepare(
        `INSERT INTO evidence (id, report_id, activity_id, activity_name, project_id, url, public_id,
           type, filename, location_meta, uploaded_by, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, body.reportId || null, body.activityId || null, body.activityName || null,
        body.projectId || null, body.url, body.publicId || null, body.type || null,
        body.filename || null, body.locationMeta || null, user.name, body.status || 'pending'
      ).run();
      return json(mapEvidence(await db.prepare('SELECT * FROM evidence WHERE id = ?').bind(id).first()), 201);
    }
  },

  // Direct-to-Cloudinary signed upload: the client PUTs the file itself using
  // the returned params; the API secret never leaves the Worker (plan §5).
  {
    method: 'POST',
    pattern: '/api/evidence/sign',
    opts: { auth: true },
    async handler({ env }) {
      const cloud = env.CLOUDINARY_CLOUD;
      const apiKey = env.CLOUDINARY_API_KEY;
      const secret = env.CLOUDINARY_API_SECRET;
      if (!cloud || !apiKey || !secret) {
        return err(503, 'Cloudinary not configured — set CLOUDINARY_CLOUD/CLOUDINARY_API_KEY vars and CLOUDINARY_API_SECRET secret');
      }
      // Cloudinary signing rule: sha1 of sorted "k=v" pairs + api_secret.
      const timestamp = Math.floor(Date.now() / 1000);
      const folder = env.FOLDER_EVIDENCE || 'oil-evidence';
      const publicId = `${folder}/evd_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
      const toSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${secret}`;
      return json({
        cloudName: cloud,
        apiKey,
        timestamp,
        folder,
        publicId,
        signature: await sha1Hex(toSign),
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloud}/image/upload`
      });
    }
  },

  {
    method: 'POST',
    pattern: '/api/evidence/confirm',
    opts: { auth: true },
    async handler({ body, db, user, audit }) {
      if (!body?.publicId && !body?.url) return err(400, 'publicId or url is required');
      const id = body.id || `EVD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const url = body.url ||
        `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD}/image/upload/f_auto,q_auto,w_800/${body.publicId}`;
      await db.prepare(
        `INSERT INTO evidence (id, report_id, activity_id, activity_name, project_id, url, public_id,
           type, filename, location_meta, uploaded_by, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, body.reportId || null, body.activityId || null, body.activityName || null,
        body.projectId || null, url, body.publicId || null, body.type || null,
        body.filename || null, body.locationMeta || null, user.name, 'approved'
      ).run();
      await audit.append({
        id: `AUD-${Date.now()}`,
        activityId: body.activityId || null,
        action: 'Evidence Uploaded',
        actor: user.name,
        role: user.role,
        detail: `${body.filename || body.publicId} linked${body.reportId ? ` to ${body.reportId}` : ''}`
      });
      return json(mapEvidence(await db.prepare('SELECT * FROM evidence WHERE id = ?').bind(id).first()), 201);
    }
  },

  {
    method: 'DELETE',
    pattern: '/api/evidence/:id',
    opts: { auth: true },
    async handler({ params, db, user, audit }) {
      const id = params.id;
      const evd = await db.prepare('SELECT * FROM evidence WHERE id = ?').bind(id).first();
      if (!evd) return err(404, 'Evidence not found');
      
      await db.prepare('DELETE FROM evidence WHERE id = ?').bind(id).run();
      
      await audit.append({
        id: `AUD-${Date.now()}`,
        activityId: evd.activity_id || null,
        action: 'Evidence Deleted',
        actor: user.name,
        role: user.role,
        detail: `Evidence ${evd.filename || evd.id} deleted`
      });
      
      return json({ success: true });
    }
  }
];
