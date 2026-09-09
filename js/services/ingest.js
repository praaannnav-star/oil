import { API } from './api.js';

export const IngestService = {
  // 1. Client-Side CSV Parser (Zero external dependency, fast & reliable)
  parseCsv(text = '') {
    const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    // Detect delimiter: comma, semicolon, tab, or pipe
    const firstLine = lines[0];
    let delimiter = ',';
    const counts = {
      ',': (firstLine.match(/,/g) || []).length,
      ';': (firstLine.match(/;/g) || []).length,
      '\t': (firstLine.match(/\t/g) || []).length,
      '|': (firstLine.match(/\|/g) || []).length
    };
    let max = 0;
    for (const [delim, count] of Object.entries(counts)) {
      if (count > max) { max = count; delimiter = delim; }
    }

    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length === 0 || (values.length === 1 && !values[0])) continue;
      const rowObj = {};
      headers.forEach((h, idx) => {
        rowObj[h || `Col_${idx + 1}`] = values[idx] ?? '';
      });
      rows.push(rowObj);
    }

    return { headers, rows };
  },

  // 2. Spreadsheet Parser (XLSX, XLS, CSV)
  async parseSpreadsheetFile(file) {
    const filename = file.name.toLowerCase();

    // Plain text / CSV files
    if (filename.endsWith('.csv') || filename.endsWith('.txt') || file.type === 'text/csv' || file.type === 'text/plain') {
      const text = await file.text();
      const { headers, rows } = this.parseCsv(text);
      return {
        filename: file.name,
        headers,
        rows,
        suggestedMap: this.autoSuggestColumnMap(headers)
      };
    }

    // Excel files via SheetJS (dynamic load or global)
    try {
      let XLSX = window.XLSX;
      if (!XLSX) {
        // Load SheetJS dynamically from CDN
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load spreadsheet parser script.'));
          document.head.appendChild(script);
        });
        XLSX = window.XLSX;
      }

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
      const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

      return {
        filename: file.name,
        headers,
        rows,
        sheetName: firstSheetName,
        suggestedMap: this.autoSuggestColumnMap(headers)
      };
    } catch (err) {
      console.warn('XLSX parsing error, attempting text fallback:', err.message);
      const text = await file.text();
      const { headers, rows } = this.parseCsv(text);
      return {
        filename: file.name,
        headers,
        rows,
        suggestedMap: this.autoSuggestColumnMap(headers)
      };
    }
  },

  // 3. Auto-suggest column mappings using oilfield domain dictionary
  autoSuggestColumnMap(headers = []) {
    const map = {};
    const rules = {
      activity: ['activity', 'task', 'work item', 'description', 'scope', 'work done', 'name', 'item'],
      date: ['date', 'day', 'period', 'reported date', 'observation date'],
      progress: ['progress', '% complete', 'percent', 'done %', 'actual %', 'status %', '%'],
      status: ['status', 'state', 'health', 'condition'],
      discipline: ['discipline', 'trade', 'department', 'dept', 'category', 'package'],
      wbsCode: ['wbs', 'code', 'activity code', 'activity id', 'act id', 'wbs code', 'id'],
      remarks: ['remarks', 'notes', 'comments', 'observations', 'blocker', 'issue', 'hindrance']
    };

    for (const [key, keywords] of Object.entries(rules)) {
      const match = headers.find(h => {
        const lower = h.toLowerCase().trim();
        return keywords.some(k => lower === k || lower.includes(k));
      });
      if (match) map[key] = match;
    }
    return map;
  },

  // 4. Ingest Spreadsheet API call
  async ingestSpreadsheet({ rows, columnMap, projectId, filename, autoSubmit = false }) {
    if (!API.useMock) {
      const { ApiHttp } = await import('./http.js');
      return await ApiHttp.request('/ingest-sheet', {
        method: 'POST',
        body: { rows, columnMap, projectId, filename, autoSubmit }
      });
    }

    // Offline / Mock fallback matching against API.activities
    await API.delay(400);
    const pool = (API.activities || []).filter(a => a.level === 'L5' || a.level === 'L6');
    const results = rows.map((row, idx) => {
      const actText = String(row[columnMap.activity] || row['Activity'] || row['Description'] || '').trim();
      const disc = String(row[columnMap.discipline] || 'Civil');
      const wbs = String(row[columnMap.wbsCode] || '');
      const prog = Number(row[columnMap.progress] ?? 50);

      const matched = pool.find(p => 
        (wbs && p.code.toLowerCase().includes(wbs.toLowerCase())) ||
        (actText && p.name.toLowerCase().includes(actText.toLowerCase())) ||
        p.discipline.toLowerCase() === disc.toLowerCase()
      ) || pool[0];

      return {
        rowNumber: idx + 1,
        syntheticTranscript: `[${disc}] ${actText}. Progress: ${prog}%.`,
        extractedEvent: {
          activity: actText || 'Activity',
          discipline: disc,
          status: prog === 100 ? 'Completed' : 'In Progress',
          progress: prog,
          date: new Date().toISOString().split('T')[0]
        },
        topMatch: matched ? {
          id: matched.id,
          code: matched.code,
          name: matched.name,
          discipline: matched.discipline,
          confidence: 88,
          signals: ['Offline fuzzy match', 'Discipline align']
        } : null,
        confidence: 88,
        source: 'spreadsheet'
      };
    });

    return {
      success: true,
      filename,
      totalRows: rows.length,
      processedCount: results.length,
      matchedCount: results.length,
      unmatchedCount: 0,
      items: results
    };
  },

  // 5. Ingest OCR / Daily Progress Report API call
  async ingestOcrDocument({ rawText, imageBase64, projectId, filename, autoSubmit = false }) {
    if (!API.useMock) {
      const { ApiHttp } = await import('./http.js');
      return await ApiHttp.request('/ingest-ocr', {
        method: 'POST',
        body: { rawText, imageBase64, projectId, filename, autoSubmit }
      });
    }

    // Offline fallback: segment text and map
    await API.delay(500);
    const pool = (API.activities || []).filter(a => a.level === 'L5' || a.level === 'L6');
    const lines = (rawText || '').split('\n').filter(l => l.trim().length > 15);
    const items = lines.map((line, idx) => {
      const matched = pool[idx % pool.length] || null;
      return {
        segmentIndex: idx + 1,
        rawSegmentText: line,
        extractedEvent: {
          activity: line.slice(0, 60),
          discipline: matched?.discipline || 'Civil',
          status: 'In Progress',
          progress: 50,
          date: new Date().toISOString().split('T')[0]
        },
        topMatch: matched ? {
          id: matched.id,
          code: matched.code,
          name: matched.name,
          discipline: matched.discipline,
          confidence: 82,
          signals: ['OCR Segment Match', 'Rule Extracted']
        } : null,
        confidence: 82,
        source: 'ocr'
      };
    });

    return {
      success: true,
      filename,
      normalizedOcrText: rawText,
      totalSegments: items.length,
      matchedCount: items.length,
      unmatchedCount: 0,
      items
    };
  },

  // 6. Confirm batch into review queue
  async confirmBatch({ items, projectId, sourceLabel }) {
    if (!API.useMock) {
      const { ApiHttp } = await import('./http.js');
      return await ApiHttp.request('/ingest/confirm', {
        method: 'POST',
        body: { items, projectId, sourceLabel }
      });
    }

    // Offline Mock fallback: insert directly into API.reviewItems
    await API.delay(300);
    items.forEach((item, idx) => {
      const rev = {
        id: `REV-MOCK-${Date.now()}-${idx}`,
        reportId: `REP-MOCK-${Date.now()}-${idx}`,
        type: 'report',
        source: sourceLabel || 'Bulk Ingestion Engine',
        reporter: 'Site Office Ingest',
        discipline: item.extractedEvent?.discipline || 'Civil',
        extractedEvent: item.extractedEvent,
        topMatch: item.topMatch,
        alternatives: item.alternatives || [],
        state: 'needs-review',
        tabCategory: 'needs-review',
        age: 'Just now'
      };
      API.reviewItems.unshift(rev);
    });
    API.persist('reviewItems');

    return {
      success: true,
      committedCount: items.length
    };
  }
};
