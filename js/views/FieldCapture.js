import { Button } from '../components/Button.js';
import { Card } from '../components/Card.js';
import { ActivityMatchCard } from '../components/ActivityMatchCard.js';
import { Toast } from '../components/Toast.js';
import { Icons } from '../components/Icons.js';
import { ReportsService } from '../services/reports.js';
import { ActivitiesService } from '../services/activities.js';
import { Speech } from '../services/speech.js';
import { AppRouter } from '../router.js';
import { State } from '../state.js';
import { DB } from '../db.js';
import { escapeHtml } from '../utils/dom.js';

export async function FieldCaptureView() {
  const container = document.createElement('div');
  container.className = 'view-container';

  // Page Header
  const headerRow = document.createElement('div');
  headerRow.className = 'd-flex justify-between items-center flex-wrap gap-2';

  const titleGroup = document.createElement('div');
  titleGroup.innerHTML = `
    <h1 class="text-2xl font-bold text-primary">Field Progress Report</h1>
    <p class="text-xs text-secondary mt-1">Capture field execution actuals via voice or text and link directly to L5/L6 schedule activities</p>
  `;
  headerRow.appendChild(titleGroup);

  const sampleFillBtn = Button({
    text: 'Load Demo Scenario (Foundation B2)',
    variant: 'secondary',
    size: 'sm',
    icon: Icons.sparkle('text-info'),
    onClick: () => {
      transcriptInput.value = 'Foundation B2 concreting completed today. Started at 8:30 AM and finished final pour at 5:15 PM with 240 m3 of M40 grade concrete. Slump 120mm checked and 6 cube moulds taken.';
      handleProcessInput();
    }
  });
  headerRow.appendChild(sampleFillBtn);
  container.appendChild(headerRow);

  // Main Card: Step 1 - Input (Voice & Text)
  const inputCard = document.createElement('div');
  inputCard.className = 'card gap-4';

  const step1Header = document.createElement('div');
  step1Header.className = 'd-flex justify-between items-center';
  step1Header.innerHTML = `
    <div class="d-flex items-center gap-2">
      <span class="badge badge-in-progress" style="font-size:12px; width:24px; height:24px; border-radius:50%; justify-content:center; padding:0;">1</span>
      <strong class="text-md text-primary">Capture Field Execution Event</strong>
    </div>
    <span class="text-xs text-muted">Web Speech API / Manual Input</span>
  `;
  inputCard.appendChild(step1Header);

  // Voice Recording Section
  const voiceBox = document.createElement('div');
  voiceBox.className = 'voice-recorder-box';

  const micBtn = document.createElement('button');
  micBtn.type = 'button';
  micBtn.className = 'voice-mic-btn';
  micBtn.innerHTML = Icons.mic();
  micBtn.setAttribute('aria-label', 'Toggle voice recording');

  const voiceStatusText = document.createElement('div');
  voiceStatusText.className = 'text-sm font-semibold text-secondary';
  voiceStatusText.textContent = 'Tap microphone to speak field progress (Browser Speech Recognition)';

  voiceBox.appendChild(micBtn);
  voiceBox.appendChild(voiceStatusText);
  inputCard.appendChild(voiceBox);

  // Speech Recognition Setup — SpeechService fallback chain
  // (native Web Speech API -> server ASR when live -> typed input)
  let isRecording = false;

  const setMicIdle = (message) => {
    isRecording = false;
    micBtn.classList.remove('active-mic');
    voiceBox.classList.remove('recording');
    if (message) voiceStatusText.textContent = message;
  };

  const startSpeechHandlers = {
    onInterim: (text) => {
      transcriptInput.value = text.trim();
    },
    onResult: (finalText) => {
      transcriptInput.value = `${transcriptInput.value} ${finalText}`.trim();
    },
    onError: (message) => {
      console.warn('Speech recognition error:', message);
      setMicIdle(`Speech recognition error: ${message}. You can type directly below.`);
    },
    onEnd: () => {
      setMicIdle('Recording finished. Review transcript below.');
      if (transcriptInput.value.trim().length > 10) {
        handleProcessInput();
      }
    }
  };

  const caps = Speech.getCapabilities();
  if (!caps.nativeSTT && !caps.serverASR) {
    voiceStatusText.innerHTML = '<span class="text-muted">Voice recognition not supported on this browser. Type your report below.</span>';
  }

  micBtn.addEventListener('click', async () => {
    if (!isRecording) {
      const mode = Speech.startListening(startSpeechHandlers);
      if (mode === 'unsupported') {
        Toast.info('Voice recognition not available. Please type into the transcript box.');
        transcriptInput.focus();
        return;
      }
      isRecording = true;
      micBtn.classList.add('active-mic');
      voiceBox.classList.add('recording');
      voiceStatusText.textContent = mode === 'server'
        ? 'Recording audio for server transcription...'
        : 'Listening... Speak clearly (e.g., "Foundation B2 concreting completed today...")';
    } else {
      voiceStatusText.textContent = 'Processing speech...';
      Speech.stopListening();
      setMicIdle();
    }
  });

  // Editable Transcript Box
  const transcriptGroup = document.createElement('div');
  transcriptGroup.className = 'd-flex flex-col gap-2';

  const transcriptLabel = document.createElement('label');
  transcriptLabel.className = 'text-xs font-bold text-muted';
  transcriptLabel.textContent = 'EDITABLE TRANSCRIPT / FIELD OBSERVATION';
  transcriptGroup.appendChild(transcriptLabel);

  const transcriptInput = document.createElement('textarea');
  transcriptInput.rows = 4;
  transcriptInput.className = 'w-full';
  transcriptInput.placeholder = 'Type or speak: e.g. "Foundation B2 concrete pouring completed today with 240m3 M40 grade. Started 8:30 AM finished 5:15 PM."';
  transcriptGroup.appendChild(transcriptInput);

  const processRow = document.createElement('div');
  processRow.className = 'd-flex justify-between items-center flex-wrap gap-2';

  const charCount = document.createElement('span');
  charCount.className = 'text-xs text-muted';
  charCount.textContent = 'Transcript is always fully editable before submission.';
  processRow.appendChild(charCount);

  const extractBtn = Button({
    text: 'Extract & Match Activity',
    variant: 'primary',
    icon: Icons.sparkle(),
    onClick: () => handleProcessInput()
  });
  processRow.appendChild(extractBtn);

  transcriptGroup.appendChild(processRow);
  inputCard.appendChild(transcriptGroup);
  container.appendChild(inputCard);

  // Dynamic Panels Container (Populated after extraction)
  const resultsContainer = document.createElement('div');
  resultsContainer.className = 'd-flex flex-col gap-5';
  container.appendChild(resultsContainer);

  let currentExtractedEvent = null;
  let currentMatch = null;
  let attachedEvidence = [];

  async function handleProcessInput() {
    const text = transcriptInput.value.trim();
    if (!text) {
      Toast.warning('Please speak or enter a field progress observation first.');
      return;
    }

    resultsContainer.innerHTML = '';
    extractBtn.disabled = true;
    extractBtn.textContent = 'Extracting Entities...';

    // Step 2: Intelligent NLP Extraction
    currentExtractedEvent = await ReportsService.extractEvent(text);

    // Step 3: L5/L6 Schedule Matching
    const allActivities = await ActivitiesService.getActivities(State.getState().currentProjectId);
    const matchResult = await ReportsService.matchActivity(currentExtractedEvent, allActivities);
    currentMatch = matchResult;

    extractBtn.disabled = false;
    extractBtn.textContent = 'Extract & Match Activity';

    renderExtractionAndMatchPanels();
  }

  function renderExtractionAndMatchPanels() {
    resultsContainer.innerHTML = '';

    // Step 2 Card: Extracted Event (All fields editable)
    const extractCard = document.createElement('div');
    extractCard.className = 'card gap-3';

    const step2Header = document.createElement('div');
    step2Header.className = 'd-flex justify-between items-center';
    step2Header.innerHTML = `
      <div class="d-flex items-center gap-2">
        <span class="badge badge-in-progress" style="font-size:12px; width:24px; height:24px; border-radius:50%; justify-content:center; padding:0;">2</span>
        <strong class="text-md text-primary">Structured Execution Event (Extracted)</strong>
      </div>
      <span class="badge badge-pending">AI Suggested • Editable</span>
    `;
    extractCard.appendChild(step2Header);

    const grid = document.createElement('div');
    grid.className = 'd-grid grid-3 gap-3';

    // Field: Discipline
    grid.innerHTML += `
      <div class="d-flex flex-col gap-1">
        <label class="text-xs font-bold text-muted">DISCIPLINE</label>
        <input type="text" id="extract-disc" value="${escapeHtml(currentExtractedEvent.discipline)}" class="w-full">
      </div>
      <div class="d-flex flex-col gap-1">
        <label class="text-xs font-bold text-muted">ACTIVITY DESCRIPTION</label>
        <input type="text" id="extract-act" value="${escapeHtml(currentExtractedEvent.activity)}" class="w-full">
      </div>
      <div class="d-flex flex-col gap-1">
        <label class="text-xs font-bold text-muted">ASSET / LOCATION TAG</label>
        <input type="text" id="extract-tag" value="${escapeHtml(currentExtractedEvent.assetTag)}" class="w-full">
      </div>
      <div class="d-flex flex-col gap-1">
        <label class="text-xs font-bold text-muted">REPORTED STATUS</label>
        <select id="extract-status" class="w-full">
          <option value="Completed" ${currentExtractedEvent.status === 'Completed' ? 'selected' : ''}>Completed (100%)</option>
          <option value="In Progress" ${currentExtractedEvent.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
          <option value="Delayed" ${currentExtractedEvent.status === 'Delayed' ? 'selected' : ''}>Delayed / Blocker Encountered</option>
        </select>
      </div>
      <div class="d-flex flex-col gap-1">
        <label class="text-xs font-bold text-muted">CAPTURED AT</label>
        <input type="text" id="extract-time" value="${escapeHtml(currentExtractedEvent.capturedAt || 'Just now')}" class="w-full">
      </div>
      <div class="d-flex flex-col gap-1">
        <label class="text-xs font-bold text-muted">IDENTIFIED BLOCKER</label>
        <input type="text" id="extract-blocker" value="${escapeHtml(currentExtractedEvent.blocker)}" class="w-full">
      </div>
    `;
    extractCard.appendChild(grid);
    resultsContainer.appendChild(extractCard);

    // Step 3 Card: Activity Match Card
    if (currentMatch.recommended) {
      const matchSection = document.createElement('div');
      matchSection.className = 'd-flex flex-col gap-2';

      const step3Header = document.createElement('div');
      step3Header.className = 'd-flex items-center gap-2';
      step3Header.innerHTML = `
        <span class="badge badge-in-progress" style="font-size:12px; width:24px; height:24px; border-radius:50%; justify-content:center; padding:0;">3</span>
        <strong class="text-md text-primary">Schedule-Linking Matcher</strong>
      `;
      matchSection.appendChild(step3Header);

      const matchCardEl = ActivityMatchCard({
        recommendedActivity: currentMatch.recommended,
        confidence: currentMatch.confidence,
        signals: currentMatch.signals,
        alternatives: currentMatch.alternatives,
        showActions: false
      });
      matchSection.appendChild(matchCardEl);
      resultsContainer.appendChild(matchSection);
    }

    // Step 4 Card: Evidence Attachment
    const evidenceCard = document.createElement('div');
    evidenceCard.className = 'card gap-3';
    evidenceCard.innerHTML = `
      <div class="d-flex justify-between items-center">
        <div class="d-flex items-center gap-2">
          <span class="badge badge-in-progress" style="font-size:12px; width:24px; height:24px; border-radius:50%; justify-content:center; padding:0;">4</span>
          <strong class="text-md text-primary">Site Photo / Evidence Verification</strong>
        </div>
        <span class="text-xs text-muted">Camera or Gallery</span>
      </div>
    `;

    const evidenceActions = document.createElement('div');
    evidenceActions.className = 'd-flex gap-3 flex-wrap items-center';

    const photoInput = document.createElement('input');
    photoInput.type = 'file';
    photoInput.accept = 'image/*';
    photoInput.capture = 'environment'; // Mobile camera
    photoInput.className = 'd-none';

    photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        Toast.warning('Photo exceeds the 2MB field limit. Please retake or compress.');
        return;
      }
      // Read as a data URL so the image survives refresh and offline queuing
      const reader = new FileReader();
      reader.onload = () => {
        attachedEvidence.push({
          localId: `EVD-NEW-${Date.now()}`,
          filename: file.name,
          url: reader.result,
          type: file.type,
          uploadedBy: State.getState().currentUser.name,
          locationMeta: 'Zone East - Pad 14 (GPS Locked)'
        });
        renderAttachedThumbnails();
        Toast.success('Photo evidence attached.');
      };
      reader.onerror = () => Toast.danger('Could not read the selected image.');
      reader.readAsDataURL(file);
    });

    const addPhotoBtn = Button({
      text: 'Take Photo / Upload Evidence',
      icon: Icons.camera(),
      variant: 'secondary',
      onClick: () => photoInput.click()
    });

    evidenceActions.appendChild(photoInput);
    evidenceActions.appendChild(addPhotoBtn);
    evidenceCard.appendChild(evidenceActions);

    const thumbsContainer = document.createElement('div');
    thumbsContainer.id = 'attached-thumbs-box';
    thumbsContainer.className = 'd-grid grid-3 gap-2 mt-2';
    evidenceCard.appendChild(thumbsContainer);

    resultsContainer.appendChild(evidenceCard);

    function renderAttachedThumbnails() {
      thumbsContainer.innerHTML = '';
      attachedEvidence.forEach((item, idx) => {
        const t = document.createElement('div');
        t.className = 'card p-2 gap-1';
        t.innerHTML = `
          <img src="${escapeHtml(item.url)}" style="height:80px; object-fit:cover; border-radius:4px;" alt="Evidence">
          <div class="text-xs font-semibold truncate">${escapeHtml(item.filename)}</div>
        `;
        thumbsContainer.appendChild(t);
      });
    }

    // Step 5: Final Submission Actions
    const submitCard = document.createElement('div');
    submitCard.className = 'card p-4 d-flex flex-row justify-between items-center flex-wrap gap-3';
    submitCard.style.background = 'var(--color-surface-el)';
    submitCard.style.border = '1px solid var(--color-primary-dim)';

    const statusNote = document.createElement('div');
    const isOnline = navigator.onLine;
    statusNote.innerHTML = `
      <div class="text-sm font-bold text-primary">${isOnline ? 'Ready for Schedule Submission' : 'Offline Mode Active'}</div>
      <div class="text-xs text-secondary">${isOnline ? 'Report will be submitted to the Review Queue and Schedule Bridge.' : 'Report will be securely stored in IndexedDB and queued for auto-sync.'}</div>
    `;
    submitCard.appendChild(statusNote);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'd-flex gap-2';

    const saveDraftBtn = Button({
      text: 'Save Local Draft',
      variant: 'secondary',
      onClick: async () => {
        await DB.saveDraft({
          id: `DRAFT-${Date.now()}`,
          transcript: transcriptInput.value,
          extractedEvent: currentExtractedEvent,
          matchedActivity: currentMatch.recommended
        });
        Toast.success('Draft saved locally in device IndexedDB.');
      }
    });
    btnGroup.appendChild(saveDraftBtn);

    const submitBtn = Button({
      text: isOnline ? 'Submit for Review' : 'Queue Offline Report',
      variant: 'primary',
      icon: Icons.check(),
      onClick: async () => {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        const payload = {
          projectId: State.getState().currentProjectId,
          author: State.getState().currentUser.name,
          rawTranscript: transcriptInput.value,
          extractedEvent: {
            discipline: document.getElementById('extract-disc')?.value || currentExtractedEvent.discipline,
            activity: document.getElementById('extract-act')?.value || currentExtractedEvent.activity,
            assetTag: document.getElementById('extract-tag')?.value || currentExtractedEvent.assetTag,
            status: document.getElementById('extract-status')?.value || currentExtractedEvent.status,
            blocker: document.getElementById('extract-blocker')?.value || currentExtractedEvent.blocker,
            capturedAt: currentExtractedEvent.capturedAt,
            date: new Date().toISOString().split('T')[0]
          },
          matchedActivity: currentMatch.recommended,
          confidence: currentMatch.confidence,
          signals: currentMatch.signals,
          alternatives: currentMatch.alternatives,
          evidenceItems: attachedEvidence.map(({ localId, ...rest }) => rest),
          isOffline: !navigator.onLine
        };

        await ReportsService.submitReport(payload);

        if (!navigator.onLine) {
          Toast.warning('Report queued in local IndexedDB. Will auto-sync upon reconnection.');
        } else {
          Toast.success('Progress report submitted and linked to schedule!');
        }

        setTimeout(() => {
          AppRouter.navigate('/review');
        }, 600);
      }
    });
    btnGroup.appendChild(submitBtn);

    submitCard.appendChild(btnGroup);
    resultsContainer.appendChild(submitCard);

    // Scroll to results smoothly
    resultsContainer.scrollIntoView({ behavior: 'smooth' });
  }

  return container;
}
