/**
 * Content Script - Inline Icon Button (Grammarly-style)
 * Shows "P" icon inside textarea when focused, with dropdown menu
 */

import type { PlasmoCSConfig } from "plasmo"
import { compressPrompt } from "~/lib/prompt-compressor"
import { applyFramework, rankFrameworks, FRAMEWORKS, type FrameworkType } from "~/lib/prompt-frameworks"
import { getAllTokenCounts } from "~/lib/tokenizers"
import { isFollowUpMessage } from "~/lib/prompt-guide"
import { generateFirstPromptTemplate, generateFollowUpTemplate, shouldPreFillTemplate } from "~/lib/prompt-template"
import { testComplexPrompt, quickTestShorten, quickTestFrameworkSwitching } from "~/lib/prompt-test-runner"

declare global {
  interface Window {
    hasCapsuleListeners?: boolean;
  }
}

import { testSmartOptimizer } from "~/lib/test-smart-optimizer"
import { runAllTests, quickTest, PROMPT_TEST_CASES } from "~/lib/prompt-type-tester"
import { optimizePromptSmartly } from "~/lib/smart-prompt-optimizer"
import { getUnifiedModelManager } from "~/lib/unified-model-manager"
import { showDownloadProgress } from "~/content/model-download-ui"
import { getCapsuleUI } from "~/content/capsule-ui"

import { detectSensitiveContentML, detectSensitiveContentSync } from "~/lib/ml-sensitive-detector"
import { detectSensitiveContent, type SensitiveContentResult } from "~/lib/sensitive-content-detector"

import { RealTimeAssistant } from "~/components/realtime"
import { getPreviewModal } from "~/content/preview-modal"


export const config: PlasmoCSConfig = {
  matches: [
    "https://chat.openai.com/*",
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*",
    "https://gemini.google.com/app/*",
    "https://www.perplexity.ai/*",
    "https://perplexity.ai/*",
    "https://poe.com/*",
    "https://grok.com/*",
    "https://x.com/*",
    "https://twitter.com/*",
    "https://copilot.microsoft.com/*",
    "https://manus.im/*",
    "https://www.deepseek.com/*",
    "https://deepseek.com/*",
    "https://www.midjourney.com/*",
    "https://midjourney.com/*",
    "https://huggingface.co/*",
    "https://*.huggingface.co/*",
    "http://localhost/*",
    "http://127.0.0.1/*"
  ],
  run_at: "document_start", // Run earlier to catch submissions before they happen
}

// PromptPrune content script loaded

// Track icons and dropdowns per textarea

const textAreaCapsules = new WeakMap<HTMLTextAreaElement | HTMLDivElement | HTMLInputElement | HTMLInputElement, any>()
// Basic mode removed - only smart mode now

// Track real-time assistant per textarea
const textAreaRealTimeAssistants = new WeakMap<HTMLTextAreaElement | HTMLDivElement | HTMLInputElement, RealTimeAssistant>()

// Track bypass flags per textarea (to allow submission after "Proceed Anyway")
const textAreaBypassFlags = new WeakMap<HTMLTextAreaElement | HTMLDivElement | HTMLInputElement, { bypass: boolean, timeout: number | null }>()

// Pending ML detection request ID to cancel stale requests (used with requestIdleCallback)
let pendingMLDetectionId = 0

// Track all textareas for finding related ones (since WeakMap doesn't support .keys())
const allTrackedTextAreas = new WeakSet<HTMLTextAreaElement | HTMLDivElement | HTMLInputElement>()

// Get bypass flag helper (needs to be accessible from showSensitiveContentWarning)
const getBypassFlagForTextarea = (textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement) => {
  let flag = textAreaBypassFlags.get(textArea)
  if (!flag) {
    flag = { bypass: false, timeout: null }
    textAreaBypassFlags.set(textArea, flag)
    allTrackedTextAreas.add(textArea)
  }
  return flag
}

  // Helper to update field buttons visibility
  // Field buttons removed - only smart mode now

  // Only smart mode now - basic mode removed
  ; (window as any).__promptprune_analysis_mode = 'smart'
const textAreaFieldButtons = new WeakMap<HTMLTextAreaElement | HTMLDivElement | HTMLInputElement | HTMLInputElement, HTMLElement>()
let frameworkUI: HTMLElement | null = null

// Helper to add element to textareas if valid and not seen
function addIfValid(
  el: HTMLElement,
  textAreas: Array<HTMLTextAreaElement | HTMLDivElement | HTMLInputElement>,
  seen: WeakSet<HTMLElement>
): boolean {
  if (seen.has(el)) return false

  // Skip if already has an icon attached
  if (textAreaCapsules.has(el as HTMLTextAreaElement | HTMLDivElement | HTMLInputElement)) {
    return false
  }

  const rect = el.getBoundingClientRect()
  if (rect.width > 0 && rect.height > 0 && el.offsetParent !== null) {
    seen.add(el)
    textAreas.push(el as HTMLTextAreaElement | HTMLDivElement | HTMLInputElement)
    return true
  }
  return false
}

// Enhanced platform detection
function findTextAreas(): Array<HTMLTextAreaElement | HTMLDivElement | HTMLInputElement> {
  const textAreas: Array<HTMLTextAreaElement | HTMLDivElement | HTMLInputElement> = []
  const seen = new WeakSet<HTMLElement>()

  // ChatGPT - multiple selectors (chat.openai.com and chatgpt.com)
  const chatgptSelectors = [
    "#prompt-textarea",
    "textarea[data-id='root']",
    "textarea[placeholder*='Message']",
    "textarea[placeholder*='message']",
    "textarea[id*='prompt']",
    "textarea[aria-label*='message']",
    "textarea[aria-label*='Message']",
    "textarea[aria-label*='Ask']",
    "textarea[data-testid*='textbox']",
    "textarea[role='textbox']",
    "div[contenteditable='true'][role='textbox']",
    "div[contenteditable='true'][data-id]",
    "textarea",
    "div[contenteditable='true']",
  ]

  for (const selector of chatgptSelectors) {
    const elements = document.querySelectorAll(selector)
    elements.forEach(el => {
      if (el instanceof HTMLTextAreaElement) {
        addIfValid(el, textAreas, seen)
      } else if (el instanceof HTMLDivElement && el.isContentEditable) {
        addIfValid(el, textAreas, seen)
      }
    })
  }

  // Perplexity - specific selectors
  const perplexitySelectors = [
    "textarea[placeholder*='Ask']",
    "textarea[placeholder*='Search']",
    "textarea[data-placeholder]",
    "textarea[aria-label*='Ask']",
    "div[contenteditable='true'][role='textbox']",
    "div[contenteditable='true'][data-placeholder]",
  ]

  for (const selector of perplexitySelectors) {
    const elements = document.querySelectorAll(selector)
    elements.forEach(el => {
      if (el instanceof HTMLTextAreaElement) {
        addIfValid(el, textAreas, seen)
      } else if (el instanceof HTMLDivElement && el.isContentEditable) {
        addIfValid(el, textAreas, seen)
      }
    })
  }

  // Grok (x.com/twitter.com)
  const grokSelectors = [
    "div[contenteditable='true'][role='textbox']",
    "div[data-testid*='tweetTextarea']",
    "div[data-testid*='textInput']",
    "textarea[placeholder*='What']",
  ]

  for (const selector of grokSelectors) {
    const elements = document.querySelectorAll(selector)
    elements.forEach(el => {
      if (el instanceof HTMLDivElement && el.isContentEditable) {
        addIfValid(el, textAreas, seen)
      } else if (el instanceof HTMLTextAreaElement) {
        addIfValid(el, textAreas, seen)
      }
    })
  }

  // Microsoft Copilot
  const copilotSelectors = [
    "textarea[placeholder*='Ask']",
    "textarea[aria-label*='Ask']",
    "textarea[aria-label*='ask']",
    "div[contenteditable='true'][role='textbox']",
    "div[contenteditable='true'][aria-label*='Ask']",
    "div[contenteditable='true'][aria-label*='ask']",
    "textarea[id*='searchbox']",
    "textarea[id*='input']",
    "textarea",
    "div[contenteditable='true']",
  ]

  for (const selector of copilotSelectors) {
    const elements = document.querySelectorAll(selector)
    elements.forEach(el => {
      if (el instanceof HTMLTextAreaElement) {
        addIfValid(el, textAreas, seen)
      } else if (el instanceof HTMLDivElement && el.isContentEditable) {
        addIfValid(el, textAreas, seen)
      }
    })
  }

  // Manus AI
  const manusSelectors = [
    "textarea[placeholder*='What']",
    "textarea[placeholder*='Ask']",
    "div[contenteditable='true']",
    "div[role='textbox']",
  ]

  for (const selector of manusSelectors) {
    const elements = document.querySelectorAll(selector)
    elements.forEach(el => {
      if (el instanceof HTMLTextAreaElement) {
        addIfValid(el, textAreas, seen)
      } else if (el instanceof HTMLDivElement && el.isContentEditable) {
        addIfValid(el, textAreas, seen)
      }
    })
  }

  // Deepseek
  const deepseekSelectors = [
    "textarea[placeholder*='Ask']",
    "textarea[placeholder*='Message']",
    "div[contenteditable='true'][role='textbox']",
  ]

  for (const selector of deepseekSelectors) {
    const elements = document.querySelectorAll(selector)
    elements.forEach(el => {
      if (el instanceof HTMLTextAreaElement) {
        addIfValid(el, textAreas, seen)
      } else if (el instanceof HTMLDivElement && el.isContentEditable) {
        addIfValid(el, textAreas, seen)
      }
    })
  }

  // Midjourney (image generation prompts)
  const midjourneySelectors = [
    "textarea[placeholder*='prompt']",
    "textarea[placeholder*='Prompt']",
    "input[type='text'][placeholder*='prompt']",
    "input[type='text'][placeholder*='Prompt']",
    "div[contenteditable='true'][placeholder*='prompt']",
  ]

  for (const selector of midjourneySelectors) {
    const elements = document.querySelectorAll(selector)
    elements.forEach(el => {
      if (el instanceof HTMLTextAreaElement) {
        addIfValid(el, textAreas, seen)
      } else if (el instanceof HTMLInputElement) {
        addIfValid(el, textAreas, seen)
      } else if (el instanceof HTMLDivElement && el.isContentEditable) {
        addIfValid(el, textAreas, seen)
      }
    })
  }

  // Claude - contenteditable divs
  const claudeSelectors = [
    "div[contenteditable='true'][data-placeholder]",
    "div[contenteditable='true'][placeholder]",
    ".ProseMirror[contenteditable='true']",
  ]

  for (const selector of claudeSelectors) {
    const elements = document.querySelectorAll(selector)
    elements.forEach(el => {
      if (el instanceof HTMLDivElement && el.isContentEditable) {
        addIfValid(el, textAreas, seen)
      }
    })
  }

  // Gemini - expanded selectors
  const geminiSelectors = [
    "textarea[aria-label*='prompt']",
    "textarea[aria-label*='Enter a prompt']",
    "textarea[placeholder*='Enter a prompt']",
    "textarea[placeholder*='prompt']",
    "div[contenteditable='true'][role='textbox']",
    "div[contenteditable='true'][aria-label*='prompt']",
    "textarea[id*='input']",
    "textarea[class*='input']",
  ]

  for (const selector of geminiSelectors) {
    const elements = document.querySelectorAll(selector)
    elements.forEach(el => {
      if (el instanceof HTMLTextAreaElement) {
        addIfValid(el, textAreas, seen)
      } else if (el instanceof HTMLDivElement && el.isContentEditable) {
        addIfValid(el, textAreas, seen)
      }
    })
  }

  return textAreas
}

function getText(element: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement | HTMLInputElement): string {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    return element.value
  }
  return element.innerText || element.textContent || ""
}

function setText(element: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement | HTMLInputElement, text: string): void {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    element.value = text
    element.dispatchEvent(new Event("input", { bubbles: true }))
    element.dispatchEvent(new Event("change", { bubbles: true }))
    element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: " " })) // Poke the UI
  } else {
    // Content-editable handling (Gemini, Claude, GPT)
    // 1. Try to set text content directly
    element.innerText = text

    // 2. Dispatch events that React/Angular often listen to
    element.dispatchEvent(new Event("input", { bubbles: true }))
    element.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, inputType: "insertText", data: text }))

    // 3. Selection management - place cursor at end
    const selection = window.getSelection()
    if (selection) {
      const range = document.createRange()
      range.selectNodeContents(element)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }
}


// Handle menu actions
function handleMenuAction(action: string, textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement) {
  const text = getText(textArea)

  if (!text.trim()) {
    showNotification("Please enter some text first", "warning")
    return
  }



  // Only smart mode now
  switch (action) {
    case "analyze":
      analyzeWithSmartOptimizer(textArea, text)
      break
    case "shorten":
      shortenPrompt(textArea, text).catch(err => {
        console.error("Shorten error:", err)
        showNotification("Shortening failed", "error")
      })
      break
    case "framework":
      showFrameworkSelector(textArea, text)
      break
    case "clear":
      // Clear all text in textarea
      if (textArea instanceof HTMLTextAreaElement || textArea instanceof HTMLInputElement) {
        textArea.value = ""
        textArea.dispatchEvent(new Event("input", { bubbles: true }))
        textArea.dispatchEvent(new Event("change", { bubbles: true }))
      } else {
        textArea.innerText = ""
        textArea.textContent = ""
        textArea.dispatchEvent(new Event("input", { bubbles: true }))
      }
      showNotification("Prompt cleared", "success")
      textArea.focus()
      break
  }
}

// Smart analyzer with ML models
async function analyzeWithSmartOptimizer(textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement, text: string) {
  // Always get the CURRENT text from textarea to ensure we have complete input
  const currentText = getText(textArea).trim()

  // Check if current text is already a framework output
  const isFrameworkOutput = /^(Role:|Action:|Objective:|Goal:|Task:|Context:|Expectation:|Purpose:)/m.test(currentText)

  // Store original prompt - use current text if it's not a framework output
  if (!originalPrompts.has(textArea)) {
    // First time - store current text (complete input)
    originalPrompts.set(textArea, currentText)
  } else if (isFrameworkOutput) {
    // Current text is framework output - use stored original
  } else {
    // User has typed new text - update stored original with complete current text
    originalPrompts.set(textArea, currentText)
  }

  // Use stored original if current is framework output, otherwise use current (complete) text
  const originalPrompt = isFrameworkOutput ? (originalPrompts.get(textArea) || currentText) : currentText

  // Check if shared models are ready (stored in background service worker)
  // Models are downloaded once and shared across all platforms
  const unifiedModel = getUnifiedModelManager()
  let modelReady = unifiedModel.isReady()

  if (!modelReady) {
    // Try to initialize (will check shared models in background service worker)
    try {
      await unifiedModel.initialize()
      modelReady = unifiedModel.isReady()
    } catch (error) {
      console.warn("[PromptPrune] Shared models not ready, using fallback:", error)
    }
  }

  // If models still not ready, use fallback methods
  if (!modelReady) {
    analyzeWithBestFramework(textArea, text)
    return
  }

  showNotification("Analyzing with AI...", "info")

  try {
    // Use smart optimizer
    const result = await optimizePromptSmartly(originalPrompt)

    // Show warnings if any
    if (result.warnings.length > 0) {
      const warningText = result.warnings.slice(0, 3).join(", ")
      showNotification(`⚠️ ${warningText}`, "warning")
    }

    // Apply the improved prompt

    const previewModal = getPreviewModal()
    previewModal.show(originalPrompt, result.improvedPrompt, (newText) => {
      setText(textArea, newText)
      showNotification(
        `✅ Applied ${result.template?.name || 'Smart template'} (${Math.round(result.confidence * 100)}% confidence)`,
        "success"
      )
    })
  } catch (error) {
    console.error("[PromptPrune] Smart analysis failed:", error)
    // Fallback to framework-based analysis
    showNotification("Smart analysis failed, using framework analysis", "warning")
    analyzeWithBestFramework(textArea, text)
  }
}

