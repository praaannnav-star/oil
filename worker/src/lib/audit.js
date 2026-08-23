// Tamper-evident audit chain: entry_hash = sha256(prev_hash || payload_hash).
// Verified nightly by the Worker cron and on demand via GET /api/audit/verify.

const GENESIS = '0'.repeat(64);

export function canonicalAuditPayload(entry) {
  // Deterministic field order keeps hashes stable across D1 row re-reads.
  return JSON.stringify({
    id: entry.id,
    activityId: entry.activityId ?? null,
    action: entry.action,
    actor: entry.actor ?? null,
    role: entry.role ?? null,
    detail: entry.detail ?? null
  });
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export class AuditChain {
  constructor(db) {
    this.db = db;
  }

  async append({ id, activityId = null, action, actor, role = null, detail = null }) {
    const last = await this.db
      .prepare('SELECT seq, payload_hash FROM audit_events ORDER BY seq DESC LIMIT 1')
      .first();
    const prevHash = last ? last.payload_hash : GENESIS;
    const payloadHash = await sha256Hex(canonicalAuditPayload({ id, activityId, action, actor, role, detail }));
    await this.db
      .prepare(
        `INSERT INTO audit_events (id, activity_id, action, actor, role, detail, prev_hash, payload_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, activityId, action, actor, role, detail, prevHash, payloadHash)
      .run();
    return { id, prevHash, payloadHash };
  }

  async verify() {
    const { results } = await this.db
      .prepare('SELECT seq, id, activity_id, action, actor, role, detail, prev_hash, payload_hash FROM audit_events ORDER BY seq ASC')
      .all();
    let prevHash = GENESIS;
    for (const row of results || []) {
      const expectedPrev = prevHash;
      if ((row.prev_hash || GENESIS) !== expectedPrev) {
        return { valid: false, brokenAtSeq: row.seq, reason: 'prev_hash mismatch' };
      }
      const recomputed = await sha256Hex(
        canonicalAuditPayload({
          id: row.id,
          activityId: row.activity_id,
          action: row.action,
          actor: row.actor,
          role: row.role,
          detail: row.detail
        })
      );
      if (recomputed !== row.payload_hash) {
        return { valid: false, brokenAtSeq: row.seq, reason: 'payload tampered' };
      }
      prevHash = row.payload_hash;
    }
    return { valid: true, entries: (results || []).length };
  }
}
