/**
 * Transformers.js Configuration
 * Based on HuggingFace's browser_inference_example.js
 * MUST be imported before any other file that imports @xenova/transformers
 * This ensures the URL template is set before transformers.js initializes
 * 
 * Reference: https://github.com/xenova/transformers.js/blob/main/examples/browser/browser_inference_example.js
 */

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

// Log the configuration to verify it's set correctly
console.log('[TransformersConfig] ✅ Environment configured (based on HuggingFace browser example):', {
  remoteURLTemplate: env.remoteURLTemplate,
  remotePath: env.remotePath,
  allowLocalModels: env.allowLocalModels,
  useBrowserCache: env.useBrowserCache
})

// Verify the configuration is correct
if (env.remoteURLTemplate && !env.remoteURLTemplate.includes('resolve/main')) {
  console.error('[TransformersConfig] ❌ WARNING: remoteURLTemplate does not use resolve/main!')
  console.error('[TransformersConfig] Current template:', env.remoteURLTemplate)
  console.error('[TransformersConfig] This will cause HTML responses instead of raw files!')
}


