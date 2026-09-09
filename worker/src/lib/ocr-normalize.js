// OCR Text Normalization & Activity Segmentation for Oil India DPRs
// Cleans scan artefacts, standardizes oil & gas engineering abbreviations,
// and extracts discrete multi-activity reporting items.

export function normalizeOcrText(rawText = '') {
  if (!rawText) return '';
  return String(rawText)
    // Normalize newlines and tabs
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Correct common OCR character confusions in numbers and codes
    .replace(/(?<=[A-Z])0(?=[A-Z])/g, 'O')  // 'N0D' -> 'NOD'
    .replace(/(?<=\d)O(?=\d)/g, '0')        // '1O5' -> '105'
    .replace(/(?<=\d)l(?=\d)/g, '1')        // '1l5' -> '115'
    .replace(/(?<=\d)I(?=\d)/g, '1')        // '2I0' -> '210'
    // Common OCR kerning mergers
    .replace(/\brn\b/gi, 'm')
    .replace(/rnanhole/gi, 'manhole')
    .replace(/rnodern/gi, 'modern')
    // Standardize engineering & site abbreviations
    .replace(/\bconc\b\.?/gi, 'concrete')
    .replace(/\bstr\b\.?/gi, 'structure')
    .replace(/\bstruct\b\.?/gi, 'structural')
    .replace(/\bfdn\b\.?/gi, 'foundation')
    .replace(/\bspl\b\.?/gi, 'spool')
    .replace(/\berec\b\.?/gi, 'erection')
    .replace(/\binst\b\.?/gi, 'installation')
    .replace(/\bhyd\b\.?/gi, 'hydrotest')
    .replace(/\bhydro\b\.?/gi, 'hydrotest')
    .replace(/\bcomm\b\.?/gi, 'commissioning')
    .replace(/\bfab\b\.?/gi, 'fabrication')
    .replace(/\balign\b\.?/gi, 'alignment')
    .replace(/\bx-ing\b\.?/gi, 'crossing')
    .replace(/\brow\b/gi, 'RoW')
    .replace(/\bptw\b/gi, 'PTW')
    .replace(/\bndt\b/gi, 'NDT')
    .replace(/\bcs\b(?=\s*pipe)/gi, 'Carbon Steel')
    .replace(/\bss\b(?=\s*pipe)/gi, 'Stainless Steel')
    .replace(/\btransf\b\.?/gi, 'transformer')
    .replace(/\bsubst\b\.?/gi, 'substation')
    .replace(/\bswgr\b\.?/gi, 'switchgear')
    .replace(/\besd\b/gi, 'ESD')
    .replace(/\btransm\b\.?/gi, 'transmitter')
    .replace(/\bcalib\b\.?/gi, 'calibration')
    .replace(/\bscr\b\.?/gi, 'scada')
    // Standardize percentage representations
    .replace(/(\d+)\s*pct\b/gi, '$1%')
    .replace(/(\d+)\s*percent\b/gi, '$1%')
    // Clean excessive spaces
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function segmentOcrReport(rawText = '') {
  const cleaned = normalizeOcrText(rawText);
  if (!cleaned) return [];

  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
  const segments = [];
  let currentDiscipline = 'General';
  let buffer = [];

  const disciplineHeaderRegex = /^(?:\[|\(|\b)?(CIVIL|PIPING|MECHANICAL|ELECTRICAL|INSTRUMENTATION|PIPELINE|HSE|SAFETY|QUALITY|TELECOM)(?:[\s&a-z0-9_\/]+)?(?:\]|\)|\b)?\s*[:–\-]?\s*$/i;
  const inlineDisciplineRegex = /^(?:\[|\b)(CIVIL|PIPING|MECHANICAL|ELECTRICAL|INSTRUMENTATION|PIPELINE|HSE|SAFETY)(?:\]|\b)\s*[:–\-]\s*(.+)$/i;
  const numberedItemRegex = /^(?:\d+[\.\)]|\-|\*|•|[A-Z]\.)\s*(.+)$/;
  const wbsPrefixRegex = /^(?:WBS|ACT|PRJ)-[A-Z0-9\-]+\s*[:–\-]\s*(.+)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line is a discipline section header (e.g. "CIVIL WORKS:" or "[PIPING]")
    const discHeaderMatch = line.match(disciplineHeaderRegex);
    if (discHeaderMatch) {
      if (buffer.length > 0) {
        segments.push({
          rawText: buffer.join(' '),
          discipline: currentDiscipline
        });
        buffer = [];
      }
      currentDiscipline = formatDiscipline(discHeaderMatch[1]);
      continue;
    }

    // Check if line has inline discipline prefix (e.g. "[Civil]: Foundation completed")
    const inlineDiscMatch = line.match(inlineDisciplineRegex);
    if (inlineDiscMatch) {
      if (buffer.length > 0) {
        segments.push({
          rawText: buffer.join(' '),
          discipline: currentDiscipline
        });
        buffer = [];
      }
      currentDiscipline = formatDiscipline(inlineDiscMatch[1]);
      buffer.push(inlineDiscMatch[2]);
      continue;
    }

    // Check if line is a numbered / bulleted activity item
    const numberedMatch = line.match(numberedItemRegex);
    if (numberedMatch) {
      if (buffer.length > 0) {
        segments.push({
          rawText: buffer.join(' '),
          discipline: currentDiscipline
        });
        buffer = [];
      }
      buffer.push(numberedMatch[1]);
      continue;
    }

    // Check if line starts with WBS identifier
    const wbsMatch = line.match(wbsPrefixRegex);
    if (wbsMatch) {
      if (buffer.length > 0) {
        segments.push({
          rawText: buffer.join(' '),
          discipline: currentDiscipline
        });
        buffer = [];
      }
      buffer.push(line);
      continue;
    }

    // If line looks like a separate table row or distinct activity clause
    if (line.includes('|') || line.includes(';')) {
      if (buffer.length > 0) {
        segments.push({
          rawText: buffer.join(' '),
          discipline: currentDiscipline
        });
        buffer = [];
      }
      segments.push({
        rawText: line.replace(/\|/g, ' · '),
        discipline: currentDiscipline
      });
      continue;
    }

    // Otherwise continuation of existing statement
    buffer.push(line);
  }

  if (buffer.length > 0) {
    segments.push({
      rawText: buffer.join(' '),
      discipline: currentDiscipline
    });
  }

  // Filter out document headers, title banners, dates only, page numbers
  const isDocHeader = (text) => {
    const lower = text.toLowerCase().trim();
    return (
      lower.startsWith('page ') ||
      lower.startsWith('daily progress report') ||
      lower.startsWith('dpr') ||
      lower.startsWith('oil india') ||
      lower.startsWith('date:') ||
      lower.startsWith('location:') ||
      lower.startsWith('reported by:') ||
      lower.startsWith('shift:') ||
      lower === 'general'
    );
  };

  return segments
    .map(s => ({
      ...s,
      rawText: s.rawText.trim()
    }))
    .filter(s => s.rawText.length >= 15 && !isDocHeader(s.rawText));
}

function formatDiscipline(disc) {
  const d = (disc || '').toLowerCase();
  if (d.includes('civ')) return 'Civil';
  if (d.includes('pip')) return 'Piping';
  if (d.includes('ele')) return 'Electrical';
  if (d.includes('inst')) return 'Instrumentation';
  if (d.includes('line') || d.includes('row')) return 'Pipeline';
  if (d.includes('hse') || d.includes('safe')) return 'HSE';
  return 'General';
}
