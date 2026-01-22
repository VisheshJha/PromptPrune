#!/usr/bin/env node
/**
 * After patch-package applies the onnxruntime-web patch, point the "import"
 * exports to the patched unminified files (ort.mjs, ort.webgpu.mjs) so the
 * Service Worker needPreload fix is used at runtime.
 * Run as: node scripts/fix-onnx-imports.js
 */
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '../node_modules/onnxruntime-web/package.json');
if (!fs.existsSync(pkgPath)) {
  console.warn('[fix-onnx-imports] onnxruntime-web not found, skip');
  process.exit(0);
}

let json = fs.readFileSync(pkgPath, 'utf8');
const before = json;
json = json.replace(
  '"import": "./dist/ort.bundle.min.mjs"',
  '"import": "./dist/ort.mjs"'
);
json = json.replace(
  '"import": "./dist/ort.webgpu.bundle.min.mjs"',
  '"import": "./dist/ort.webgpu.mjs"'
);
// Parcel and others may use "browser" for resolution; point to patched ESM build
json = json.replace(
  '"browser": "dist/ort.min.js"',
  '"browser": "dist/ort.mjs"'
);
if (json !== before) {
  fs.writeFileSync(pkgPath, json, 'utf8');
  console.log('[fix-onnx-imports] Updated onnxruntime-web package.json to use patched ort.mjs / ort.webgpu.mjs');
}
