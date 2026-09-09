// Automated verification of OCR and Spreadsheet Ingestion
import assert from 'assert';
import { normalizeOcrText, segmentOcrReport } from '../worker/src/lib/ocr-normalize.js';
import { IngestService } from '../js/services/ingest.js';

console.log('🧪 Running Test Suite: OCR & Spreadsheet Ingestion Engine...\n');

// Test 1: CSV Parser
console.log('Test 1: CSV Parsing & Delimiter Detection');
const testCsv = `WBS,Activity Description,Discipline,Progress %,Status,Date,Remarks
DUL-CIV-01,Control Building Structural Column Retrofitting,Civil,100%,Completed,2026-03-09,Final pour completed
DUL-PIP-SKD,Dual-Filter Coalescer Skid Alignment,Piping,100%,Completed,2026-03-09,Hydrotest passed
DUL-ELE-UPS,120kVA Industrial UPS Bank & Battery Rack,Electrical,85%,In Progress,2026-03-09,Cycle 2 charging`;

const parsedCsv = IngestService.parseCsv(testCsv);
assert.strictEqual(parsedCsv.headers.length, 7, 'Should parse 7 headers');
assert.strictEqual(parsedCsv.rows.length, 3, 'Should parse 3 data rows');
assert.strictEqual(parsedCsv.rows[0]['Activity Description'], 'Control Building Structural Column Retrofitting');
console.log('  ✅ CSV parsing passed.\n');

// Test 2: Column Auto-Mapping
console.log('Test 2: Oilfield Column Auto-Mapping');
const suggestedMap = IngestService.autoSuggestColumnMap(parsedCsv.headers);
assert.strictEqual(suggestedMap.activity, 'Activity Description');
assert.strictEqual(suggestedMap.wbsCode, 'WBS');
assert.strictEqual(suggestedMap.discipline, 'Discipline');
assert.strictEqual(suggestedMap.progress, 'Progress %');
assert.strictEqual(suggestedMap.status, 'Status');
assert.strictEqual(suggestedMap.date, 'Date');
assert.strictEqual(suggestedMap.remarks, 'Remarks');
console.log('  ✅ Column auto-mapping passed:', suggestedMap, '\n');

// Test 3: OCR Text Normalization
console.log('Test 3: OCR Text Normalization & Abbreviation Expansion');
const dirtyOcr = `1. Reinforced column fdn conc. pour finished with slump 12Omm.
2. Dual-filter coalescer spl. erec. & align. completed.
3. High-pressure hyd. test done at Line-24.`;

const cleanedOcr = normalizeOcrText(dirtyOcr);
assert(cleanedOcr.includes('foundation'), 'Should expand fdn -> foundation');
assert(cleanedOcr.includes('concrete'), 'Should expand conc. -> concrete');
assert(cleanedOcr.includes('spool'), 'Should expand spl. -> spool');
assert(cleanedOcr.includes('erection'), 'Should expand erec. -> erection');
assert(cleanedOcr.includes('alignment'), 'Should expand align. -> alignment');
assert(cleanedOcr.includes('hydrotest'), 'Should expand hyd. -> hydrotest');
console.log('  ✅ OCR normalization passed.\n');

// Test 4: OCR Multi-Activity Segmentation
console.log('Test 4: OCR Daily Progress Report Segmentation');
const sampleDpr = `DAILY PROGRESS REPORT - DULIAJAN HUB
CIVIL WORKS:
1. Blast-Resistant Control Room Roof Installation DUL-CIV-ROOF completed today with final seal check.
2. Foundation footing slab curing in progress.
PIPING:
3. Skid High-Pressure Hydrotest DUL-PIP-HYD successfully finished at 120 bar.
ELECTRICAL:
4. 120kVA Industrial UPS Bank & Battery Rack Commissioning DUL-ELE-UPS tested and ready.`;

const segments = segmentOcrReport(sampleDpr);
assert.strictEqual(segments.length, 4, `Expected 4 discrete activity segments, got ${segments.length}`);
assert.strictEqual(segments[0].discipline, 'Civil');
assert.strictEqual(segments[2].discipline, 'Piping');
assert.strictEqual(segments[3].discipline, 'Electrical');
console.log(`  ✅ Segmented ${segments.length} activities with proper discipline tag attribution.\n`);

console.log('🎉 ALL 4 TESTS PASSED SUCCESSFULLY!');
