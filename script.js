
const fs = require('fs');
let content = fs.readFileSync('js/services/api.js', 'utf8');
content = content.replace(/import { MOCK_.*? } from '\.\.\/data\/mock-.*\.js';\r?\n/g, '');
fs.writeFileSync('js/services/api.js', content, 'utf8');

