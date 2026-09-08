#!/usr/bin/env node
/**
 * Utility to generate and insert a new user with PBKDF2-SHA256 password into Cloudflare D1.
 *
 * Usage:
 *   node scripts/add-user.mjs <username> <password> <role> "<name>" "<title>" [remote|local]
 *
 * Example:
 *   node scripts/add-user.mjs site_eng secret456 "Field Supervisor" "Arup Saikia" "Site Engineer - Rig 05" remote
 */
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

const ROLE_ROUTES = {
  'Admin': ['/overview', '/projects', '/projects/:id', '/schedule', '/activities/:id', '/progress', '/progress/new', '/review', '/surveys', '/evidence', '/analytics', '/memory', '/audit', '/admin'],
  'Executive / GM': ['/overview', '/projects', '/projects/:id', '/schedule', '/activities/:id', '/evidence', '/analytics', '/memory', '/audit', '/progress', '/progress/new'],
  'Project Manager': ['/overview', '/manager', '/projects', '/projects/new', '/projects/:id', '/projects/:id/edit', '/schedule', '/activities/:id', '/review', '/surveys', '/evidence', '/analytics', '/memory', '/audit', '/progress', '/progress/new'],
  'Planner': ['/overview', '/projects', '/projects/:id', '/schedule', '/activities/:id', '/review', '/surveys', '/evidence', '/analytics', '/memory', '/audit', '/progress', '/progress/new'],
  'Reviewer': ['/overview', '/schedule', '/activities/:id', '/review', '/surveys', '/evidence', '/audit', '/progress', '/progress/new'],
  'Field Supervisor': ['/overview', '/projects', '/projects/:id', '/progress', '/progress/new', '/surveys', '/evidence', '/activities/:id']
};

const [,, username, password, role, name, title, targetEnv = 'remote'] = process.argv;

if (!username || !password || !role) {
  console.log(`
Usage:
  node scripts/add-user.mjs <username> <password> <role> "<fullName>" "<title>" [remote|local]

Available roles:
  - "Admin"
  - "Executive / GM"
  - "Project Manager"
  - "Planner"
  - "Reviewer"
  - "Field Supervisor"

Example:
  node scripts/add-user.mjs engineer pass2026 "Field Supervisor" "Rohit Bora" "Site Civil Lead" remote
`);
  process.exit(1);
}

// PBKDF2-SHA256 hashing (100,000 iterations, matching worker/src/lib/password.js)
const salt = crypto.randomBytes(16);
const iterations = 100000;
const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
const passwordHash = `pbkdf2$${iterations}$${salt.toString('base64')}$${hash.toString('base64')}`;

const id = `USR-${role.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`;
const allowedRoutes = ROLE_ROUTES[role] || ROLE_ROUTES['Field Supervisor'];
const department = 'Oil India Operations';
const avatar = role.includes('Supervisor') ? '👷‍♂️' : role.includes('Admin') ? '👨‍💼' : role.includes('Exec') ? '👔' : '📐';

const sql = `INSERT INTO users (id, username, password_hash, name, title, role, department, avatar, allowed_routes_json) VALUES ('${id}', '${username.toLowerCase()}', '${passwordHash}', '${name || username}', '${title || role}', '${role}', '${department}', '${avatar}', '${JSON.stringify(allowedRoutes)}');`;

console.log(`\n🔑 Creating User: ${username} (${role})`);
console.log(`👤 ID:       ${id}`);
console.log(`🔒 Hash:     ${passwordHash.slice(0, 30)}...`);

try {
  const flag = targetEnv === 'local' ? '--local' : '--remote';
  console.log(`🚀 Executing D1 insert on ${flag}...`);
  execSync(`npx wrangler d1 execute oil-field-db ${flag} --command="${sql.replace(/"/g, '\\"')}"`, {
    cwd: './worker',
    stdio: 'inherit'
  });
  console.log(`\n✅ User "${username}" successfully added!`);
} catch (err) {
  console.error('\n❌ Failed to insert user into D1:', err.message);
  console.log('\nDirect SQL fallback:');
  console.log(sql);
}