// Fallback: Analyze with best framework (original method)
function analyzeWithBestFramework(textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement, text: string) {
  // Check if current text is already a framework output (has framework structure)
  const isFrameworkOutput = /^(Role:|Action:|Objective:|Goal:|Task:|Context:|Expectation:|Purpose:)/m.test(text)

  // Store original prompt BEFORE any framework transformation
  // Only store if we don't have one OR if current text is NOT a framework output
  if (!originalPrompts.has(textArea)) {
    // First time - store the current text as original
    originalPrompts.set(textArea, text)
  } else if (isFrameworkOutput) {
    // Current text is framework output - use stored original, don't overwrite
  }

  // Always use original prompt for analysis
  const originalPrompt = originalPrompts.get(textArea) || text

  showNotification("Analyzing...", "info")

  setTimeout(async () => {
    try {
      // Add timeout for HF models (15 seconds max - increased from 10)
      const rankingsPromise = rankFrameworks(originalPrompt)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Analysis timeout")), 15000)
      )

      const rankings = await Promise.race([rankingsPromise, timeoutPromise]) as Awaited<ReturnType<typeof rankFrameworks>>

      if (!rankings || rankings.length === 0) {
        console.error("[PromptPrune] No frameworks ranked - rankings:", rankings)
        showNotification("Unable to analyze prompt - no frameworks matched", "error")
        return
      }

      const bestFit = rankings[0]

      // Always apply framework to original prompt
      const frameworkOutput = await applyFramework(originalPrompt, bestFit.framework)
      const optimized = frameworkOutput.optimized

      if (!optimized || optimized.trim().length === 0) {
        console.error("[PromptPrune] Framework application produced empty output")
        showNotification("Framework application produced empty output", "error")
        return
      }

      const previewModal = getPreviewModal()
      previewModal.show(originalPrompt, optimized, (newText) => {
        setText(textArea, newText)
        showNotification(`Applied ${FRAMEWORKS[bestFit.framework].name} framework`, "success")
      })
    } catch (error) {
      console.error("Analysis error:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"

      // If HF models fail, try fallback without HF
      if (errorMessage.includes("timeout") || errorMessage.includes("transformers")) {
        try {
          // Fallback: use framework selection without HF
          const frameworkRankings = await rankFrameworks(originalPrompt).catch(() => null)
          if (frameworkRankings && frameworkRankings.length > 0) {
            const bestFit = frameworkRankings[0]
            const frameworkOutput = await applyFramework(originalPrompt, bestFit.framework)
            setText(textArea, frameworkOutput.optimized)
            showNotification(`Applied ${FRAMEWORKS[bestFit.framework].name} framework (fallback)`, "success")
            return
          }
        } catch (fallbackError) {
          console.error("Fallback also failed:", fallbackError)
        }
      }

      showNotification(`Analysis failed: ${errorMessage.substring(0, 50)}`, "error")
    }
  }, 100)
}

// Detect platform and model
function detectPlatformAndModel(): { platform: string; model: string } {
  const hostname = window.location.hostname

  if (hostname.includes("openai.com") || hostname.includes("chatgpt.com") || hostname.includes("chat.openai.com")) {
    // Try to detect ChatGPT model from page
    const modelElement = document.querySelector('[data-model-id], [data-model], .model-selector, select[aria-label*="model"]')
    let model = "gpt-4"
    if (modelElement) {
      const modelText = modelElement.textContent || modelElement.getAttribute("data-model-id") || modelElement.getAttribute("data-model") || ""
      if (modelText.toLowerCase().includes("gpt-3.5") || modelText.toLowerCase().includes("3.5")) {
        model = "gpt-3.5-turbo"
      } else if (modelText.toLowerCase().includes("gpt-4")) {
        model = "gpt-4"
      } else if (modelText.toLowerCase().includes("o1")) {
        model = "o1"
      }
    }
    return { platform: "OpenAI", model }
  } else if (hostname.includes("claude.ai") || hostname.includes("anthropic.com")) {
    // Try to detect Claude model
    let model = "claude-3-opus"
    const modelElement = document.querySelector('[data-model], .model-selector, select[aria-label*="model"]')
    if (modelElement) {
      const modelText = modelElement.textContent || modelElement.getAttribute("data-model") || ""
      if (modelText.toLowerCase().includes("sonnet")) {
        model = "claude-3-sonnet"
      } else if (modelText.toLowerCase().includes("haiku")) {
        model = "claude-3-haiku"
      } else if (modelText.toLowerCase().includes("opus")) {
        model = "claude-3-opus"
      }
    }
    return { platform: "Anthropic", model }
  } else if (hostname.includes("gemini.google.com") || hostname.includes("google.com")) {
    return { platform: "Google", model: "gemini-pro" }
  } else if (hostname.includes("perplexity.ai")) {
    // Try to detect Perplexity model
    let model = "sonar-pro"
    const modelElement = document.querySelector('[data-model], .model-selector, select[aria-label*="model"]')
    if (modelElement) {
      const modelText = modelElement.textContent || modelElement.getAttribute("data-model") || ""
      if (modelText.toLowerCase().includes("sonar")) {
        model = modelText.toLowerCase().includes("pro") ? "sonar-pro" : "sonar"
      }
    }
    return { platform: "Perplexity", model }
  } else if (hostname.includes("poe.com")) {
    return { platform: "Poe", model: "gpt-4" }
  } else if (hostname.includes("grok.com") || hostname.includes("x.com") || hostname.includes("twitter.com")) {
    // Try to detect Grok model
    let model = "grok-beta"
    const modelElement = document.querySelector('[data-model], .model-selector, select[aria-label*="model"]')
    if (modelElement) {
      const modelText = modelElement.textContent || modelElement.getAttribute("data-model") || ""
      if (modelText.toLowerCase().includes("grok")) {
        if (modelText.toLowerCase().includes("vision")) {
          model = "grok-vision"
        } else if (modelText.toLowerCase().includes("2")) {
          model = "grok-2"
        } else {
          model = "grok-beta"
        }
      }
    }
    return { platform: "Grok", model }
  } else if (hostname.includes("copilot.microsoft.com")) {
    // Copilot uses GPT-4 by default, but may vary
    let model = "gpt-4"
    const modelElement = document.querySelector('[data-model], .model-selector, select[aria-label*="model"]')
    if (modelElement) {
      const modelText = modelElement.textContent || modelElement.getAttribute("data-model") || ""
      if (modelText.toLowerCase().includes("3.5")) {
        model = "gpt-3.5-turbo"
      } else if (modelText.toLowerCase().includes("4")) {
        model = "gpt-4"
      }
    }
    return { platform: "Microsoft", model }
  } else if (hostname.includes("manus.im")) {
    // Try to detect Manus model
    let model = "manus"
    const modelElement = document.querySelector('[data-model], .model-selector, select[aria-label*="model"]')
    if (modelElement) {
      const modelText = modelElement.textContent || modelElement.getAttribute("data-model") || ""
      if (modelText.toLowerCase().includes("pro")) {
        model = "manus-pro"
      }
    }
    return { platform: "Manus AI", model }
  } else if (hostname.includes("deepseek.com")) {
    // Try to detect Deepseek model
    let model = "deepseek-chat"
    const modelElement = document.querySelector('[data-model], .model-selector, select[aria-label*="model"]')
    if (modelElement) {
      const modelText = modelElement.textContent || modelElement.getAttribute("data-model") || ""
      if (modelText.toLowerCase().includes("coder")) {
        model = "deepseek-coder"
      } else if (modelText.toLowerCase().includes("math")) {
        model = "deepseek-math"
      } else {
        model = "deepseek-chat"
      }
    }
    return { platform: "Deepseek", model }
  } else if (hostname.includes("midjourney.com")) {
    // Try to detect Midjourney version
    let model = "midjourney"
    const modelElement = document.querySelector('[data-version], .version-selector, select[aria-label*="version"]')
    if (modelElement) {
      const versionText = modelElement.textContent || modelElement.getAttribute("data-version") || ""
      if (versionText.toLowerCase().includes("v6") || versionText.toLowerCase().includes("6")) {
        model = "midjourney-v6"
      }
    }
    return { platform: "Midjourney", model }
  }

  // Default to OpenAI GPT-4
  return { platform: "OpenAI", model: "gpt-4" }
}

// Shorten prompt with token reduction display
async function shortenPrompt(textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement, text: string) {
  showNotification("Shortening...", "info")

  try {
    // Use compressPrompt for actual shortening
    const compressed = compressPrompt(text, {
      removeRedundancy: true,
      simplifyPhrases: true,
      preserveKeywords: true,
    })

    // Detect platform and model
    const { platform, model } = detectPlatformAndModel()

    // Calculate token counts
    const [originalCounts, compressedCounts] = await Promise.all([
      getAllTokenCounts(text),
      getAllTokenCounts(compressed),
    ])

    // Get token count for the detected model
    let originalTokens = 0
    let compressedTokens = 0
    let modelKey = ""

    // Map platform/model to tokenizer keys
    // Token counts are organized by provider, then by model
    if (platform === "OpenAI") {
      const openaiOriginal = originalCounts.openai || []
      const openaiCompressed = compressedCounts.openai || []

      if (model.includes("3.5")) {
        modelKey = "gpt-3.5-turbo"
        const orig = openaiOriginal.find(c => c.model.includes("3.5"))
        const comp = openaiCompressed.find(c => c.model.includes("3.5"))
        originalTokens = orig?.count || 0
        compressedTokens = comp?.count || 0
      } else if (model.includes("o1")) {
        modelKey = "o1-preview"
        const orig = openaiOriginal.find(c => c.model.includes("o1"))
        const comp = openaiCompressed.find(c => c.model.includes("o1"))
        originalTokens = orig?.count || 0
        compressedTokens = comp?.count || 0
      } else {
        modelKey = "gpt-4"
        const orig = openaiOriginal.find(c => c.model.includes("gpt-4") && !c.model.includes("3.5"))
        const comp = openaiCompressed.find(c => c.model.includes("gpt-4") && !c.model.includes("3.5"))
        originalTokens = orig?.count || openaiOriginal[0]?.count || 0
        compressedTokens = comp?.count || openaiCompressed[0]?.count || 0
      }
    } else if (platform === "Anthropic") {
      const anthropicOriginal = originalCounts.anthropic || []
      const anthropicCompressed = compressedCounts.anthropic || []

      if (model.includes("sonnet")) {
        modelKey = "claude-3-sonnet"
        const orig = anthropicOriginal.find(c => c.model.includes("sonnet"))
        const comp = anthropicCompressed.find(c => c.model.includes("sonnet"))
        originalTokens = orig?.count || 0
        compressedTokens = comp?.count || 0
      } else if (model.includes("haiku")) {
        modelKey = "claude-3-haiku"
        const orig = anthropicOriginal.find(c => c.model.includes("haiku"))
        const comp = anthropicCompressed.find(c => c.model.includes("haiku"))
        originalTokens = orig?.count || 0
        compressedTokens = comp?.count || 0
      } else {
        modelKey = "claude-3-opus"
        const orig = anthropicOriginal.find(c => c.model.includes("opus"))
        const comp = anthropicCompressed.find(c => c.model.includes("opus"))
        originalTokens = orig?.count || anthropicOriginal[0]?.count || 0
        compressedTokens = comp?.count || anthropicCompressed[0]?.count || 0
      }
    } else if (platform === "Google") {
      modelKey = "gemini-pro"
      const geminiOriginal = originalCounts.gemini || []
      const geminiCompressed = compressedCounts.gemini || []
      originalTokens = geminiOriginal[0]?.count || 0
      compressedTokens = geminiCompressed[0]?.count || 0
    } else if (platform === "Grok") {
      modelKey = model || "grok-beta"
      const grokOriginal = originalCounts.grok || []
      const grokCompressed = compressedCounts.grok || []
      const orig = grokOriginal.find(c => c.model.includes(model.toLowerCase()) || c.model.includes("beta"))
      const comp = grokCompressed.find(c => c.model.includes(model.toLowerCase()) || c.model.includes("beta"))
      originalTokens = orig?.count || grokOriginal[0]?.count || 0
      compressedTokens = comp?.count || grokCompressed[0]?.count || 0
    } else if (platform === "Microsoft") {
      // Copilot uses OpenAI models, so use OpenAI tokenizer
      modelKey = model || "gpt-4"
      const copilotOriginal = originalCounts.copilot || originalCounts.openai || []
      const copilotCompressed = compressedCounts.copilot || compressedCounts.openai || []
      if (model.includes("3.5")) {
        const orig = copilotOriginal.find(c => c.model.includes("3.5"))
        const comp = copilotCompressed.find(c => c.model.includes("3.5"))
        originalTokens = orig?.count || 0
        compressedTokens = comp?.count || 0
      } else {
        const orig = copilotOriginal.find(c => c.model.includes("gpt-4") && !c.model.includes("3.5"))
        const comp = copilotCompressed.find(c => c.model.includes("gpt-4") && !c.model.includes("3.5"))
        originalTokens = orig?.count || copilotOriginal[0]?.count || 0
        compressedTokens = comp?.count || copilotCompressed[0]?.count || 0
      }
    } else if (platform === "Deepseek") {
      modelKey = model || "deepseek-chat"
      const deepseekOriginal = originalCounts.deepseek || []
      const deepseekCompressed = compressedCounts.deepseek || []
      const orig = deepseekOriginal.find(c => c.model.includes(model.toLowerCase()) || c.model.includes("chat"))
      const comp = deepseekCompressed.find(c => c.model.includes(model.toLowerCase()) || c.model.includes("chat"))
      originalTokens = orig?.count || deepseekOriginal[0]?.count || 0
      compressedTokens = comp?.count || deepseekCompressed[0]?.count || 0
    } else if (platform === "Manus AI") {
      modelKey = model || "manus"
      const manusOriginal = originalCounts.manus || []
      const manusCompressed = compressedCounts.manus || []
      const orig = manusOriginal.find(c => c.model.includes(model.toLowerCase()) || c.model.includes("manus"))
      const comp = manusCompressed.find(c => c.model.includes(model.toLowerCase()) || c.model.includes("manus"))
      originalTokens = orig?.count || manusOriginal[0]?.count || 0
      compressedTokens = comp?.count || manusCompressed[0]?.count || 0
    } else if (platform === "Midjourney") {
      modelKey = model || "midjourney"
      const midjourneyOriginal = originalCounts.midjourney || []
      const midjourneyCompressed = compressedCounts.midjourney || []
      const orig = midjourneyOriginal.find(c => c.model.includes(model.toLowerCase()) || c.model.includes("midjourney"))
      const comp = midjourneyCompressed.find(c => c.model.includes(model.toLowerCase()) || c.model.includes("midjourney"))
      originalTokens = orig?.count || midjourneyOriginal[0]?.count || 0
      compressedTokens = comp?.count || midjourneyCompressed[0]?.count || 0
    } else if (platform === "Perplexity") {
      modelKey = model || "sonar-pro"
      const perplexityOriginal = originalCounts.perplexity || []
      const perplexityCompressed = compressedCounts.perplexity || []
      const orig = perplexityOriginal.find(c => c.model.includes(model.toLowerCase()) || c.model.includes("sonar"))
      const comp = perplexityCompressed.find(c => c.model.includes(model.toLowerCase()) || c.model.includes("sonar"))
      originalTokens = orig?.count || perplexityOriginal[0]?.count || 0
      compressedTokens = comp?.count || perplexityCompressed[0]?.count || 0
    } else {
      // Fallback to average across all providers
      const allOriginal: number[] = []
      const allCompressed: number[] = []

      Object.values(originalCounts).forEach(providerCounts => {
        providerCounts.forEach(count => allOriginal.push(count.count))
      })
      Object.values(compressedCounts).forEach(providerCounts => {
        providerCounts.forEach(count => allCompressed.push(count.count))
      })

      originalTokens = allOriginal.length > 0
        ? Math.round(allOriginal.reduce((a, b) => a + b, 0) / allOriginal.length)
        : 0
      compressedTokens = allCompressed.length > 0
        ? Math.round(allCompressed.reduce((a, b) => a + b, 0) / allCompressed.length)
        : 0
    }

    // Apply compressed text
    setText(textArea, compressed)

    // Calculate reductions
    const charReduction = text.length - compressed.length
    const charReductionPercent = Math.round((charReduction / text.length) * 100)
    const tokenReduction = originalTokens - compressedTokens
    const tokenReductionPercent = originalTokens > 0 ? Math.round((tokenReduction / originalTokens) * 100) : 0

    // Show notification with token info
    const modelDisplay = modelKey || model
    if (tokenReduction > 0 && originalTokens > 0) {
      showNotification(
        `Shortened: ${charReductionPercent}% chars, ${tokenReduction} tokens (${tokenReductionPercent}%) saved for ${modelDisplay}`,
        "success"
      )
    } else if (compressedTokens > 0) {
      showNotification(
        `Shortened: ${charReductionPercent}% chars, ${compressedTokens} tokens for ${modelDisplay}`,
        "success"
      )
    } else {
      showNotification(
        `Shortened: ${charReductionPercent}% chars saved`,
        "success"
      )
    }
  } catch (error) {
    console.error("Shorten error:", error)
    showNotification("Shortening failed", "error")
  }
}

