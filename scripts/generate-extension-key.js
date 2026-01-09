#!/usr/bin/env node

/**
 * Generate RSA key pair for stable Chrome extension ID
 * 
 * This script generates:
 * 1. A private key (extension_key_private.pem) - KEEP SECRET, never commit
 * 2. A public key in base64 format - add to package.json manifest.key
 * 
 * Usage: node scripts/generate-extension-key.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔑 Generating RSA key pair for stable extension ID...\n');

// Generate key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// Convert public key to DER format then base64 (Chrome's format)
const publicKeyDer = crypto.createPublicKey(publicKey).export({ 
  type: 'spki', 
  format: 'der' 
});
const publicKeyBase64 = publicKeyDer.toString('base64');

console.log('✅ Key pair generated successfully!\n');
console.log('📝 Public Key (add to package.json → manifest.key):');
console.log('─'.repeat(80));
console.log(publicKeyBase64);
console.log('─'.repeat(80));
console.log('\n🔒 Private Key (SAVE THIS SECRETLY - never commit to git!):');
console.log('─'.repeat(80));
console.log(privateKey);
console.log('─'.repeat(80));
console.log('\n⚠️  IMPORTANT:');
console.log('   1. Copy the public key above and add it to package.json → manifest.key');
console.log('   2. Save the private key securely (password manager, secure vault)');
console.log('   3. You will need the private key when publishing to Chrome Web Store');
console.log('   4. Never commit the private key to git!\n');

// Calculate what the extension ID will be (for reference)
// Chrome uses: base32(sha256(public_key)) truncated to 32 chars
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

console.log('📋 Predicted Extension ID:', extensionId);
console.log('📋 Redirect URI to register in Google Cloud Console:');
console.log(`   https://${extensionId}.chromiumapp.org/\n`);

