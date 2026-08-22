import { API } from './api.js';
import { DB } from '../db.js';
import { AuditService } from './audit.js';

export const ReportsService = {
  async getReports(projectId = null) {
    await API.delay();
    let list = API.reports;
    if (projectId) {
      list = list.filter(r => r.projectId === projectId);
    }
    return list;
  },

  // Intelligent Extraction Layer (Extracts structured operational entities from transcript)
  async extractEvent(transcript) {
    await API.delay(300); // realistic AI extraction pause
    const lower = (transcript || '').toLowerCase();

    // Discipline detection
    let discipline = 'Civil';
    if (lower.includes('pipe') || lower.includes('spool') || lower.includes('weld') || lower.includes('flange')) {
      discipline = 'Piping';
    } else if (lower.includes('cable') || lower.includes('junction') || lower.includes('sensor') || lower.includes('dcs') || lower.includes('instrument')) {
      discipline = 'Instrumentation';
    } else if (lower.includes('motor') || lower.includes('transformer') || lower.includes('switchgear') || lower.includes('ht') || lower.includes('panel')) {
      discipline = 'Electrical';
    }

    // Status detection
    let status = 'In Progress';
    if (lower.includes('completed') || lower.includes('finished') || lower.includes('done') || lower.includes('poured')) {
      status = 'Completed';
    } else if (lower.includes('delayed') || lower.includes('halted') || lower.includes('shortage') || lower.includes('stopped') || lower.includes('breakdown')) {
      status = 'Delayed';
    }

    // Asset extraction
    let assetTag = 'General Area';
    if (lower.includes('foundation b2') || lower.includes('b2')) {
      assetTag = 'Foundation Block B2 (Pad 14)';
    } else if (lower.includes('foundation b3') || lower.includes('b3')) {
      assetTag = 'Foundation Block B3';
    } else if (lower.includes('foundation b1') || lower.includes('b1')) {
      assetTag = 'Foundation Block B1';
    } else if (lower.includes('j-44') || lower.includes('suction header') || lower.includes('16 inch')) {
      assetTag = '16" Gas Suction Header (Joint J-44)';
    } else if (lower.includes('jb-102') || lower.includes('jb 102')) {
      assetTag = 'Junction Box JB-102';
    }

    // Blocker detection
    let blocker = 'None';
    if (lower.includes('shortage')) {
      blocker = 'Material / parts shortage reported';
    } else if (lower.includes('rain') || lower.includes('monsoon')) {
      blocker = 'Weather / rainfall interruption';
    } else if (lower.includes('breakdown')) {
      blocker = 'Equipment breakdown';
    }

    return {
      discipline,
      activity: transcript ? transcript.slice(0, 70) + (transcript.length > 70 ? '...' : '') : 'Site Activity',
      assetTag,
      startTime: '08:30 IST',
      endTime: '17:15 IST',
      status,
      blocker,
      date: new Date().toISOString().split('T')[0]
    };
  },

  // Intelligent Schedule-Linking Matcher
  async matchActivity(extractedEvent, candidateActivities = null) {
    await API.delay(200);
    const pool = candidateActivities || API.activities;
    const lowerAct = (extractedEvent.activity || '').toLowerCase();
    const lowerTag = (extractedEvent.assetTag || '').toLowerCase();

    // Score all L5/L6 activities
    const scored = pool
      .filter(a => a.level === 'L5' || a.level === 'L6')
      .map(act => {
        let score = 30; // base score
        const signals = [];

        // Discipline match
        if (act.discipline.toLowerCase() === extractedEvent.discipline.toLowerCase()) {
          score += 25;
          signals.push({ label: `Discipline matches (${act.discipline})`, match: true });
        } else {
          signals.push({ label: `Discipline mismatch (${act.discipline} vs ${extractedEvent.discipline})`, match: false });
        }

        // Asset code/tag match
        const actCode = act.code.toLowerCase();
        const actName = act.name.toLowerCase();
        if (lowerTag.includes('b2') && (actCode.includes('b2') || actName.includes('b2'))) {
          score += 35;
          signals.push({ label: 'Asset identifier verified (Foundation B2)', match: true });
        } else if (lowerTag.includes('jb-102') && (actCode.includes('102') || actName.includes('jb-102'))) {
          score += 35;
          signals.push({ label: 'Equipment tag JB-102 matched', match: true });
        } else if (lowerTag.includes('16') && (actName.includes('16"') || actCode.includes('hdr'))) {
          score += 35;
          signals.push({ label: '16" Gas Suction Header asset verified', match: true });
        }

        // Semantic terminology
        if (lowerAct.includes('pour') && actName.includes('pour')) {
          score += 10;
          signals.push({ label: 'Terminology semantic alignment ("pour", "concrete")', match: true });
        }

        // Schedule window active
        signals.push({ label: 'Schedule window active and expecting progress', match: true });

        const confidence = Math.min(98, Math.max(25, score));
        return {
          ...act,
          confidence,
          signals
        };
      })
      .sort((a, b) => b.confidence - a.confidence);

    const recommended = scored[0] || null;
    const alternatives = scored.slice(1, 4);

    return {
      recommended,
      confidence: recommended ? recommended.confidence : 0,
      signals: recommended ? recommended.signals : [],
      alternatives
    };
  },

  async submitReport(reportData) {
    await API.delay();
    const newReport = {
      id: `REP-${Date.now()}`,
      projectId: reportData.projectId || 'PRJ-OIL-2026-01',
      author: reportData.author || 'Site Engineer (Field PWA)',
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST',
      rawTranscript: reportData.rawTranscript,
      extractedEvent: reportData.extractedEvent,
      matchedActivityId: reportData.matchedActivity?.id,
      matchedActivityName: reportData.matchedActivity?.name,
      matchedActivityCode: reportData.matchedActivity?.code,
      confidence: reportData.confidence || 90,
      signals: reportData.signals || [],
      status: reportData.isOffline ? 'pending-sync' : 'pending-review',
      reviewer: null,
      reviewedAt: null,
      evidenceIds: reportData.evidenceIds || []
    };

    if (reportData.isOffline) {
      await DB.addPendingReport(newReport);
    } else {
      API.reports.unshift(newReport);
      API.persist('reports');

      // Also create a review item
      const reviewItem = {
        id: `REV-${Date.now()}`,
        reportId: newReport.id,
        source: 'Mobile Field App',
        reporter: newReport.author,
        discipline: newReport.extractedEvent.discipline,
        extractedEvent: newReport.extractedEvent,
        topMatch: reportData.matchedActivity ? {
          ...reportData.matchedActivity,
          confidence: reportData.confidence,
          signals: reportData.signals
        } : null,
        alternatives: reportData.alternatives || [],
        state: 'needs-review',
        tabCategory: reportData.confidence >= 80 ? 'high-confidence' : 'needs-review',
        reviewer: null,
        reviewedAt: null,
        age: 'Just now'
      };
      API.reviewItems.unshift(reviewItem);
      API.persist('reviewItems');

      // Audit trail
      await AuditService.appendAudit({
        activityId: newReport.matchedActivityId || 'GENERAL',
        action: 'Field Progress Report Submitted',
        actor: newReport.author,
        role: 'Field Staff',
        detail: `Report: "${newReport.rawTranscript.slice(0, 100)}..." Linked with ${newReport.confidence}% confidence.`
      });
    }

    return newReport;
  }
};
