/**
 * Background service worker for PromptPrune
 * Handles shared model storage and message passing
 */

// Log immediately when service worker loads
console.log('[ServiceWorker] 🚀 Service worker script loading...')

// CRITICAL: Ensure URL.createObjectURL is available BEFORE any imports
// Chrome extension service workers DO support URL.createObjectURL, but we need to ensure it's accessible
// Transformers.js needs this for blob handling

// Check if URL.createObjectURL exists - Chrome extension service workers should have it
if (typeof URL !== 'undefined') {
  if (typeof URL.createObjectURL === 'function') {
    console.log('[ServiceWorker] ✅ URL.createObjectURL is available')
    // Ensure it's also on self.URL for transformers.js
    if (typeof self !== 'undefined') {
      if (typeof (self as any).URL === 'undefined') {
        (self as any).URL = URL
      } else if (typeof (self as any).URL.createObjectURL === 'undefined') {
        (self as any).URL.createObjectURL = URL.createObjectURL.bind(URL)
      }
    }
  } else {
    // If not available, try to get it from global scope
    console.warn('[ServiceWorker] ⚠️ URL.createObjectURL not found on URL constructor, checking alternatives...')
    const GlobalURL = (typeof self !== 'undefined' ? (self as any).URL : undefined) || 
                      (typeof globalThis !== 'undefined' ? (globalThis as any).URL : undefined)
    
    if (GlobalURL && typeof GlobalURL.createObjectURL === 'function') {
      URL.createObjectURL = GlobalURL.createObjectURL.bind(GlobalURL)
      console.log('[ServiceWorker] ✅ URL.createObjectURL found and assigned from global scope')
    } else {
      // Last resort: Chrome extension service workers should have this, but if not, create a minimal polyfill
      console.error('[ServiceWorker] ❌ URL.createObjectURL not available - this is unexpected in Chrome extension service workers')
      // Note: A real polyfill would need to use IndexedDB or other storage, which is complex
      // For now, transformers.js will fail gracefully and use fallback methods
    }
  }
} else {
  console.error('[ServiceWorker] ❌ URL is not defined - this is unexpected')
}

import { getSharedModelManager } from './model-manager'
import type { AuditLogData } from '~/lib/auth-service'

console.log('[ServiceWorker] ✅ Imports successful')

// Inline audit log sending to avoid import issues
// API URL - replaced at build time by build script
// Default: localhost for development (if placeholder not replaced)
// API URL - replaced at build time by build script
// Default: localhost for development (if placeholder not replaced)
const GROOT_BASE_URL_RAW = "__GROOT_API_URL__"
const GROOT_BASE_URL = GROOT_BASE_URL_RAW === "__GROOT_API_URL__" 
  ? "http://localhost:8080/api/v1" 
  : GROOT_BASE_URL_RAW
const GROOT_AUDIT_URL = `${GROOT_BASE_URL}/extension/sensitive-prompts`

console.log(`[ServiceWorker] 🔧 Groot API URL: ${GROOT_BASE_URL}`)

async function sendAuditLogToPortal(data: AuditLogData): Promise<void> {
  // Get all storage to see what's there
  const allStorage = await chrome.storage.local.get(null)
  console.log('[ServiceWorker] 🔍 All storage keys:', Object.keys(allStorage))
  console.log('[ServiceWorker] 🔍 Storage contents:', allStorage)
  
  const storage = await chrome.storage.local.get("company_config")
  const config = storage.company_config
  
  // Also try to get from Plasmo storage namespace (if it uses a different key)
  if (!config) {
    // Try common Plasmo storage keys
    const plasmoKeys = Object.keys(allStorage).filter(k => k.includes('company') || k.includes('config'))
    console.log('[ServiceWorker] 🔍 Looking for config in keys:', plasmoKeys)
    for (const key of plasmoKeys) {
      console.log(`[ServiceWorker] 🔍 Checking key "${key}":`, allStorage[key])
    }
  }
  
  console.log('[ServiceWorker] 🔍 Checking company config:', {
    hasConfig: !!config,
    configType: typeof config,
    isValid: config?.isValid,
    hasCompanyId: !!config?.companyId,
    companyIdValue: config?.companyId,
    hasWebhookSecret: !!config?.webhookSecret,
    webhookSecretLength: config?.webhookSecret?.length
  })
  
  // Also try reading from Plasmo Storage namespace (if it exists)
  if (!config) {
    console.warn('[ServiceWorker] ⚠️ Config not found in chrome.storage.local, checking other keys...')
    console.log('[ServiceWorker] Available keys:', Object.keys(allStorage))
  }
  
  const hasValidConfig = config && config.isValid && config.companyId
  
  if (!hasValidConfig) {
    console.warn('[ServiceWorker] ⚠️ Missing or invalid company config')
    console.warn('[ServiceWorker] 💡 User needs to login to sync with portal first')
    throw new Error("Missing company config. Please login to sync with portal.")
  }
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  }
  
  if (config.companyId) {
    headers["X-Company-Id"] = config.companyId
  }
  if (config.webhookSecret) {
    headers["X-Webhook-Secret"] = config.webhookSecret
  }
  
  console.log(`[ServiceWorker] 📤 Sending to: ${GROOT_AUDIT_URL}`)
  console.log(`[ServiceWorker] 📤 Headers:`, { 
    "X-Company-Id": config.companyId?.substring(0, 8) + "...",
    "X-Webhook-Secret": config.webhookSecret ? "***" : "missing"
  })
  
  try {
    const response = await fetch(GROOT_AUDIT_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(data)
    })
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }
    
    console.log('[ServiceWorker] ✅ Audit log sent successfully')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[ServiceWorker] ❌ Failed to send audit log:', errorMessage)
    throw error
  }
}

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

  // Trigger automatic model download on install/update (non-blocking)
  if (details.reason === 'install' || details.reason === 'update') {
    console.log("PromptPrune: Starting shared model download in background...")
    // Delay to ensure service worker is fully initialized (non-blocking)
    setTimeout(() => {
      startSharedModelDownload().catch(() => {
        // Silently handle - extension works without models
      })
    }, 2000)
  }
})

