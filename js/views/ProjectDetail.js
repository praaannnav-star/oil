import { ProjectsService } from '../services/projects.js';
import { ActivitiesService } from '../services/activities.js';
import { ReportsService } from '../services/reports.js';
import { MetricCard } from '../components/Card.js';
import { Badge } from '../components/Badge.js';
import { Button } from '../components/Button.js';
import { Table } from '../components/Table.js';
import { Icons } from '../components/Icons.js';
import { AppRouter } from '../router.js';
import { Auth, USER_ROLES } from '../services/auth.js';
import { escapeHtml } from '../utils/dom.js';

export async function ProjectDetailView(params = {}) {
  const container = document.createElement('div');
  container.className = 'view-container';

  const projectId = params.id || 'PRJ-OIL-DUL-001';
  const project = await ProjectsService.getProject(projectId);

  if (!project) {
    container.innerHTML = `<div class="card p-5 text-center"><h2 class="text-danger">Project Not Found</h2></div>`;
    return container;
  }

  // Header Card
  const header = document.createElement('div');
  header.className = 'card p-4 gap-3';
  header.innerHTML = `
    <div class="d-flex justify-between items-center flex-wrap gap-2">
      <div>
        <div class="d-flex items-center gap-2">
          <h1 class="text-2xl font-bold text-primary">${project.name}</h1>
          <span class="badge badge-${project.health}">${project.health.toUpperCase()}</span>
        </div>
        <span class="text-xs text-muted font-mono">${project.code} • ${project.location} • Lead Planner: ${project.leadPlanner}</span>
      </div>
      <div class="d-flex gap-2">
        ${(Auth.getUser()?.role === USER_ROLES.ADMIN || Auth.getUser()?.role === USER_ROLES.PROJECT_MANAGER) ? `<button class="btn btn-secondary btn-sm" id="btn-edit-project">Edit Project</button>` : ''}
        <button class="btn btn-secondary btn-sm" id="btn-goto-schedule">${Icons.schedule()} Schedule Explorer</button>
        <button class="btn btn-primary btn-sm" id="btn-goto-report">${Icons.progress()} Report Progress</button>
      </div>
    </div>
    <p class="text-sm text-secondary">${project.description}</p>
  `;
  container.appendChild(header);

  setTimeout(() => {
    document.getElementById('btn-goto-schedule')?.addEventListener('click', () => AppRouter.navigate('/schedule'));
    document.getElementById('btn-goto-report')?.addEventListener('click', () => AppRouter.navigate('/progress/new'));
    document.getElementById('btn-edit-project')?.addEventListener('click', () => AppRouter.navigate(`/projects/${project.id}/edit`));
  }, 50);

  // KPIs
  const kpiGrid = document.createElement('div');
  kpiGrid.className = 'd-grid grid-4 gap-3';

  kpiGrid.appendChild(MetricCard({
    label: 'ACTUAL PROGRESS',
    value: `${project.actualProgress}%`,
    subtext: `Target Planned: ${project.plannedProgress}%`
  }));

  kpiGrid.appendChild(MetricCard({
    label: 'SCHEDULE VARIANCE',
    value: `${project.variance}%`,
    status: project.variance < 0 ? 'danger' : 'success',
    subtext: `SPI Index: ${project.spi}`
  }));

  kpiGrid.appendChild(MetricCard({
    label: 'DELAYED ACTIVITIES',
    value: project.delayedActivitiesCount,
    status: 'danger',
    subtext: 'Requires Planner Mitigation'
  }));

  kpiGrid.appendChild(MetricCard({
    label: 'EVIDENCE COVERAGE',
    value: `${project.evidenceCoverage}%`,
    status: 'success',
    subtext: 'Verified Field Packets'
  }));

  container.appendChild(kpiGrid);

  // Site Location Map — Phase W3: OpenStreetMap embed + AI Geo Gazetteer Suggestion
  const mapSectionWrapper = document.createElement('div');
  mapSectionWrapper.className = 'card p-4 gap-3';

  function renderMapSection() {
    mapSectionWrapper.innerHTML = '';
    const hasCoords = project.lat && project.lng;
    const lat = project.lat || 27.3569;
    const lng = project.lng || 95.3194;
    const d = 0.035; // ~7km bbox span

    mapSectionWrapper.innerHTML = `
      <div class="d-flex justify-between items-center flex-wrap gap-2 mb-1">
        <div>
          <h3 class="card-title">Site Location & Geospatial Pin</h3>
          <span class="text-xs text-muted font-mono">${hasCoords ? `${project.lat}, ${project.lng} • OpenStreetMap` : 'No coordinates set'}</span>
        </div>
        <button id="btn-suggest-geo" class="btn btn-secondary btn-sm">
          📍 Suggest Coordinates (AI & Gazetteer)
        </button>
      </div>

      <div id="geo-candidates-mount" class="d-flex flex-col gap-2 d-none"></div>

      ${hasCoords ? `
        <iframe
          title="Project site location map"
          class="map-embed"
          src="https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${+lng + d},${+lat + d}&layer=mapnik&marker=${lat},${lng}"
          loading="lazy"
        ></iframe>
      ` : `
        <div class="card p-3 text-center text-muted" style="background:var(--color-surface-hover);">
          <p class="text-xs mb-0">No coordinates currently assigned to this project. Click <strong>Suggest Coordinates</strong> above to locate verified OIL facilities.</p>
        </div>
      `}
    `;

    const btnSuggest = mapSectionWrapper.querySelector('#btn-suggest-geo');
    const candidatesMount = mapSectionWrapper.querySelector('#geo-candidates-mount');

    btnSuggest.addEventListener('click', async () => {
      btnSuggest.disabled = true;
      btnSuggest.textContent = 'Searching OIL Gazetteer...';
      try {
        const queryText = `${project.name} ${project.location || ''} ${project.code || ''}`;
        const res = await ProjectsService.suggestLocation(queryText, project.id);
        candidatesMount.innerHTML = '';
        candidatesMount.classList.remove('d-none');

        const candidates = res.candidates || [];
        if (candidates.length === 0) {
          candidatesMount.innerHTML = '<span class="text-xs text-muted p-2">No matching OIL facility found in gazetteer.</span>';
          return;
        }

        const title = document.createElement('div');
        title.className = 'text-xs font-bold text-muted uppercase';
        title.textContent = `SUGGESTED OIL SITE PINS (${res.source.toUpperCase()})`;
        candidatesMount.appendChild(title);

        candidates.forEach(cand => {
          const row = document.createElement('div');
          row.className = 'd-flex justify-between items-center p-2 rounded';
          row.style.background = 'var(--color-surface-hover)';
          row.innerHTML = `
            <div class="d-flex flex-col">
              <div class="d-flex items-center gap-2">
                <strong class="text-xs text-primary">${escapeHtml(cand.name)}</strong>
                <span class="badge badge-in-progress" style="font-size:10px;">${cand.confidence}% Match</span>
              </div>
              <span class="text-xs text-muted font-mono">${cand.lat}, ${cand.lng} ${cand.chainageRef ? `• ${escapeHtml(cand.chainageRef)}` : ''}</span>
            </div>
            <button class="btn btn-primary btn-sm btn-confirm-pin">Confirm Pin</button>
          `;

          row.querySelector('.btn-confirm-pin').addEventListener('click', async () => {
            project.lat = cand.lat;
            project.lng = cand.lng;
            await ProjectsService.setLocation(project.id, cand.lat, cand.lng);
            Toast.success(`Confirmed site pin: ${cand.name}`);
            renderMapSection();
          });

          candidatesMount.appendChild(row);
        });
      } catch (err) {
        Toast.danger('Failed to fetch site suggestions: ' + err.message);
      } finally {
        btnSuggest.disabled = false;
        btnSuggest.textContent = '📍 Suggest Coordinates (AI & Gazetteer)';
      }
    });
  }

  renderMapSection();
  container.appendChild(mapSectionWrapper);

  // Discipline Progress Breakdown & Delayed Activities Split View
  const splitGrid = document.createElement('div');
  splitGrid.className = 'd-grid grid-2 gap-4';

  // Left: Discipline Status — computed from real L5/L6 activities
  const activities = await ActivitiesService.getActivities(projectId);
  const byDiscipline = new Map();
  for (const act of activities) {
    if (act.level !== 'L5' && act.level !== 'L6') continue;
    if (!byDiscipline.has(act.discipline)) {
      byDiscipline.set(act.discipline, { total: 0, sum: 0, delayed: 0 });
    }
    const bucket = byDiscipline.get(act.discipline);
    bucket.total++;
    bucket.sum += Number(act.progress || 0);
    if (act.status === 'delayed') bucket.delayed++;
  }

  const discCard = document.createElement('div');
  discCard.className = 'card p-4 gap-3';
  discCard.innerHTML = `
    <div class="card-header p-0 mb-1">
      <h3 class="card-title">Discipline Progress Tracking</h3>
      <span class="text-xs text-muted">Computed from live L5/L6 schedule actuals</span>
    </div>
    <div class="d-flex flex-col gap-3" id="discipline-bars"></div>
  `;
  const barsBox = discCard.querySelector('#discipline-bars');
  if (byDiscipline.size === 0) {
    barsBox.innerHTML = '<p class="text-xs text-muted">No L5/L6 activities scheduled under this project yet.</p>';
  } else {
    byDiscipline.forEach((bucket, discipline) => {
      const avg = Math.round(bucket.sum / bucket.total);
      const row = document.createElement('div');
      row.innerHTML = `
        <div class="d-flex justify-between text-xs font-semibold mb-1">
          <span>${escapeHtml(discipline)} (${bucket.total} activities${bucket.delayed > 0 ? `, ${bucket.delayed} delayed` : ''})</span>
          <span class="font-mono ${bucket.delayed > 0 ? 'text-warning' : 'text-primary'}">${avg}% Avg Complete</span>
        </div>
        <div class="confidence-bar-bg" style="height:6px;"><div class="confidence-bar-fill ${avg >= 70 ? 'confidence-high' : avg >= 40 ? 'confidence-medium' : 'confidence-low'}" style="width:${avg}%;"></div></div>
      `;
      barsBox.appendChild(row);
    });
  }
  splitGrid.appendChild(discCard);

  // Right: Recent Field Reports
  const reports = await ReportsService.getReports(projectId);
  const repCard = document.createElement('div');
  repCard.className = 'card p-4 gap-3';
  repCard.innerHTML = `
    <div class="card-header p-0 mb-1">
      <h3 class="card-title">Recent Field Execution Events</h3>
      <span class="text-xs text-muted">Direct from Field PWA</span>
    </div>
  `;

  const repList = document.createElement('div');
  repList.className = 'd-flex flex-col gap-2';

  reports.slice(0, 3).forEach(r => {
    const item = document.createElement('div');
    item.className = 'card p-2 gap-1';
    item.style.background = 'var(--color-surface-el)';
    item.innerHTML = `
      <div class="d-flex justify-between items-center">
        <strong class="text-xs text-primary truncate">${r.extractedEvent?.activity || 'Site Observation'}</strong>
        <span class="text-xs text-muted font-mono">${r.author.split(' ')[0]}</span>
      </div>
      <div class="text-xs text-secondary truncate">${r.rawTranscript}</div>
    `;
    repList.appendChild(item);
  });
  repCard.appendChild(repList);
  splitGrid.appendChild(repCard);

  container.appendChild(splitGrid);

  return container;
}
