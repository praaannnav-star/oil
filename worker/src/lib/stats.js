// Public landing-page stats — data-derived only, cached for offline fallback.
// Mirrors ApiService.getPublicStats() shape on the client.

export function computePublicStats(db) {
  // Counts are computed with scalar subqueries to stay a single round-trip.
  return db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM projects) AS projects,
        (SELECT COUNT(*) FROM activities WHERE level IN ('L5','L6')) AS activities,
        (SELECT COUNT(*) FROM reviews WHERE state = 'needs-review') AS pendingReviews,
        (SELECT COUNT(*) FROM evidence) AS evidence,
        (SELECT COUNT(*) FROM field_reports) AS reports`
    )
    .first();
}

export async function refreshStatsCache(db) {
  const stats = await computePublicStats(db);
  await db
    .prepare(
      `INSERT INTO stats_cache (key, value_json, updated_at) VALUES ('public', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`
    )
    .bind(JSON.stringify({ ...stats, savedAt: Date.now() }))
    .run();
  return stats;
}

export async function getPublicStats(db) {
  const live = await computePublicStats(db);
  if (live && Number(live.projects) >= 0) {
    const payload = { ...live, savedAt: Date.now() };
    // Write-behind cache; failure never blocks the response.
    try { await refreshStatsCache(db); } catch {}
    return payload;
  }
  const row = await db.prepare(`SELECT value_json FROM stats_cache WHERE key = 'public'`).first();
  return row ? JSON.parse(row.value_json) : { projects: 0, activities: 0, pendingReviews: 0, evidence: 0, reports: 0 };
}

export async function runGoldenSetBenchmark(db, env = {}) {
  const { PROMPT_VERSION } = await import('../prompts.js');
  const { extractRules } = await import('./rules.js');

  const rows = (await db.prepare('SELECT * FROM golden_set').all()).results || [];
  if (rows.length === 0) {
    return { accuracyPercent: 100, totalEvaluated: 0, passedCount: 0, promptVersion: PROMPT_VERSION, evaluatedAt: new Date().toISOString() };
  }

  let totalFields = 0;
  let matchingFields = 0;
  let passedSamples = 0;

  for (const sample of rows) {
    let expected = {};
    try { expected = JSON.parse(sample.expected_json); } catch {}

    const extracted = extractRules(sample.transcript);

    let samplePass = true;
    for (const [k, expectedVal] of Object.entries(expected)) {
      totalFields++;
      const actualVal = extracted[k];
      if (actualVal && String(actualVal).toLowerCase().trim() === String(expectedVal).toLowerCase().trim()) {
        matchingFields++;
      } else {
        samplePass = false;
      }
    }
    if (samplePass) passedSamples++;
  }

  const accuracyPercent = totalFields > 0 ? Number(((matchingFields / totalFields) * 100).toFixed(1)) : 100;
  const result = {
    accuracyPercent,
    totalEvaluated: rows.length,
    passedCount: passedSamples,
    matchingFields,
    totalFields,
    promptVersion: PROMPT_VERSION,
    modelName: '@cf/meta/llama-3.1-8b-instruct',
    evaluatedAt: new Date().toISOString()
  };

  await db
    .prepare(
      `INSERT INTO stats_cache (key, value_json, updated_at) VALUES ('golden_set_benchmark', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`
    )
    .bind(JSON.stringify(result))
    .run();

  if (accuracyPercent < 80) {
    console.warn(`[benchmark:alert] AI extraction accuracy ${accuracyPercent}% is below 80% threshold for prompt ${PROMPT_VERSION}`);
  } else {
    console.log(`[benchmark:info] AI golden-set accuracy ${accuracyPercent}% (${passedSamples}/${rows.length} passed, prompt ${PROMPT_VERSION})`);
  }

  return result;
}

export async function getBenchmarkStats(db) {
  const row = await db.prepare(`SELECT value_json FROM stats_cache WHERE key = 'golden_set_benchmark'`).first();
  if (row) {
    try { return JSON.parse(row.value_json); } catch {}
  }
  return await runGoldenSetBenchmark(db);
}
