import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

console.log('====================================================');
console.log(' 🧪 TESTING BLACK THEME ADHERENCE ACROSS ALL COMPONENTS');
console.log('====================================================\n');

// 1. Check CSS Tokens
console.log('--- 1. Testing Design System Tokens (css/tokens.css) ---');
const tokensCss = readFileSync(join(repoRoot, 'css', 'tokens.css'), 'utf8');

assert(/--color-bg:\s*#000000;/.test(tokensCss), '--color-bg is pure black (#000000)');
assert(/--color-surface:\s*#000000;/.test(tokensCss), '--color-surface is pure black (#000000)');
assert(/--color-surface-el:\s*#0A0A0A;/.test(tokensCss), '--color-surface-el is deep black (#0A0A0A)');
assert(/--color-border:\s*#222222;/.test(tokensCss), '--color-border provides crisp delineation (#222222)');
assert(/--color-primary:\s*#E0291D;/.test(tokensCss), '--color-primary is OIL red (#E0291D)');
assert(!/--shadow-glow:[^;]*rgba\(37,\s*99,\s*235/.test(tokensCss), 'No legacy blue glow in tokens');

// 2. Check Base HTML & Body
console.log('\n--- 2. Testing HTML, Body & Shell (css/base.css & index.html) ---');
const baseCss = readFileSync(join(repoRoot, 'css', 'base.css'), 'utf8');
const indexHtml = readFileSync(join(repoRoot, 'index.html'), 'utf8');

assert(/html\s*\{[^}]*background-color:\s*var\(--color-bg\)(?:\s*!important)?;/.test(baseCss), 'html background-color uses var(--color-bg)');
assert(/body\s*\{[^}]*background-color:\s*var\(--color-bg\)(?:\s*!important)?;/.test(baseCss), 'body background-color uses var(--color-bg)');
assert(/<meta name="theme-color" content="#000000">/.test(indexHtml), 'index.html meta theme-color is #000000');
assert(!/select option[^}]*#141414/.test(baseCss), 'select option does not use legacy gray #141414');

// 3. Check Dashboard Layout Shell
console.log('\n--- 3. Testing Logged-In Dashboard Shell (css/layout.css) ---');
const layoutCss = readFileSync(join(repoRoot, 'css', 'layout.css'), 'utf8');

assert(/#app\s*\{[^}]*background-color:\s*var\(--color-bg\)(?:\s*!important)?;/.test(layoutCss), '#app background-color is var(--color-bg)');
assert(/\.app-main\s*\{[^}]*background-color:\s*var\(--color-bg\);/.test(layoutCss), '.app-main workspace background is var(--color-bg)');
assert(/\.app-header\s*\{[^}]*background-color:\s*var\(--color-surface\);/.test(layoutCss), '.app-header background-color is var(--color-surface)');
assert(/\.app-sidebar\s*\{[^}]*background-color:\s*var\(--color-surface\);/.test(layoutCss), '.app-sidebar background-color is var(--color-surface)');
assert(/\.mobile-bottom-nav\s*\{[^}]*background-color:\s*var\(--color-surface\);/.test(layoutCss), '.mobile-bottom-nav background is var(--color-surface)');
assert(!/\.offline-banner\s*\{[^}]*#7C2D12/.test(layoutCss), 'Offline alert banner uses refined black/red theme instead of brown');

// 4. Check All UI Components
console.log('\n--- 4. Testing All Dashboard Components (css/components.css) ---');
const componentsCss = readFileSync(join(repoRoot, 'css', 'components.css'), 'utf8');

assert(/\.card\s*\{[^}]*background-color:\s*var\(--color-surface\);/.test(componentsCss), '.card background-color is var(--color-surface)');
assert(/\.metric-card\s*\{[^}]*background:\s*var\(--color-surface\);/.test(componentsCss), '.metric-card background is var(--color-surface)');
assert(/\.table-container\s*\{[^}]*background:\s*var\(--color-surface\);/.test(componentsCss), '.table-container background is var(--color-surface)');
assert(/\.data-table th\s*\{[^}]*background:\s*var\(--color-surface-el\);/.test(componentsCss), '.data-table th background is var(--color-surface-el)');
assert(/\.modal-content\s*\{[^}]*background:\s*var\(--color-surface\);/.test(componentsCss), '.modal-content background is var(--color-surface)');
assert(/\.timeline-content\s*\{[^}]*background:\s*var\(--color-surface\);/.test(componentsCss), '.timeline-content background is var(--color-surface)');
assert(/\.match-signals\s*\{[^}]*background:\s*var\(--color-surface\);/.test(componentsCss), '.match-signals background is var(--color-surface)');
assert(/\.btn-secondary\s*\{[^}]*background-color:\s*var\(--color-surface-el\);/.test(componentsCss), '.btn-secondary background-color is var(--color-surface-el)');
assert(/\.badge-neutral\s*\{[^}]*background:\s*var\(--color-surface-el\);/.test(componentsCss), '.badge-neutral is defined using surface-el');
assert(!/\.match-card\.recommended\s*\{[^}]*rgba\(37,\s*99,\s*235/.test(componentsCss), 'No blue tint in recommended match cards');
assert(!/\.voice-mic-btn\s*\{[^}]*rgba\(37,\s*99,\s*235/.test(componentsCss), 'No blue shadow in voice mic button');

// 5. Final Summary
console.log('\n====================================================');
console.log(` 🏁 RESULTS: ${passedTests}/${totalTests} tests passed (${failedTests} failures)`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log(' ✨ ALL COMPONENTS CONFIRMED COMPLIANT WITH THE BLACK THEME!\n');
  process.exit(0);
}
