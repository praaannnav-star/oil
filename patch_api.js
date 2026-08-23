
const fs = require('fs');
let content = fs.readFileSync('js/services/api.js', 'utf8');

// Remove mock imports
content = content.replace(/import { MOCK_.*? } from '\.\.\/data\/mock-.*\.js';\r?\n/g, '');

// Remove SEEDS object completely
content = content.replace(/const SEEDS = \{[\s\S]*?\};\r?\n/, '');

// Fix constructors
content = content.replace(/this\.projects = JSON\.parse\(JSON\.stringify\(MOCK_PROJECTS\)\);/, 'this.projects = [];');
content = content.replace(/this\.activities = JSON\.parse\(JSON\.stringify\(MOCK_ACTIVITIES\)\);/, 'this.activities = [];');
content = content.replace(/this\.reports = JSON\.parse\(JSON\.stringify\(MOCK_REPORTS\)\);/, 'this.reports = [];');
content = content.replace(/this\.evidence = JSON\.parse\(JSON\.stringify\(MOCK_EVIDENCE\)\);/, 'this.evidence = [];');
content = content.replace(/this\.reviewItems = JSON\.parse\(JSON\.stringify\(MOCK_REVIEW_ITEMS\)\);/, 'this.reviewItems = [];');
content = content.replace(/this\.auditLogs = JSON\.parse\(JSON\.stringify\(MOCK_AUDIT_LOG\)\);/, 'this.auditLogs = [];');

// Replace _hydrate
const newHydrate =   async _hydrate() {
    let hasData = false;
    for (const name of COLLECTIONS) {
      try {
        const stored = await DB.getEntity(name);
        if (Array.isArray(stored)) {
          this[name] = stored;
          if (stored.length > 0) hasData = true;
        }
      } catch (err) {
        console.warn(\Entity \ could not be read\, err);
      }
    }
    this._hydrated = true;

    if (!hasData && !this.useMock) {
      import('../sync.js').then(({ Sync }) => {
        if (Sync.pullRemoteState) {
          Sync.pullRemoteState().catch(e => console.warn('Initial remote pull failed', e));
        }
      });
    }
  };

content = content.replace(/async _hydrate\(\) \{[\s\S]*?this\._hydrated = true;\r?\n  \}/, newHydrate);
fs.writeFileSync('js/services/api.js', content, 'utf8');

