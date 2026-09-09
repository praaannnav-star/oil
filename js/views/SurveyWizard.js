// Survey capture wizard — template selection, guided questions with voice
// dictation and photo evidence, geo auto-tag, offline-aware submission (A6).
import { SurveyService } from '../services/surveys.js';
import { Speech } from '../services/speech.js';
import { State } from '../state.js';
import { AppRouter } from '../router.js';
import { Auth } from '../services/auth.js';
import { Toast } from '../components/Toast.js';
import { Button } from '../components/Button.js';
import { Icons } from '../components/Icons.js';
import { escapeHtml } from '../utils/dom.js';

export async function SurveyWizardView() {
  const container = document.createElement('div');
  container.className = 'view-container';

  const header = document.createElement('div');
  header.className = 'd-flex justify-between items-center flex-wrap gap-2';
  header.innerHTML = `
    <div>
      <h1 class="text-2xl font-bold text-primary">Field Survey Capture</h1>
      <p class="text-xs text-secondary mt-1">Structured inspections and progress surveys — submitted straight into the review queue</p>
    </div>
  `;
  container.appendChild(header);

  let step = 1;
  let template = null;
  let geo = null;
  let photos = [];

  let isFetchingGeo = true;
  let geoError = false;

  function fetchGeoLocation() {
    isFetchingGeo = true;
    geoError = false;
    renderStepper();
    try {
      navigator.geolocation?.getCurrentPosition(
        pos => { 
          geo = { lat: +pos.coords.latitude.toFixed(5), lng: +pos.coords.longitude.toFixed(5), at: new Date().toISOString() }; 
          isFetchingGeo = false;
          renderStepper();
        },
        () => { 
          geoError = true;
          isFetchingGeo = false;
          renderStepper();
        },
        { timeout: 5000, maximumAge: 0 }
      );
    } catch (_) { 
      geoError = true;
      isFetchingGeo = false;
      renderStepper();
    }
  }

  // Initial geo fetch
  fetchGeoLocation();

  const stepBadge = (n, label) => `
    <span class="badge ${step === n ? 'badge-in-progress' : 'badge-completed'}" style="font-size:12px; width:24px; height:24px; border-radius:50%; justify-content:center; padding:0;">${n}</span>
    <strong class="text-sm ${step === n ? 'text-primary' : 'text-muted'}">${label}</strong>
  `;

  const stepper = document.createElement('div');
  stepper.className = 'd-flex items-center gap-4 flex-wrap mt-2 mb-3';
  container.appendChild(stepper);

  const body = document.createElement('div');
  body.className = 'd-flex flex-col gap-3';
  container.appendChild(body);

  function renderStepper() {
    let geoStatusHtml = '';
    if (isFetchingGeo) {
      geoStatusHtml = `<span class="text-xs text-muted font-mono ml-auto">📍 Fetching live location...</span>`;
    } else if (geo) {
      geoStatusHtml = `<span class="text-xs text-success font-mono ml-auto" style="cursor:pointer;" title="Click to refresh location" id="refresh-geo-btn">📍 Geo-tag locked (${geo.lat}, ${geo.lng})</span>`;
    } else if (geoError) {
      geoStatusHtml = `<span class="text-xs text-danger font-mono ml-auto" style="cursor:pointer;" title="Click to retry fetching location" id="refresh-geo-btn">📍 Location unavailable (Retry)</span>`;
    }

    stepper.innerHTML = `
      <div class="d-flex items-center gap-2">${stepBadge(1, 'Template')}</div>
      <span class="text-muted">→</span>
      <div class="d-flex items-center gap-2">${stepBadge(2, 'Questions')}</div>
      <span class="text-muted">→</span>
      <div class="d-flex items-center gap-2">${stepBadge(3, 'Submit')}</div>
      ${geoStatusHtml}
    `;

    const refreshBtn = stepper.querySelector('#refresh-geo-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', fetchGeoLocation);
    }
  }

  async function renderTemplateStep() {
    body.innerHTML = '<div class="p-3 text-muted text-sm font-mono">Loading survey templates...</div>';
    const templates = await SurveyService.getTemplates();
    body.innerHTML = '';
    templates.forEach(tpl => {
      const card = document.createElement('article');
      card.className = 'project-card';
      card.innerHTML = `
        <div class="d-flex items-center gap-3">
          <span style="font-size:1.6rem;">${tpl.icon}</span>
          <div class="d-flex flex-col gap-1">
            <strong class="text-sm text-primary">${escapeHtml(tpl.name)}</strong>
            <span class="text-xs text-secondary">${escapeHtml(tpl.description)} · ${(tpl.questions || []).length} questions</span>
          </div>
        </div>
      `;
      card.addEventListener('click', () => {
        template = tpl;
        step = 2;
        renderStepper();
        renderQuestionStep();
      });
      body.appendChild(card);
    });
  }

  function renderQuestionStep() {
    body.innerHTML = '';
    const formCard = document.createElement('div');
    formCard.className = 'card p-4 gap-3';

    const head = document.createElement('div');
    head.innerHTML = `<h3 class="card-title">${template.icon} ${escapeHtml(template.name)}</h3>`;
    formCard.appendChild(head);

    template.questions.forEach(q => {
      const wrap = document.createElement('div');
      wrap.className = 'd-flex flex-col gap-1';
      let field = '';
      if (q.type === 'radio') {
        field = q.options.map(o => `
          <label class="text-sm d-flex items-center gap-2" style="cursor:pointer;">
            <input type="radio" name="${q.id}" value="${escapeHtml(o)}" required="${!!q.required}"> ${escapeHtml(o)}
          </label>`).join('');
      } else if (q.type === 'number') {
        field = `<input type="number" name="${q.id}" placeholder="${escapeHtml(q.placeholder || '')}" ${q.required ? 'required' : ''}>`;
      } else {
        field = `<textarea name="${q.id}" rows="2" placeholder="${escapeHtml(q.placeholder || '')}" ${q.required ? 'required' : ''}></textarea>`;
      }
      wrap.innerHTML = `<label class="text-xs font-bold text-muted">${escapeHtml(q.label.toUpperCase())}${q.required ? ' *' : ''}</label><div class="d-grid gap-2">${field}</div>`;
      if (q.voice) {
        const micBtn = Button({
          text: 'Dictate',
          icon: Icons.mic(),
          variant: 'secondary',
          size: 'sm',
          onClick: () => {
            const ta = wrap.querySelector(`[name="${q.id}"]`);
            Speech.startListening({
              onResult: (t) => { ta.value = `${ta.value} ${t}`.trim(); },
              onError: (m) => Toast.warning(m),
              onEnd: () => Toast.info('Dictation finished.')
            });
            Toast.info('Listening... tap Dictate again to stop.');
            micBtn.onclick = () => Speech.stopListening();
          }
        });
        wrap.appendChild(micBtn);
      }
      formCard.appendChild(wrap);
    });



    // Optional photo evidence (Single image enforcement)
    const photoWrap = document.createElement('div');
    photoWrap.className = 'd-flex flex-col gap-1';
    photoWrap.innerHTML = `<label class="text-xs font-bold text-muted">SITE PHOTO EVIDENCE (MAX 1 IMAGE)</label>`;
    const photoInput = document.createElement('input');
    photoInput.type = 'file';
    photoInput.accept = 'image/*';
    photoInput.capture = 'environment';
    photoInput.className = 'd-none';
    const attachBtn = Button({ text: 'Attach Photo', icon: Icons.camera(), variant: 'secondary', size: 'sm', onClick: () => photoInput.click() });
    const count = document.createElement('span');
    count.className = 'text-xs text-muted d-flex items-center gap-2';

    photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) return Toast.warning('Photo exceeds the 2MB limit.');
      const reader = new FileReader();
      reader.onload = () => {
        // Enforce strictly 1 photo in memory
        photos = [{ filename: file.name, url: reader.result, type: file.type }];
        attachBtn.style.display = 'none'; // Hide button
        count.innerHTML = `
          <div class="d-flex items-center gap-2">
            <span class="badge badge-success" style="padding: 2px 8px; border-radius: 4px; background: var(--color-success-dim); color: var(--color-success);">✓ 1 photo attached (${escapeHtml(file.name)})</span>
            <button type="button" class="btn btn-ghost" style="padding: 2px 6px; font-size: 12px; height: auto;" id="remove-survey-photo" title="Remove photo">✕</button>
          </div>
        `;
        count.querySelector('#remove-survey-photo').addEventListener('click', () => {
          photos = [];
          photoInput.value = ''; // Reset input
          count.innerHTML = '';
          attachBtn.style.display = ''; // Show button
        });
      };
      reader.readAsDataURL(file);
    });

    photoWrap.appendChild(photoInput);
    const row = document.createElement('div');
    row.className = 'd-flex items-center gap-3';
    row.appendChild(attachBtn);
    row.appendChild(count);
    photoWrap.appendChild(row);
    formCard.appendChild(photoWrap);

    const actions = document.createElement('div');
    actions.className = 'd-flex justify-end gap-2';
    actions.appendChild(Button({ text: 'Back', variant: 'ghost', onClick: () => { step = 1; renderStepper(); renderTemplateStep(); } }));
    actions.appendChild(Button({
      text: 'Review Answers',
      variant: 'primary',
      icon: Icons.check(),
      onClick: () => {
        const answers = {};
        let valid = true;
        for (const q of template.questions) {
          const el = formCard.querySelector(`[name="${q.id}"]`);
          const val = q.type === 'radio'
            ? formCard.querySelector(`[name="${q.id}"]:checked`)?.value || ''
            : el?.value.trim() || '';
          if (q.required && !val) {
            valid = false;
            Toast.warning(`Please answer: "${q.label}"`);
            break;
          }
          answers[q.id] = val;
        }

        if (!valid) return;
        template._answers = answers;
        step = 3;
        renderStepper();
        renderSubmitStep();
      }
    }));
    formCard.appendChild(actions);
    body.appendChild(formCard);
  }

  function renderSubmitStep() {
    body.innerHTML = '';
    const reviewCard = document.createElement('div');
    reviewCard.className = 'card p-4 gap-3';
    reviewCard.innerHTML = `<h3 class="card-title">Review & Submit</h3>`;

    template.questions.forEach(q => {
      const ans = template._answers[q.id];
      const rowEl = document.createElement('div');
      rowEl.className = 'd-flex flex-col gap-1 p-2';
      rowEl.style.background = 'var(--color-surface-el)';
      rowEl.style.borderRadius = '8px';
      rowEl.innerHTML = `
        <span class="text-xs font-bold text-muted">${escapeHtml(q.label)}</span>
        <span class="text-sm text-primary">${escapeHtml(ans || '—')}</span>
      `;
      reviewCard.appendChild(rowEl);
    });

    const meta = document.createElement('div');
    meta.className = 'text-xs text-secondary d-flex gap-3 flex-wrap';
    const project = State.getState().currentProjectId;
    meta.innerHTML = `<span>📁 ${escapeHtml(project)}</span><span>📸 ${photos.length} photo(s)</span>${geo ? `<span>📍 geo-tagged</span>` : ''}<span>${navigator.onLine ? '🟢 will submit online' : '🔴 offline — queued for auto-sync'}</span>`;
    reviewCard.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'd-flex justify-end gap-2';
    actions.appendChild(Button({ text: 'Edit Answers', variant: 'ghost', onClick: () => { step = 2; renderStepper(); renderQuestionStep(); } }));
    actions.appendChild(Button({
      text: navigator.onLine ? 'Submit Survey' : 'Queue Offline Survey',
      variant: 'primary',
      icon: Icons.check(),
      onClick: async () => {
        await SurveyService.submitSurvey({
          projectId: project,
          templateId: template.id,
          templateName: template.name,
          answers: template._answers,
          photos,
          geo,
          isOffline: !navigator.onLine
        });
        Toast.success(navigator.onLine ? 'Survey submitted to review queue.' : 'Survey queued — will sync automatically.');
        if (Auth.canAccess('/review')) {
          AppRouter.navigate('/review');
        } else {
          AppRouter.navigate('/overview');
        }
      }
    }));
    reviewCard.appendChild(actions);
    body.appendChild(reviewCard);
  }

  renderStepper();
  renderTemplateStep();
  return container;
}