// Store original prompt for framework switching
const originalPrompts = new WeakMap<HTMLTextAreaElement | HTMLDivElement | HTMLInputElement, string>()

// Track if role was provided in first prompt (for follow-up detection)
// Use both WeakMap (per textarea) and a global flag (persists across textarea changes)
const roleProvidedInFirstPrompt = new WeakMap<HTMLTextAreaElement | HTMLDivElement | HTMLInputElement, boolean>()
let globalRoleProvided = false // Global flag that persists across textarea changes

// Helper to check if role exists in text
function hasRoleInText(text: string): boolean {
  const rolePatterns = [
    /role:\s*(.+?)(?:\n|$)/i,
    /(?:you are|act as|role|as a|as an|as the)\s+(?:an |a )?([^.,!?\n]+?)(?:\s+who|\s+that|\s+in|$)/i,
  ]
  for (const pattern of rolePatterns) {
    const match = text.match(pattern)
    if (match && match[1] && match[1].trim().length > 2) {
      return true
    }
  }
  return false
}

// Framework suggestion chips (appear below Smart Analysis button)
const textAreaFrameworkSuggestions = new WeakMap<HTMLTextAreaElement | HTMLDivElement | HTMLInputElement, HTMLElement>()

// Context suggestions removed - they were blocking the textarea

function showFrameworkSuggestions(textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement, text: string) {
  // Debounce to avoid too many calls
  const suggestionKey = `framework-suggestions-${textArea.id || 'default'}`
  const lastCall = (window as any)[suggestionKey]
  const now = Date.now()
  if (lastCall && now - lastCall < 1000) {
    return // Debounce: only update once per second
  }
  ; (window as any)[suggestionKey] = now

  // Get or create suggestions container
  let suggestionsContainer = textAreaFrameworkSuggestions.get(textArea)
  if (!suggestionsContainer) {
    suggestionsContainer = document.createElement("div")
    suggestionsContainer.id = `promptprune-framework-suggestions-${textArea.id || Math.random()}`
    suggestionsContainer.style.cssText = `
      position: fixed;
        z-index: 9999;
      display: flex;
      gap: 8px;
        background: white;
        padding: 4px;
        border-radius: 999px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        border: 1px solid #e5e7eb;
        pointer-events: auto;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `
    document.body.appendChild(suggestionsContainer)
    textAreaFrameworkSuggestions.set(textArea, suggestionsContainer)
  }

  // Position below Smart Analysis button
  // Position below P icon
  // The capsule UI is now responsible for positioning itself relative to the textarea.
  // Framework suggestions will be positioned relative to the capsule.
  // For now, we'll just position it generally below the textarea.
  // Position below the capsule using fixed positioning
  // This ensures it never gets cut off or blocks the input in a weird way
  const textAreaRect = textArea.getBoundingClientRect()

  // Calculate fixed position
  const left = textAreaRect.left
  const top = textAreaRect.bottom + 50 // clearly below

  suggestionsContainer.style.left = `${left}px`
  suggestionsContainer.style.top = `${top}px`




  // Get top 2-3 framework suggestions
  rankFrameworks(text).then(rankings => {
    const topFrameworks = rankings.slice(0, 3)
    suggestionsContainer.innerHTML = ""

    topFrameworks.forEach((rank, index) => {
      const framework = FRAMEWORKS[rank.framework]
      const chip = document.createElement("button")
      chip.style.cssText = `
        padding: 4px 10px;
        border-radius: 999px;
        background: ${index === 0 ? '#10b981' : '#f3f4f6'};
        color: ${index === 0 ? 'white' : '#4b5563'};
        border: 1px solid ${index === 0 ? '#059669' : '#e5e7eb'};
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
        white-space: nowrap;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      `

      let innerHTML = `<span>${framework.icon} ${framework.name}</span>`

      if (index === 0) {
        innerHTML += `
          <span style="
            background: rgba(255,255,255,0.2); 
            padding: 1px 5px; 
            border-radius: 4px; 
            font-size: 9px; 
            font-weight: 700;
            letter-spacing: 0.5px;
          ">BEST</span>
        `
      }

      chip.innerHTML = innerHTML

      // Tooltip for description
      chip.title = `${framework.description}`

      chip.addEventListener("click", async (e) => {
        e.stopPropagation()
        const originalPrompt = originalPrompts.get(textArea) || text
        const frameworkOutput = await applyFramework(originalPrompt, rank.framework)

        const previewModal = getPreviewModal()
        previewModal.show(originalPrompt, frameworkOutput.optimized, (newText) => {
          setText(textArea, newText)
          showNotification(`Applied ${framework.name}`, "success")
          hideFrameworkSuggestions(textArea)
        })
      })

      chip.addEventListener("mouseenter", () => {
        chip.style.transform = "translateY(-1px)"
        chip.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)"
        if (index !== 0) chip.style.background = "#e5e7eb"
      })

      chip.addEventListener("mouseleave", () => {
        chip.style.transform = "translateY(0)"
        chip.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)"
        if (index !== 0) chip.style.background = "#f3f4f6"
      })

      suggestionsContainer.appendChild(chip)
    })

    suggestionsContainer.style.display = "flex"
  }).catch(err => {
    console.error("[PromptPrune] Error getting framework suggestions:", err)
  })
}

function hideFrameworkSuggestions(textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement) {
  const suggestionsContainer = textAreaFrameworkSuggestions.get(textArea)
  if (suggestionsContainer) {
    suggestionsContainer.style.display = "none"
  }
}

// Context suggestions completely removed - they were blocking the textarea and not user-friendly

