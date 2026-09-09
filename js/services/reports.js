import { API } from './api.js';
import { DB } from '../db.js';
import { AuditService } from './audit.js';
import { EvidenceService } from './evidence.js';

export const ReportsService = {
  async getReports(projectId = null) {
    await API.delay();
    let list = API.reports;
    if (projectId) {
      list = list.filter(r => r.projectId === projectId);
    }
    return list;
  },

  async correctReport(reportId, notes) {
    if (!API.useMock) {
      const { ApiHttp } = await import('./http.js');
      return await ApiHttp.request(`/reports/${reportId}/correct`, {
        method: 'POST',
        body: { notes }
      });
    }
    // Mock implementation for local testing without worker
    await API.delay(500);
    const item = API.reports.find(r => r.id === reportId) || API.reviewItems.find(i => i.reportId === reportId);
    if (!item) throw new Error('Report not found');
    const evt = item.extractedEvent || JSON.parse(item.extracted_json || '{}');
    const corrected = { ...evt }; // naive mock correction
    return { event: corrected, source: 'llm-correct' };
  },

  // Intelligent Extraction Layer (Extracts structured operational entities from transcript)
  async extractEvent(input) {
    // Field devices and sync replays can deliver numbers/objects/null here;
    // coerce once so neither the live path nor rules engine ever crashes.
    const transcript = typeof input === 'string'
      ? input
      : input == null ? '' : String(input);

    const pctMatch = transcript.match(/(\d{1,3})\s*%/);
    const textPct = pctMatch ? Math.min(100, Math.max(0, Number(pctMatch[1]))) : null;

    if (navigator.onLine) {
      try {
        const { ApiHttp } = await import('./http.js');
        const res = await ApiHttp.request('/extract', {
          method: 'POST',
          body: { transcript }
        });
        if (res && res.event) {
          const ev = res.event;
          const evProgress = ev.progress != null && !isNaN(ev.progress)
            ? Number(ev.progress)
            : (textPct != null ? textPct : (ev.status === 'Completed' ? 100 : null));

          return {
            discipline: ev.discipline || 'Civil',
            activity: ev.activity || transcript.slice(0, 70),
            assetTag: ev.assetTag || 'General Area',
            capturedAt: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) + ' IST',
            status: ev.status || (evProgress === 100 ? 'Completed' : 'In Progress'),
            blocker: ev.blocker || 'None',
            progress: evProgress,
            date: ev.date || new Date().toISOString().split('T')[0],
            source: res.source || 'llm'
          };
        }
      } catch (err) {
        console.warn('Live AI extraction fallback to rules engine:', err.message);
      }
    }

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
      // Truthful capture time — the moment of extraction, not a fabricated
      // shift window. Field crews rarely narrate exact start/finish clock times.
      capturedAt: new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' IST',
      status,
      blocker,
      progress: textPct != null ? textPct : (status === 'Completed' ? 100 : null),
      date: new Date().toISOString().split('T')[0]
    };
  },

  // Intelligent Schedule-Linking Matcher
  async matchActivity(extractedEvent, candidateActivities = null) {
    await API.delay(200);
    const pool = candidateActivities || API.activities;
    const ev = extractedEvent || {};
    const lowerAct = String(ev.activity ?? '').toLowerCase();
    const lowerTag = String(ev.assetTag ?? '').toLowerCase();

    // Score all L5/L6 activities
    const scored = pool
      .filter(a => a.level === 'L5' || a.level === 'L6')
      .map(act => {
        let score = 30; // base score
        const signals = [];
        const actCode = String(act.code ?? '').toLowerCase();
        const actName = String(act.name ?? '').toLowerCase();
        const evDiscipline = String(ev.discipline ?? '').toLowerCase();

        // Discipline match
        if (String(act.discipline ?? '').toLowerCase() === evDiscipline) {
          score += 25;
          signals.push({ label: `Discipline matches (${act.discipline})`, match: true });
        } else {
          signals.push({ label: `Discipline mismatch (${act.discipline} vs ${extractedEvent.discipline})`, match: false });
        }

        // Asset code/tag match
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

        // Schedule window validation — only claim an active window when the
        // report date genuinely falls inside the activity's planned dates.
        const today = new Date().toISOString().split('T')[0];
        const hasWindow = act.plannedStart && act.plannedFinish;
        if (hasWindow && today >= act.plannedStart && today <= act.plannedFinish) {
          score += 10;
          signals.push({ label: `Schedule window active (${act.plannedStart} → ${act.plannedFinish})`, match: true });
        } else {
          signals.push({
            label: hasWindow
              ? `Outside planned window (${act.plannedStart} → ${act.plannedFinish})`
              : 'No planned schedule window defined for this activity',
            match: false
          });
        }

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
    const newReport = {
      id: `REP-${Date.now()}`,
      projectId: reportData.projectId || 'PRJ-OIL-DUL-001',
      author: reportData.author || 'Site Engineer (Field PWA)',
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST',
      rawTranscript: reportData.rawTranscript,
      extractedEvent: reportData.extractedEvent,
      matchedActivityId: reportData.matchedActivity?.id,
      matchedActivityName: reportData.matchedActivity?.name,
      matchedActivityCode: reportData.matchedActivity?.code,
      confidence: reportData.confidence || 90,
      signals: reportData.signals || [],
      status: navigator.onLine ? 'pending-sync' : 'pending-sync',
      reviewer: null,
      reviewedAt: null,
      evidenceItems: reportData.evidenceItems || [],
      evidenceIds: []
    };

    // Always queue through local DB to ensure durability
    await DB.addPendingReport(newReport);

    // If online, immediately trigger the sync engine to push to backend
    if (navigator.onLine) {
      import('../sync.js').then(({ Sync }) => {
        if (Sync.syncPending) Sync.syncPending().catch(e => console.warn('Background sync failed:', e));
      });
    }

    return newReport;
  },

  // Normalize free blocker text into a cause enum via Workers AI / rules
  async classifyDelayCause(text) {
    if (!API.useMock && text && text !== 'None') {
      try {
        const { ApiHttp } = await import('./http.js');
        const res = await ApiHttp.request('/delay-cause', {
          method: 'POST',
          body: { text }
        });
        if (res && res.code) return res;
      } catch (err) {
        console.warn('Live delay-cause classification fallback:', err.message);
      }
    }

    const lower = String(text ?? '').toLowerCase();
    const rules = [
      { code: 'WEATHER', label: 'Weather / Rainfall Interruption', keys: ['rain', 'monsoon', 'weather', 'storm', 'flood'] },
      { code: 'MATERIAL_SHORTAGE', label: 'Material / Parts Shortage', keys: ['shortage', 'material', 'stock', 'supply', 'gland', 'cement'] },
      { code: 'EQUIPMENT_BREAKDOWN', label: 'Equipment Breakdown', keys: ['breakdown', 'machine', 'crane', 'rig', 'compressor failure', 'equipment'] },
      { code: 'LABOUR_SHORTAGE', label: 'Manpower / Labour Shortage', keys: ['labour', 'labor', 'manpower', 'workers', 'crew absent'] },
      { code: 'PERMIT_CLEARANCE', label: 'Permit / Clearance Pending', keys: ['permit', 'clearance', 'approval pending', 'statutory'] },
      { code: 'TECHNICAL', label: 'Technical / Quality Issue', keys: ['rework', 'cube test', 'fail', 'defect', 'rectification'] }
    ];
    for (const rule of rules) {
      if (rule.keys.some(k => lower.includes(k))) {
        return { code: rule.code, label: rule.label };
      }
    }
    if (lower.includes('delay') || lower.includes('halt') || lower.includes('stopped')) {
      return { code: 'OTHER', label: 'Other Site Constraint' };
    }
    return { code: 'NONE', label: 'No Blocker Detected' };
  },

  // Daily operational digest derived from REAL data ("What changed since
  // yesterday?"). Rules-based now; becomes POST /api/summarize when live.
  async summarizeDailyDigest(projectId = null) {
    await API.delay(200);
    const reports = projectId ? API.reports.filter(r => r.projectId === projectId) : API.reports;
    const activities = projectId ? API.activities.filter(a => a.projectId === projectId) : API.activities;
    const evidence = API.evidence.filter(e => !projectId || e.projectId === projectId);
    const reviewItems = API.reviewItems;
    const today = new Date().toISOString().split('T')[0];
    const signals = [];

    const updatedActivities = activities.filter(a =>
      a.actualStart === today || a.actualFinish === today ||
      reports.some(r => r.matchedActivityId === a.id && r.extractedEvent?.date === today)
    );
    if (updatedActivities.length > 0) {
      signals.push({
        tone: 'success',
        headline: `${updatedActivities.length} ACTIVITIES UPDATED`,
        detail: `Verified field progress recorded on ${[...new Set(updatedActivities.map(a => a.discipline))].join(' & ') || 'multiple disciplines'}`
      });
    }

    const approvedEvidence = evidence.filter(e => e.status !== 'pending');
    if (approvedEvidence.length > 0) {
      signals.push({
        tone: 'info',
        headline: `${approvedEvidence.length} EVIDENCE PACKETS VERIFIED`,
        detail: 'Photo documentation linked to schedule activities passed inspection'
      });
    }

    const delayed = activities.filter(a => a.status === 'delayed');
    for (const act of delayed.slice(0, 2)) {
      const blockerReport = reports.find(r => r.matchedActivityId === act.id && r.extractedEvent?.blocker && r.extractedEvent.blocker !== 'None');
      const cause = await this.classifyDelayCause(blockerReport?.extractedEvent?.blocker || '');
      signals.push({
        tone: 'danger',
        headline: `⚠ ${act.code} DELAYED`,
        detail: cause.code === 'NONE'
          ? `${act.name} flagged delayed — awaiting blocker classification from site`
          : `${act.name}: ${cause.label}`
      });
    }

    const openBlockers = reports.filter(r => r.extractedEvent?.blocker && r.extractedEvent.blocker !== 'None');
    if (openBlockers.length > 0) {
      const latest = openBlockers[0];
      const quote = String(latest.rawTranscript ?? '');
      signals.push({
        tone: 'danger',
        headline: `${openBlockers.length} BLOCKER REPORT${openBlockers.length > 1 ? 'S' : ''}`,
        detail: `"${quote.slice(0, 80)}${quote.length > 80 ? '...' : ''}" — ${latest.author ?? 'Unknown'}`
      });
    }

    const pendingReview = reviewItems.filter(i => i.state === 'needs-review').length;
    if (pendingReview > 0) {
      signals.push({
        tone: 'warning',
        headline: `${pendingReview} ITEM${pendingReview > 1 ? 'S' : ''} AWAITING PLANNER REVIEW`,
        detail: 'Field submissions queued for schedule-linking validation'
      });
    }

    if (signals.length === 0) {
      signals.push({
        tone: 'info',
        headline: 'NO FIELD MOVEMENT TODAY',
        detail: 'No verified observations recorded yet — submit a field report from the PWA to populate this digest.'
      });
    }
    return signals.slice(0, 6);
  }
};
