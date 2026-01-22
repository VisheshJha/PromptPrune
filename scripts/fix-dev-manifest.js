#!/usr/bin/env node
/**
 * Ensures chrome-mv3-dev manifest has background.type = "module" so
 * import.meta works in the service worker (onnxruntime-web uses it).
 *
 * Run after `plasmo dev` has done at least one build, then reload the
 * extension:  node scripts/fix-dev-manifest.js
 *
 * For prod, fix-manifest.js sets type: "module" automatically.
 */
const fs = require('fs');
const path = require('path');

const devManifest = path.join(__dirname, '..', 'build', 'chrome-mv3-dev', 'manifest.json');
if (!fs.existsSync(devManifest)) process.exit(0);

let m;
try {
  m = JSON.parse(fs.readFileSync(devManifest, 'utf8'));
} catch (e) {
  process.exit(0);
}

if (m.background && !m.background.type) {
  m.background.type = 'module';
  fs.writeFileSync(devManifest, JSON.stringify(m, null, 2));
  console.log('✅ [fix-dev-manifest] Set background.type = "module"');
}
// Remove 'unsafe-eval' from CSP if present (Chrome MV3 rejects it for extension_pages)
const csp = m.content_security_policy?.extension_pages;
if (typeof csp === 'string' && csp.includes('unsafe-eval')) {
  m.content_security_policy = m.content_security_policy || {};
  m.content_security_policy.extension_pages = csp.replace(/'unsafe-eval'/g, '').replace(/\s+/g, ' ').trim();
  fs.writeFileSync(devManifest, JSON.stringify(m, null, 2));
  console.log('✅ [fix-dev-manifest] Removed unsafe-eval from CSP');
}
