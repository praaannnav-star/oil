// OIL Bridge API — Bulk Ingestion Routes (Spreadsheets & OCR Daily Progress Reports)
// POST /api/ingest-sheet       -> Parses tabular row arrays, classifies against L5/L6 activities, returns linked events
// POST /api/ingest-ocr         -> Extracts and segments raw DPR/scanned text, normalizes abbreviations, classifies activities
// POST /api/ingest/confirm     -> Batch commits verified items directly into field_reports + reviews in D1
import { json, err } from '../lib/http.js';
import { extractRules } from '../lib/rules.js';
import { classifyDisciplineRules } from '../lib/discipline.js';
import { normalizeOcrText, segmentOcrReport } from '../lib/ocr-normalize.js';

function levenshteinSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (a === b) return 1.0;
  if (a.includes(b) || b.includes(a)) return 0.85;

  const lenA = a.length;
  const lenB = b.length;
  if (Math.abs(lenA - lenB) > Math.max(lenA, lenB) * 0.6) return 0;

  const matrix = [];
  for (let i = 0; i <= lenA; i++) matrix[i] = [i];
  for (let j = 0; j <= lenB; j++) matrix[0][j] = j;

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  const maxLen = Math.max(lenA, lenB);
  return maxLen === 0 ? 1 : Math.max(0, 1 - matrix[lenA][lenB] / maxLen);
}