// Show framework selector
function showFrameworkSelector(textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement, text: string) {
  // Store the original prompt when first opening (before any framework transformation)
  // If we don't have a stored original, use the current text as the original
  if (!originalPrompts.has(textArea)) {
    originalPrompts.set(textArea, text)
  }

  // Always use the stored original prompt for framework analysis
  const originalPrompt = originalPrompts.get(textArea) || text

  if (!frameworkUI) {
    frameworkUI = createFrameworkUI(textArea)
    document.body.appendChild(frameworkUI)
  }

  const content = frameworkUI.querySelector("#promptprune-framework-content")!
  content.innerHTML = "<div style='text-align: center; padding: 20px;'>⏳ Analyzing frameworks...</div>"
  frameworkUI.style.display = "block"

  setTimeout(async () => {
    try {
      // Always use original prompt for ranking and framework application
      const rankings = await rankFrameworks(originalPrompt)

      // Clear content first
      content.innerHTML = ""

      rankings.forEach((rank, index) => {
        const framework = FRAMEWORKS[rank.framework]
        const isTop = index === 0

        const frameworkCard = document.createElement("div")
        frameworkCard.style.cssText = `
          margin-bottom: 12px;
          padding: 12px;
          border: 2px solid ${isTop ? '#10b981' : '#e5e7eb'};
          border-radius: 8px;
          background: ${isTop ? '#f0fdf4' : 'white'};
          cursor: pointer;
          transition: all 0.2s;
        `

        frameworkCard.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <div>
              <strong style="font-size: 14px;">${framework.icon} ${framework.name}</strong>
              ${isTop ? '<span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">BEST FIT</span>' : ''}
            </div>
            <span style="color: #6b7280; font-size: 12px;">Score: ${rank.score.toFixed(1)}</span>
          </div>
          <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">${framework.description}</div>
          <div style="font-size: 11px; color: #9ca3af; margin-bottom: 8px;">${framework.useCase}</div>
          <div style="font-size: 11px; color: #6b7280; background: #f9fafb; padding: 8px; border-radius: 4px; margin-top: 8px; max-height: 100px; overflow-y: auto; font-family: monospace; white-space: pre-wrap; word-break: break-word;">
            ${rank.output.optimized.substring(0, 200)}${rank.output.optimized.length > 200 ? '...' : ''}
          </div>
        `

        // Add hover effects
        frameworkCard.addEventListener("mouseenter", () => {
          frameworkCard.style.background = "#f9fafb"
        })
        frameworkCard.addEventListener("mouseleave", () => {
          frameworkCard.style.background = isTop ? "#f0fdf4" : "white"
        })

        // Add click handler
        frameworkCard.addEventListener("click", async () => {
          // CRITICAL: Always use the stored original prompt, never the current textarea content
          // This prevents framework-to-framework duplication of words like "action", "you are", etc.
          let originalPrompt = originalPrompts.get(textArea)

          if (!originalPrompt) {
            // If no stored original, store the current text as original before applying framework
            const currentText = getText(textArea).trim()
            if (currentText) {
              originalPrompts.set(textArea, currentText)
              originalPrompt = currentText
            } else {
              originalPrompt = text
            }
          }

          // Verify we're using original, not framework output

          // Apply framework to the ORIGINAL prompt only
          const frameworkOutput = await applyFramework(originalPrompt, rank.framework)
          const optimized = frameworkOutput.optimized
          setText(textArea, optimized)
          if (frameworkUI) {
            frameworkUI.style.display = "none"
          }
          showNotification(`Applied ${framework.name} framework`, "success")
        })

        content.appendChild(frameworkCard)
      })
    } catch (error) {
      console.error("Framework selection error:", error)
      content.innerHTML = "<div style='text-align: center; padding: 20px; color: #ef4444;'>Error loading frameworks</div>"
    }
  }, 300)
}

// Create framework UI
function createFrameworkUI(textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement): HTMLElement {
  const container = document.createElement("div")
  container.id = "promptprune-framework-ui"
  container.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 400px;
    max-height: 600px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    z-index: 999998;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: none;
    overflow: hidden;
  `

  const header = document.createElement("div")
  header.style.cssText = `
    padding: 16px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `
  header.innerHTML = `
    <h3 style="margin: 0; font-size: 16px; font-weight: 600;">✨ Choose Framework</h3>
    <button id="promptprune-close" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #6b7280;">×</button>
  `

  const content = document.createElement("div")
  content.style.cssText = `
    padding: 16px;
    max-height: 500px;
    overflow-y: auto;
  `
  content.id = "promptprune-framework-content"

  container.appendChild(header)
  container.appendChild(content)

  header.querySelector("#promptprune-close")?.addEventListener("click", () => {
    container.style.display = "none"
    // Keep icon visible when closing framework UI
    // No longer managing icon visibility here as it's handled by Capsule UI
  })

  return container
}

// Show minimal notification (for template pre-fill)
function showMinimalNotification(message: string) {
  // Remove existing minimal notification
  const existing = document.getElementById("promptprune-minimal-notification")
  if (existing) {
    existing.remove()
  }

  const notification = document.createElement("div")
  notification.id = "promptprune-minimal-notification"
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    padding: 8px 12px;
    background: rgba(16, 185, 129, 0.95);
    color: white;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 1000001;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 12px;
    font-weight: 500;
    max-width: 280px;
    animation: slideInMinimal 0.3s ease-out;
    backdrop-filter: blur(10px);
  `

  // Add animation
  const style = document.createElement("style")
  style.textContent = `
    @keyframes slideInMinimal {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `
  if (!document.head.querySelector("#promptprune-minimal-notification-style")) {
    style.id = "promptprune-minimal-notification-style"
    document.head.appendChild(style)
  }

  notification.textContent = message
  document.body.appendChild(notification)

  // Auto-remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = "slideInMinimal 0.3s ease-out reverse"
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove()
      }
    }, 300)
  }, 3000)
}

// Find submit button for a textarea
function findSubmitButton(textArea: HTMLElement): HTMLElement | null {
  // Common selectors for submit buttons across platforms
  // IMPORTANT: Exclude navigation buttons and links
  const selectors = [
    'button[type="submit"]:not([role="link"]):not([title*="home"]):not([title*="Home"])',
    'button[aria-label*="Send"]:not([role="link"]):not([title*="home"]):not([title*="Home"])',
    'button[aria-label*="send"]:not([role="link"]):not([title*="home"]):not([title*="Home"])',
    'button[data-testid*="send"]:not([role="link"]):not([title*="home"]):not([title*="Home"])',
    'button[title*="Send"]',
    'button:has(svg)', // Many platforms use SVG icons
    '[role="button"][aria-label*="Send"]',
    'button.send-button',
    'button.submit-button',
    'form button[type="submit"]'
  ]

  // Search in parent form or nearby
  let parent = textArea.parentElement
  let depth = 0
  while (parent && depth < 5) {
    for (const selector of selectors) {
      const button = parent.querySelector(selector)
      if (button && button instanceof HTMLElement) {
        // Exclude navigation buttons
        const text = button.textContent?.toLowerCase() || ''
        const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || ''
        const title = button.getAttribute('title')?.toLowerCase() || ''
        const role = button.getAttribute('role') || ''

        // Skip if it's a navigation button
        if (role === 'link' || title.includes('home') || title.includes('copilot home') ||
          text.includes('home') || ariaLabel.includes('home')) {
          continue
        }

        // Make sure it's actually a submit button (has text like "Send", "Submit", or icon/arrow)
        const hasSendText = text.includes('send') || ariaLabel.includes('send') || ariaLabel.includes('submit')
        const hasSvg = button.querySelector('svg') !== null
        const isArrowButton = hasSvg && (button.closest('form') || button.closest('div[class*="input"], div[class*="textarea"], div[class*="chat"]'))

        if (hasSendText || hasSvg || isArrowButton) {
          return button
        }
      }
    }
    parent = parent.parentElement
    depth++
  }

  // Fallback: search entire document
  for (const selector of selectors) {
    const buttons = document.querySelectorAll(selector)
    for (const button of buttons) {
      if (button instanceof HTMLElement) {
        // Exclude navigation buttons
        const text = button.textContent?.toLowerCase() || ''
        const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || ''
        const title = button.getAttribute('title')?.toLowerCase() || ''
        const role = button.getAttribute('role') || ''

        // Skip if it's a navigation button
        if (role === 'link' || title.includes('home') || title.includes('copilot home') ||
          text.includes('home') || ariaLabel.includes('home')) {
          continue
        }

        // Check if it's near the textarea (same form or container)
        const form = textArea.closest('form')
        const buttonForm = button.closest('form')
        const isNearTextarea = (form && form === buttonForm) ||
          (textArea.closest('div[class*="input"], div[class*="textarea"], div[class*="chat"]') &&
            button.closest('div[class*="input"], div[class*="textarea"], div[class*="chat"]') &&
            textArea.closest('div[class*="input"], div[class*="textarea"], div[class*="chat"]') ===
            button.closest('div[class*="input"], div[class*="textarea"], div[class*="chat"]'))

        if ((text.includes('send') || ariaLabel.includes('send') || button.querySelector('svg')) && isNearTextarea) {
          return button
        }
      }
    }
  }

  return null
}

// Show sensitive content warning modal
function showSensitiveContentWarning(
  textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement,
  text: string,
  sensitiveCheck: Awaited<ReturnType<typeof detectSensitiveContentML>>
) {
  // Show sensitive content warning modal

  // Double-check that we have sensitive content
  if (!sensitiveCheck.hasSensitiveContent || sensitiveCheck.detectedItems.length === 0) {
    console.warn("[PromptPrune] WARNING: showSensitiveContentWarning called but no sensitive content detected!")
    return
  }

  // Remove existing warning if any
  const existing = document.getElementById("promptprune-sensitive-warning")
  if (existing) {
    existing.remove()
  }

  // Create modal overlay
  const overlay = document.createElement("div")
  overlay.id = "promptprune-sensitive-warning"
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10000000;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.2s ease-out;
  `

  // Create modal content - simplified, modern design
  const modal = document.createElement("div")
  modal.style.cssText = `
    background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
    border-radius: 16px;
    padding: 32px;
    max-width: 480px;
    width: 90%;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: slideUp 0.3s ease-out;
    border: 1px solid rgba(220, 38, 38, 0.1);
  `

  // Header - simplified
  const header = document.createElement("div")
  header.style.cssText = `
    text-align: center;
    margin-bottom: 24px;
  `

  const icon = document.createElement("div")
  icon.textContent = "🔒"
  icon.style.cssText = `
    font-size: 48px;
    margin-bottom: 12px;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
  `

  const title = document.createElement("h2")
  title.textContent = "Sensitive Information Detected"
  title.style.cssText = `
    margin: 0 0 8px 0;
    font-size: 22px;
    font-weight: 700;
    color: #111827;
    letter-spacing: -0.02em;
  `

  const subtitle = document.createElement("div")
  subtitle.textContent = "Your prompt contains information that should not be shared"
  subtitle.style.cssText = `
    color: #6b7280;
    font-size: 14px;
    line-height: 1.5;
  `

  header.appendChild(icon)
  header.appendChild(title)
  header.appendChild(subtitle)

  // Risk indicator - simplified
  const riskBadge = document.createElement("div")
  const riskLevel = sensitiveCheck.riskScore >= 70 ? 'Critical' : sensitiveCheck.riskScore >= 50 ? 'High' : 'Moderate'
  const riskColor = sensitiveCheck.riskScore >= 70 ? '#dc2626' : sensitiveCheck.riskScore >= 50 ? '#f59e0b' : '#3b82f6'
  const riskBg = sensitiveCheck.riskScore >= 70 ? '#fee2e2' : sensitiveCheck.riskScore >= 50 ? '#fef3c7' : '#dbeafe'

  riskBadge.style.cssText = `
    background: ${riskBg};
    color: ${riskColor};
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    display: inline-block;
    margin-bottom: 20px;
    text-align: center;
    width: 100%;
    box-sizing: border-box;
  `
  riskBadge.textContent = `${riskLevel} Risk Detected`
  modal.appendChild(riskBadge)

  // Compliance Classifications - NEW
  if (sensitiveCheck.classifications && sensitiveCheck.classifications.length > 0) {
    const complianceDiv = document.createElement("div")
    complianceDiv.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 20px;
      justify-content: center;
    `
    sensitiveCheck.classifications.forEach((cls: string) => {
      const clsBadge = document.createElement("span")
      clsBadge.style.cssText = `

        background: #f3f4f6;
        color: #374151;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        border: 1px solid #e5e7eb;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      `
      clsBadge.textContent = cls
      complianceDiv.appendChild(clsBadge)
    })
    modal.appendChild(complianceDiv)
  }


  // Warning message - simplified
  const warningMsg = document.createElement("div")
  warningMsg.style.cssText = `
    background: #fef2f2;
    border-left: 4px solid #dc2626;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 20px;
  `
  warningMsg.innerHTML = `
    <div style="color: #991b1b; font-size: 14px; line-height: 1.6; font-weight: 500;">
      Sharing this information could lead to security breaches, privacy violations, or identity theft.
    </div>
  `

  // Detected items list - simplified
  const detectedList = document.createElement("div")
  detectedList.style.cssText = `
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 24px;
    max-height: 240px;
    overflow-y: auto;
  `

  if (sensitiveCheck.detectedItems.length > 0) {
    sensitiveCheck.detectedItems.slice(0, 5).forEach((item: any) => {
      const itemDiv = document.createElement("div")
      itemDiv.style.cssText = `

        padding: 12px;
        margin-bottom: 8px;
        background: #f9fafb;
        border-radius: 8px;
        font-size: 13px;
        border: 1px solid ${item.severity === 'high' ? '#fee2e2' : item.severity === 'medium' ? '#fef3c7' : '#dbeafe'};
      `
      // Clean up type name for display - remove "Standalone" suffix and format nicely
      let typeName = item.type.replace(/_/g, ' ').replace(/\b\w/g, (char: string) => char.toUpperCase())
      typeName = typeName.replace(/Standalone/gi, '').trim()

      // Handle special cases
      if (typeName.toLowerCase().includes('aadhaar')) typeName = 'Aadhaar Number'
      if (typeName.toLowerCase().includes('pan')) typeName = 'PAN Card'
      if (typeName.toLowerCase().includes('upi')) typeName = 'UPI ID'
      if (typeName.toLowerCase().includes('ifsc')) typeName = 'IFSC Code'
      if (typeName.toLowerCase().includes('gstin')) typeName = 'GSTIN'
      if (typeName.toLowerCase().includes('voter id')) typeName = 'Voter ID'
      if (typeName.toLowerCase().includes('driver license')) typeName = 'Driver License'
      if (typeName.toLowerCase().includes('credit card')) typeName = 'Credit Card'
      if (typeName.toLowerCase().includes('bank account')) typeName = 'Bank Account'
      if (typeName.toLowerCase().includes('api key')) typeName = 'API Key'
      if (typeName.toLowerCase().includes('phone')) typeName = 'Phone Number'
      itemDiv.innerHTML = `
        <div style="font-weight: 600; color: #111827; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: ${item.severity === 'high' ? '#dc2626' : item.severity === 'medium' ? '#f59e0b' : '#3b82f6'};"></span>
          ${typeName}
        </div>
        <div style="color: #6b7280; font-size: 12px; line-height: 1.4;">${item.suggestion.replace(/🚨|⚠️/g, '').trim()}</div>
      `
      detectedList.appendChild(itemDiv)
    })

    if (sensitiveCheck.detectedItems.length > 5) {
      const moreDiv = document.createElement("div")
      moreDiv.style.cssText = `
        text-align: center;
        color: #6b7280;
        font-size: 12px;
        padding-top: 8px;
        font-weight: 500;
      `
      moreDiv.textContent = `+${sensitiveCheck.detectedItems.length - 5} more sensitive items found`
      detectedList.appendChild(moreDiv)
    }

  }

  // Buttons - improved design
  const buttons = document.createElement("div")
  buttons.style.cssText = `
    display: flex;
    gap: 12px;
    justify-content: stretch;
  `

  const cancelBtn = document.createElement("button")
  cancelBtn.textContent = "Edit Prompt"
  cancelBtn.style.cssText = `
    flex: 1;
    padding: 12px 24px;
    background: #ffffff;
    color: #374151;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
  `
  cancelBtn.onmouseover = () => {
    cancelBtn.style.background = "#f9fafb"
    cancelBtn.style.borderColor = "#d1d5db"
  }
  cancelBtn.onmouseout = () => {
    cancelBtn.style.background = "#ffffff"
    cancelBtn.style.borderColor = "#e5e7eb"
  }
  cancelBtn.onclick = () => {
    document.removeEventListener('keydown', modalKeyHandler, { capture: true })
    overlay.remove()
    textArea.focus()
  }

  const maskBtn = document.createElement("button")
  maskBtn.textContent = "Mask Sensitive Data"
  maskBtn.style.cssText = `
    flex: 1;
    padding: 12px 24px;
    background: #4f46e5;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
    box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);
  `
  maskBtn.onmouseover = () => {
    maskBtn.style.background = "#4338ca"
    maskBtn.style.transform = "translateY(-1px)"
  }
  maskBtn.onmouseout = () => {
    maskBtn.style.background = "#4f46e5"
    maskBtn.style.transform = "translateY(0)"
  }
  maskBtn.onclick = async () => {
    document.removeEventListener('keydown', modalKeyHandler, { capture: true })
    overlay.remove()
    // Call mask logic - properly handle async
    try {
      await maskSensitiveData(textArea)
    } catch (error) {
      console.error("[PromptPrune] Masking failed:", error)
      showNotification("Masking failed. Please try again.", "error")
    }
  }

  const proceedBtn = document.createElement("button")
  proceedBtn.textContent = "Proceed Anyway"
  proceedBtn.style.cssText = `
    flex: 1;
    padding: 12px 24px;
    background: ${sensitiveCheck.riskScore >= 70 ? '#dc2626' : '#f59e0b'};
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
    opacity: 0.9;
  `
  proceedBtn.onmouseover = () => {
    proceedBtn.style.opacity = "1"
    proceedBtn.style.transform = "translateY(-1px)"
    proceedBtn.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)"
  }
  proceedBtn.onmouseout = () => {
    proceedBtn.style.opacity = "0.9"
    proceedBtn.style.transform = "translateY(0)"
    proceedBtn.style.boxShadow = "none"
  }
  proceedBtn.onclick = (e) => {
    e.stopPropagation()
    e.stopImmediatePropagation()

    // Remove modal key handler first
    document.removeEventListener('keydown', modalKeyHandler, { capture: true })

    // Set bypass flag to allow submission for this textarea
    const bypassFlag = getBypassFlagForTextarea(textArea)
    bypassFlag.bypass = true

    // Remove modal first
    overlay.remove()

    // Clear bypass after a longer delay (enough for submission to go through)
    if (bypassFlag.timeout) clearTimeout(bypassFlag.timeout)
    bypassFlag.timeout = window.setTimeout(() => {
      bypassFlag.bypass = false
    }, 5000) // Increased to 5 seconds to ensure submission completes

    // Allow the original submission to proceed - use a small delay to ensure modal is removed
    setTimeout(() => {
      // Try to find the correct submit button - be more specific
      const submitBtn = findSubmitButton(textArea)
      if (submitBtn) {
        // Verify it's actually a submit button and not a navigation button
        const btnText = submitBtn.textContent?.toLowerCase() || ''
        const btnTitle = submitBtn.getAttribute('title')?.toLowerCase() || ''
        const btnAriaLabel = submitBtn.getAttribute('aria-label')?.toLowerCase() || ''
        const btnRole = submitBtn.getAttribute('role') || ''
        const isNavigationBtn = btnText.includes('home') || btnTitle.includes('home') ||
          btnAriaLabel.includes('home') || btnTitle.includes('copilot home') ||
          btnRole === 'link' ||
          submitBtn.closest('a') !== null

        if (isNavigationBtn) {
          // Submit the form directly instead of using Enter key
          const form = textArea.closest('form')
          if (form) {
            form.requestSubmit()
          } else {
            // Fallback: trigger native submit on textarea
            if (textArea instanceof HTMLTextAreaElement || textArea instanceof HTMLInputElement) {
              textArea.form?.requestSubmit()
            }
          }
        } else {
          // Create a synthetic click that won't cause navigation
          const syntheticClick = new MouseEvent('click', {
            bubbles: true,
            cancelable: false,
            view: window,
            button: 0
          })
          submitBtn.dispatchEvent(syntheticClick)
        }
      } else {
        // Instead of dispatching Enter (which triggers detection again), submit the form directly
        const form = textArea.closest('form')
        if (form) {
          form.requestSubmit()
        } else if (textArea instanceof HTMLTextAreaElement || textArea instanceof HTMLInputElement) {
          textArea.form?.requestSubmit()
        } else {
          // Last resort: dispatch Enter but mark it as bypassed
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: false
          })
          textArea.dispatchEvent(enterEvent)
        }
      }
    }, 200) // Slightly longer delay to ensure modal is fully removed
  }

  buttons.appendChild(cancelBtn)
  buttons.appendChild(maskBtn)
  buttons.appendChild(proceedBtn)

  // Assemble modal
  modal.appendChild(header)
  modal.appendChild(riskBadge)
  modal.appendChild(warningMsg)
  modal.appendChild(detectedList)
  modal.appendChild(buttons)
  overlay.appendChild(modal)

  // Add animations
  const style = document.createElement("style")
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from {
        transform: translateY(20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `
  if (!document.head.querySelector("#promptprune-warning-modal-style")) {
    style.id = "promptprune-warning-modal-style"
    document.head.appendChild(style)
  }

  // Close on overlay click
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      document.removeEventListener('keydown', modalKeyHandler, { capture: true })
      overlay.remove()
      textArea.focus()
    }
  }

  // Close on Escape key and prevent Enter key from submitting while modal is open
  const modalKeyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', modalKeyHandler, { capture: true })
      overlay.remove()
      textArea.focus()
    } else if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      // CRITICAL: Prevent Enter key from submitting while modal is visible
      // This prevents the bug where Enter key still submits the prompt after modal appears
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()

      // If Enter is pressed, focus the "Edit Prompt" button (safer default)
      // User can use Tab to switch to "Proceed Anyway" if needed
      cancelBtn.focus()
    }
  }
  document.addEventListener('keydown', modalKeyHandler, { capture: true })

  document.body.appendChild(overlay)

  // Focus the cancel button for accessibility
  cancelBtn.focus()

  // Verify modal is visible
  setTimeout(() => {
    const modalCheck = document.getElementById("promptprune-sensitive-warning")
    if (modalCheck) {
      const computed = window.getComputedStyle(modalCheck)
    } else {
      console.error("[PromptPrune] Modal NOT found in DOM after append!")
    }
  }, 100)
}

// Show notification
function showNotification(message: string, type: "success" | "error" | "warning" | "info") {
  // Remove existing notification
  const existing = document.getElementById("promptprune-notification")
  if (existing) {
    existing.remove()
  }

  const notification = document.createElement("div")
  notification.id = "promptprune-notification"
  const colors = {
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6",
  }
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${colors[type]};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    animation: slideIn 0.3s ease-out;
  `

  // Add animation
  const style = document.createElement("style")
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `
  if (!document.head.querySelector("#promptprune-notification-style")) {
    style.id = "promptprune-notification-style"
    document.head.appendChild(style)
  }

  notification.textContent = message
  document.body.appendChild(notification)

  setTimeout(() => {
    notification.style.animation = "slideIn 0.3s ease-out reverse"
    setTimeout(() => notification.remove(), 300)
  }, 3000)
}

async function maskSensitiveData(textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement) {
  const text = getText(textArea)
  if (!text || text.trim().length === 0) return

  showNotification("Masking sensitive data...", "info")

  // Use the robust regex-based detection directly
  const detection = detectSensitiveContent(text)


  if (!detection.hasSensitiveContent) {
    showNotification("No sensitive data found to mask", "info")
    return
  }

  let maskedText = text
  let successfulMasks = 0

  // Sort by position descending to replace from end to start (avoids index shifting)
  const itemsToMask = [...detection.detectedItems].sort((a, b) => b.position - a.position)

  for (const item of itemsToMask) {
    const originalValue = item.originalValue
    if (!originalValue) continue

    const typeLabel = item.type.replace(/_/g, ' ').toUpperCase().replace('STANDALONE', '').trim() || 'SENSITIVE'
    const replacement = `[${typeLabel}_REDACTED]`

    // Primary: Replace at exact position
    const actualTextAtPosition = maskedText.substring(item.position, item.position + originalValue.length)

    if (actualTextAtPosition.toLowerCase() === originalValue.toLowerCase()) {
      maskedText = maskedText.substring(0, item.position) +
        replacement +
        maskedText.substring(item.position + originalValue.length)
      successfulMasks++
    } else {
      // Fallback: Global search if position shifted
      const escapedMatch = originalValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escapedMatch, 'gi')
      if (regex.test(maskedText)) {
        maskedText = maskedText.replace(regex, replacement)
        successfulMasks++
      }
    }
  }


  if (successfulMasks > 0) {
    setText(textArea, maskedText)
    showNotification(`Successfully masked ${successfulMasks} sensitive items`, "success")
  } else {
    showNotification("Found sensitive data but could not redaction (already masked?)", "warning")
  }
}



// Initialize Capsule for textarea
function initializeCapsuleForTextArea(textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement) {
  // Skip if already initialized for this textarea
  if (textAreaCapsules.has(textArea)) {
    return
  }

  // Initialize Capsule UI (Singleton)
  const capsule = getCapsuleUI()
  capsule.mount()

  // Update capsule target when textarea is focused or hovered
  const updateCapsule = () => {
    capsule.setTarget(textArea)
    textAreaCapsules.set(textArea, capsule)
  }

  textArea.addEventListener('focus', updateCapsule)
  textArea.addEventListener('mouseenter', updateCapsule)

  // Initial update if this is the active element
  if (document.activeElement === textArea) {
    updateCapsule()
  }

  // Wire up Capsule events (once globally)
  if (!window.hasCapsuleListeners) {
    window.hasCapsuleListeners = true

    capsule.on('optimize', async () => {
      const target = capsule.target
      if (target) {
        const text = getText(target)
        if (!text.trim()) {
          showNotification("Please enter some text first", "warning")
          return
        }
        capsule.setLoading(true)
        try {
          await analyzeWithSmartOptimizer(target, text)
        } finally {
          capsule.setLoading(false)
        }
      }
    })

    capsule.on('frameworks', () => {
      const target = capsule.target
      if (target) {
        const text = getText(target)
        showFrameworkSelector(target, text)
      }
    })

    capsule.on('mask', () => {
      const target = capsule.target
      if (target) {
        maskSensitiveData(target)
      }
    })
  }

  // Update position on scroll/resize
  const updatePositions = () => {
    // Update capsule position if this is the active textarea
    if (textAreaCapsules.get(textArea) === capsule) {
      capsule.updatePosition(textArea.getBoundingClientRect())
    }
  }

  window.addEventListener('scroll', updatePositions, true)
  window.addEventListener('resize', updatePositions)
  window.addEventListener('resize', updatePositions)



  // Track if template was pre-filled
  let templatePreFilled = false

  // Pre-fill template for first prompt or follow-up
  const preFillTemplate = (event?: Event) => {
    // Don't pre-fill if user just cleared the textbox
    if (textArea.hasAttribute("data-cleared-by-user")) {
      return
    }

    // Don't pre-fill if event has preventRefill flag
    if (event && (event as any).preventRefill) {
      return
    }

    if (shouldPreFillTemplate(textArea)) {
      const currentText = getText(textArea).trim()

      // Only pre-fill if completely empty
      if (currentText.length === 0) {
        // Check if this is a follow-up message
        // Use multiple methods: 
        // 1) Check if role was provided before (per textarea or globally)
        // 2) Check DOM for previous messages
        // 3) Check if previous messages in DOM contain role
        const hasRoleBefore = roleProvidedInFirstPrompt.get(textArea) || globalRoleProvided || false
        const hasPreviousMessages = isFollowUpMessage(textArea)

        // Also check if previous messages in the conversation contain role
        let hasRoleInPreviousMessages = false
        if (hasPreviousMessages) {
          // Look for role in previous user messages
          const messageSelectors = [
            '[class*="user-message"]',
            '[class*="chat-message"]',
            '[data-role="user"]',
          ]
          for (const selector of messageSelectors) {
            const messages = document.querySelectorAll(selector)
            for (const msg of Array.from(messages)) {
              if (msg === textArea || msg.contains(textArea)) continue
              const text = msg.textContent?.trim() || ""
              if (text.length > 10 && hasRoleInText(text)) {
                hasRoleInPreviousMessages = true
                break
              }
            }
            if (hasRoleInPreviousMessages) break
          }
        }

        const isFollowUp = hasRoleBefore || hasPreviousMessages || hasRoleInPreviousMessages

        // Follow-up detection

        // Use different template for follow-ups
        // Follow-ups: Only Task (with default "Summarize in 100 words") and Context
        // First prompts: Role, Task, Topic, Format, Tone
        let template: string
        if (isFollowUp) {
          template = generateFollowUpTemplate()
        } else {
          template = generateFirstPromptTemplate()
        }

        // Set the template text
        setText(textArea, template)
        templatePreFilled = true

        // Track if role is in the template (for future follow-up detection)
        // This helps detect follow-ups even if DOM detection fails
        if (!isFollowUp && hasRoleInText(template)) {
          roleProvidedInFirstPrompt.set(textArea, true)
          globalRoleProvided = true // Set global flag too
        }

        // Show minimal notification
        setTimeout(() => {
          const message = isFollowUp
            ? "✨ Context-aware template ready"
            : "✨ Template pre-filled for better results"
          showMinimalNotification(message)
        }, 300)

        // For contenteditable divs, place cursor at end
        if (textArea instanceof HTMLDivElement && textArea.isContentEditable) {
          setTimeout(() => {
            const range = document.createRange()
            const selection = window.getSelection()
            if (selection && textArea.firstChild) {
              range.selectNodeContents(textArea)
              range.collapse(false)
              selection.removeAllRanges()
              selection.addRange(range)
            }
          }, 10)
        }
      }
    }
  }

  // Reset original prompt when user significantly changes the text
  const resetOriginalPrompt = (event?: Event) => {
    // Don't reset if user just cleared the textbox
    if (textArea.hasAttribute("data-cleared-by-user")) {
      return
    }

    // Don't reset if event has preventRefill flag
    if (event && (event as any).preventRefill) {
      return
    }

    const currentText = getText(textArea).trim()
    const storedOriginal = originalPrompts.get(textArea)

    // If textarea is empty, clear stored original and role tracking
    // But don't clear global flag - it persists across textarea changes
    if (currentText.length === 0) {
      originalPrompts.delete(textArea)
      roleProvidedInFirstPrompt.delete(textArea)
      // Note: We keep globalRoleProvided = true to persist across textarea changes
      return
    }

    // Track if role is present in current text (for follow-up detection)
    // This helps detect follow-ups even if DOM detection fails
    if (hasRoleInText(currentText)) {
      roleProvidedInFirstPrompt.set(textArea, true)
      globalRoleProvided = true // Set global flag too
    }

    if (!storedOriginal) {
      // No stored original, store current text as original
      originalPrompts.set(textArea, currentText)
      return
    }

    // If current text is very different (less than 50% similarity), reset
    // This allows user to start a new prompt without framework artifacts
    const similarity = calculateSimilarity(currentText, storedOriginal)
    if (similarity < 0.5) {
      originalPrompts.delete(textArea)
      // Store the new text as the new original
      originalPrompts.set(textArea, currentText)
      // Reset role tracking for new conversation (user started a completely new prompt)
      roleProvidedInFirstPrompt.delete(textArea)
      globalRoleProvided = false // Reset global flag too
    }
  }

  // Simple similarity calculation (Jaccard-like)
  const calculateSimilarity = (text1: string, text2: string): number => {
    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))
    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])
    return intersection.size / union.size
  }

  // Show icon on focus
  const showIcon = () => {
    // Icon visibility is now managed by the Capsule UI
    // We only need to ensure the Capsule is updated and visible
    const capsule = getCapsuleUI()
    capsule.setTarget(textArea)
    capsule.show()

    // Pre-fill template on first focus if it's the first prompt
    preFillTemplate(undefined)
  }

  // Hide icon on blur (with delay to allow clicking)
  let hideTimeout: number | null = null
  const hideIcon = () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout)
    }
    hideTimeout = window.setTimeout(() => {
      // Only hide if not focused
      if (document.activeElement !== textArea) {
        const capsule = getCapsuleUI()
        capsule.hide()
      }
    }, 200)
  }

  textArea.addEventListener("focus", (e) => {
    showIcon()
    // Pre-fill template on focus if empty (but not if user cleared it)
    if (!textArea.hasAttribute("data-cleared-by-user")) {
      preFillTemplate(e)
    }
  }, true)
  textArea.addEventListener("blur", hideIcon, true)
  textArea.addEventListener("input", (e) => {
    if (document.activeElement === textArea) {
      // updateIconPosition() // This function is no longer needed as Capsule handles positioning
    }

    // Don't pre-fill template if user cleared it
    const currentText = getText(textArea).trim()
    if (currentText.length === 0 && textArea.hasAttribute("data-cleared-by-user")) {
      // User cleared it, don't refill - just return
      return
    }

    // Reset original prompt when user significantly changes the text
    resetOriginalPrompt(e)
  }, true)

  // Show icon initially if textarea has focus or has text
  const initialText = getText(textArea).trim()
  if (document.activeElement === textArea || initialText.length > 0) {
    showIcon()
  } else {
    // Pre-fill template on initial load if it's the first prompt (only if not cleared by user)
    setTimeout(() => {
      if (!textArea.hasAttribute("data-cleared-by-user")) {
        preFillTemplate()
      }
    }, 500)
  }

  // Show icon when text is added or textarea is focused
  textArea.addEventListener("input", (e) => {
    const currentText = getText(textArea).trim()
    // The iconBtn logic is now handled by CapsuleUI, so this block is largely obsolete.
    // Keeping it for now, but it might be removed in future refactors.
    // const iconBtn = textAreaIcons.get(textArea)
    // if (iconBtn) {
    //   if (currentText.length > 0 || document.activeElement === textArea) {
    //     iconBtn.style.display = "block"
    //     iconBtn.style.opacity = "1"
    //     iconBtn.style.visibility = "visible"
    //     updateIconPosition()
    //   }
    // }
    // Reset original prompt when user significantly changes the text
    // This also tracks role in the text (see resetOriginalPrompt function)
    resetOriginalPrompt(e)

    // Update Capsule UI
    const capsule = getCapsuleUI()
    if (textAreaCapsules.get(textArea) === capsule) {
      // Update token count (approximate) - this is fast, no need to debounce
      const tokenCount = currentText.split(/\s+/).filter(w => w.length > 0).length
      capsule.updateTokenCount(tokenCount)

      // PERFORMANCE FIX: ONLY use FAST regex-only detection during typing (instant, no delay)
      // As requested by user: "keep only check for regex while typing"
      const regexResult = detectSensitiveContent(currentText)
      capsule.updateSensitiveWarning(regexResult.hasSensitiveContent, regexResult.detectedItems?.map(item => ({
        type: item.type,
        value: item.value,
        severity: item.severity
      })))

      // ML detection is moved to submission check to prevent typing lag
      // Framework suggestions are also removed from typing to prevent hangs
    }

    // Hide framework suggestions while typing to prevent hangs
    hideFrameworkSuggestions(textArea)

  }, true)

  // Also track when user submits/sends the message (Enter key or submit button)
  // Use a more aggressive approach - intercept at document level

  // Get or create bypass flag for this textarea
  const getBypassFlag = () => {
    let flag = textAreaBypassFlags.get(textArea)
    if (!flag) {
      flag = { bypass: false, timeout: null }
      textAreaBypassFlags.set(textArea, flag)
    }
    return flag
  }

  const checkAndBlockSubmission = async (currentText: string, event?: Event): Promise<boolean> => {
    // If bypass is active for this textarea, allow submission
    const bypassFlag = getBypassFlag()
    if (bypassFlag.bypass) {
      return false
    }
    if (!currentText || currentText.trim().length === 0) {
      return false
    }

    const textTrimmed = currentText.trim()

    // Use FAST regex check first (non-blocking, instant)
    const regexCheck = detectSensitiveContent(textTrimmed)

    if (regexCheck.hasSensitiveContent) {
      // Regex found something - block immediately (fast, non-blocking)
      if (event) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
      }

      if (!textAreaCapsules.has(textArea)) {
        initializeCapsuleForTextArea(textArea)
      }
      showSensitiveContentWarning(textArea, textTrimmed, regexCheck)
      return true // Blocked
    }

    // Regex is clean - check with ML in background (non-blocking, with timeout)
    // Don't block UI - if ML is slow, allow submission
    try {
      const mlCheckPromise = detectSensitiveContentML(textTrimmed)
      const timeoutPromise = new Promise<SensitiveContentResult>((resolve) => {
        setTimeout(() => resolve({
          hasSensitiveContent: false,
          detectedItems: [],
          riskScore: 0,
          shouldBlock: false
        }), 1500) // 1.5 second timeout - allow submission if ML is slow
      })

      const mlCheck = await Promise.race([mlCheckPromise, timeoutPromise])

      if (mlCheck.hasSensitiveContent) {
        // ML found something - block submission
        if (event) {
          event.preventDefault()
          event.stopPropagation()
          event.stopImmediatePropagation()
        }

        if (!textAreaCapsules.has(textArea)) {
          initializeCapsuleForTextArea(textArea)
        }
        showSensitiveContentWarning(textArea, textTrimmed, mlCheck)
        return true // Blocked
      }
    } catch (error) {
      // On error, allow submission (fail open)
      console.warn("[PromptPrune] ML detection error, allowing submission:", error)
    }

    return false // Not blocked
  }

  // Keydown listener on textarea - use capture phase to intercept early
  const keydownListener = (e: KeyboardEvent) => {
    // Only handle Enter key (not Shift+Enter for new lines)
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      // Check if this textarea is the target - be more flexible
      const target = e.target as HTMLElement
      const isOurTextarea = target === textArea ||
        textArea.contains?.(target) ||
        target === textArea ||
        (target.closest && textArea.contains?.(target.closest('textarea, [contenteditable]') as Node))

      if (isOurTextarea) {
        // Get text immediately - don't wait
        const currentText = getText(textArea)
        const textTrimmed = currentText.trim()

        // Use FAST regex check first (non-blocking, instant)
        const regexCheck = detectSensitiveContent(textTrimmed)

        if (regexCheck.hasSensitiveContent) {
          // Regex found something - block immediately (fast, non-blocking)
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()

          if (!textAreaCapsules.has(textArea)) {
            initializeCapsuleForTextArea(textArea)
          }
          showSensitiveContentWarning(textArea, textTrimmed, regexCheck)
          return
        }

        // Regex is clean - check with ML in background (non-blocking, with timeout)
        // Don't block UI - if ML is slow, allow submission
        const mlCheckPromise = detectSensitiveContentML(textTrimmed)
        const timeoutPromise = new Promise<SensitiveContentResult>((resolve) => {
          setTimeout(() => resolve({
            hasSensitiveContent: false,
            detectedItems: [],
            riskScore: 0,
            shouldBlock: false
          }), 1500) // 1.5 second timeout - allow submission if ML is slow
        })

        Promise.race([mlCheckPromise, timeoutPromise])
          .then(mlCheck => {
            if (mlCheck.hasSensitiveContent) {
              // ML found something - block submission
              e.preventDefault()
              e.stopPropagation()
              e.stopImmediatePropagation()

              if (!textAreaCapsules.has(textArea)) {
                initializeCapsuleForTextArea(textArea)
              }
              showSensitiveContentWarning(textArea, textTrimmed, mlCheck)
            } else {
              // Both regex and ML are clean - allow submission
              // Don't prevent default - let the form submit naturally
            }
          })
          .catch(err => {
            // On error, allow submission (fail open)
            console.warn("[PromptPrune] ML check error, allowing submission:", err)
          })

        // Track role if no sensitive content
        if (hasRoleInText(currentText)) {
          roleProvidedInFirstPrompt.set(textArea, true)
          globalRoleProvided = true
        }
      }
    }
  }

  // Also add document-level listener as backup - highest priority
  const documentKeydownListener = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      // Check if bypass is active for this textarea
      const bypassFlag = getBypassFlagForTextarea(textArea)
      if (bypassFlag.bypass) {
        return
      }

      // Check if the active element is our textarea
      const activeEl = document.activeElement
      const isOurTextarea = activeEl === textArea ||
        textArea.contains?.(activeEl) ||
        (activeEl && activeEl.closest && textArea.contains?.(activeEl.closest('textarea, [contenteditable]') as Node))

      if (isOurTextarea) {
        // Get text immediately
        const currentText = getText(textArea)

        // Check with ML model (async)
        detectSensitiveContentSync(currentText.trim()).then(syncCheck => {
          if (syncCheck.hasSensitiveContent) {
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
            checkAndBlockSubmission(currentText, e).then(blocked => {
              if (blocked) {
                // Submission blocked
              }
            })
          }
        }).catch((err: Error) => {
          console.error("[PromptPrune] Error in ML sensitive check:", err)
        })


        // Also check with ML in background
        checkAndBlockSubmission(currentText, e).then(blocked => {
          if (blocked) {
            // Submission blocked
          }
        }).catch(() => { })
      }
    }
  }

  // Add listeners with highest priority (capture phase, non-passive)
  textArea.addEventListener("keydown", keydownListener as EventListener, { capture: true, passive: false })
  // Document listener with even higher priority
  document.addEventListener("keydown", documentKeydownListener as EventListener, { capture: true, passive: false })


  // Also intercept submit button clicks - use MutationObserver to catch dynamically added buttons
  // Use a more aggressive approach - intercept all clicks and check if they're submit buttons
  const setupSubmitButtonListener = () => {
    const submitButton = findSubmitButton(textArea)
    if (submitButton) {
      // Remove old listener if exists
      const existingListener = (submitButton as any).__promptprune_listener
      if (existingListener) {
        submitButton.removeEventListener("click", existingListener, { capture: true } as any)
      }

      const listener = (e: Event) => {
        const currentText = getText(textArea)
        console.log("[PromptPrune] Submit button clicked, text length:", currentText.length)
        console.log("[PromptPrune] Submit button event:", e.type, e.target)

        if (checkAndBlockSubmission(currentText, e)) {
          return false
        }
      }

      submitButton.addEventListener("click", listener, { capture: true, passive: false })
        ; (submitButton as any).__promptprune_listener = listener
    }
  }

  // Also add document-level click listener as backup to catch any submit buttons
  const documentClickListener = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target) return

    // IMPORTANT: Exclude clicks on buttons inside the warning modal
    const warningModal = document.getElementById("promptprune-sensitive-warning")
    if (warningModal && (warningModal.contains(target) || target.closest("#promptprune-sensitive-warning"))) {
      console.log("[PromptPrune] Click detected inside warning modal, ignoring")
      return
    }

    // Check if this is a submit button (various patterns)
    // But exclude "Proceed Anyway" and "Edit Prompt" buttons - check this FIRST
    const buttonText = (target.textContent || '').toLowerCase().trim()
    if (buttonText.includes('proceed anyway') || buttonText.includes('edit prompt') || buttonText === 'proceed anyway' || buttonText === 'edit prompt') {
      console.log("[PromptPrune] Click on modal button, ignoring:", buttonText)
      return
    }

    // Check if bypass is active for this textarea
    const bypassFlag = getBypassFlagForTextarea(textArea)
    if (bypassFlag.bypass) {
      console.log("[PromptPrune] Bypass active, allowing click")
      return
    }

    const isSubmitButton = (target as HTMLButtonElement).type === 'submit' ||
      target.getAttribute('type') === 'submit' ||
      (target.closest('button[type="submit"]') && !target.closest('#promptprune-sensitive-warning')) ||
      (target.closest('form')?.querySelector('button[type="submit"]') === target && !target.closest('#promptprune-sensitive-warning')) ||
      ((target.textContent?.toLowerCase().includes('send') || target.getAttribute('aria-label')?.toLowerCase().includes('send')) &&
        !target.closest('#promptprune-sensitive-warning') &&
        !buttonText.includes('proceed') &&
        !buttonText.includes('edit prompt'))

    if (isSubmitButton) {
      // Check if this button is related to our textarea
      const form = target.closest('form')
      if (form && (form.contains(textArea) || textArea.closest('form') === form)) {
        const currentText = getText(textArea)
        console.log("[PromptPrune] Checking textarea content for sensitive data")
        if (checkAndBlockSubmission(currentText, e)) {
          return false
        }
      } else {
        // Also check if textarea is nearby (same container)
        const textAreaContainer = textArea.closest('div[class*="input"], div[class*="textarea"], div[class*="chat"], form')
        const buttonContainer = target.closest('div[class*="input"], div[class*="textarea"], div[class*="chat"], form')
        if (textAreaContainer && buttonContainer && textAreaContainer === buttonContainer) {
          const currentText = getText(textArea)
          console.log("[PromptPrune] Checking textarea in same container")
          if (checkAndBlockSubmission(currentText, e)) {
            return false
          }
        }
      }
    }
  }

  document.addEventListener("click", documentClickListener, { capture: true, passive: false })

  // Setup initially
  setupSubmitButtonListener()

  // Also try to setup after a short delay (in case button is added dynamically)
  setTimeout(() => {
    setupSubmitButtonListener()
  }, 1000)

  // Re-setup if DOM changes (for dynamically added buttons)
  const submitButtonObserver = new MutationObserver(() => {
    setupSubmitButtonListener()
  })

  // Observe parent container for button changes
  let submitButtonParent = textArea.parentElement
  let depth = 0
  while (submitButtonParent && depth < 3) {
    // Check if parent is a valid Node before observing
    if (submitButtonParent instanceof Node) {
      submitButtonObserver.observe(submitButtonParent, { childList: true, subtree: true })
    }
    submitButtonParent = submitButtonParent.parentElement
    depth++
  }

  // Expose test function for this textarea
  // Enhanced test function for sensitive content detection
  ; (textArea as any).__testSensitiveDetection = (testText?: string) => {
    const text = testText || getText(textArea)
    // Use ML model only
    detectSensitiveContentML(text).then(result => {
      if (result.hasSensitiveContent) {
        showSensitiveContentWarning(textArea, text, result)
      }
    }).catch(error => {
      console.error("[PromptPrune] ML detection error:", error)
    })

    // Return a placeholder result (async, so can't return actual result)
    return {
      hasSensitiveContent: false,
      detectedItems: [],
      riskScore: 0,
      shouldBlock: false
    }
  }

  // Also add global test function
  if (!(window as any).__promptpruneTestSensitive) {
    (window as any).__promptpruneTestSensitive = async (testText: string) => {
      const result = await detectSensitiveContentML(testText)
      // Find first textarea and show warning
      const firstTextarea = document.querySelector('textarea, [contenteditable="true"]') as HTMLElement
      if (firstTextarea && result.hasSensitiveContent) {
        showSensitiveContentWarning(firstTextarea as any, testText, result)
      }
      return result
    }
  }

  // Old test function (keep for compatibility)
  ; (textArea as any).__testSensitiveDetectionOld = async (testText?: string) => {
    const text = testText || getText(textArea).trim()
    const result = await detectSensitiveContentML(text)
    if (result.hasSensitiveContent) {
      showSensitiveContentWarning(textArea, text, result)
    }
    return result
  }
}



/**
 * Initialize all real-time prompt assistance components
 */
function initializeRealTimeComponents(textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement): void {
  // Check if already initialized
  if (textAreaCapsules.has(textArea)) {
    return
  }

  // Get user settings (default: all enabled)
  const enabled = {
    tokenCounter: localStorage.getItem('pp-realtime-token-counter') !== 'false',
    qualityScore: localStorage.getItem('pp-realtime-quality-score') !== 'false',
    spellCheck: localStorage.getItem('pp-realtime-spell-check') !== 'false',
    autocomplete: localStorage.getItem('pp-realtime-autocomplete') !== 'false',
    redundancy: localStorage.getItem('pp-realtime-redundancy') !== 'false',
    smartSuggestions: localStorage.getItem('pp-realtime-smart-suggestions') !== 'false',
    // Grammar feature removed from user-facing UI/UX
    grammar: false,
  }

  try {
    const assistant = new RealTimeAssistant({
      textarea: textArea,
      enabled,
      qualityScore: {
        onScoreClick: () => {
          // Show breakdown modal (can be implemented later)
          const score = (assistant as any).qualityScore?.getCurrentScore()
          console.log('[PromptPrune] Quality score clicked:', score)
        },
      },
      spellCheck: {
        onFix: (word, correction) => {
          console.log(`[PromptPrune] Fixed "${word}" → "${correction}"`)
        },
        onFixAll: () => {
          console.log('[PromptPrune] Fixed all misspellings')
        },
      },
      autocomplete: {
        onAccept: (suggestion) => {
          console.log('[PromptPrune] Autocomplete accepted:', suggestion)
        },
        maxSuggestions: 1,
      },
    })
    textAreaRealTimeAssistants.set(textArea, assistant)
    console.log('[PromptPrune] Real-time assistant initialized with all features')
  } catch (error) {
    console.error('[PromptPrune] Error initializing real-time assistant:', error)
  }
}

// Expose test functions globally for browser console testing
// Note: Content scripts run in isolated world, so we need to inject into page context
if (typeof window !== "undefined") {
  // First, expose in content script context (for internal use)
  ; (window as any).testComplexPrompt = testComplexPrompt
    ; (window as any).quickTestShorten = quickTestShorten
    ; (window as any).quickTestFrameworkSwitching = quickTestFrameworkSwitching
    ; (window as any).testSmartOptimizer = testSmartOptimizer
    ; (window as any).runAllPromptTests = runAllTests
    ; (window as any).quickPromptTest = quickTest
    ; (window as any).PROMPT_TEST_CASES = PROMPT_TEST_CASES

  // DISABLED: Test bridge injection causes CSP violations
  // Use content script context only for testing
  function injectTestBridge() {
    // Disabled to avoid CSP violations - test functions available in content script context only
    return
  }

  // DISABLED: Test bridge injection code removed to avoid CSP violations
  /*
  function injectTestBridgeOriginal() {
    try {
      // Check if already injected
      if ((document as any).__promptpruneBridgeInjected) {
        console.log('[PromptPrune] Test bridge already injected, skipping')
        return;
      }
      
      // Get test cases data safely (only basic info to avoid circular refs)
      const testCasesData = PROMPT_TEST_CASES.map(tc => ({
        name: tc.name,
        prompt: tc.prompt,
        type: tc.type
      }))
      
      const script = document.createElement('script')
      script.setAttribute('data-promptprune', 'test-bridge')
      
      // Use a simpler approach that's more CSP-friendly
      const bridgeCode = `
(function() {
  if (window.__promptpruneTestBridge) {
    console.log('[PromptPrune] Bridge already exists');
    return;
  }
  
  console.log('[PromptPrune] Creating test bridge in page context...');
  
  window.__promptpruneTestBridge = {
    runAllPromptTests: function() {
      return new Promise((resolve, reject) => {
        const requestId = 'test_' + Date.now() + '_' + Math.random();
        
        window.postMessage({
          type: 'PROMPTPRUNE_TEST',
          action: 'runAllTests',
          requestId: requestId
        }, '*');
        
        const listener = function(event) {
          if (event.data && event.data.type === 'PROMPTPRUNE_TEST_RESULT' && event.data.requestId === requestId) {
            window.removeEventListener('message', listener);
            if (event.data.error) {
              reject(new Error(event.data.error));
            } else {
              resolve(event.data.result);
            }
          }
        };
        window.addEventListener('message', listener);
        
        setTimeout(function() {
          window.removeEventListener('message', listener);
          reject(new Error('Test timeout after 60 seconds'));
        }, 60000);
      });
    },
    quickPromptTest: function(prompt) {
      return new Promise((resolve, reject) => {
        const requestId = 'test_' + Date.now() + '_' + Math.random();
        
        window.postMessage({
          type: 'PROMPTPRUNE_TEST',
          action: 'quickTest',
          prompt: prompt,
          requestId: requestId
        }, '*');
        
        const listener = function(event) {
          if (event.data && event.data.type === 'PROMPTPRUNE_TEST_RESULT' && event.data.requestId === requestId) {
            window.removeEventListener('message', listener);
            if (event.data.error) {
              reject(new Error(event.data.error));
            } else {
              resolve(event.data.result);
            }
          }
        };
        window.addEventListener('message', listener);
        
        setTimeout(function() {
          window.removeEventListener('message', listener);
          reject(new Error('Test timeout after 10 seconds'));
        }, 10000);
      });
    },
    PROMPT_TEST_CASES: ${JSON.stringify(testCasesData)}
  };
  
  window.runAllPromptTests = window.__promptpruneTestBridge.runAllPromptTests;
  window.quickPromptTest = window.__promptpruneTestBridge.quickPromptTest;
  window.PROMPT_TEST_CASES = window.__promptpruneTestBridge.PROMPT_TEST_CASES;
  
  // Test functions available silently in page context
})();
`
      
      // Use textContent instead of innerHTML to avoid CSP issues
      script.textContent = bridgeCode
      
      // Inject into page - prefer head for better CSP compliance
      const target = document.head || document.documentElement
      target.insertBefore(script, target.firstChild)
      
      // Mark as injected
      ;(document as any).__promptpruneBridgeInjected = true
      
      // Remove script after a short delay to clean up
      setTimeout(() => {
        if (script.parentNode) {
          script.remove()
        }
      }, 1000)
      
      console.log('[PromptPrune] Test bridge injection script added to DOM')
      
      // Verify injection worked by checking after a delay
      setTimeout(() => {
        // Try to access the bridge from page context (this won't work from content script, but we can check if script executed)
        const scriptInDOM = document.querySelector('script[data-promptprune="test-bridge"]')
        if (scriptInDOM) {
          console.log('[PromptPrune] Test bridge script found in DOM')
        } else {
          console.warn('[PromptPrune] Test bridge script not found in DOM - may have been removed or blocked by CSP')
        }
      }, 500)
    } catch (error) {
      console.error('[PromptPrune] Failed to inject test bridge:', error)
    }
  }
  */

  // DISABLED: Test bridge injection to avoid CSP violations
  // Test functions are available in content script context only
  // Users can access them via browser console in extension context

  // Listen for messages from page context
  window.addEventListener('message', async (event) => {
    // Only accept messages from same window
    if (event.source !== window) return

    if (event.data && event.data.type === 'PROMPTPRUNE_TEST') {
      console.log('[PromptPrune] Received test request:', event.data.action, 'requestId:', event.data.requestId)
      try {
        let result
        if (event.data.action === 'runAllTests') {
          console.log('[PromptPrune] Running all tests...')
          const testResults = await runAllTests()
          // Transform to match popup expectations
          result = {
            summary: {
              total: testResults.total,
              passed: testResults.passed,
              failed: testResults.failed
            },
            tests: testResults.results.map(r => ({
              name: r.testCase.name,
              passed: r.passed,
              error: r.errors.length > 0 ? r.errors.join('; ') : undefined,
              warnings: r.warnings,
              parsed: r.parsed,
              frameworkOutput: r.frameworkOutput,
              smartOutput: r.smartOutput
            }))
          }
          console.log('[PromptPrune] Test results:', result.summary)
        } else if (event.data.action === 'quickTest') {
          console.log('[PromptPrune] Running quick test for:', event.data.prompt)
          result = await quickTest(event.data.prompt)
        } else {
          throw new Error('Unknown test action: ' + event.data.action)
        }

        // Send result back to page context
        window.postMessage({
          type: 'PROMPTPRUNE_TEST_RESULT',
          requestId: event.data.requestId,
          result: result
        }, '*')
        console.log('[PromptPrune] Test result sent back, requestId:', event.data.requestId, 'result keys:', Object.keys(result || {}))
      } catch (error) {
        console.error('[PromptPrune] Test failed:', error)
        window.postMessage({
          type: 'PROMPTPRUNE_TEST_RESULT',
          requestId: event.data.requestId,
          error: error instanceof Error ? error.message : String(error)
        }, '*')
      }
    }
  })

    // Expose model diagnostic functions
    ; (window as any).checkModelStatus = async () => {
      const unifiedModel = getUnifiedModelManager()
      const status = unifiedModel.getModelStatus()
      const cached = await unifiedModel.isCached()
      console.log('[PromptPrune] Model Status:', {
        ...status,
        cached,
        timestamp: new Date().toISOString()
      })
      return { ...status, cached }
    }

    ; (window as any).forceModelRetry = async () => {
      const unifiedModel = getUnifiedModelManager()
      console.log('[PromptPrune] Forcing model retry...')
      await unifiedModel.forceRetryInitialization()
      return await (window as any).checkModelStatus()
    }

    ; (window as any).testHuggingFaceAccess = async () => {
      console.log('[PromptPrune] Testing HuggingFace access...')

      // First, check if we can access the manifest
      let manifestPermissions: string[] = []
      try {
        const manifestUrl = chrome.runtime.getURL('manifest.json')
        const manifestResponse = await fetch(manifestUrl)
        if (manifestResponse.ok) {
          const manifest = await manifestResponse.json()
          manifestPermissions = manifest.host_permissions || []
          console.log('[PromptPrune] Manifest host_permissions:', manifestPermissions)

          const hasHuggingFace = manifestPermissions.some((p: string) =>
            p.includes('huggingface.co')
          )
          if (!hasHuggingFace) {
            console.error('[PromptPrune] ❌ HuggingFace permissions NOT FOUND in manifest!')
            console.error('[PromptPrune] Current permissions:', manifestPermissions)
            console.error('[PromptPrune] 🔧 FIX: Rebuild extension and reload!')
            return {
              results: [],
              allAccessible: false,
              manifestCheck: 'FAILED - HuggingFace permissions missing',
              manifestPermissions
            }
          } else {
            console.log('[PromptPrune] ✅ HuggingFace permissions found in manifest')
          }
        }
      } catch (error: any) {
        console.warn('[PromptPrune] Could not check manifest:', error.message)
      }

      const testUrls = [
        'https://huggingface.co/VisheshKJha/tk-prompt-prune/resolve/main/config.json',
        'https://huggingface.co/VisheshKJha/tk-prompt-prune/resolve/main/model_quantized.onnx',
        'https://huggingface.co/VisheshKJha/tk-prompt-prune/resolve/main/model.onnx',
        'https://huggingface.co/VisheshKJha/tk-prompt-prune/resolve/main/tokenizer.json',
      ]

      const results: any[] = []
      for (const url of testUrls) {
        try {
          console.log(`[PromptPrune] Testing: ${url}`)
          const response = await fetch(url, { method: 'GET', redirect: 'follow' })

          // Check if we got redirected
          const finalUrl = response.url
          const wasRedirected = finalUrl !== url

          // Try to read the response to see what we actually got
          const contentType = response.headers.get('content-type') || 'unknown'
          const isHTML = contentType.includes('text/html')
          const isJSON = contentType.includes('application/json')
          const isBinary = contentType.includes('application/octet-stream') || contentType.includes('application/x-')

          // Read first few bytes to check if it's HTML
          let firstBytes = ''
          let isActuallyHTML = false
          try {
            const clone = response.clone()
            const text = await clone.text()
            firstBytes = text.substring(0, 200)
            isActuallyHTML = text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')
          } catch (e) {
            // If we can't read it, that's fine
          }

          results.push({
            url,
            finalUrl: wasRedirected ? finalUrl : undefined,
            wasRedirected,
            status: response.status,
            ok: response.ok,
            contentType,
            isHTML,
            isActuallyHTML,
            isJSON,
            isBinary,
            accessible: response.ok && !isHTML && !isActuallyHTML,
            firstBytes: firstBytes.substring(0, 100) // First 100 chars for debugging
          })

          console.log(`[PromptPrune] ${url}:`, {
            status: response.status,
            finalUrl: wasRedirected ? finalUrl : 'same',
            contentType,
            isHTML,
            isActuallyHTML,
            accessible: response.ok && !isHTML && !isActuallyHTML,
            issue: isActuallyHTML ? 'Returning HTML instead of file (404 or auth page)' :
              isHTML ? 'Content-Type says HTML' :
                response.ok ? 'OK' : 'Failed'
          })

          if (isActuallyHTML) {
            console.error(`[PromptPrune] ⚠️ Got HTML response! First 100 chars:`, firstBytes.substring(0, 100))
          }
        } catch (error: any) {
          results.push({
            url,
            error: error.message,
            accessible: false
          })
          console.error(`[PromptPrune] ${url}:`, error.message)

          // Check if it's a CORS/permission error
          if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
            console.error('[PromptPrune] ⚠️ CORS/Permission error detected!')
            console.error('[PromptPrune] This means the extension cannot access HuggingFace')
            console.error('[PromptPrune] 🔧 FIX: Rebuild extension and reload!')
          }
        }
      }

      const allAccessible = results.every(r => r.accessible)
      if (!allAccessible) {
        console.error('[PromptPrune] ❌ HuggingFace access test FAILED!')
        console.error('[PromptPrune] This usually means:')
        console.error('  1. Extension manifest missing https://huggingface.co/* in host_permissions')
        console.error('  2. Extension not reloaded after manifest update')
        console.error('  3. CORS issue (check browser console for CORS errors)')
        console.error('  4. Model files missing on HuggingFace (check Files tab)')
        console.error('[PromptPrune] 🔧 FIX: Reload the extension in chrome://extensions/')
      } else {
        console.log('[PromptPrune] ✅ HuggingFace access test PASSED!')
      }

      return {
        results,
        allAccessible,
        manifestPermissions,
        manifestCheck: manifestPermissions.length > 0 ? 'OK' : 'Could not check'
      }
    }

    // Non-async wrapper for testHuggingFaceAccess (for console use)
    ; (window as any).testHuggingFace = () => {
      console.log('[PromptPrune] Running HuggingFace access test...')
      return (window as any).testHuggingFaceAccess().then((result: any) => {
        console.log('[PromptPrune] Test complete!')
        console.log('[PromptPrune] Results:', result)
        return result
      }).catch((error: any) => {
        console.error('[PromptPrune] Test failed:', error)
        return { error: error.message }
      })
    }

    // Non-async wrapper for checkModelStatus
    ; (window as any).checkModel = () => {
      console.log('[PromptPrune] Checking model status...')
      return (window as any).checkModelStatus().then((result: any) => {
        console.log('[PromptPrune] Model status:', result)
        return result
      }).catch((error: any) => {
        console.error('[PromptPrune] Check failed:', error)
        return { error: error.message }
      })
    }

    // Non-async wrapper for forceModelRetry
    ; (window as any).retryModel = () => {
      console.log('[PromptPrune] Forcing model retry...')
      return (window as any).forceModelRetry().then((result: any) => {
        console.log('[PromptPrune] Retry complete!')
        console.log('[PromptPrune] New status:', result)
        return result
      }).catch((error: any) => {
        console.error('[PromptPrune] Retry failed:', error)
        return { error: error.message }
      })
    }

    // Test functions for Intent and Framework Matching
    ; (window as any).testIntentAndFramework = async (prompt?: string) => {
      const unifiedModel = getUnifiedModelManager()
      const testPrompt = prompt || "Write a blog post about artificial intelligence"

      console.log("🧪 Testing Intent & Framework Matching")
      console.log("=".repeat(80))
      console.log(`Prompt: "${testPrompt}"`)
      console.log("")

      try {
        // Test Intent Classification
        console.log("📊 Testing Intent Classification...")
        const intentResult = await unifiedModel.classifyIntent(testPrompt)
        console.log("✅ Intent Result:")
        console.log(`   Intent: ${intentResult.intent}`)
        console.log(`   Confidence: ${(intentResult.confidence * 100).toFixed(1)}%`)
        console.log("   All Intents:")
        intentResult.allIntents.forEach((i, idx) => {
          console.log(`   ${idx + 1}. ${i.intent}: ${(i.score * 100).toFixed(1)}%`)
        })

        console.log("")

        // Test Framework Matching
        console.log("📊 Testing Framework Matching...")
        const frameworkResult = await unifiedModel.matchFramework(testPrompt)
        console.log("✅ Framework Result:")
        console.log(`   Framework: ${frameworkResult.framework}`)
        console.log(`   Score: ${(frameworkResult.score * 100).toFixed(1)}%`)
        console.log("   All Frameworks:")
        frameworkResult.allScores.forEach((f, idx) => {
          console.log(`   ${idx + 1}. ${f.framework}: ${(f.score * 100).toFixed(1)}%`)
        })

        return {
          intent: intentResult,
          framework: frameworkResult
        }
      } catch (error) {
        console.error("❌ Test failed:", error)
        return { error: error instanceof Error ? error.message : String(error) }
      }
    }

    // Test suite for multiple prompts
    ; (window as any).testIntentFrameworkSuite = async () => {
      const testCases = [
        { name: "Content Creation", prompt: "Write a blog post about AI", expectedFramework: "roses", expectedIntent: "content creation" },
        { name: "Professional", prompt: "Write a professional email to a client", expectedFramework: "race", expectedIntent: "professional communication" },
        { name: "Reasoning", prompt: "How does photosynthesis work? Explain step by step", expectedFramework: "cot", expectedIntent: "explanation" },
        { name: "Code Generation", prompt: "Write a Python function to sort a list", expectedFramework: "create", expectedIntent: "code generation" },
        { name: "Data Analysis", prompt: "Analyze this sales data and create a report", expectedFramework: "race", expectedIntent: "data analysis" },
        { name: "Creative Writing", prompt: "Write a short story about a robot", expectedFramework: "roses", expectedIntent: "creative writing" },
        { name: "Tutorial", prompt: "Create a step-by-step guide on how to bake a cake", expectedFramework: "guide", expectedIntent: "explanation" }
      ]

      const unifiedModel = getUnifiedModelManager()
      console.log("🧪 Running Intent & Framework Test Suite")
      console.log("=".repeat(80))

      const results = []

      for (const testCase of testCases) {
        console.log(`\n📝 Test: ${testCase.name}`)
        console.log(`   Prompt: "${testCase.prompt}"`)

        try {
          const intentResult = await unifiedModel.classifyIntent(testCase.prompt)
          const frameworkResult = await unifiedModel.matchFramework(testCase.prompt)

          const intentMatch = intentResult.intent.toLowerCase() === testCase.expectedIntent.toLowerCase()
          const frameworkMatch = frameworkResult.framework.toLowerCase() === testCase.expectedFramework.toLowerCase()

          console.log(`   Intent: ${intentResult.intent} (${(intentResult.confidence * 100).toFixed(1)}%) ${intentMatch ? '✅' : '❌'} Expected: ${testCase.expectedIntent}`)
          console.log(`   Framework: ${frameworkResult.framework} (${(frameworkResult.score * 100).toFixed(1)}%) ${frameworkMatch ? '✅' : '❌'} Expected: ${testCase.expectedFramework}`)

          results.push({
            name: testCase.name,
            prompt: testCase.prompt,
            intent: { actual: intentResult.intent, expected: testCase.expectedIntent, match: intentMatch },
            framework: { actual: frameworkResult.framework, expected: testCase.expectedFramework, match: frameworkMatch },
            passed: intentMatch && frameworkMatch
          })
        } catch (error) {
          console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`)
          results.push({
            name: testCase.name,
            prompt: testCase.prompt,
            error: error instanceof Error ? error.message : String(error),
            passed: false
          })
        }
      }

      // Summary
      console.log("\n" + "=".repeat(80))
      console.log("📊 TEST SUMMARY")
      console.log("=".repeat(80))
      const passed = results.filter(r => r.passed).length
      const total = results.length
      const intentPassed = results.filter(r => r.intent && r.intent.match).length
      const frameworkPassed = results.filter(r => r.framework && r.framework.match).length

      console.log(`\n✅ Overall: ${passed}/${total} tests passed (${(passed / total * 100).toFixed(1)}%)`)
      console.log(`✅ Intent Classification: ${intentPassed}/${total} correct (${(intentPassed / total * 100).toFixed(1)}%)`)
      console.log(`✅ Framework Matching: ${frameworkPassed}/${total} correct (${(frameworkPassed / total * 100).toFixed(1)}%)`)

      return results
    }

  // Test functions available silently in content script context
}

