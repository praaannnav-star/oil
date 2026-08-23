const fs = require('fs');
let content = fs.readFileSync('js/services/auth.js', 'utf8');

const helperCode = \
  _triggerLiveLogin(username, password) {
    if (this._syncTimeout) clearTimeout(this._syncTimeout);
    this._syncTimeout = setTimeout(() => {
      import('./http.js').then(({ ApiHttp }) => {
        ApiHttp.login(username, password)
          .then(() => {
            return import('../sync.js').then(({ Sync }) => {
              if (Sync.pullRemoteState) return Sync.pullRemoteState();
            });
          })
          .catch(err => console.warn('Live API auth background sync:', err.message));
      });
    }, 100);
  }
\;

content = content.replace(/class AuthService \{/, 'class AuthService {\n' + helperCode);
content = content.replace(/import\('\.\/http\.js'\)\.then\(\(\{ ApiHttp \}\) => \{\s*ApiHttp\.login\(byRole\.username, byRole\.password\)\.catch\(err => console\.warn\('Live API auth background sync:', err\.message\)\);\s*\}\);/g, 'this._triggerLiveLogin(byRole.username, byRole.password);');
content = content.replace(/import\('\.\/http\.js'\)\.then\(\(\{ ApiHttp \}\) => \{\s*ApiHttp\.login\(account\.username, account\.password\)\.catch\(err => console\.warn\('Live API auth background sync:', err\.message\)\);\s*\}\);/g, 'this._triggerLiveLogin(account.username, account.password);');
content = content.replace(/import\('\.\/http\.js'\)\.then\(\(\{ ApiHttp \}\) => \{\s*ApiHttp\.login\(target\.username, target\.password\)\.catch\(err => console\.warn\('Live API auth background sync:', err\.message\)\);\s*\}\);/g, 'this._triggerLiveLogin(target.username, target.password);');

fs.writeFileSync('js/services/auth.js', content, 'utf8');
