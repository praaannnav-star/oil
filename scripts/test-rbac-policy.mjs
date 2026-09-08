import { canAccessRoute, getDefaultRoute, routeMatches } from '../js/services/access-policy.js';

const DEMO_ACCOUNTS = [
  { role: 'Project Manager', allowedRoutes: ['/overview', '/projects', '/projects/new', '/projects/:id', '/progress/new'] },
  { role: 'Admin', allowedRoutes: ['/overview'] },
  { role: 'Executive / GM', allowedRoutes: ['/overview', '/projects', '/projects/:id', '/progress/new'] },
  { role: 'Planner', allowedRoutes: ['/overview', '/projects', '/projects/:id', '/progress/new'] },
  { role: 'Reviewer', allowedRoutes: ['/overview', '/progress/new'] },
  { role: 'Field Supervisor', allowedRoutes: ['/overview', '/progress/new'] }
];

let failures = 0;
function check(name, condition) {
  if (condition) {
    console.log(`PASS ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL ${name}`);
  }
}

check('dynamic project route matches', routeMatches('/projects/:id', '/projects/PRJ-OIL-DUL-001'));
check('new project route is not treated as a project id', !routeMatches('/projects/:id', '/projects/new'));
check('anonymous user cannot access dashboard', !canAccessRoute(null, '/overview'));

for (const account of DEMO_ACCOUNTS) {
  check(`${account.role} can reach its dashboard`, canAccessRoute(account, '/overview'));
  check(`${account.role} has a valid post-login route`, canAccessRoute(account, getDefaultRoute(account)));
  check(`${account.role} can capture progress when granted`, canAccessRoute(account, '/progress/new') === (account.role === 'Admin' || account.allowedRoutes.includes('/progress/new')));
}

const admin = DEMO_ACCOUNTS.find(account => account.role === 'Admin');
check('admin can access an unlisted route', canAccessRoute(admin, '/admin'));

if (failures) process.exitCode = 1;