// Inject design system CSS
function injectDesignSystemCSS(): void {
  if (document.head.querySelector('#promptprune-design-system')) {
    return // Already injected
  }

  // Inject CSS variables directly
  const style = document.createElement('style')
  style.id = 'promptprune-design-system'
  style.textContent = `
    :root {
      --color-primary-500: #10b981;
      --color-primary-600: #059669;
      --color-success: #10b981;
      --color-warning: #f59e0b;
      --color-error: #ef4444;
      --color-info: #3b82f6;
      --color-gray-50: #f9fafb;
      --color-gray-100: #f3f4f6;
      --color-gray-200: #e5e7eb;
      --color-gray-400: #9ca3af;
      --color-gray-500: #6b7280;
      --color-gray-600: #4b5563;
      --color-gray-700: #374151;
      --color-gray-900: #111827;
      --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Roboto', sans-serif;
      --text-xs: 0.75rem;
      --text-sm: 0.875rem;
      --text-base: 1rem;
      --text-lg: 1.125rem;
      --font-normal: 400;
      --font-medium: 500;
      --font-semibold: 600;
      --font-bold: 700;
      --space-1: 0.25rem;
      --space-2: 0.5rem;
      --space-3: 0.75rem;
      --space-4: 1rem;
      --space-6: 1.5rem;
      --space-8: 2rem;
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
      --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
      --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);
      --radius-sm: 0.375rem;
      --radius-md: 0.5rem;
      --radius-lg: 0.75rem;
      --radius-xl: 1rem;
      --radius-full: 9999px;
      --transition-fast: 150ms ease-out;
      --transition-base: 200ms ease-out;
      --transition-slow: 300ms ease-out;
      --line-height-normal: 1.5;
    }
  `
  document.head.appendChild(style)
}

