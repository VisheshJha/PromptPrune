# Transformers.js Local Asset Bridge

This directory contains ONNX Runtime WASM files for Transformers.js.

## Files

These files are loaded locally instead of from CDN to bypass:
- HuggingFace 401 errors
- CDN availability issues
- Network latency

## Setup

Run: `node scripts/setup-transformers-assets.js`

## Files Included

- `ort-wasm-simd-threaded.wasm` - Core WASM file (12 MB, required)
- `ort-wasm-simd-threaded.jsep.wasm` - JSEP/WebGPU WASM (23 MB, optional)
- `ort-wasm-simd-threaded.jsep.mjs` - JSEP JS wrapper (52 KB, optional)
- `ort-wasm-simd-threaded.mjs` - JS wrapper (20 KB, optional)

**Total Size:** ~35 MB (only 1.75% of Chrome Web Store 2GB limit ✅)

## Version

ONNX Runtime: 1.23.2
Transformers.js: See package.json

## Notes

- Files are loaded via `chrome.runtime.getURL('assets/transformers/')`
- Must be included in `web_accessible_resources` in manifest
- CSP must allow `wasm-unsafe-eval`
