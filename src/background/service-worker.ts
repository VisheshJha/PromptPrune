/**
 * Background service worker for PromptPrune
 * Handles storage and potential future features like context menu integration
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("PromptPrune extension installed")
  
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
  if (message.type === "SAVE_PROMPT") {
    // Save prompt to storage
    chrome.storage.local.get(["savedPrompts"], (result) => {
      const savedPrompts = result.savedPrompts || []
      savedPrompts.push({
        prompt: message.prompt,
        optimized: message.optimized,
        timestamp: Date.now(),
      })
      
      // Keep only last 50 prompts
      const trimmed = savedPrompts.slice(-50)
      
      chrome.storage.local.set({ savedPrompts: trimmed }, () => {
        sendResponse({ success: true })
      })
    })
    return true // Keep channel open for async response
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

