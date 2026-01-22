/**
 * Transformers.js config for browser/extension. Import before @xenova/transformers.
 * Backend-Proxied Hybrid: all model requests go through Groot hf-proxy; remoteHost
 * and remotePathTemplate are overridden in the Service Worker from GROOT_API_URL.
 *
 * @see https://github.com/xenova/transformers.js#documentation
 */

// 1) User-Agent for fetch (Groot proxy adds its own; this covers any direct fallback)
; (function () {
  const g = typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : window);
  if (typeof (g as any).fetch !== 'function') return;
  const nat = (g as any).fetch;
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  (g as any).fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const u = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    const isProxyOrHf = typeof u === 'string' && (u.includes('hf-proxy') || u.includes('huggingface.co') || u.includes('hf.co'));
    if (!isProxyOrHf) return nat.call(g, input, init);

    const h = new Headers(init?.headers);
    if (!h.has('User-Agent')) h.set('User-Agent', ua);

    // Preserve all original init options, including Range headers from Transformers.js
    return nat.call(g, input, {
      ...init,
      headers: h,
      // Transformers.js needs 'omit' or 'include' depending on the platform, 
      // but 'omit' is safest for the Groot proxy/CORS.
      credentials: init?.credentials || 'omit'
    });
  };
})();

// 2) URL.createObjectURL: use self.URL in SW if main URL lacks it
if (typeof URL !== 'undefined' && typeof URL.createObjectURL !== 'function' && (self as any).URL?.createObjectURL) {
  (URL as any).createObjectURL = (self as any).URL.createObjectURL.bind((self as any).URL);
}

import { env } from '@xenova/transformers';
import { indexedDBModelCache } from './indexeddb-model-cache';
import * as ort from 'onnxruntime-web';

// Configure ONNX Runtime environment for extension compatibility
// (SharedArrayBuffer/threading restriction in extensions)
if ((ort as any).env?.wasm) {
  (ort as any).env.wasm.numThreads = 1;
  (ort as any).env.wasm.simd = true; // 1.17.3 has single-threaded SIMD
  (ort as any).env.wasm.proxy = false;
}
if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
  (ort as any).env.wasm.wasmPaths = chrome.runtime.getURL('assets/transformers/');
}

const e = env as any;

// Force proxy path: no local models. remoteHost is set in the Service Worker (background/index.ts)
// to Groot /api/v1/hf-proxy. Do NOT set remoteHost here—it would overwrite that when ml-engine
// imports this file after the background has set it.
e.allowLocalModels = false;
e.cacheDir = 'transformers-cache';
e.quantized = true;
e.remotePathTemplate = '{model}/resolve/{revision}/';

// Persistent caching: IndexedDB so models pulled via Groot are 100% offline-ready after first load
if (typeof indexedDB !== 'undefined') {
  e.useCustomCache = true;
  e.customCache = indexedDBModelCache;
  e.useBrowserCache = false;
} else {
  e.useBrowserCache = true;
}

// WASM Local Bundle: ort-wasm-simd.wasm, ort-wasm.wasm etc. in /assets/transformers/ via chrome.runtime.getURL
if (e.backends?.onnx?.wasm) {
  // Extensions lack SharedArrayBuffer support in most contexts; force single-thread.
  e.backends.onnx.wasm.numThreads = 1;
  e.backends.onnx.wasm.simd = true;
  e.backends.onnx.wasm.proxy = false;

  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    // Ensuring assets/transformers/ path is correctly set
    e.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('assets/transformers/');
  }
}

e.allowWorker = typeof window !== 'undefined';