// Global document-level listeners for sensitive content detection
// These are attached immediately to catch submissions even before textareas are found
let globalSensitiveContentListenerAttached = false

function attachGlobalSensitiveContentListeners() {
  if (globalSensitiveContentListenerAttached) {
    return
  }
  globalSensitiveContentListenerAttached = true

  // Attach global sensitive content listeners (early interception)

  // Global Enter key listener - catches ALL Enter key presses
  // Track events we've manually triggered to prevent infinite loops
  const manuallyTriggeredEvents = new WeakSet<Event>()
  // Track if we're currently processing a click/keydown to prevent concurrent processing
  let isProcessingClick = false
  let isProcessingKeydown = false
  // Track last processed text to avoid duplicate checks
  let lastProcessedText: string | null = null
  let lastProcessedTime = 0

  const globalKeydownListener = (e: KeyboardEvent) => {
    // Skip if this is an event we manually triggered
    if (manuallyTriggeredEvents.has(e)) {
      return
    }

    // CRITICAL: Check if warning modal is visible - if so, don't process Enter key
    const warningModal = document.getElementById("promptprune-sensitive-warning")
    if (warningModal) {
      // Use computed styles to check if modal is actually visible
      const computed = window.getComputedStyle(warningModal)
      const isVisible = computed.display !== 'none' &&
        computed.visibility !== 'hidden' &&
        computed.opacity !== '0' &&
        warningModal.offsetParent !== null

      if (isVisible) {
        // Modal is visible - block Enter to prevent submission
        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          return
        }
      }
    }

    // Skip if we're already processing a keydown
    if (isProcessingKeydown) {
      return
    }

    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      const activeEl = document.activeElement
      if (!activeEl) return

      // Check if it's a textarea or contenteditable
      const isTextInput = activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLInputElement ||
        (activeEl instanceof HTMLElement && activeEl.isContentEditable)

      if (isTextInput) {
        // Find textarea reference
        let textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement | null = null
        if (activeEl instanceof HTMLTextAreaElement || activeEl instanceof HTMLInputElement) {
          textArea = activeEl
        } else if (activeEl instanceof HTMLElement && activeEl.isContentEditable) {
          textArea = activeEl as HTMLDivElement
        }

        if (!textArea) return

        // CRITICAL: Check bypass flag FIRST before checking sensitive content
        const bypassFlag = textAreaBypassFlags.get(textArea)
        if (bypassFlag && bypassFlag.bypass) {
          return // Allow submission, don't check sensitive content
        }

        const text = getText(activeEl as HTMLElement)
        const textTrimmed = text?.trim() || ''
        if (textTrimmed.length > 0) {
          // Debounce: Skip if we just processed the same text within 500ms
          const now = Date.now()
          if (lastProcessedText === textTrimmed && (now - lastProcessedTime) < 500) {
            return
          }

          // CRITICAL: Prevent default IMMEDIATELY to block submission
          // We'll allow it later if no sensitive content is found
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()

          // Mark as processing and track text
          isProcessingKeydown = true
          lastProcessedText = textTrimmed
          lastProcessedTime = now


          // Use FAST regex detection first (non-blocking), then ML if needed
          // This prevents UI freezing during typing
          const regexCheck = detectSensitiveContent(textTrimmed)

          // If regex finds something, show warning immediately (fast)
          if (regexCheck.hasSensitiveContent) {
            if (!textAreaCapsules.has(textArea)) {
              initializeCapsuleForTextArea(textArea)
            }
            showSensitiveContentWarning(textArea, text.trim(), regexCheck)
            isProcessingKeydown = false
            return
          }

          // If regex is clean, check with ML in background (non-blocking)
          // But don't block UI - allow submission if ML check takes too long
          const mlCheckPromise = detectSensitiveContentML(textTrimmed)
          const timeoutPromise = new Promise<SensitiveContentResult>((resolve) => {
            setTimeout(() => resolve({
              hasSensitiveContent: false,
              detectedItems: [],
              riskScore: 0,
              shouldBlock: false
            }), 2000) // 2 second timeout - allow submission if ML is slow
          })

          Promise.race([mlCheckPromise, timeoutPromise]).then(sensitiveCheck => {
            if (sensitiveCheck.hasSensitiveContent) {

              // Ensure textarea has capsule
              if (!textAreaCapsules.has(textArea)) {
                initializeCapsuleForTextArea(textArea)
              }

              // Show warning (event already prevented)
              showSensitiveContentWarning(textArea, text.trim(), sensitiveCheck)
            } else {
              // No sensitive content - manually trigger submit
              // Find and click the submit button
              const submitButton = textArea.closest('form')?.querySelector('button[type="submit"]') as HTMLButtonElement ||
                document.querySelector('button[aria-label*="send" i], button[aria-label*="submit" i]') as HTMLButtonElement ||
                textArea.closest('div')?.querySelector('button[type="submit"]') as HTMLButtonElement

              if (submitButton) {
                submitButton.click()
              } else {
                // Fallback: dispatch Enter key event on the textarea
                const enterEvent = new KeyboardEvent('keydown', {
                  key: 'Enter',
                  code: 'Enter',
                  keyCode: 13,
                  which: 13,
                  bubbles: true,
                  cancelable: true
                })
                manuallyTriggeredEvents.add(enterEvent)
                isProcessingKeydown = false // Reset before dispatching
                textArea.dispatchEvent(enterEvent)
              }
            }
            // Reset processing flag
            isProcessingKeydown = false
          }).catch((error) => {
            console.warn("[PromptPrune] GLOBAL: ML detection error, allowing submission:", error)
            // On error, allow submission by manually triggering
            const submitButton = textArea.closest('form')?.querySelector('button[type="submit"]') as HTMLButtonElement ||
              document.querySelector('button[aria-label*="send" i]') as HTMLButtonElement
            if (submitButton) {
              isProcessingKeydown = false // Reset before clicking
              submitButton.click()
            } else {
              isProcessingKeydown = false
            }
          })
        }
      }
    }
  }

  // Global click listener for submit buttons - catches ALL button clicks
  const globalClickListener = (e: MouseEvent) => {
    // Skip if this is an event we manually triggered
    if (manuallyTriggeredEvents.has(e)) {
      return
    }

    // Skip if we're already processing a click
    if (isProcessingClick) {
      console.log("[PromptPrune] GLOBAL: Already processing click, skipping")
      return
    }

    const target = e.target as HTMLElement
    if (!target) return

    // Exclude modal buttons
    const warningModal = document.getElementById("promptprune-sensitive-warning")
    if (warningModal && warningModal.contains(target)) {
      return
    }

    // Check if this is a submit button (including arrow buttons with SVG)
    const targetText = target.textContent?.toLowerCase() || ''
    const targetAriaLabel = target.getAttribute('aria-label')?.toLowerCase() || ''
    const hasSvg = target.querySelector('svg') !== null || target.closest('button')?.querySelector('svg') !== null
    const isInForm = target.closest('form') !== null
    const isNearInput = target.closest('div[class*="input"], div[class*="textarea"], div[class*="chat"]') !== null

    const isSubmitButton = (target as HTMLButtonElement).type === 'submit' ||
      target.getAttribute('type') === 'submit' ||
      target.closest('button[type="submit"]') ||
      targetText.includes('send') ||
      targetAriaLabel.includes('send') ||
      targetAriaLabel.includes('submit') ||
      (hasSvg && (isInForm || isNearInput)) // Arrow button with SVG near input

    if (isSubmitButton) {
      // Find the nearest textarea
      const form = target.closest('form')
      let textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement | null = null

      if (form) {
        textArea = form.querySelector('textarea, [contenteditable="true"]') as HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
      }

      if (!textArea) {
        // Search nearby containers
        const container = target.closest('div[class*="input"], div[class*="textarea"], div[class*="chat"]')
        if (container) {
          textArea = container.querySelector('textarea, [contenteditable="true"]') as HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
        }
      }

      // Also try document.activeElement as fallback
      if (!textArea && document.activeElement) {
        const activeEl = document.activeElement
        if (activeEl instanceof HTMLTextAreaElement ||
          activeEl instanceof HTMLInputElement ||
          (activeEl instanceof HTMLElement && activeEl.isContentEditable)) {
          textArea = activeEl as HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
        }
      }

      if (textArea) {
        const text = getText(textArea)
        const textTrimmed = text?.trim() || ''
        if (textTrimmed.length > 0) {
          // Check bypass flag if textarea is tracked
          const bypassFlag = textAreaBypassFlags.get(textArea)
          if (bypassFlag && bypassFlag.bypass) {
            return
          }

          // Debounce: Skip if we just processed the same text within 500ms
          const now = Date.now()
          if (lastProcessedText === textTrimmed && (now - lastProcessedTime) < 500) {
            return
          }

          // CRITICAL: Prevent default IMMEDIATELY to block submission
          // We'll allow it later if no sensitive content is found
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()

          // Mark as processing and track text
          isProcessingClick = true
          lastProcessedText = textTrimmed
          lastProcessedTime = now


          // Use FAST regex detection first (non-blocking), then ML if needed
          const regexCheck = detectSensitiveContent(textTrimmed)

          // If regex finds something, show warning immediately (fast)
          if (regexCheck.hasSensitiveContent) {
            if (!textAreaCapsules.has(textArea)) {
              initializeCapsuleForTextArea(textArea)
            }
            showSensitiveContentWarning(textArea, text.trim(), regexCheck)
            isProcessingClick = false
            return
          }

          // If regex is clean, check with ML in background (non-blocking)
          // But don't block UI - allow submission if ML check takes too long
          const mlCheckPromise = detectSensitiveContentML(textTrimmed)
          const timeoutPromise = new Promise<SensitiveContentResult>((resolve) => {
            setTimeout(() => resolve({
              hasSensitiveContent: false,
              detectedItems: [],
              riskScore: 0,
              shouldBlock: false
            }), 2000) // 2 second timeout - allow submission if ML is slow
          })

          Promise.race([mlCheckPromise, timeoutPromise]).then(mlCheck => {
            if (mlCheck.hasSensitiveContent) {

              // Ensure textarea has capsule
              if (!textAreaCapsules.has(textArea)) {
                initializeCapsuleForTextArea(textArea)
              }

              // Show warning with ML results (event already prevented)
              showSensitiveContentWarning(textArea, text.trim(), mlCheck)
            } else {
              // No sensitive content - manually trigger submit
              // Re-dispatch the click event on the button
              const newClickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
              })
              manuallyTriggeredEvents.add(newClickEvent)
              isProcessingClick = false // Reset before dispatching
              target.dispatchEvent(newClickEvent)
            }
            // Reset processing flag
            isProcessingClick = false
          }).catch((error) => {
            console.warn("[PromptPrune] GLOBAL: ML detection error, allowing submission:", error)
            // On error, allow submission by re-dispatching click
            const newClickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window
            })
            manuallyTriggeredEvents.add(newClickEvent)
            isProcessingClick = false // Reset before dispatching
            target.dispatchEvent(newClickEvent)
          })
        }
      }
    }
  }

  // Attach with highest priority (capture phase, not passive)
  document.addEventListener("keydown", globalKeydownListener, { capture: true, passive: false })
  document.addEventListener("click", globalClickListener, { capture: true, passive: false })

}

