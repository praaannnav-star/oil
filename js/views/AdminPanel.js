import { ProjectsService } from '../services/projects.js';
import { MetricCard } from '../components/Card.js';
import { Badge } from '../components/Badge.js';
import { Button } from '../components/Button.js';
import { Modal } from '../components/Modal.js';
import { Toast } from '../components/Toast.js';
import { AppRouter } from '../router.js';
import { Auth } from '../services/auth.js';
import { escapeHtml } from '../utils/dom.js';

const ALL_ROUTES = [
  { path: '/overview', label: 'Overview Dashboard' },
  { path: '/projects', label: 'Projects Portfolio' },
  { path: '/projects/new', label: 'Create Project' },
  { path: '/projects/:id', label: 'Project Details' },
  { path: '/projects/:id/edit', label: 'Edit Project' },
  { path: '/schedule', label: 'Master Schedule (L5/L6)' },
  { path: '/activities/:id', label: 'Activity Details' },
  { path: '/progress', label: 'Field Progress Feed' },
  { path: '/progress/new', label: 'Field Report Capture' },
  { path: '/review', label: 'Review & Approval Queue' },
  { path: '/surveys', label: 'Field Survey Wizard' },
  { path: '/evidence', label: 'Evidence Vault' },
  { path: '/analytics', label: 'Analytics & SPI' },
  { path: '/memory', label: 'Execution Memory' },
  { path: '/audit', label: 'Audit Trail Ledger' },
  { path: '/manager', label: 'PM Workstation' },
  { path: '/admin', label: 'System Administration' }
];

const DEFAULT_ROLE_ROUTES = {
  'Admin': ALL_ROUTES.map(r => r.path),
  'Executive / GM': ['/overview', '/projects', '/projects/:id', '/schedule', '/activities/:id', '/evidence', '/analytics', '/memory', '/audit', '/progress', '/progress/new'],
  'Project Manager': ['/overview', '/manager', '/projects', '/projects/new', '/projects/:id', '/projects/:id/edit', '/schedule', '/activities/:id', '/review', '/surveys', '/evidence', '/analytics', '/memory', '/audit', '/progress', '/progress/new'],
  'Planner': ['/overview', '/projects', '/projects/:id', '/schedule', '/activities/:id', '/review', '/surveys', '/evidence', '/analytics', '/memory', '/audit', '/progress', '/progress/new'],
  'Reviewer': ['/overview', '/schedule', '/activities/:id', '/review', '/surveys', '/evidence', '/audit', '/progress', '/progress/new'],
  'Field Supervisor': ['/overview', '/projects', '/projects/:id', '/progress', '/progress/new', '/surveys', '/evidence', '/activities/:id']
};

const DISCIPLINES = [
  'Civil',
  'Electrical',
  'Piping',
  'Instrumentation',
  'Mechanical',
  'HSE',
  'All'
];

