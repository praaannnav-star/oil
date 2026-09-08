// D1 row <-> client entity mappers. Client services consume camelCase shapes
// (js/data/mock-*.js); D1 stores snake_case columns with extras overflow.

function parseJson(text, fallback) {
  try {
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

export function mapProject(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    location: row.location,
    projectType: row.project_type,
    category: row.category,
    riskTier: row.risk_tier,
    priority: row.priority,
    region: row.region,
    lat: row.lat,
    lng: row.lng,
    startDate: row.start_date,
    targetFinish: row.target_finish,
    health: row.health,
    spi: row.spi,
    plannedProgress: row.planned_progress,
    actualProgress: row.actual_progress,
    variance: row.variance,
    delayedActivitiesCount: row.delayed_activities_count,
    pendingReviewCount: row.pending_review_count,
    evidenceCoverage: row.evidence_coverage,
    ...parseJson(row.extras_json, {})
  };
}

export function projectToRow(p) {
  const known = new Set([
    'id', 'code', 'name', 'location', 'projectType', 'category', 'riskTier', 'priority',
    'region', 'lat', 'lng', 'startDate', 'targetFinish', 'health', 'spi',
    'plannedProgress', 'actualProgress', 'variance', 'delayedActivitiesCount',
    'pendingReviewCount', 'evidenceCoverage'
  ]);
  const extras = {};
  for (const [k, v] of Object.entries(p)) if (!known.has(k)) extras[k] = v;
  const num = v => (v == null || v === '' ? null : Number(v));
  return {
    id: p.id,
    code: p.code || null,
    name: p.name,
    location: p.location || null,
    project_type: p.projectType || null,
    category: p.category || null,
    risk_tier: p.riskTier || null,
    priority: p.priority || null,
    region: p.region || null,
    lat: num(p.lat),
    lng: num(p.lng),
    start_date: p.startDate || null,
    target_finish: p.targetFinish || null,
    health: p.health || 'on-track',
    spi: num(p.spi),
    planned_progress: num(p.plannedProgress),
    actual_progress: num(p.actualProgress),
    variance: num(p.variance),
    delayed_activities_count: num(p.delayedActivitiesCount),
    pending_review_count: num(p.pendingReviewCount),
    evidence_coverage: num(p.evidenceCoverage),
    extras_json: JSON.stringify(extras)
  };
}

export function mapActivity(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    parentId: row.parent_id,
    level: row.level,
    code: row.code,
    name: row.name,
    discipline: row.discipline,
    plannedStart: row.planned_start,
    plannedFinish: row.planned_finish,
    actualStart: row.actual_start,
    actualFinish: row.actual_finish,
    progress: row.progress,
    status: row.status,
    variance: row.variance,
    lat: row.lat,
    lng: row.lng,
    ...parseJson(row.extras_json, {})
  };
}

export function activityToRow(a) {
  const known = new Set([
    'id', 'projectId', 'parentId', 'level', 'code', 'name', 'discipline',
    'plannedStart', 'plannedFinish', 'actualStart', 'actualFinish',
    'progress', 'status', 'variance', 'lat', 'lng'
  ]);
  const extras = {};
  for (const [k, v] of Object.entries(a)) if (!known.has(k)) extras[k] = v;
  const num = v => (v == null || v === '' ? null : Number(v));
  return {
    id: a.id,
    project_id: a.projectId,
    parent_id: a.parentId || null,
    level: a.level || null,
    code: a.code || null,
    name: a.name || null,
    discipline: a.discipline || null,
    planned_start: a.plannedStart || null,
    planned_finish: a.plannedFinish || null,
    actual_start: a.actualStart || null,
    actual_finish: a.actualFinish || null,
    progress: num(a.progress),
    status: a.status || null,
    variance: a.variance != null ? Number(a.variance) : null,
    lat: num(a.lat),
    lng: num(a.lng),
    extras_json: JSON.stringify(extras)
  };
}

export function mapReport(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    author: row.author,
    timestamp: row.created_at,
    rawTranscript: row.raw_transcript,
    extractedEvent: parseJson(row.extracted_json, {}),
    matchedActivityId: row.matched_activity_id,
    matchedActivityName: row.matched_activity_name,
    matchedActivityCode: row.matched_activity_code,
    confidence: row.confidence,
    signals: parseJson(row.signals_json, []),
    alternatives: parseJson(row.alternatives_json, []),
    status: row.status,
    source: row.source,
    reviewer: row.reviewer,
    reviewedAt: row.reviewed_at,
    syncedAt: row.synced_at,
    evidenceIds: parseJson(row.evidence_ids_json, [])
  };
}

export function mapReview(row) {
  if (!row) return null;
  const extractedEvent = parseJson(row.extracted_json, {});
  const urgency = extractedEvent.urgency || { priority: 'P4', score: 20, label: 'P4 Info' };
  const disc = row.discipline || extractedEvent.discipline || '';
  const suggestedReviewerRole = extractedEvent.suggestedReviewerRole || (
    disc.toLowerCase().includes('elect') || disc.toLowerCase().includes('mech') ? 'Project Manager' :
    disc.toLowerCase().includes('inst') || disc.toLowerCase().includes('inspect') ? 'QAQC Reviewer' : 'Lead Planner'
  );

  return {
    id: row.id,
    reportId: row.report_id,
    type: row.type || 'report',
    source: row.source,
    reporter: row.reporter,
    discipline: row.discipline,
    extractedEvent,
    urgency,
    suggestedReviewerRole,
    topMatch: parseJson(row.top_match_json, null),
    alternatives: parseJson(row.alternatives_json, []),
    surveyAnswers: parseJson(row.survey_answers_json, undefined) ?? undefined,
    state: row.state,
    tabCategory: row.tab_category,
    reviewer: row.reviewer,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason ?? undefined,
    age: row.age,
    aiVerification: parseJson(row.ai_verification_json, null)
  };
}

export function mapSurvey(row) {
  if (!row) return null;
  return {
    type: 'survey',
    id: row.id,
    projectId: row.project_id,
    templateId: row.template_id,
    templateName: row.template_name,
    submittedBy: row.submitted_by,
    answers: parseJson(row.answers_json, {}),
    photos: parseJson(row.photos_json, []),
    photoCount: row.photo_count,
    geo: parseJson(row.geo_json, null),
    timestamp: row.created_at,
    status: row.status,
    syncedAt: row.synced_at
  };
}

export function mapEvidence(row) {
  if (!row) return null;
  return {
    id: row.id,
    reportId: row.report_id ?? undefined,
    activityId: row.activity_id,
    activityName: row.activity_name,
    projectId: row.project_id,
    url: row.url,
    publicId: row.public_id ?? undefined,
    type: row.type,
    filename: row.filename,
    createdAt: row.created_at,
    uploadedBy: row.uploaded_by,
    locationMeta: row.location_meta,
    status: row.status
  };
}

export function mapAudit(row) {
  if (!row) return null;
  return {
    seq: row.seq,
    id: row.id,
    activityId: row.activity_id,
    timestamp: row.created_at,
    actor: row.actor,
    role: row.role,
    action: row.action,
    detail: row.detail
  };
}