// Initialize
function init() {
  // Inject design system CSS
  injectDesignSystemCSS()

  const textAreas = findTextAreas()

  if (textAreas.length === 0) {
    setTimeout(init, 1000)
    return
  }

  // Attach to all textareas
  textAreas.forEach(textArea => {
    initializeCapsuleForTextArea(textArea)
  })

  // Check if we should reset global role flag (when new conversation starts)
  // This happens when URL changes or page reloads
  const currentUrl = window.location.href
  const lastUrl = sessionStorage.getItem('promptprune_last_url')
  if (lastUrl && lastUrl !== currentUrl) {
    // URL changed, might be a new conversation
    globalRoleProvided = false
    console.log("[PromptPrune] URL changed, reset global role tracking")
  }
  sessionStorage.setItem('promptprune_last_url', currentUrl)

  // Check for auto-download flag (set on install/update)
  checkAndStartAutoDownload()
}

/**
 * Check if models should be auto-downloaded and start download in background
 */
async function checkAndStartAutoDownload(): Promise<void> {
  try {
    console.log('[PromptPrune] 🔍 Checking shared model status...')

    // Check if shared models are ready (stored in background service worker)
    const result = await new Promise<{ [key: string]: any }>((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get([
          'promptprune-models-ready',
          'promptprune-model-download-attempted',
          'promptprune-model-download-status',
          'promptprune-model-download-progress'
        ], resolve)
      } else {
        console.warn('[PromptPrune] ⚠️ Chrome storage not available')
        resolve({})
      }
    })

    const modelsReady = result['promptprune-models-ready'] === true
    const downloadAttempted = result['promptprune-model-download-attempted'] === 'true'
    const downloadStatus = result['promptprune-model-download-status'] || 'unknown'
    const downloadProgress = result['promptprune-model-download-progress'] || 0

    // Clear status logging
    if (modelsReady) {
      console.log('[PromptPrune] ✅ Shared models: READY')
      console.log('[PromptPrune] 📊 Models available for ALL platforms (ChatGPT, Copilot, Gemini, etc.)')
      console.log('[PromptPrune] 📊 Storage: ~53MB (shared, not per-platform)')
    } else if (downloadStatus === 'downloading') {
      console.log(`[PromptPrune] ⏳ Shared models: DOWNLOADING (${downloadProgress}%)`)
      console.log('[PromptPrune] 💡 This happens once - models will be shared across all platforms')
    } else if (downloadStatus === 'failed') {
      console.log('[PromptPrune] ⚠️ Shared models: DOWNLOAD FAILED')
      console.log('[PromptPrune] 💡 Extension will use regex fallback (still works, just less accurate)')
      console.log('[PromptPrune] 💡 Error:', result['promptprune-model-download-error'] || 'Unknown')
    } else if (!downloadAttempted) {
      console.log('[PromptPrune] 📥 Shared models: NOT DOWNLOADED')
      console.log('[PromptPrune] 💡 Requesting download in background...')

      // Request model initialization in background service worker
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ type: 'INIT_MODELS' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[PromptPrune] ❌ Failed to request model init:', chrome.runtime.lastError)
          } else if (response?.success) {
            console.log('[PromptPrune] ✅ Download started in background service worker')
            console.log('[PromptPrune] 📊 Check background service worker console for progress')
          }
        })
      }
    } else {
      console.log('[PromptPrune] ⏭️ Shared models: Download previously attempted')
    }
  } catch (error) {
    console.error('[PromptPrune] ❌ Model check failed:', error)
  }
}