export async function AdminPanelView() {
  const container = document.createElement('div');
  container.className = 'view-container';

  let projects = [];
  let users = [];
  let assignments = [];

  try {
    projects = await ProjectsService.getProjects();
  } catch (e) {
    console.warn('Projects fetch error:', e);
  }

  // Load initial data from API
  async function loadData() {
    try {
      const { ApiHttp } = await import('../services/http.js');
      const [usersRes, assignRes] = await Promise.all([
        ApiHttp.request('/users').catch(() => []),
        ApiHttp.request('/assignments').catch(() => [])
      ]);
      if (Array.isArray(usersRes)) users = usersRes;
      if (Array.isArray(assignRes)) assignments = assignRes;
    } catch (err) {
      console.warn('Failed to load admin data:', err.message);
    }
    if (users.length === 0 && Auth.getUser()) {
      users = [Auth.getUser()];
    }
  }

  await loadData();

  function renderView() {
    container.innerHTML = '';

    // Page Header
    const header = document.createElement('div');
    header.innerHTML = `
      <h1 class="text-2xl font-bold text-primary">System Administration</h1>
      <p class="text-xs text-secondary mt-1">Govern user credentials, role access policies, and project discipline supervision matrix.</p>
    `;
    container.appendChild(header);

    // Metrics Overview
    const metrics = document.createElement('div');
    metrics.className = 'd-grid grid-4 gap-3 my-3';
    metrics.append(
      MetricCard({ label: 'ENTERPRISE USERS', value: users.length, subtext: 'Registered user accounts' }),
      MetricCard({ label: 'PROJECTS', value: projects.length, subtext: 'Active portfolio records' }),
      MetricCard({ label: 'DISCIPLINE ASSIGNMENTS', value: assignments.length, status: 'success', subtext: 'Supervision assignments' }),
      MetricCard({ label: 'ACCESS MODEL', value: 'RBAC', status: 'success', subtext: 'Route-level enforcement' })
    );
    container.appendChild(metrics);

    // Section 1: User Access Directory
    const userSection = document.createElement('section');
    userSection.className = 'card p-4 gap-3 my-3';

    const userHeader = document.createElement('div');
    userHeader.className = 'd-flex justify-between items-center flex-wrap gap-2';
    userHeader.innerHTML = `
      <div>
        <h2 class="card-title">User Access Directory</h2>
        <p class="text-xs text-secondary mt-1">Create accounts, assign roles (e.g. Field Supervisor, Project Manager), and customize allowed routes.</p>
      </div>
    `;

    const addUserBtn = Button({
      text: '+ Add New User',
      variant: 'primary',
      size: 'sm',
      onClick: () => openUserModal()
    });
    userHeader.appendChild(addUserBtn);
    userSection.appendChild(userHeader);

    const userRowsContainer = document.createElement('div');
    userRowsContainer.className = 'admin-user-list mt-2';

    const currentAuthedUser = Auth.getUser();

    users.forEach(user => {
      const row = document.createElement('div');
      row.className = 'admin-user-row';
      const allowedCount = (user.allowedRoutes || []).length;
      const isSelf = currentAuthedUser && (currentAuthedUser.id === user.id || currentAuthedUser.username === user.username);

      row.innerHTML = `
        <span class="admin-avatar">${escapeHtml(user.avatar || '👤')}</span>
        <div>
          <div class="d-flex items-center gap-2">
            <strong>${escapeHtml(user.name)}</strong>
            <span class="text-xs font-mono text-muted">(@${escapeHtml(user.username)})</span>
            ${isSelf ? '<span class="badge badge-completed" style="font-size:10px; padding:1px 6px;">You</span>' : ''}
          </div>
          <small>${escapeHtml(user.title || user.department || 'Oil India Staff')}</small>
        </div>
        <div class="d-flex items-center gap-2">
          <span>${Badge({ label: user.role, status: user.role === 'Admin' ? 'at-risk' : user.role.includes('Manager') ? 'in-progress' : user.role.includes('Supervisor') ? 'on-track' : 'completed' })}</span>
          <small class="text-xs text-muted">${allowedCount} routes</small>
        </div>
        <div class="d-flex items-center gap-2 justify-end">
          <button class="btn btn-ghost btn-sm btn-edit-user" title="Edit user access & credentials">✏️ Edit</button>
          <button class="btn btn-ghost btn-sm btn-delete-user text-danger" title="${isSelf ? 'Cannot delete your own account' : 'Delete user account'}" ${isSelf ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>🗑️</button>
        </div>
      `;

      row.querySelector('.btn-edit-user').addEventListener('click', () => openUserModal(user));

      if (!isSelf) {
        row.querySelector('.btn-delete-user').addEventListener('click', async () => {
          if (confirm(`Are you sure you want to permanently delete user "${user.name}" (@${user.username})? All their sessions and project assignments will be removed.`)) {
            try {
              const { ApiHttp } = await import('../services/http.js');
              await ApiHttp.request(`/users/${user.id}`, { method: 'DELETE' });
              Toast.success(`User "${user.name}" successfully deleted.`);
              await loadData();
              renderView();
            } catch (err) {
              Toast.danger(`Failed to delete user: ${err.message}`);
            }
          }
        });
      }

      userRowsContainer.appendChild(row);
    });

    userSection.appendChild(userRowsContainer);
    container.appendChild(userSection);

    // Section 2: Project Supervision & Multi-Discipline Assignments Matrix
    const assignSection = document.createElement('section');
    assignSection.className = 'card p-4 gap-3 my-3';

    const assignHeader = document.createElement('div');
    assignHeader.className = 'd-flex justify-between items-center flex-wrap gap-2';
    assignHeader.innerHTML = `
      <div>
        <h2 class="card-title">Project Supervision & Discipline Assignments</h2>
        <p class="text-xs text-secondary mt-1">Assign multiple supervisors and managers to the same project across distinct disciplines (Civil, Electrical, Piping, Mechanical, HSE, etc.).</p>
      </div>
    `;
    assignSection.appendChild(assignHeader);

    const projectListDiv = document.createElement('div');
    projectListDiv.className = 'd-flex flex-col gap-3 mt-3';

    if (projects.length === 0) {
      projectListDiv.innerHTML = `<div class="p-3 text-muted text-sm font-mono">No active projects found in database.</div>`;
    } else {
      projects.forEach(project => {
        const projectCard = document.createElement('div');
        projectCard.className = 'card p-3';
        projectCard.style.background = 'var(--color-surface-hover)';
        projectCard.style.border = '1px solid var(--color-border)';

        const projectAssigned = assignments.filter(a => a.projectId === project.id);

        const cardTop = document.createElement('div');
        cardTop.className = 'd-flex justify-between items-center flex-wrap gap-2 pb-2';
        cardTop.style.borderBottom = '1px solid var(--color-border)';
        cardTop.innerHTML = `
          <div>
            <div class="d-flex items-center gap-2">
              <strong class="text-primary text-base">${escapeHtml(project.name)}</strong>
              <span class="badge badge-completed font-mono" style="font-size:11px;">${escapeHtml(project.code || project.id)}</span>
              ${Badge({ label: project.health || 'on-track', status: project.health === 'critical' ? 'rejected' : project.health === 'at-risk' ? 'at-risk' : 'completed' })}
            </div>
            <small class="text-xs text-secondary">${escapeHtml(project.location || 'Assam, India')} · ${projectAssigned.length} assigned supervisors/managers</small>
          </div>
        `;

        const assignBtn = Button({
          text: '+ Assign Supervisor / Manager',
          variant: 'secondary',
          size: 'sm',
          onClick: () => openAssignModal(project)
        });
        cardTop.appendChild(assignBtn);
        projectCard.appendChild(cardTop);

        // Assigned personnel table/chips
        const assignmentList = document.createElement('div');
        assignmentList.className = 'mt-2';

        if (projectAssigned.length === 0) {
          assignmentList.innerHTML = `<div class="text-xs text-muted py-2 font-mono">No discipline supervisors or managers assigned yet. Click "+ Assign Supervisor / Manager" above to designate personnel.</div>`;
        } else {
          const table = document.createElement('table');
          table.className = 'table text-xs w-full mt-1';
          table.style.width = '100%';
          table.innerHTML = `
            <thead>
              <tr style="text-align:left; color:var(--color-text-muted); font-size:11px;">
                <th style="padding:4px 8px;">PERSONNEL</th>
                <th style="padding:4px 8px;">ROLE</th>
                <th style="padding:4px 8px;">TECHNICAL DISCIPLINE</th>
                <th style="padding:4px 8px;">ASSIGNED</th>
                <th style="padding:4px 8px; text-align:right;">ACTION</th>
              </tr>
            </thead>
            <tbody>
              ${projectAssigned.map(a => `
                <tr style="border-top:1px solid var(--color-border);">
                  <td style="padding:6px 8px;">
                    <span style="font-size:1.1rem; vertical-align:middle; margin-right:4px;">${escapeHtml(a.userAvatar || '👷‍♂️')}</span>
                    <strong>${escapeHtml(a.userName || 'Personnel')}</strong>
                    <span class="text-muted">(@${escapeHtml(a.username || '')})</span>
                  </td>
                  <td style="padding:6px 8px;">
                    <span class="badge ${a.userRole?.includes('Manager') ? 'badge-in-progress' : 'badge-on-track'}" style="font-size:10px;">${escapeHtml(a.userRole || 'Supervisor')}</span>
                  </td>
                  <td style="padding:6px 8px;">
                    <span class="badge badge-completed" style="font-weight:600; font-size:11px; padding:2px 8px;">
                      ⚡ ${escapeHtml(a.discipline)}
                    </span>
                  </td>
                  <td style="padding:6px 8px; color:var(--color-text-muted);">
                    ${a.assignedAt ? new Date(a.assignedAt).toLocaleDateString('en-IN') : 'Active'}
                  </td>
                  <td style="padding:6px 8px; text-align:right;">
                    <button class="btn btn-ghost btn-sm text-danger btn-remove-assign" data-id="${a.id}" data-project="${project.id}" style="padding:2px 6px;" title="Remove discipline assignment">✕ Remove</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          `;

          table.querySelectorAll('.btn-remove-assign').forEach(btn => {
            btn.addEventListener('click', async () => {
              const assignId = btn.getAttribute('data-id');
              const projId = btn.getAttribute('data-project');
              if (confirm('Remove this discipline assignment?')) {
                try {
                  const { ApiHttp } = await import('../services/http.js');
                  await ApiHttp.request(`/projects/${projId}/assignments/${assignId}`, { method: 'DELETE' });
                  Toast.success('Discipline assignment removed.');
                  await loadData();
                  renderView();
                } catch (err) {
                  Toast.danger(`Failed to remove assignment: ${err.message}`);
                }
              }
            });
          });

          assignmentList.appendChild(table);
        }

        projectCard.appendChild(assignmentList);
        projectListDiv.appendChild(projectCard);
      });
    }

    assignSection.appendChild(projectListDiv);
    container.appendChild(assignSection);

    // Section 3: Portfolio Controls
    const controls = document.createElement('section');
    controls.className = 'card p-4 gap-3 my-3';
    controls.innerHTML = `
      <div class="card-header p-0">
        <div>
          <h2 class="card-title">Portfolio Controls</h2>
          <p class="text-xs text-secondary mt-1">Direct navigation to project creation, schedule governance, and cryptographic audit ledger.</p>
        </div>
      </div>
      <div class="d-flex gap-2 flex-wrap mt-2">
        <button id="admin-create" class="btn btn-primary">Create Project</button>
        <button id="admin-projects" class="btn btn-secondary">Manage Projects</button>
        <button id="admin-audit" class="btn btn-secondary">Open Audit Trail</button>
      </div>
    `;

    controls.querySelector('#admin-create').addEventListener('click', () => AppRouter.navigate('/projects/new'));
    controls.querySelector('#admin-projects').addEventListener('click', () => AppRouter.navigate('/projects'));
    controls.querySelector('#admin-audit').addEventListener('click', () => AppRouter.navigate('/audit'));
    container.appendChild(controls);
  }

  // User Add/Edit Modal
  function openUserModal(existingUser = null) {
    const isEdit = !!existingUser;
    const formEl = document.createElement('form');
    formEl.className = 'd-flex flex-col gap-3';

    let selectedRole = existingUser ? existingUser.role : 'Field Supervisor';
    let currentAllowedRoutes = existingUser && Array.isArray(existingUser.allowedRoutes)
      ? [...existingUser.allowedRoutes]
      : [...(DEFAULT_ROLE_ROUTES[selectedRole] || [])];

    formEl.innerHTML = `
      <div class="d-grid grid-2 gap-2">
        <div class="form-group">
          <label class="form-label text-xs font-semibold">Full Name *</label>
          <input type="text" id="modal-user-name" class="form-input" placeholder="e.g. Ramesh Kalita" value="${escapeHtml(existingUser?.name || '')}" required>
        </div>
        <div class="form-group">
          <label class="form-label text-xs font-semibold">Username *</label>
          <input type="text" id="modal-user-username" class="form-input font-mono" placeholder="e.g. ramesh_k" value="${escapeHtml(existingUser?.username || '')}" ${isEdit ? 'disabled style="background:var(--color-surface-hover);"' : ''} required>
        </div>
      </div>

      <div class="d-grid grid-2 gap-2">
        <div class="form-group">
          <label class="form-label text-xs font-semibold">${isEdit ? 'Password (leave blank to keep current)' : 'Password *'}</label>
          <input type="password" id="modal-user-password" class="form-input font-mono" placeholder="••••••••" ${isEdit ? '' : 'required minlength="6"'}>
        </div>
        <div class="form-group">
          <label class="form-label text-xs font-semibold">System Role *</label>
          <select id="modal-user-role" class="form-input">
            <option value="Field Supervisor" ${selectedRole === 'Field Supervisor' ? 'selected' : ''}>Field Supervisor (Site Execution)</option>
            <option value="Project Manager" ${selectedRole === 'Project Manager' ? 'selected' : ''}>Project Manager (Workstation & Schedule)</option>
            <option value="Planner" ${selectedRole === 'Planner' ? 'selected' : ''}>Planner (L5/L6 Schedule Mastermind)</option>
            <option value="Reviewer" ${selectedRole === 'Reviewer' ? 'selected' : ''}>Reviewer (QA/QC Inspection)</option>
            <option value="Executive / GM" ${selectedRole === 'Executive / GM' ? 'selected' : ''}>Executive / GM (Command Center)</option>
            <option value="Admin" ${selectedRole === 'Admin' ? 'selected' : ''}>Admin (System Administrator)</option>
          </select>
        </div>
      </div>

      <div class="d-grid grid-3 gap-2">
        <div class="form-group">
          <label class="form-label text-xs font-semibold">Job Title</label>
          <input type="text" id="modal-user-title" class="form-input" placeholder="e.g. Lead Electrical Engineer" value="${escapeHtml(existingUser?.title || '')}">
        </div>
        <div class="form-group">
          <label class="form-label text-xs font-semibold">Department</label>
          <input type="text" id="modal-user-dept" class="form-input" placeholder="e.g. Field Operations — Rig 04" value="${escapeHtml(existingUser?.department || '')}">
        </div>
        <div class="form-group">
          <label class="form-label text-xs font-semibold">Avatar Emoji</label>
          <input type="text" id="modal-user-avatar" class="form-input text-center" style="font-size:1.2rem;" value="${escapeHtml(existingUser?.avatar || (selectedRole.includes('Supervisor') ? '👷‍♂️' : selectedRole.includes('Manager') ? '👷' : selectedRole.includes('Admin') ? '👨‍💼' : '📐'))}">
        </div>
      </div>

      <div class="form-group mt-1">
        <div class="d-flex justify-between items-center mb-1">
          <label class="form-label text-xs font-semibold">Allowed Navigation Routes & Permissions</label>
          <button type="button" id="btn-reset-routes" class="btn btn-ghost btn-xs text-xs font-mono" style="padding:1px 6px;">⟲ Reset to Role Defaults</button>
        </div>
        <div id="route-checkboxes-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:6px; max-height:160px; overflow-y:auto; padding:8px; border:1px solid var(--color-border); border-radius:var(--radius-sm); background:var(--color-surface-hover);">
        </div>
      </div>
    `;

    const gridEl = formEl.querySelector('#route-checkboxes-grid');
    const roleSelect = formEl.querySelector('#modal-user-role');
    const avatarInput = formEl.querySelector('#modal-user-avatar');

    function renderRouteCheckboxes() {
      gridEl.innerHTML = ALL_ROUTES.map(r => {
        const isChecked = currentAllowedRoutes.includes(r.path);
        return `
          <label class="d-flex items-center gap-2 text-xs" style="cursor:pointer; margin:0;">
            <input type="checkbox" value="${r.path}" class="route-chk" ${isChecked ? 'checked' : ''}>
            <span class="font-mono text-primary">${r.path}</span>
          </label>
        `;
      }).join('');

      gridEl.querySelectorAll('.route-chk').forEach(chk => {
        chk.addEventListener('change', (e) => {
          const val = e.target.value;
          if (e.target.checked) {
            if (!currentAllowedRoutes.includes(val)) currentAllowedRoutes.push(val);
          } else {
            currentAllowedRoutes = currentAllowedRoutes.filter(p => p !== val);
          }
        });
      });
    }

    renderRouteCheckboxes();

    roleSelect.addEventListener('change', (e) => {
      selectedRole = e.target.value;
      currentAllowedRoutes = [...(DEFAULT_ROLE_ROUTES[selectedRole] || [])];
      avatarInput.value = selectedRole.includes('Supervisor') ? '👷‍♂️' : selectedRole.includes('Manager') ? '👷' : selectedRole.includes('Admin') ? '👨‍💼' : '📐';
      renderRouteCheckboxes();
    });

    formEl.querySelector('#btn-reset-routes').addEventListener('click', () => {
      currentAllowedRoutes = [...(DEFAULT_ROLE_ROUTES[selectedRole] || [])];
      renderRouteCheckboxes();
    });

    const submitBtn = Button({
      text: isEdit ? 'Update User' : 'Create User',
      variant: 'primary',
      size: 'sm',
      onClick: async () => {
        const name = formEl.querySelector('#modal-user-name').value.trim();
        const username = formEl.querySelector('#modal-user-username').value.trim().toLowerCase();
        const password = formEl.querySelector('#modal-user-password').value;
        const role = roleSelect.value;
        const title = formEl.querySelector('#modal-user-title').value.trim();
        const department = formEl.querySelector('#modal-user-dept').value.trim();
        const avatar = avatarInput.value.trim() || '👤';

        if (!name || (!isEdit && !username)) {
          Toast.warning('Please enter both Full Name and Username.');
          return;
        }

        if (!isEdit && (!password || password.length < 6)) {
          Toast.warning('Password must be at least 6 characters long.');
          return;
        }

        const payload = {
          name,
          role,
          title,
          department,
          avatar,
          allowedRoutes: currentAllowedRoutes
        };

        if (!isEdit) {
          payload.username = username;
          payload.password = password;
        } else if (password && password.length >= 6) {
          payload.password = password;
        }

        try {
          const { ApiHttp } = await import('../services/http.js');
          if (isEdit) {
            await ApiHttp.request(`/users/${existingUser.id}`, { method: 'PATCH', body: payload });
            Toast.success(`User "${name}" updated successfully.`);
          } else {
            await ApiHttp.request('/users', { method: 'POST', body: payload });
            Toast.success(`User "${name}" created successfully.`);
          }
          modal.close();
          await loadData();
          renderView();
        } catch (err) {
          Toast.danger(`Error: ${err.message}`);
        }
      }
    });

    const cancelBtn = Button({
      text: 'Cancel',
      variant: 'ghost',
      size: 'sm',
      onClick: () => modal.close()
    });

    const modal = Modal({
      title: isEdit ? `Edit User: ${existingUser.name}` : 'Add New Enterprise User',
      body: formEl,
      footer: [cancelBtn, submitBtn]
    });
  }

  // Discipline Assignment Modal
  function openAssignModal(preselectedProject = null) {
    const formEl = document.createElement('form');
    formEl.className = 'd-flex flex-col gap-3';

    formEl.innerHTML = `
      <div class="form-group">
        <label class="form-label text-xs font-semibold">Target Project *</label>
        <select id="assign-project-select" class="form-input" ${preselectedProject ? 'disabled style="background:var(--color-surface-hover);"' : ''}>
          ${projects.map(p => `
            <option value="${p.id}" ${preselectedProject && preselectedProject.id === p.id ? 'selected' : ''}>
              ${escapeHtml(p.name)} (${escapeHtml(p.code || p.id)})
            </option>
          `).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label text-xs font-semibold">Supervisor / Manager Personnel *</label>
        <select id="assign-user-select" class="form-input">
          ${users.map(u => `
            <option value="${u.id}">
              ${escapeHtml(u.avatar || '👤')} ${escapeHtml(u.name)} — [${escapeHtml(u.role)}] (@${escapeHtml(u.username)})
            </option>
          `).join('')}
        </select>
        <small class="text-xs text-muted mt-1">Select any registered supervisor, engineer, or project manager.</small>
      </div>

      <div class="form-group">
        <label class="form-label text-xs font-semibold">Assigned Technical Discipline *</label>
        <select id="assign-discipline-select" class="form-input font-bold">
          ${DISCIPLINES.map(d => `
            <option value="${d}">${d === 'All' ? '🌐 All Disciplines (General Supervision)' : `⚡ ${d} Discipline`}</option>
          `).join('')}
        </select>
        <small class="text-xs text-muted mt-1">To assign the same supervisor to multiple disciplines (e.g. Civil & Electrical), submit an assignment for each discipline.</small>
      </div>
    `;

    const submitBtn = Button({
      text: 'Confirm Assignment',
      variant: 'primary',
      size: 'sm',
      onClick: async () => {
        const projectId = preselectedProject ? preselectedProject.id : formEl.querySelector('#assign-project-select').value;
        const userId = formEl.querySelector('#assign-user-select').value;
        const discipline = formEl.querySelector('#assign-discipline-select').value;

        if (!projectId || !userId || !discipline) {
          Toast.warning('Please select project, personnel, and discipline.');
          return;
        }

        try {
          const { ApiHttp } = await import('../services/http.js');
          await ApiHttp.request(`/projects/${projectId}/assignments`, {
            method: 'POST',
            body: { userId, discipline }
          });
          Toast.success(`Successfully assigned to ${discipline}!`);
          modal.close();
          await loadData();
          renderView();
        } catch (err) {
          Toast.danger(`Assignment failed: ${err.message}`);
        }
      }
    });

    const cancelBtn = Button({
      text: 'Cancel',
      variant: 'ghost',
      size: 'sm',
      onClick: () => modal.close()
    });

    const modal = Modal({
      title: `Assign Supervision: ${preselectedProject?.name || 'Project'}`,
      body: formEl,
      footer: [cancelBtn, submitBtn]
    });
  }

  renderView();
  return container;
}
