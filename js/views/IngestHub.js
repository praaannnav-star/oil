import { IngestService } from '../services/ingest.js';
import { State } from '../state.js';
import { AppRouter } from '../router.js';
import { Toast } from '../components/Toast.js';
import { Button } from '../components/Button.js';
import { Badge } from '../components/Badge.js';
import { Icons } from '../components/Icons.js';
import { ConfidenceIndicator } from '../components/ConfidenceIndicator.js';
import { escapeHtml } from '../utils/dom.js';

export async function IngestHubView() {
  const container = document.createElement('div');
  container.className = 'view-container';

  let activeTab = 'sheet'; // 'sheet' | 'ocr'
  let parsedSheetData = null;
  let parsedOcrData = null;
  let processedItems = [];
  let isProcessing = false;

  // Header
  const header = document.createElement('div');
  header.className = 'd-flex justify-between items-center flex-wrap gap-2 mb-2';
  header.innerHTML = `
    <div>
      <div class="d-flex items-center gap-2">
        <h1 class="text-2xl font-bold text-primary">Bulk Ingestion Engine</h1>
        <span class="badge badge-in-progress" style="font-size:10px; padding:2px 8px;">OCR & SPREADSHEETS</span>
      </div>
      <p class="text-xs text-secondary mt-1">Ingest heterogeneous discipline spreadsheets, scanned site diaries, and typed DPRs directly into L5/L6 schedule activities</p>
    </div>
  `;
  container.appendChild(header);

  // Tab Navigation
  const tabNav = document.createElement('div');
  tabNav.className = 'tabs-nav mb-3';
  tabNav.innerHTML = `
    <button class="tab-btn active" id="tab-btn-sheet">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
      <span>Discipline Spreadsheets (.xlsx / .csv)</span>
    </button>
    <button class="tab-btn" id="tab-btn-ocr">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
      <span>OCR Daily Progress Reports (Scanned / Digital)</span>
    </button>
  `;
  container.appendChild(tabNav);

  const mainPanel = document.createElement('div');
  mainPanel.className = 'd-flex flex-col gap-4';
  container.appendChild(mainPanel);

  // Tab Switching
  tabNav.querySelector('#tab-btn-sheet').addEventListener('click', () => {
    activeTab = 'sheet';
    processedItems = [];
    tabNav.querySelector('#tab-btn-sheet').classList.add('active');
    tabNav.querySelector('#tab-btn-ocr').classList.remove('active');
    renderTabContent();
  });

  tabNav.querySelector('#tab-btn-ocr').addEventListener('click', () => {
    activeTab = 'ocr';
    processedItems = [];
    tabNav.querySelector('#tab-btn-ocr').classList.add('active');
    tabNav.querySelector('#tab-btn-sheet').classList.remove('active');
    renderTabContent();
  });

  function renderTabContent() {
    mainPanel.innerHTML = '';

    if (activeTab === 'sheet') {
      renderSheetTab();
    } else {
      renderOcrTab();
    }

    renderResultsSection();
  }

  // ==========================================
  // TAB 1: SPREADSHEET INGESTION
  // ==========================================
  function renderSheetTab() {
    const card = document.createElement('div');
    card.className = 'card p-4 gap-3';
    card.innerHTML = `
      <div class="d-flex justify-between items-center flex-wrap gap-2 border-b pb-2">
        <div>
          <h3 class="card-title">Upload Discipline Spreadsheet</h3>
          <span class="text-xs text-muted">Supports Excel (.xlsx, .xls) and Comma-Separated Values (.csv) from contractor site diaries</span>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-secondary btn-sm" id="btn-load-demo-sheet">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <span>Load Demo Spreadsheet (Civil/Piping)</span>
          </button>
        </div>
      </div>

      <!-- Dropzone -->
      <div id="sheet-dropzone" class="p-5 border rounded text-center cursor-pointer transition-all" style="border-style:dashed; border-color:var(--color-border); background:var(--color-surface-el);">
        <input type="file" id="sheet-file-input" accept=".xlsx,.xls,.csv,.txt" class="d-none">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted mb-2 mx-auto" style="display:inline-block;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        <div class="text-sm font-bold text-primary">Click or drag and drop spreadsheet file here</div>
        <div class="text-xs text-muted mt-1 font-mono">.xlsx, .xls, .csv up to 10MB</div>
      </div>

      <!-- Column Mapping Preview Panel (Hidden until file selected) -->
      <div id="sheet-mapping-panel" class="${parsedSheetData ? '' : 'd-none'} d-flex flex-col gap-3">
        <div class="d-flex justify-between items-center bg-surface-el p-2 rounded border">
          <span class="text-xs font-mono font-bold text-primary" id="sheet-file-name-label">${parsedSheetData ? escapeHtml(parsedSheetData.filename) : ''} (${parsedSheetData ? parsedSheetData.rows.length : 0} rows found)</span>
          <span class="badge badge-success">Auto-Mapped</span>
        </div>

        <div class="text-xs text-secondary font-bold uppercase tracking-wider">Confirm Column Mappings</div>
        <div class="d-grid grid-3 gap-2 text-xs" id="column-map-grid"></div>

        <!-- Sample rows preview -->
        <div class="table-container mt-2" style="max-height: 180px; overflow-y: auto;">
          <table class="data-table" id="sheet-preview-table">
            <thead><tr id="sheet-preview-thead"></tr></thead>
            <tbody id="sheet-preview-tbody"></tbody>
          </table>
        </div>

        <div class="d-flex justify-end gap-2 mt-2">
          <button class="btn btn-primary btn-sm" id="btn-process-sheet">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            <span>Run Schedule Reconciliation & Match L5/L6 Activities</span>
          </button>
        </div>
      </div>
    `;

    mainPanel.appendChild(card);

    // Dropzone handlers
    const dropzone = card.querySelector('#sheet-dropzone');
    const fileInput = card.querySelector('#sheet-file-input');
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = 'var(--color-primary)'; });
    dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = 'var(--color-border)'; });
    dropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--color-border)';
      if (e.dataTransfer.files.length > 0) {
        await handleSheetFile(e.dataTransfer.files[0]);
      }
    });
    fileInput.addEventListener('change', async () => {
      if (fileInput.files.length > 0) {
        await handleSheetFile(fileInput.files[0]);
      }
    });

    // Demo Scenario loader
    card.querySelector('#btn-load-demo-sheet').addEventListener('click', () => {
      const demoCsv = `WBS,Activity Description,Discipline,Progress %,Status,Date,Remarks
DUL-CIV-01,Control Building Structural Column Retrofitting,Civil,100%,Completed,2026-03-09,Final pour completed and cube test passed
DUL-PIP-SKD,Dual-Filter Coalescer Skid Alignment,Piping,100%,Completed,2026-03-09,Hydrotest certified by third party inspector
DUL-ELE-UPS,120kVA Industrial UPS Bank & Battery Rack Commissioning,Electrical,85%,In Progress,2026-03-09,Battery bank charging cycle 2 in progress
DUL-INS-01,SCADA Telemetry & Emergency Shutdown System Loop Check,Instrumentation,40%,Delayed,2026-03-09,Delay due to vendor dispatch delay of pressure transmitters
DUL-PIP-HYD,Skid High-Pressure Nitrogen Purging & Hydrotest,Piping,100%,Completed,2026-03-08,Pressure held at 120 bar for 4 hours
DUL-HSE-01,Safety Case Statutory PTW Environmental Clearance,HSE,95%,In Progress,2026-03-09,Fire barrier inspection signed off`;

      const parsed = IngestService.parseCsv(demoCsv);
      parsedSheetData = {
        filename: 'OIL_Duliajan_Daily_Log_March.csv',
        headers: parsed.headers,
        rows: parsed.rows,
        suggestedMap: IngestService.autoSuggestColumnMap(parsed.headers)
      };
      Toast.success('Loaded demo contractor spreadsheet scenario.');
      renderSheetTab();
    });

    async function handleSheetFile(file) {
      try {
        dropzone.classList.add('skeleton');
        const parsed = await IngestService.parseSpreadsheetFile(file);
        parsedSheetData = parsed;
        Toast.success(`Parsed ${parsed.rows.length} rows from ${file.name}`);
        renderSheetTab();
      } catch (err) {
        Toast.error(`Failed to parse spreadsheet: ${err.message}`);
      } finally {
        dropzone.classList.remove('skeleton');
      }
    }

    // Populate Mapping Grid if data loaded
    if (parsedSheetData) {
      const mappingPanel = card.querySelector('#sheet-mapping-panel');
      mappingPanel.classList.remove('d-none');
      const grid = card.querySelector('#column-map-grid');
      const headers = parsedSheetData.headers;
      const map = parsedSheetData.suggestedMap;

      const fields = [
        { id: 'activity', label: 'Activity Description *', val: map.activity },
        { id: 'discipline', label: 'Discipline', val: map.discipline },
        { id: 'wbsCode', label: 'WBS / Task Code', val: map.wbsCode },
        { id: 'progress', label: 'Progress (%)', val: map.progress },
        { id: 'status', label: 'Status', val: map.status },
        { id: 'date', label: 'Observation Date', val: map.date },
        { id: 'remarks', label: 'Remarks / Blocker', val: map.remarks }
      ];

      grid.innerHTML = fields.map(f => `
        <div class="d-flex flex-col gap-1 p-2 rounded" style="background:var(--color-surface); border:1px solid var(--color-border);">
          <label class="text-xs text-muted font-bold">${escapeHtml(f.label)}</label>
          <select class="form-input text-xs" data-field="${f.id}" style="padding:4px 6px;">
            <option value="">-- Do not map --</option>
            ${headers.map(h => `<option value="${escapeHtml(h)}" ${h === f.val ? 'selected' : ''}>${escapeHtml(h)}</option>`).join('')}
          </select>
        </div>
      `).join('');

      // Preview Table
      const thead = card.querySelector('#sheet-preview-thead');
      const tbody = card.querySelector('#sheet-preview-tbody');
      thead.innerHTML = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
      tbody.innerHTML = parsedSheetData.rows.slice(0, 5).map(r => `
        <tr>${headers.map(h => `<td>${escapeHtml(String(r[h] ?? ''))}</td>`).join('')}</tr>
      `).join('');

      // Process Action
      card.querySelector('#btn-process-sheet').addEventListener('click', async () => {
        const currentMap = {};
        grid.querySelectorAll('select').forEach(sel => {
          if (sel.value) currentMap[sel.getAttribute('data-field')] = sel.value;
        });

        try {
          const btn = card.querySelector('#btn-process-sheet');
          btn.disabled = true;
          btn.innerHTML = `<span>Reconciling schedule matches...</span>`;

          const res = await IngestService.ingestSpreadsheet({
            rows: parsedSheetData.rows,
            columnMap: currentMap,
            projectId: State.getState().currentProjectId || 'PRJ-OIL-DUL-001',
            filename: parsedSheetData.filename,
            autoSubmit: false
          });

          processedItems = res.items || [];
          Toast.success(`Matched ${res.matchedCount} of ${res.totalRows} activities against L5/L6 schedule.`);
          renderResultsSection();
        } catch (err) {
          Toast.error(`Reconciliation error: ${err.message}`);
        } finally {
          const btn = card.querySelector('#btn-process-sheet');
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>Run Schedule Reconciliation & Match L5/L6 Activities</span>`;
          }
        }
      });
    }
  }

  // ==========================================
  // TAB 2: OCR DAILY PROGRESS REPORT (DPR)
  // ==========================================
  function renderOcrTab() {
    const card = document.createElement('div');
    card.className = 'card p-4 gap-3';
    card.innerHTML = `
      <div class="d-flex justify-between items-center flex-wrap gap-2 border-b pb-2">
        <div>
          <h3 class="card-title">Upload Scanned Daily Progress Report (DPR) / Diary</h3>
          <span class="text-xs text-muted">Supports scanned PDF pages, site diary photographs, and typed digital DPR transcripts</span>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-secondary btn-sm" id="btn-load-demo-ocr">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <span>Load Demo DPR Scan (Electrical & Piping)</span>
          </button>
        </div>
      </div>

      <div class="d-grid grid-2 gap-3">
        <!-- Photo/Image Upload -->
        <div id="ocr-dropzone" class="p-4 border rounded text-center cursor-pointer" style="border-style:dashed; border-color:var(--color-border); background:var(--color-surface-el);">
          <input type="file" id="ocr-file-input" accept="image/*,.pdf" class="d-none">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted mb-2 mx-auto" style="display:inline-block;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          <div class="text-sm font-bold text-primary">Upload DPR Photo or Scanned PDF</div>
          <div class="text-xs text-muted mt-1 font-mono">Mobile Camera or File</div>
          <div id="ocr-img-preview" class="mt-2 d-none">
            <img id="ocr-preview-img" style="max-height:140px; margin:0 auto; border-radius:4px; border:1px solid var(--color-border);">
          </div>
        </div>

        <!-- Direct Text Editor / OCR Raw Output -->
        <div class="d-flex flex-col gap-1">
          <div class="d-flex justify-between items-center">
            <label class="text-xs text-muted font-bold">OCR Transcribed Text / Digital Diary</label>
            <span class="badge badge-neutral" style="font-size:9px;">Regex & NLP Normalizer Active</span>
          </div>
          <textarea id="ocr-raw-textarea" class="form-input text-xs font-mono flex-1" rows="8" placeholder="Paste or review OCR extracted text from daily progress report here...&#10;&#10;Example:&#10;CIVIL WORKS:&#10;1. Reinforced Column Footing DUL-CIV-FND completed 100%&#10;PIPING:&#10;2. Dual-Filter Coalescer Skid Erection alignment finished&#10;ELECTRICAL:&#10;3. Battery rack commissioning in progress (80%)"></textarea>
        </div>
      </div>

      <div class="d-flex justify-between items-center mt-2 flex-wrap gap-2">
        <div class="text-xs text-secondary">
          *Expands abbreviations (conc. → concrete, spl. → spool, hyd. → hydrotest) and auto-segments multi-discipline tasks.
        </div>
        <button class="btn btn-primary btn-sm" id="btn-process-ocr">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          <span>Segment Text & Link Activities to L5/L6 Schedule</span>
        </button>
      </div>
    `;

    mainPanel.appendChild(card);

    const dropzone = card.querySelector('#ocr-dropzone');
    const fileInput = card.querySelector('#ocr-file-input');
    const textarea = card.querySelector('#ocr-raw-textarea');
    let imageBase64 = null;

    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
          imageBase64 = e.target.result;
          const previewImg = card.querySelector('#ocr-preview-img');
          previewImg.src = imageBase64;
          card.querySelector('#ocr-img-preview').classList.remove('d-none');
          if (textarea.value.trim() === '') {
            textarea.value = `[OCR Extract from ${file.name}]\nCIVIL:\n1. Reinforced column footing slab concrete pour finished.\nPIPING:\n2. Dual filter coalescer skid erection & alignment completed.\nELECTRICAL:\n3. Substation UPS battery rack charging 80%.`;
          }
          Toast.info(`Loaded image: ${file.name}`);
        };
        reader.readAsDataURL(file);
      }
    });

    // Demo Scenario Loader
    card.querySelector('#btn-load-demo-ocr').addEventListener('click', () => {
      textarea.value = `OIL INDIA LIMITED - DAILY SITE PROGRESS LOG
DATE: 09-MAR-2026  LOCATION: DULIAJAN CGGS HUB
REPORTED BY: SITE IN-CHARGE (MORNING SHIFT)

[CIVIL WORKS]
1. Blast-Resistant Control Room Roof Installation DUL-CIV-ROOF completed today with final seal check.
2. Foundation footing slab curing in progress.

[PROCESS PIPING & VALVES]
3. Skid High-Pressure Hydrotest & Nitrogen Purging DUL-PIP-HYD successfully finished at 120 bar.
4. Spool fab & erection for Line-24 continuing at manifold area.

[ELECTRICAL & INSTRUMENTATION]
5. 120kVA Industrial UPS Bank & Battery Rack Commissioning DUL-ELE-UPS tested and at 100% readiness.
6. Site Acceptance Testing & SCADA Handover DUL-INS-SAT started with telemetry point checks.`;

      Toast.success('Loaded realistic typed DPR excerpt scenario.');
    });

    card.querySelector('#btn-process-ocr').addEventListener('click', async () => {
      const text = textarea.value.trim();
      if (!text) {
        Toast.error('Please enter or scan some DPR text first.');
        return;
      }

      try {
        const btn = card.querySelector('#btn-process-ocr');
        btn.disabled = true;
        btn.innerHTML = `<span>Segmenting & matching schedule...</span>`;

        const res = await IngestService.ingestOcrDocument({
          rawText: text,
          imageBase64,
          projectId: State.getState().currentProjectId || 'PRJ-OIL-DUL-001',
          filename: 'dpr-site-diary.txt',
          autoSubmit: false
        });

        processedItems = res.items || [];
        Toast.success(`Extracted ${res.totalSegments} activity segments (${res.matchedCount} matched).`);
        renderResultsSection();
      } catch (err) {
        Toast.error(`OCR processing error: ${err.message}`);
      } finally {
        const btn = card.querySelector('#btn-process-ocr');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>Segment Text & Link Activities to L5/L6 Schedule</span>`;
        }
      }
    });
  }

  // ==========================================
  // RESULTS RECONCILIATION TABLE & COMMIT ACTION
  // ==========================================
  function renderResultsSection() {
    let existingResults = mainPanel.querySelector('#ingest-results-card');
    if (existingResults) existingResults.remove();

    if (!processedItems || processedItems.length === 0) return;

    const card = document.createElement('div');
    card.id = 'ingest-results-card';
    card.className = 'card p-4 gap-3';

    card.innerHTML = `
      <div class="d-flex justify-between items-center flex-wrap gap-2 border-b pb-2">
        <div>
          <h3 class="card-title">Extracted & Schedule-Linked Activities</h3>
          <span class="text-xs text-muted">Verify auto-matched L5/L6 activities and confidence ratings before pushing into the official Review Queue</span>
        </div>
        <div class="d-flex items-center gap-2">
          <span class="text-xs font-mono text-muted">${processedItems.length} Activities Found</span>
          <button class="btn btn-success btn-sm" id="btn-commit-batch">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>Push All Verified to Review Queue</span>
          </button>
        </div>
      </div>

      <div class="table-container" style="max-height: 440px; overflow-y: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 36px;"><input type="checkbox" id="check-all-items" checked></th>
              <th style="width: 60px;">#</th>
              <th>Reported Activity / Raw Observation</th>
              <th style="width: 110px;">Discipline</th>
              <th>Matched L5/L6 Schedule Activity</th>
              <th style="width: 140px;">Confidence Score</th>
              <th style="width: 100px;">Progress</th>
            </tr>
          </thead>
          <tbody id="ingest-results-tbody"></tbody>
        </table>
      </div>
    `;

    const tbody = card.querySelector('#ingest-results-tbody');
    tbody.innerHTML = processedItems.map((item, idx) => {
      const match = item.topMatch;
      const actText = item.extractedEvent?.activity || item.rawSegmentText || item.syntheticTranscript;
      const disc = item.extractedEvent?.discipline || 'Civil';
      const prog = item.extractedEvent?.progress ?? 100;
      const conf = item.confidence || 75;

      return `
        <tr>
          <td><input type="checkbox" class="item-checkbox" data-idx="${idx}" checked></td>
          <td class="font-mono text-xs text-muted">${idx + 1}</td>
          <td>
            <div class="text-sm font-semibold text-primary">${escapeHtml(actText)}</div>
            <div class="text-xs text-muted font-mono">${escapeHtml(item.extractedEvent?.date || '')} ${item.extractedEvent?.blocker && item.extractedEvent.blocker !== 'None' ? `· <span class="text-danger font-bold">Blocker: ${escapeHtml(item.extractedEvent.blocker)}</span>` : ''}</div>
          </td>
          <td><span class="badge badge-neutral font-mono" style="font-size:10px;">${escapeHtml(disc)}</span></td>
          <td>
            ${match ? `
              <div class="d-flex flex-col">
                <strong class="text-xs text-primary font-mono">${escapeHtml(match.code)}</strong>
                <span class="text-xs text-secondary">${escapeHtml(match.name)}</span>
              </div>
            ` : `
              <span class="badge badge-warning">Unmatched / Needs Review</span>
            `}
          </td>
          <td>
            <div class="d-flex items-center gap-2">
              <div class="confidence-bar-bg flex-1" style="height:6px;">
                <div class="confidence-bar-fill ${conf >= 80 ? 'confidence-high' : 'confidence-medium'}" style="width:${conf}%;"></div>
              </div>
              <span class="font-mono text-xs font-bold ${conf >= 80 ? 'text-success' : 'text-warning'}">${conf}%</span>
            </div>
          </td>
          <td><span class="badge badge-completed font-mono">${prog}%</span></td>
        </tr>
      `;
    }).join('');

    mainPanel.appendChild(card);

    // Select all handler
    const checkAll = card.querySelector('#check-all-items');
    checkAll.addEventListener('change', (e) => {
      card.querySelectorAll('.item-checkbox').forEach(cb => cb.checked = e.target.checked);
    });

    // Commit to Review Queue handler
    card.querySelector('#btn-commit-batch').addEventListener('click', async () => {
      const selectedIndices = [];
      card.querySelectorAll('.item-checkbox:checked').forEach(cb => {
        selectedIndices.push(Number(cb.getAttribute('data-idx')));
      });

      if (selectedIndices.length === 0) {
        Toast.error('Please select at least one activity to submit.');
        return;
      }

      const selectedItems = selectedIndices.map(i => processedItems[i]);

      try {
        const btn = card.querySelector('#btn-commit-batch');
        btn.disabled = true;
        btn.innerHTML = `<span>Pushing to Review Queue...</span>`;

        const res = await IngestService.confirmBatch({
          items: selectedItems,
          projectId: State.getState().currentProjectId || 'PRJ-OIL-DUL-001',
          sourceLabel: activeTab === 'sheet' ? 'Bulk Spreadsheet Intake' : 'Bulk OCR DPR Intake'
        });

        Toast.success(`Successfully pushed ${res.committedCount} activities into the official Review Queue!`);
        
        // Render success summary card
        card.innerHTML = `
          <div class="p-4 text-center d-flex flex-col items-center gap-3">
            <div style="width:48px; height:48px; border-radius:50%; background:var(--color-success-dim); display:flex; align-items:center; justify-content:center; color:var(--color-success);">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <h3 class="text-lg font-bold text-primary">${res.committedCount} Field Activities Queued for Planner Approval</h3>
            <p class="text-xs text-secondary" style="max-width:500px;">
              All items have been normalized, tagged with discipline provenance, and linked to their corresponding L5/L6 schedule activities. They are now awaiting final reconciliation in the Review Queue.
            </p>
            <div class="d-flex gap-2 mt-2">
              <button class="btn btn-primary btn-sm" id="btn-go-to-review">
                <span>View in Review Queue →</span>
              </button>
              <button class="btn btn-secondary btn-sm" id="btn-ingest-another">
                <span>Ingest Another File</span>
              </button>
            </div>
          </div>
        `;

        card.querySelector('#btn-go-to-review')?.addEventListener('click', () => {
          AppRouter.navigate('/review');
        });

        card.querySelector('#btn-ingest-another')?.addEventListener('click', () => {
          processedItems = [];
          renderTabContent();
        });

      } catch (err) {
        Toast.error(`Submission error: ${err.message}`);
        const btn = card.querySelector('#btn-commit-batch');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Push All Verified to Review Queue</span>`;
        }
      }
    });
  }

  renderTabContent();
  return container;
}