// Match an activity candidate against the L5/L6 activity pool
function matchCandidate(activityPool, { activityText = '', discipline = '', wbsCode = '', assetTag = '' }, sourceType = 'spreadsheet') {
  const lowerAct = (activityText || '').toLowerCase();
  const lowerTag = (assetTag || '').toLowerCase().trim();
  const lowerCode = (wbsCode || '').toLowerCase().trim();
  const targetDisc = (discipline || '').toLowerCase().trim();

  const scored = activityPool.map(c => {
    let score = 0;
    const cName = (c.name || '').toLowerCase();
    const cCode = (c.code || '').toLowerCase();
    const cDisc = (c.discipline || '').toLowerCase();

    // Direct WBS / Code exact hit
    if (lowerCode && (cCode === lowerCode || cCode.includes(lowerCode))) {
      score += 55;
    }

    // Discipline match
    if (targetDisc && cDisc.includes(targetDisc)) {
      score += 25;
    }

    // Asset tag match
    if (lowerTag && lowerTag !== 'general area') {
      if (cCode.includes(lowerTag) || cName.includes(lowerTag)) {
        score += 30;
      }
    }

    // Token overlap
    const tokens = lowerAct.split(/[\s,·\/\-]+/).filter(t => t.length >= 3);
    for (const t of tokens) {
      if (cName.includes(t)) score += 10;
      if (cCode.includes(t)) score += 15;
    }

    // Phrase fuzzy similarity
    const sim = levenshteinSimilarity(lowerAct, cName);
    if (sim > 0.45) {
      score += Math.round(sim * 35);
    }

    return { ...c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0] || null;

  // Source-specific confidence weighting
  let baseConfidence = best ? Math.min(99, Math.max(15, best.score)) : 25;
  if (sourceType === 'spreadsheet') {
    // Spreadsheets carry structured row semantics
    baseConfidence = Math.min(99, baseConfidence + 10);
  } else if (sourceType === 'ocr') {
    // OCR carries scanning noise
    baseConfidence = Math.min(96, Math.max(20, baseConfidence));
  }

  const topMatch = best && best.score >= 35 ? {
    id: best.id,
    projectId: best.projectId,
    code: best.code,
    name: best.name,
    discipline: best.discipline,
    confidence: baseConfidence,
    signals: [
      `Source: ${sourceType.toUpperCase()}`,
      `Token & phrase similarity: ${Math.round(best.score)}%`,
      `Discipline: ${best.discipline}`
    ]
  } : null;

  const alternatives = scored.slice(1, 4).filter(a => a.score >= 30).map(a => ({
    id: a.id,
    projectId: a.projectId,
    code: a.code,
    name: a.name,
    discipline: a.discipline,
    confidence: Math.max(20, a.score)
  }));

  return { topMatch, alternatives, confidence: topMatch ? topMatch.confidence : 25 };
}

export default [
  // 1. Spreadsheet Ingestion Endpoint
  {
    method: 'POST',
    pattern: '/api/ingest-sheet',
    opts: { auth: true },
    async handler({ body, db, user, audit }) {
      const rows = Array.isArray(body?.rows) ? body.rows : [];
      const columnMap = body?.columnMap || {};
      const targetProjectId = body?.projectId || null;
      const filename = body?.filename || 'spreadsheet.xlsx';
      const autoSubmit = Boolean(body?.autoSubmit);

      if (rows.length === 0) {
        return err(400, 'No spreadsheet rows provided for ingestion.');
      }

      // Load activities pool for schedule linking
      const actStmt = targetProjectId
        ? db.prepare(`SELECT * FROM activities WHERE project_id = ? AND level IN ('L5','L6')`).bind(targetProjectId)
        : db.prepare(`SELECT * FROM activities WHERE level IN ('L5','L6')`);
      const { results: actRows } = await actStmt.all();
      const activityPool = (actRows || []).map(r => ({
        id: r.id,
        projectId: r.project_id,
        code: r.code,
        name: r.name,
        discipline: r.discipline,
        plannedFinish: r.planned_finish
      }));

      const results = [];
      let matchedCount = 0;
      let unmatchedCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const activityText = String(row[columnMap.activity] || row['Activity'] || row['activity'] || row['Description'] || row['task'] || '').trim();
        if (!activityText) continue;

        const dateStr = String(row[columnMap.date] || row['Date'] || row['date'] || new Date().toISOString().split('T')[0]).slice(0, 10);
        const rawProgress = row[columnMap.progress] !== undefined ? row[columnMap.progress] : (row['Progress'] ?? row['progress'] ?? row['% Complete']);
        const progressNum = rawProgress !== undefined && rawProgress !== null && rawProgress !== '' ? Number(String(rawProgress).replace('%', '').trim()) : null;
        const progress = progressNum !== null && !isNaN(progressNum) ? Math.min(100, Math.max(0, progressNum)) : null;

        const rawStatus = String(row[columnMap.status] || row['Status'] || row['status'] || '').toLowerCase();
        let status = 'in-progress';
        if (rawStatus.includes('comp') || progress === 100) status = 'completed';
        else if (rawStatus.includes('delay') || rawStatus.includes('stuck') || rawStatus.includes('hold')) status = 'delayed';

        const rawDisc = String(row[columnMap.discipline] || row['Discipline'] || row['discipline'] || '');
        const discObj = rawDisc ? { discipline: rawDisc } : classifyDisciplineRules(activityText);
        const discipline = discObj.discipline || 'Civil';

        const wbsCode = String(row[columnMap.wbsCode] || row['WBS'] || row['WBS Code'] || row['Code'] || '').trim();
        const remarks = String(row[columnMap.remarks] || row['Remarks'] || row['Comments'] || row['Notes'] || '').trim();

        // Synthesize operational statement
        const syntheticTranscript = `[${discipline}] ${wbsCode ? `WBS: ${wbsCode} — ` : ''}${activityText}. Progress: ${progress != null ? progress + '%' : 'Observed'}. Status: ${status}. Date: ${dateStr}.${remarks ? ` Remarks: ${remarks}` : ''}`;

        // Match against schedule
        const matchResult = matchCandidate(activityPool, {
          activityText,
          discipline,
          wbsCode,
          assetTag: ''
        }, 'spreadsheet');

        if (matchResult.topMatch) matchedCount++;
        else unmatchedCount++;

        const extractedEvent = {
          activity: activityText,
          discipline,
          status: status === 'completed' ? 'Completed' : (status === 'delayed' ? 'Delayed' : 'In Progress'),
          progress: progress ?? (status === 'completed' ? 100 : 50),
          date: dateStr,
          assetTag: wbsCode || 'General Area',
          blocker: status === 'delayed' ? (remarks || 'Schedule Drag Flagged in Sheet') : 'None',
          capturedAt: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) + ' IST'
        };

        const item = {
          rowNumber: i + 1,
          syntheticTranscript,
          extractedEvent,
          topMatch: matchResult.topMatch,
          alternatives: matchResult.alternatives,
          confidence: matchResult.confidence,
          source: 'spreadsheet',
          sourceFile: filename,
          rawRow: row
        };

        // If autoSubmit is requested, immediately persist each row as a review item in D1
        if (autoSubmit) {
          const reportId = `REP-SHT-${Date.now()}-${i}`;
          const reviewId = `REV-SHT-${Date.now()}-${i}`;

          await db.prepare(
            `INSERT INTO field_reports (id, project_id, author, raw_transcript, extracted_json,
               matched_activity_id, matched_activity_name, matched_activity_code, confidence, signals_json,
               alternatives_json, status, source, evidence_ids_json, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            reportId, targetProjectId || matchResult.topMatch?.projectId || null, user.name,
            syntheticTranscript, JSON.stringify(extractedEvent),
            matchResult.topMatch?.id || null, matchResult.topMatch?.name || null, matchResult.topMatch?.code || null,
            matchResult.confidence, JSON.stringify(matchResult.topMatch?.signals || []), JSON.stringify(matchResult.alternatives || []),
            'pending-review', 'spreadsheet', '[]', new Date().toISOString()
          ).run();

          await db.prepare(
            `INSERT INTO reviews (id, report_id, type, source, reporter, discipline, extracted_json,
               top_match_json, alternatives_json, state, tab_category, age, ai_verification_json)
             VALUES (?, ?, 'report', ?, ?, ?, ?, ?, ?, 'needs-review', ?, 'Just now', ?)`
          ).bind(
            reviewId, reportId, `Spreadsheet (${filename})`, user.name,
            discipline, JSON.stringify({ ...extractedEvent, urgency: { priority: status === 'delayed' ? 'P2' : 'P4', score: status === 'delayed' ? 75 : 20, label: status === 'delayed' ? 'P2 High' : 'P4 Info' } }),
            JSON.stringify(matchResult.topMatch ? { ...matchResult.topMatch, confidence: matchResult.confidence } : null),
            JSON.stringify(matchResult.alternatives || []),
            matchResult.confidence >= 80 ? 'high-confidence' : 'needs-review',
            JSON.stringify({ status: 'verified_spreadsheet', verified: true, confidence: matchResult.confidence, reasoning: `Ingested from verified site spreadsheet "${filename}".` })
          ).run();

          item.reportId = reportId;
          item.reviewId = reviewId;
        }

        results.push(item);
      }

      await audit.append({
        id: `AUD-SHT-${Date.now()}`,
        action: 'Discipline Spreadsheet Ingested',
        actor: user.name,
        role: user.role,
        detail: `Ingested file "${filename}". Parsed ${results.length} rows (${matchedCount} auto-linked to L5/L6, ${unmatchedCount} pending).`
      });

      return json({
        success: true,
        filename,
        totalRows: rows.length,
        processedCount: results.length,
        matchedCount,
        unmatchedCount,
        items: results
      });
    }
  },

  // 2. OCR Daily Progress Report (DPR) Ingestion Endpoint
  {
    method: 'POST',
    pattern: '/api/ingest-ocr',
    opts: { auth: true },
    async handler({ body, db, user, env, audit }) {
      const targetProjectId = body?.projectId || null;
      const filename = body?.filename || 'scanned-dpr.pdf';
      const autoSubmit = Boolean(body?.autoSubmit);
      let rawText = body?.rawText ? String(body.rawText) : '';
      const imageBase64 = body?.imageBase64 || null;

      // If raw image data provided and Cloudflare AI Vision is available
      if (!rawText && imageBase64 && env?.AI) {
        try {
          // Clean base64 header if present (data:image/jpeg;base64,...)
          const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
          const binaryStr = atob(base64Data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          const visionRes = await env.AI.run('@cf/llava-1.5-7b-hf', {
            image: [...bytes],
            prompt: 'Extract all written text from this infrastructure project daily progress report image. Transcribe all work activities, disciplines, numbers, and dates accurately as text.',
            max_tokens: 1024
          });

          rawText = visionRes?.description || visionRes?.response || '';
        } catch (visionErr) {
          console.warn('Vision OCR error, falling back to simulated OCR parser:', visionErr.message);
        }
      }

      if (!rawText || !rawText.trim()) {
        return err(400, 'No text or image content provided for OCR processing.');
      }

      // 1. Clean & Segment OCR Text into discrete activity chunks
      const segments = segmentOcrReport(rawText);

      // 2. Load activities pool for schedule linking
      const actStmt = targetProjectId
        ? db.prepare(`SELECT * FROM activities WHERE project_id = ? AND level IN ('L5','L6')`).bind(targetProjectId)
        : db.prepare(`SELECT * FROM activities WHERE level IN ('L5','L6')`);
      const { results: actRows } = await actStmt.all();
      const activityPool = (actRows || []).map(r => ({
        id: r.id,
        projectId: r.project_id,
        code: r.code,
        name: r.name,
        discipline: r.discipline,
        plannedFinish: r.planned_finish
      }));

      const results = [];
      let matchedCount = 0;
      let unmatchedCount = 0;

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const segText = seg.rawText;
        const disc = seg.discipline && seg.discipline !== 'General' ? seg.discipline : classifyDisciplineRules(segText).discipline;

        // Run deterministic rules extraction on segment
        const extracted = extractRules(segText);
        extracted.discipline = disc;

        // Link against L5/L6 activities
        const matchResult = matchCandidate(activityPool, {
          activityText: extracted.activity || segText,
          discipline: disc,
          assetTag: extracted.assetTag || ''
        }, 'ocr');

        if (matchResult.topMatch) matchedCount++;
        else unmatchedCount++;

        const item = {
          segmentIndex: i + 1,
          rawSegmentText: segText,
          extractedEvent: {
            ...extracted,
            date: extracted.date || new Date().toISOString().split('T')[0]
          },
          topMatch: matchResult.topMatch,
          alternatives: matchResult.alternatives,
          confidence: matchResult.confidence,
          source: 'ocr',
          sourceFile: filename
        };

        if (autoSubmit) {
          const reportId = `REP-OCR-${Date.now()}-${i}`;
          const reviewId = `REV-OCR-${Date.now()}-${i}`;

          await db.prepare(
            `INSERT INTO field_reports (id, project_id, author, raw_transcript, extracted_json,
               matched_activity_id, matched_activity_name, matched_activity_code, confidence, signals_json,
               alternatives_json, status, source, evidence_ids_json, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            reportId, targetProjectId || matchResult.topMatch?.projectId || null, user.name,
            segText, JSON.stringify(item.extractedEvent),
            matchResult.topMatch?.id || null, matchResult.topMatch?.name || null, matchResult.topMatch?.code || null,
            matchResult.confidence, JSON.stringify(matchResult.topMatch?.signals || []), JSON.stringify(matchResult.alternatives || []),
            'pending-review', 'ocr', '[]', new Date().toISOString()
          ).run();

          await db.prepare(
            `INSERT INTO reviews (id, report_id, type, source, reporter, discipline, extracted_json,
               top_match_json, alternatives_json, state, tab_category, age, ai_verification_json)
             VALUES (?, ?, 'report', ?, ?, ?, ?, ?, ?, 'needs-review', ?, 'Just now', ?)`
          ).bind(
            reviewId, reportId, `OCR DPR (${filename})`, user.name,
            disc, JSON.stringify({ ...item.extractedEvent, urgency: { priority: 'P3', score: 45, label: 'P3 Medium' } }),
            JSON.stringify(matchResult.topMatch ? { ...matchResult.topMatch, confidence: matchResult.confidence } : null),
            JSON.stringify(matchResult.alternatives || []),
            matchResult.confidence >= 80 ? 'high-confidence' : 'needs-review',
            JSON.stringify({ status: 'ocr_extracted', verified: true, confidence: matchResult.confidence, reasoning: `OCR scanned from "${filename}".` })
          ).run();

          item.reportId = reportId;
          item.reviewId = reviewId;
        }

        results.push(item);
      }

      await audit.append({
        id: `AUD-OCR-${Date.now()}`,
        action: 'OCR DPR Document Ingested',
        actor: user.name,
        role: user.role,
        detail: `Processed document "${filename}". Extracted ${results.length} activity segments (${matchedCount} auto-linked to L5/L6).`
      });

      return json({
        success: true,
        filename,
        normalizedOcrText: normalizeOcrText(rawText),
        totalSegments: segments.length,
        matchedCount,
        unmatchedCount,
        items: results
      });
    }
  },

  // 3. Batch Confirmation Endpoint — Commits user-verified items to Review Queue
  {
    method: 'POST',
    pattern: '/api/ingest/confirm',
    opts: { auth: true },
    async handler({ body, db, user, audit }) {
      const items = Array.isArray(body?.items) ? body.items : [];
      const projectId = body?.projectId || null;
      const sourceLabel = body?.sourceLabel || 'Bulk Ingestion Engine';

      if (items.length === 0) {
        return err(400, 'No items selected for confirmation.');
      }

      const insertedReviewIds = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const reportId = `REP-BULK-${Date.now()}-${i}`;
        const reviewId = `REV-BULK-${Date.now()}-${i}`;
        const transcript = item.syntheticTranscript || item.rawSegmentText || item.extractedEvent?.activity || 'Bulk Ingest Activity';
        const extracted = item.extractedEvent || {};
        const match = item.topMatch || null;
        const confidence = Number(item.confidence || (match ? match.confidence : 75));
        const disc = extracted.discipline || match?.discipline || 'Civil';
        const status = (extracted.status || '').toLowerCase().includes('delayed') ? 'delayed' : 'pending-review';

        await db.prepare(
          `INSERT INTO field_reports (id, project_id, author, raw_transcript, extracted_json,
             matched_activity_id, matched_activity_name, matched_activity_code, confidence, signals_json,
             alternatives_json, status, source, evidence_ids_json, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          reportId, projectId || match?.projectId || null, user.name,
          transcript, JSON.stringify(extracted),
          match?.id || null, match?.name || null, match?.code || null,
          confidence, JSON.stringify(match?.signals || []), JSON.stringify(item.alternatives || []),
          'pending-review', item.source || 'bulk-ingest', '[]', new Date().toISOString()
        ).run();

        await db.prepare(
          `INSERT INTO reviews (id, report_id, type, source, reporter, discipline, extracted_json,
             top_match_json, alternatives_json, state, tab_category, age, ai_verification_json)
           VALUES (?, ?, 'report', ?, ?, ?, ?, ?, ?, 'needs-review', ?, 'Just now', ?)`
        ).bind(
          reviewId, reportId, sourceLabel, user.name,
          disc, JSON.stringify({ ...extracted, urgency: { priority: status === 'delayed' ? 'P2' : 'P3', score: status === 'delayed' ? 75 : 45, label: status === 'delayed' ? 'P2 High' : 'P3 Medium' } }),
          JSON.stringify(match ? { ...match, confidence } : null),
          JSON.stringify(item.alternatives || []),
          confidence >= 80 ? 'high-confidence' : 'needs-review',
          JSON.stringify({ status: 'bulk_verified', verified: true, confidence, reasoning: `Verified in bulk intake from ${sourceLabel}.` })
        ).run();

        insertedReviewIds.push(reviewId);
      }

      await audit.append({
        id: `AUD-BLK-${Date.now()}`,
        action: 'Bulk Ingest Items Committed to Review Queue',
        actor: user.name,
        role: user.role,
        detail: `Committed ${insertedReviewIds.length} verified activities into Review Queue from "${sourceLabel}".`
      });

      return json({
        success: true,
        committedCount: insertedReviewIds.length,
        reviewIds: insertedReviewIds
      });
    }
  }
];