// Also handle browser startup (for existing users)
chrome.runtime.onStartup.addListener(() => {
  console.log("PromptPrune: Browser startup - checking for shared models")
  chrome.storage.local.get(['promptprune-models-ready'], (result) => {
    const modelsReady = result['promptprune-models-ready'] === true
    
    if (!modelsReady) {
      console.log("PromptPrune: Starting shared model download on startup")
      // Delay to ensure service worker is ready (non-blocking)
      setTimeout(() => {
        startSharedModelDownload().catch(() => {
          // Silently handle - extension works without models
        })
      }, 2000)
    }
  })
})

/**
 * Download models once in background service worker (shared across all platforms)
 */
// Non-blocking model download - doesn't prevent extension from working
async function startSharedModelDownload(): Promise<void> {
  // Check if already downloaded or in progress (non-blocking check)
  try {
    const storage = await chrome.storage.local.get([
      'promptprune-models-ready',
      'promptprune-model-download-status'
    ])
    
    if (storage['promptprune-models-ready']) {
      console.log('[PromptPrune] ✅ Models already downloaded')
      return
    }
    
    if (storage['promptprune-model-download-status'] === 'downloading') {
      console.log('[PromptPrune] ⏳ Model download already in progress')
      return
    }
  } catch (err) {
    // If storage check fails, continue anyway (non-blocking)
    console.warn('[PromptPrune] Could not check model status, continuing...')
  }
  
  console.log('[PromptPrune] 📥 Starting shared model download (background, non-blocking)...')
  console.log('[PromptPrune] 📊 This will download ~53MB models to extension storage')
  console.log('[PromptPrune] 📊 Models will be shared across ALL platforms (ChatGPT, Copilot, Gemini, etc.)')
  
  try {
    const startTime = Date.now()
    const modelManager = getSharedModelManager()
    
    // Show progress updates (non-blocking)
    chrome.storage.local.set({
      'promptprune-model-download-progress': 0,
      'promptprune-model-download-status': 'downloading'
    }).catch(() => {})
    
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
    }).catch(() => {})
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.warn('[PromptPrune] ⚠️ Model download failed (using regex fallback):', errorMessage)
    console.log('[PromptPrune] 💡 Extension will use regex fallback methods (still works, just less accurate)')
    
    // Mark as failed but don't throw - extension works fine without models
    chrome.storage.local.set({
      'promptprune-models-ready': false,
      'promptprune-model-download-attempted': true,
      'promptprune-model-download-status': 'failed',
      'promptprune-model-download-error': errorMessage
    }).catch(() => {})
    
    // Don't rethrow - extension should continue working without models
  }
}

// Log that service worker is active
console.log('[ServiceWorker] ✅ PromptPrune service worker is active and listening for messages')

// Check if config exists on startup
chrome.storage.local.get("company_config").then((result) => {
  if (result.company_config) {
    console.log('[ServiceWorker] ✅ Company config found on startup:', {
      isValid: result.company_config.isValid,
      companyId: result.company_config.companyId
    })
  } else {
    console.warn('[ServiceWorker] ⚠️ No company config found on startup - user needs to login')
  }
})

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[ServiceWorker] 📨 Received message:', message.type, message)
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

  // Handle audit log messages from content scripts
  if (message.type === "AUDIT_LOG") {
    console.log('[ServiceWorker] 📤 Processing AUDIT_LOG request')
    console.log('[ServiceWorker] 📤 Message data:', message.data)
    const auditData = message.data as AuditLogData
    
    if (!auditData) {
      console.error('[ServiceWorker] ❌ No audit data provided')
      sendResponse({ success: false, error: "No audit data provided" })
      return true
    }
    
    console.log('[ServiceWorker] 📤 Sending audit log to portal:', {
      userEmail: auditData.userEmail,
      platform: auditData.platform,
      riskScore: auditData.riskScore
    })
    
    // Use Promise to handle async properly
    sendAuditLogToPortal(auditData)
      .then(() => {
        console.log('[ServiceWorker] ✅ Audit log sent, sending success response')
        sendResponse({ success: true })
      })
      .catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[ServiceWorker] ❌ Error in sendAuditLogToPortal:', errorMessage)
        sendResponse({ success: false, error: errorMessage })
      })
    
    return true // Keep channel open for async response
  }
  
  // Log unhandled message types for debugging
  console.warn('[ServiceWorker] ⚠️ Unhandled message type:', message.type)
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

