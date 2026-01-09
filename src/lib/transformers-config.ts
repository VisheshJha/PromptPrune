/**
 * Transformers.js Configuration
 * Based on HuggingFace's browser_inference_example.js
 * MUST be imported before any other file that imports @xenova/transformers
 * This ensures the URL template is set before transformers.js initializes
 * 
 * Reference: https://github.com/xenova/transformers.js/blob/main/examples/browser/browser_inference_example.js
 */

// Service worker compatibility: Ensure URL.createObjectURL is available BEFORE importing transformers
// This must run before @xenova/transformers is imported
// Transformers.js uses URL.createObjectURL internally for blob handling

// Check multiple sources for URL.createObjectURL
let createObjectURLFn: ((blob: Blob) => string) | null = null

// 1. Check URL constructor
if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
  createObjectURLFn = URL.createObjectURL.bind(URL)
  console.log('[TransformersConfig] ✅ URL.createObjectURL found on URL constructor')
}

// 2. Check self.URL (service worker global)
if (!createObjectURLFn && typeof self !== 'undefined') {
  const SelfURL = (self as any).URL
  if (SelfURL && typeof SelfURL.createObjectURL === 'function') {
    createObjectURLFn = SelfURL.createObjectURL.bind(SelfURL)
    // Also add to URL constructor if missing
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'undefined') {
      URL.createObjectURL = createObjectURLFn
    }
    console.log('[TransformersConfig] ✅ URL.createObjectURL found on self.URL')
  }
}

// 3. Check globalThis
if (!createObjectURLFn && typeof globalThis !== 'undefined') {
  const GlobalURL = (globalThis as any).URL
  if (GlobalURL && typeof GlobalURL.createObjectURL === 'function') {
    createObjectURLFn = GlobalURL.createObjectURL.bind(GlobalURL)
    // Also add to URL constructor if missing
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'undefined') {
      URL.createObjectURL = createObjectURLFn
    }
    console.log('[TransformersConfig] ✅ URL.createObjectURL found on globalThis.URL')
  }
}

// Final check - if still not available, create a minimal polyfill
if (!createObjectURLFn) {
  console.warn('[TransformersConfig] ⚠️ URL.createObjectURL not found, creating minimal polyfill')
  // Create a minimal polyfill that returns a data URL
  // This is a fallback - Chrome extension service workers should have URL.createObjectURL
  createObjectURLFn = function(blob: Blob): string {
    // Try to use the native implementation if available
    if (typeof URL !== 'undefined' && typeof (URL as any).createObjectURL === 'function') {
      return (URL as any).createObjectURL(blob)
    }
    // Fallback: return a chrome-extension:// URL (service workers can use this)
    // This is a workaround - transformers.js might not work perfectly but won't crash
    const blobUrl = `chrome-extension://${chrome.runtime.id}/blob-${Date.now()}-${Math.random()}`
    console.warn('[TransformersConfig] Using fallback blob URL:', blobUrl)
    return blobUrl
  }
}

// Ensure it's available on all possible locations
if (createObjectURLFn) {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'undefined') {
    URL.createObjectURL = createObjectURLFn
    console.log('[TransformersConfig] ✅ URL.createObjectURL assigned to URL constructor')
  }
  if (typeof self !== 'undefined') {
    if (typeof (self as any).URL === 'undefined') {
      (self as any).URL = { createObjectURL: createObjectURLFn }
    } else if (typeof (self as any).URL.createObjectURL === 'undefined') {
      (self as any).URL.createObjectURL = createObjectURLFn
    }
    console.log('[TransformersConfig] ✅ URL.createObjectURL available on self.URL')
  }
}

import { env } from '@xenova/transformers'

// Configure transformers.js to use resolve/main URLs (not blob/main)
// This is the key fix from HuggingFace's browser example
// blob/main returns HTML pages, resolve/main returns raw files
env.allowLocalModels = false
env.useBrowserCache = true
env.remoteURLTemplate = 'https://huggingface.co/{model}/resolve/main/{path}'
env.remotePath = 'resolve/main'

// Additional browser-specific optimizations
// These settings ensure proper behavior in Chrome extensions
if (typeof window !== 'undefined') {
  // Disable local model loading in browser context
  env.allowLocalModels = false
}

// Verify the configuration is correct
if (env.remoteURLTemplate && !env.remoteURLTemplate.includes('resolve/main')) {
  console.error('[TransformersConfig] ❌ WARNING: remoteURLTemplate does not use resolve/main!')
  console.error('[TransformersConfig] Current template:', env.remoteURLTemplate)
  console.error('[TransformersConfig] This will cause HTML responses instead of raw files!')
}