// Removed - models now download in background service worker (shared storage)

// Start IMMEDIATELY - don't wait for DOM
// Attach global listeners right away to catch early submissions
attachGlobalSensitiveContentListeners()

// Also initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  // DOM already ready, init immediately
  init()
}

// Watch for new textareas (SPA navigation) - debounced
let observerTimeout: ReturnType<typeof setTimeout> | null = null
const observer = new MutationObserver(() => {
  if (observerTimeout) clearTimeout(observerTimeout)
  observerTimeout = setTimeout(() => {
    const textAreas = findTextAreas()
    const processedIds = new Set<string>()

    textAreas.forEach(textArea => {
      // Create stable ID for this textarea
      const rect = textArea.getBoundingClientRect()
      const textAreaId = textArea.id || textArea.getAttribute('data-id') || textArea.getAttribute('name') || ''
      const stableId = textAreaId || `textarea-${Math.round(rect.top)}-${Math.round(rect.left)}`

      // Skip if we've already processed this ID
      if (processedIds.has(stableId)) {
        return
      }
      processedIds.add(stableId)

      // Re-attach capsule if needed
      if (!textAreaCapsules.has(textArea) && textArea.isConnected) {
        initializeCapsuleForTextArea(textArea)
      }
    })
  }, 300)
})

// Only observe if document.body exists
if (document.body && document.body instanceof Node) {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })
} else {
  // Wait for body to be available
  const bodyObserver = new MutationObserver(() => {
    if (document.body && document.body instanceof Node) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      })
      bodyObserver.disconnect()
    }
  })
  bodyObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
}

// Re-initialize on navigation (for SPAs)
let lastUrl = location.href
const urlObserver = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    setTimeout(init, 1000)
  }
})

urlObserver.observe(document, { subtree: true, childList: true })
