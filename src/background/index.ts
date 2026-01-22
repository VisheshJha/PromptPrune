/**
 * Background service worker for PromptPrune
 * Handles shared model storage and message passing
 */


// Log immediately when service worker loads
console.log('[ServiceWorker] 🚀 Service worker script loading...')

import type { AuditLogData } from '~/lib/auth-service'

// Keep-alive connection to offscreen document
let offscreenPort: chrome.runtime.Port | null = null;

// API URL setup
const GROOT_BASE_URL_RAW = "__GROOT_API_URL__"
const GROOT_BASE_URL = GROOT_BASE_URL_RAW === "__GROOT_API_URL__"
  ? "http://localhost:8080/api/v1"
  : GROOT_BASE_URL_RAW
const GROOT_AUDIT_URL = `${GROOT_BASE_URL}/extension/sensitive-prompts`

console.log(`[ServiceWorker] 🔧 Groot API URL: ${GROOT_BASE_URL}`)

// --- Offscreen Document Management ---

/**
 * Ensures the offscreen document is created and returns true if successful
 */
async function getOrCreateOffscreenDocument(): Promise<boolean> {
  const existingContexts = await (chrome as any).runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });

  if (existingContexts.length > 0) {
    return true;
  }

  try {
    await (chrome as any).offscreen.createDocument({
      url: chrome.runtime.getURL('tabs/offscreen.html'),
      reasons: ['WORKERS'],
      justification: 'Running local ML models (GLiNER, OpenELM) which require WebAssembly (wasm-unsafe-eval), restricted in Service Workers.',
    });
    console.log('[ServiceWorker] 🖼️ Offscreen document created');

    // Establish keep-alive connection
    offscreenPort = chrome.runtime.connect({ name: 'offscreen-keep-alive' });
    offscreenPort.onDisconnect.addListener(() => {
      console.log('[ServiceWorker] 🔌 Offscreen connection severed');
      offscreenPort = null;
    });

    return true;
  } catch (error) {
    console.error('[ServiceWorker] ❌ Failed to create offscreen document:', error);
    return false;
  }
}

/**
 * Forward to ML Engine via Offscreen Document
 */
async function sendToMLEngine(type: string, payload: any): Promise<any> {
  console.log('[ServiceWorker] ▶ sendToMLEngine forwarding to offscreen:', type);
  try {
    const ready = await getOrCreateOffscreenDocument();
    if (!ready) throw new Error('Offscreen document unavailable');

    const response = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type,
      payload
    });

    console.log('[ServiceWorker] ✅ Response from offscreen:', !!response?.success);
    if (response?.success) {
      return response.result;
    } else {
      throw new Error(response?.error || 'Offscreen ML request failed');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[ServiceWorker] ❌ sendToMLEngine error:', errorMsg);
    throw error;
  }
}

async function sendAuditLogToPortal(data: AuditLogData): Promise<void> {
  // ... (rest of sendAuditLogToPortal remains unchanged)
  const storage = await chrome.storage.local.get("company_config")
  const config = storage.company_config

  if (!config || !config.isValid || !config.companyId) {
    console.warn('[ServiceWorker] ⚠️ Missing or invalid company config')
    throw new Error("Missing company config. Please login to sync with portal.")
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Company-Id": config.companyId
  }

  if (config.webhookSecret) {
    headers["X-Webhook-Secret"] = config.webhookSecret
  }

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
})

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INIT_MODELS') {
    console.log('[ServiceWorker] 📨 INIT_MODELS received → forwarding to ML Engine (fetch will go to Groot hf-proxy)');
  }

  // Forward ML messages to ML Engine Worker
  const mlMessageTypes = ["DETECT_PII_ML", "OPTIMIZE_PROMPT", "CHECK_MODEL_STATUS", "INIT_MODELS", "INIT_PII"];

  if (mlMessageTypes.includes(message.type)) {
    // Map message types to worker message types
    let workerType = message.type;
    let payload = message;

    if (message.type === 'DETECT_PII_ML') {
      workerType = 'VERIFY_PII';
      payload = { text: message.text };
    } else if (message.type === 'OPTIMIZE_PROMPT') {
      workerType = 'OPTIMIZE_PROMPT';
      payload = {
        text: message.text,
        mode: message.mode || 'OPTIMIZE',
        frameworks: message.frameworks
      };
    } else if (message.type === 'CHECK_MODEL_STATUS') {
      workerType = 'CHECK_STATUS';
      payload = {};
    } else if (message.type === 'INIT_MODELS' || message.type === 'INIT_PII') {
      workerType = 'INIT_MODELS';
      payload = { grootBase: GROOT_BASE_URL };
    }

    console.log('[ServiceWorker] ▶ Calling sendToMLEngine(', workerType, ')');
    sendToMLEngine(workerType, payload)
      .then(result => {
        console.log('[ServiceWorker] ✅ sendToMLEngine result:', {
          type: typeof result,
          isString: typeof result === 'string',
          length: typeof result === 'string' ? result.length : 'N/A',
          preview: typeof result === 'string' ? result.substring(0, 100) : result
        });
        // Format response to match expected structure
        if (message.type === 'DETECT_PII_ML') {
          sendResponse({ success: true, result });
        } else if (message.type === 'OPTIMIZE_PROMPT') {
          // Ensure result is a string
          const optimizedText = typeof result === 'string' ? result : (result?.result || String(result || ''));
          console.log('[ServiceWorker] OPTIMIZE_PROMPT sending response:', {
            success: true,
            resultType: typeof optimizedText,
            resultLength: optimizedText.length
          });
          sendResponse({ success: true, result: optimizedText });
        } else if (message.type === 'CHECK_MODEL_STATUS') {
          sendResponse({ success: true, ...result });
        } else {
          sendResponse({ success: true, ...result });
        }
      })
      .catch(error => {
        console.error(`[ServiceWorker] Error forwarding ${message.type} to ML Engine:`, error);
        const errorMsg = error instanceof Error ? error.message : String(error);

        // Provide helpful error message for Worker issues
        if (errorMsg.includes('Worker') || errorMsg.includes('not available')) {
          sendResponse({
            success: false,
            error: 'ML Engine not available. Please reload the extension. If the issue persists, check that CSP allows wasm-unsafe-eval.'
          });
        } else {
          sendResponse({ success: false, error: errorMsg });
        }
      });
    return true; // Keep channel open
  }

  // 5. Backward Compatibility: SMART_ANALYSIS
  if (message.type === "SMART_ANALYSIS") {
    console.warn('[ServiceWorker] SMART_ANALYSIS is deprecated. Please use OPTIMIZE_PROMPT.');
    sendResponse({
      success: true,
      result: {
        sensitive: { isSensitive: false, confidence: 0 },
        spellCheck: { corrected: message.text, corrections: [] },
        framework: { framework: 'general', score: 0, allScores: [] },
        intent: { intent: 'general', confidence: 0, allIntents: [] }
      }
    });
    return true;
  }

  // 6. Standard extension features (Audit Log, Settings, etc.)
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
      .then((response) => sendResponse({ available: response.ok }))
      .catch(() => sendResponse({ available: false }))
    return true
  }

  if (message.type === "AUDIT_LOG") {
    sendAuditLogToPortal(message.data)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true
  }

  return false;
})

// Optional: Context menu integration
chrome.contextMenus?.create({
  id: "optimize-prompt",
  title: "Optimize with PromptPrune",
  contexts: ["selection"],
}, () => {
  if (chrome.runtime.lastError) {
    // Ignore error if item already exists
  }
})

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "optimize-prompt" && info.selectionText) {
    chrome.runtime.openOptionsPage?.()
  }
})



