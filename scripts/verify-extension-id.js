#!/usr/bin/env node

/**
 * Verify that the extension ID matches the key in the manifest
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const manifestPath = process.argv[2] || path.join(__dirname, '..', 'build', 'chrome-mv3-prod', 'manifest.json');

if (!fs.existsSync(manifestPath)) {
  console.error('❌ Manifest not found:', manifestPath);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (!manifest.key) {
  console.error('❌ No "key" field found in manifest!');
  console.error('   Make sure package.json → manifest.key is set');
  process.exit(1);
}

console.log('✅ Key found in manifest\n');

// Calculate expected extension ID
const publicKeyDer = Buffer.from(manifest.key, 'base64');
const hash = crypto.createHash('sha256').update(publicKeyDer).digest();
const base32Chars = 'abcdefghijklmnopqrstuvwxyz234567';
let extensionId = '';
for (let i = 0; i < 32; i++) {
  const byte = hash[Math.floor(i * 5 / 8)];
  const bitOffset = (i * 5) % 8;
  let value;
  if (bitOffset <= 3) {
    value = (byte >> (3 - bitOffset)) & 0x1f;
  } else {
    const nextByte = hash[Math.floor(i * 5 / 8) + 1] || 0;
    value = ((byte << (bitOffset - 3)) | (nextByte >> (11 - bitOffset))) & 0x1f;
  }
  extensionId += base32Chars[value];
}

console.log('📋 Expected Extension ID:', extensionId);
console.log('📋 Redirect URI:', `https://${extensionId}.chromiumapp.org/\n`);

console.log('⚠️  IMPORTANT:');
console.log('   If Chrome shows a different ID, it means Chrome is using a cached ID.');
console.log('   Solution:');
console.log('   1. Remove the extension completely from chrome://extensions/');
console.log('   2. Rebuild: npm run build');
console.log('   3. Load it fresh (not reload existing)');
console.log('   4. The ID should now match:', extensionId);

