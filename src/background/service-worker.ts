/**
 * Background service worker for PromptPrune
 * Handles shared model storage and message passing
 */

import { getSharedModelManager } from './model-manager'

// Handle extension install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("PromptPrune extension installed", details.reason)
  
  // Initialize storage with default settings
  chrome.storage.local.set({
    settings: {
      defaultModel: "gpt-4",
      ollamaUrl: "http://localhost:11434",
      ollamaModel: "tinyllama:1.1b",
      requestsPerMonth: 1000,
    },
  })

  // Trigger automatic model download on install/update
  if (details.reason === 'install' || details.reason === 'update') {
    console.log("PromptPrune: Starting shared model download in background...")
    // Download models in background service worker (shared storage)
    startSharedModelDownload()
  }
})

// Also handle browser startup (for existing users)
chrome.runtime.onStartup.addListener(() => {
  console.log("PromptPrune: Browser startup - checking for shared models")
  chrome.storage.local.get(['promptprune-models-ready'], (result) => {
    const modelsReady = result['promptprune-models-ready'] === true
    
    if (!modelsReady) {
      console.log("PromptPrune: Starting shared model download on startup")
      startSharedModelDownload()
    }
  })
})

/**
 * Download models once in background service worker (shared across all platforms)
 */
async function startSharedModelDownload(): Promise<void> {
  console.log('[PromptPrune] 📥 Starting shared model download (once for all platforms)...')
  console.log('[PromptPrune] 📊 This will download ~53MB models to extension storage')
  console.log('[PromptPrune] 📊 Models will be shared across ALL platforms (ChatGPT, Copilot, Gemini, etc.)')
  
  try {
    const startTime = Date.now()
    const modelManager = getSharedModelManager()
    
    // Show progress updates
    chrome.storage.local.set({
      'promptprune-model-download-progress': 0,
      'promptprune-model-download-status': 'downloading'
    })
    
    await modelManager.initialize()
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[PromptPrune] ✅ Shared models ready! (Downloaded in ${duration}s)`)
    console.log('[PromptPrune] ✅ Models are now available for ALL platforms')
    console.log('[PromptPrune] 📊 Storage: ~53MB (shared, not per-platform)')
    
    chrome.storage.local.set({
      'promptprune-models-ready': true,
      'promptprune-model-download-progress': 100,
      'promptprune-model-download-status': 'ready',
      'promptprune-model-download-time': Date.now()
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[PromptPrune] ❌ Shared model download failed:', errorMessage)
    console.error('[PromptPrune] ⚠️ Extension will use regex fallback methods (still works, just less accurate)')
    
    chrome.storage.local.set({
      'promptprune-models-ready': false,
      'promptprune-model-download-attempted': true,
      'promptprune-model-download-status': 'failed',
      'promptprune-model-download-error': errorMessage
    })
  }
}

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle ML model inference requests (shared models)
  if (message.type === "SMART_ANALYSIS") {
    const modelManager = getSharedModelManager()
    
    // Add timeout to prevent hanging (5 seconds max)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Analysis timeout after 5s')), 5000)
    })
    
    Promise.race([
      modelManager.smartAnalysis(message.text),
      timeoutPromise
    ])
      .then(result => {
        sendResponse({ success: true, result })
      })
      .catch(error => {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[ServiceWorker] Smart analysis error:', errorMessage)
        sendResponse({ success: false, error: errorMessage })
      })
    return true // Keep channel open for async response
  }

  if (message.type === "CHECK_MODELS_READY") {
    const modelManager = getSharedModelManager()
    chrome.storage.local.get(['promptprune-models-ready'], (result) => {
      const ready = result['promptprune-models-ready'] === true || modelManager.isReady()
      sendResponse({ ready })
    })
    return true
  }

  if (message.type === "INIT_MODELS") {
    startSharedModelDownload()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }))
    return true
  }

  if (message.type === "SAVE_PROMPT") {
    chrome.storage.local.get(["savedPrompts"], (result) => {
      const savedPrompts = result.savedPrompts || []
      savedPrompts.push({
        prompt: message.prompt,
        optimized: message.optimized,
        timestamp: Date.now(),
      })
      
      const trimmed = savedPrompts.slice(-50)
      chrome.storage.local.set({ savedPrompts: trimmed }, () => {
        sendResponse({ success: true })
      })
    })
    return true
  }

  if (message.type === "GET_SAVED_PROMPTS") {
    chrome.storage.local.get(["savedPrompts"], (result) => {
      sendResponse({ prompts: result.savedPrompts || [] })
    })
    return true
  }

  if (message.type === "CHECK_OLLAMA") {
    fetch("http://localhost:11434/api/tags", {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    })
      .then((response) => {
        sendResponse({ available: response.ok })
      })
      .catch(() => {
        sendResponse({ available: false })
      })
    return true
  }
})

// Optional: Context menu integration for future features
chrome.contextMenus?.create({
  id: "optimize-prompt",
  title: "Optimize with PromptPrune",
  contexts: ["selection"],
})

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "optimize-prompt" && info.selectionText) {
    // Open popup or send to content script
    chrome.runtime.openOptionsPage?.()
  }
})

