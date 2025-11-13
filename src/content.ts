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
import { createFieldButton, positionFieldButton } from "~/content/field-button"
import { makeButtonsDraggable } from "~/content/draggable-buttons"
import { testComplexPrompt, quickTestShorten, quickTestFrameworkSwitching } from "~/lib/prompt-test-runner"
import { testSmartOptimizer } from "~/lib/test-smart-optimizer"
import { runAllTests, quickTest, PROMPT_TEST_CASES } from "~/lib/prompt-type-tester"
import { optimizePromptSmartly } from "~/lib/smart-prompt-optimizer"
import { getModelManager } from "~/lib/model-manager"
import { showModelDownloadPrompt, downloadModelsWithProgress, showDownloadProgress } from "~/content/model-download-ui"
import { createDualAnalyzeButtons, updateButtonPositions } from "~/content/dual-analyze-buttons"
import { detectSensitiveContent } from "~/lib/sensitive-content-detector"

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
  ],
  run_at: "document_idle",
}

// PromptPrune content script loaded

// Track icons and dropdowns per textarea
const textAreaIcons = new WeakMap<HTMLTextAreaElement | HTMLDivElement | HTMLInputElement | HTMLInputElement, HTMLElement>()
const textAreaDropdowns = new WeakMap<HTMLTextAreaElement | HTMLDivElement | HTMLInputElement | HTMLInputElement, HTMLElement>()
const textAreaSmartButtons = new WeakMap<HTMLTextAreaElement | HTMLDivElement | HTMLInputElement | HTMLInputElement, HTMLElement>()
const textAreaBasicButtons = new WeakMap<HTMLTextAreaElement | HTMLDivElement | HTMLInputElement | HTMLInputElement, HTMLElement>()

// Helper to update field buttons visibility
function updateFieldButtonsVisibility(textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement, mode: 'smart' | 'basic'): void {
  const fieldButtonHost = textAreaFieldButtons.get(textArea)
  if (fieldButtonHost) {
    if (mode === 'basic') {
      fieldButtonHost.style.display = 'block'
    } else {
      fieldButtonHost.style.display = 'none'
    }
  }
}

// Global analysis mode (smart vs basic) - load from localStorage
let analysisMode: 'smart' | 'basic' = (localStorage.getItem('promptprune-analysis-mode') || 'smart') as 'smart' | 'basic'
;(window as any).__promptprune_analysis_mode = analysisMode
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
  if (textAreaIcons.has(el as HTMLTextAreaElement | HTMLDivElement | HTMLInputElement)) {
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
  } else {
    element.innerText = text
    element.dispatchEvent(new Event("input", { bubbles: true }))
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

// Create icon button using Shadow DOM
function createIconButton(textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement): HTMLElement {
  // Create shadow host with stable ID per textarea
  // Use textarea's position and attributes to create a stable identifier
  const rect = textArea.getBoundingClientRect()
  const textAreaId = textArea.id || textArea.getAttribute('data-id') || textArea.getAttribute('name') || ''
  const stableId = textAreaId || `textarea-${Math.round(rect.top)}-${Math.round(rect.left)}`
  const iconId = `promptprune-icon-${stableId}`
  
  // Check if an icon with this ID already exists and remove it
  const existingIcon = document.querySelector(`#${iconId}`)
  if (existingIcon) {
    console.log("[PromptPrune] Removing duplicate icon:", iconId)
    existingIcon.remove()
  }
  
  const shadowHost = document.createElement("div")
  shadowHost.id = iconId
  shadowHost.style.cssText = `
    position: fixed;
    z-index: 10000;
    pointer-events: none;
    display: none;
    top: 0;
    right: 0;
    left: auto;
    bottom: auto;
  `

  // Create shadow root
  const shadowRoot = shadowHost.attachShadow({ mode: "open" })

  // Add styles
  const style = document.createElement("style")
  style.textContent = `
    .icon-button {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: #10b981;
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      transition: all 0.2s;
      pointer-events: auto;
    }
    .icon-button:hover {
      background: #059669;
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    .icon-button:active {
      transform: scale(0.95);
    }
  `

  // Create button
  const button = document.createElement("button")
  button.className = "icon-button"
  button.textContent = "P"
  button.setAttribute("aria-label", "PromptPrune - Analyze prompt")
  button.title = "PromptPrune - Optimize your prompt"

  shadowRoot.appendChild(style)
  shadowRoot.appendChild(button)
  
  // Add tooltip on hover for pre-filled template
  let tooltip: HTMLElement | null = null
  button.addEventListener("mouseenter", () => {
    // Check if template was pre-filled
    const host = shadowHost
    if (host.getAttribute("data-template-prefilled") === "true") {
      tooltip = document.createElement("div")
      tooltip.id = "promptprune-tooltip"
      tooltip.textContent = "Template pre-filled for better framework analysis"
      tooltip.style.cssText = `
        position: fixed;
        background: rgba(0, 0, 0, 0.85);
        color: white;
        padding: 6px 10px;
        border-radius: 4px;
        font-size: 11px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: 1000002;
        pointer-events: none;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      `
      const rect = button.getBoundingClientRect()
      tooltip.style.top = `${rect.top - 30}px`
      tooltip.style.left = `${rect.left}px`
      document.body.appendChild(tooltip)
    }
  })
  
  button.addEventListener("mouseleave", () => {
    if (tooltip) {
      tooltip.remove()
      tooltip = null
    }
  })

  return shadowHost
}

// Create dropdown menu using Shadow DOM
function createDropdownMenu(textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement): HTMLElement {
  const shadowHost = document.createElement("div")
  shadowHost.id = "promptprune-dropdown-host"
  shadowHost.style.cssText = `
    position: fixed;
    z-index: 10001;
    pointer-events: none;
    display: none;
  `

  const shadowRoot = shadowHost.attachShadow({ mode: "open" })

  const style = document.createElement("style")
  style.textContent = `
    .dropdown {
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      min-width: 220px;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      pointer-events: auto;
    }
    .dropdown-item {
      padding: 12px 16px;
      cursor: pointer;
      border: none;
      background: white;
      width: 100%;
      text-align: left;
      font-size: 14px;
      color: #374151;
      transition: background 0.15s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dropdown-item:hover {
      background: #f3f4f6;
    }
    .dropdown-item:first-child {
      border-top-left-radius: 8px;
      border-top-right-radius: 8px;
    }
    .dropdown-item:last-child {
      border-bottom-left-radius: 8px;
      border-bottom-right-radius: 8px;
    }
    .dropdown-item-icon {
      font-size: 16px;
    }
    .dropdown-divider {
      height: 1px;
      background: #e5e7eb;
      margin: 4px 0;
    }
  `

  const dropdown = document.createElement("div")
  dropdown.className = "dropdown"
  dropdown.id = "promptprune-dropdown"

  // Get current mode for dropdown label
  const currentMode = (window as any).__promptprune_analysis_mode || localStorage.getItem('promptprune-analysis-mode') || 'smart'
  
  // Menu items
  const items = [
    { icon: "✨", text: currentMode === 'smart' ? "Smart Analyze" : "Basic Analyze", action: "analyze" },
    { icon: "✂️", text: "Shorten Prompt", action: "shorten" },
    { icon: "📋", text: "Choose Framework...", action: "framework" },
  ]

  items.forEach((item, index) => {
    const button = document.createElement("button")
    button.className = "dropdown-item"
    button.innerHTML = `<span class="dropdown-item-icon">${item.icon}</span><span>${item.text}</span>`
    button.addEventListener("click", () => {
      handleMenuAction(item.action, textArea)
      hideDropdown()
    })
    dropdown.appendChild(button)

    if (index < items.length - 1) {
      const divider = document.createElement("div")
      divider.className = "dropdown-divider"
      dropdown.appendChild(divider)
    }
  })

  shadowRoot.appendChild(style)
  shadowRoot.appendChild(dropdown)

  return shadowHost
}

// Handle menu actions
function handleMenuAction(action: string, textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement) {
  const text = getText(textArea)
  
  if (!text.trim()) {
    showNotification("Please enter some text first", "warning")
    return
  }

  // Keep icon visible after action
  const iconBtn = textAreaIcons.get(textArea)
  if (iconBtn) {
    iconBtn.style.display = "block"
    iconBtn.style.opacity = "1"
    iconBtn.style.visibility = "visible"
  }

  // Get current mode from global or localStorage
  const currentMode = (window as any).__promptprune_analysis_mode || localStorage.getItem('promptprune-analysis-mode') || 'smart'
  
  switch (action) {
    case "analyze":
      if (currentMode === 'smart') {
        analyzeWithSmartOptimizer(textArea, text)
      } else {
        analyzeWithBestFramework(textArea, text)
      }
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
    console.log("[PromptPrune] Stored original prompt:", currentText.substring(0, 50) + "...")
  } else if (isFrameworkOutput) {
    // Current text is framework output - use stored original
    console.log("[PromptPrune] Current text is framework output, using stored original")
  } else {
    // User has typed new text - update stored original with complete current text
    originalPrompts.set(textArea, currentText)
    console.log("[PromptPrune] Updated original prompt with current text:", currentText.substring(0, 50) + "...")
  }
  
  // Use stored original if current is framework output, otherwise use current (complete) text
  const originalPrompt = isFrameworkOutput ? (originalPrompts.get(textArea) || currentText) : currentText
  
  // Check if models are ready or cached
  const modelManager = getModelManager()
  const modelsReady = modelManager.areAnyModelsReady()
  const modelsCached = await modelManager.areModelsCached()
  
  if (!modelsReady && !modelsCached) {
    // Models not ready and not cached - show download prompt
    const download = await showModelDownloadPrompt()
    if (!download) {
      // User declined - use fallback
      analyzeWithBestFramework(textArea, text)
      return
    }
    
    // Download models with progress
    const success = await downloadModelsWithProgress()
    if (!success) {
      showNotification("Model download failed, using basic mode", "warning")
      analyzeWithBestFramework(textArea, text)
      return
    }
  } else if (!modelsReady && modelsCached) {
    // Models are cached but not loaded - load them silently
    showNotification("Loading AI models...", "info")
    try {
      await downloadModelsWithProgress()
    } catch (error) {
      console.warn("[PromptPrune] Error loading cached models:", error)
      showNotification("Error loading models, using basic mode", "warning")
      analyzeWithBestFramework(textArea, text)
      return
    }
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
    setText(textArea, result.improvedPrompt)
    
    showNotification(
      `✅ Applied ${FRAMEWORKS[result.framework].name} framework (${Math.round(result.confidence * 100)}% confidence)`,
      "success"
    )
    
    console.log("[PromptPrune] Smart analysis complete:", {
      framework: result.framework,
      confidence: result.confidence,
      intent: result.intent.category,
      warnings: result.warnings.length
    })
  } catch (error) {
    console.error("[PromptPrune] Smart analysis failed:", error)
    // Fallback to basic analysis
    showNotification("Smart analysis failed, using basic mode", "warning")
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
    console.log("[PromptPrune] Stored original prompt:", text.substring(0, 50) + "...")
  } else if (isFrameworkOutput) {
    // Current text is framework output - use stored original, don't overwrite
    console.log("[PromptPrune] Current text is framework output, using stored original")
  }
  
  // Always use original prompt for analysis
  const originalPrompt = originalPrompts.get(textArea) || text
  console.log("[PromptPrune] Using original prompt for analysis:", originalPrompt.substring(0, 50) + "...")
  
  showNotification("Analyzing...", "info")
  
  setTimeout(async () => {
    try {
      console.log("[PromptPrune] Starting framework analysis for:", originalPrompt.substring(0, 100) + "...")
      
      // Add timeout for HF models (15 seconds max - increased from 10)
      const rankingsPromise = rankFrameworks(originalPrompt)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Analysis timeout")), 15000)
      )
      
      const rankings = await Promise.race([rankingsPromise, timeoutPromise]) as Awaited<ReturnType<typeof rankFrameworks>>
      
      console.log("[PromptPrune] Framework rankings received:", rankings?.length || 0, "frameworks")
      
      if (!rankings || rankings.length === 0) {
        console.error("[PromptPrune] No frameworks ranked - rankings:", rankings)
        showNotification("Unable to analyze prompt - no frameworks matched", "error")
        return
      }

      const bestFit = rankings[0]
      console.log("[PromptPrune] Best fit framework:", bestFit.framework, "score:", bestFit.score.toFixed(1))
      
      // Always apply framework to original prompt
      const frameworkOutput = await applyFramework(originalPrompt, bestFit.framework)
      const optimized = frameworkOutput.optimized
      
      if (!optimized || optimized.trim().length === 0) {
        console.error("[PromptPrune] Framework application produced empty output")
        showNotification("Framework application produced empty output", "error")
        return
      }
      
      console.log("[PromptPrune] Framework applied successfully, output length:", optimized.length)
      setText(textArea, optimized)
      showNotification(`Applied ${FRAMEWORKS[bestFit.framework].name} framework`, "success")
    } catch (error) {
      console.error("Analysis error:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      
      // If HF models fail, try fallback without HF
      if (errorMessage.includes("timeout") || errorMessage.includes("transformers")) {
        console.log("[PromptPrune] HF models failed, using fallback...")
        try {
          // Fallback: use basic framework selection without HF
          const basicRankings = await rankFrameworks(originalPrompt).catch(() => null)
          if (basicRankings && basicRankings.length > 0) {
            const bestFit = basicRankings[0]
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
          console.log("[PromptPrune] Applying framework to original prompt:", originalPrompt.substring(0, 50) + "...")
          
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
    const textAreas = findTextAreas()
    textAreas.forEach(ta => {
      const iconBtn = textAreaIcons.get(ta)
      if (iconBtn) {
        iconBtn.style.display = "block"
        iconBtn.style.opacity = "1"
        iconBtn.style.visibility = "visible"
      }
    })
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
  const selectors = [
    'button[type="submit"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="send"]',
    'button[data-testid*="send"]',
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
        // Make sure it's actually a submit button (has text like "Send" or icon)
        const text = button.textContent?.toLowerCase() || ''
        const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || ''
        if (text.includes('send') || ariaLabel.includes('send') || button.querySelector('svg')) {
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
        const text = button.textContent?.toLowerCase() || ''
        const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || ''
        if (text.includes('send') || ariaLabel.includes('send') || button.querySelector('svg')) {
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
  sensitiveCheck: ReturnType<typeof detectSensitiveContent>
) {
  console.log("[PromptPrune] showSensitiveContentWarning called with:", {
    riskScore: sensitiveCheck.riskScore,
    items: sensitiveCheck.detectedItems.length,
    shouldBlock: sensitiveCheck.shouldBlock,
    detectedItems: sensitiveCheck.detectedItems
  })
  
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
  
  // Create modal content
  const modal = document.createElement("div")
  modal.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: slideUp 0.3s ease-out;
  `
  
  // Header
  const header = document.createElement("div")
  header.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 2px solid #fee2e2;
  `
  
  const icon = document.createElement("div")
  icon.textContent = "🚨"
  icon.style.cssText = "font-size: 32px;"
  
  const title = document.createElement("h2")
  title.textContent = "Sensitive Content Detected"
  title.style.cssText = `
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #dc2626;
  `
  
  header.appendChild(icon)
  header.appendChild(title)
  
  // Risk score
  const riskScore = document.createElement("div")
  riskScore.style.cssText = `
    background: ${sensitiveCheck.riskScore >= 70 ? '#fee2e2' : sensitiveCheck.riskScore >= 50 ? '#fef3c7' : '#dbeafe'};
    padding: 8px 12px;
    border-radius: 6px;
    margin-bottom: 16px;
    font-size: 14px;
    font-weight: 600;
    color: ${sensitiveCheck.riskScore >= 70 ? '#991b1b' : sensitiveCheck.riskScore >= 50 ? '#92400e' : '#1e40af'};
  `
  riskScore.textContent = `Risk Score: ${sensitiveCheck.riskScore}/100 ${sensitiveCheck.riskScore >= 70 ? '(CRITICAL)' : sensitiveCheck.riskScore >= 50 ? '(HIGH)' : '(MODERATE)'}`
  
  // Warning message
  const warningMsg = document.createElement("div")
  warningMsg.style.cssText = `
    color: #374151;
    font-size: 15px;
    line-height: 1.6;
    margin-bottom: 20px;
  `
  warningMsg.innerHTML = `
    <p style="margin: 0 0 12px 0; font-weight: 600;">⚠️ Your prompt contains sensitive information that could:</p>
    <ul style="margin: 0; padding-left: 20px;">
      <li>Lead to data breaches or security incidents</li>
      <li>Violate privacy regulations (GDPR, HIPAA, etc.)</li>
      <li>Expose confidential company information</li>
      <li>Result in identity theft or financial fraud</li>
    </ul>
  `
  
  // Detected items list
  const detectedList = document.createElement("div")
  detectedList.style.cssText = `
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
    max-height: 200px;
    overflow-y: auto;
  `
  
  const listTitle = document.createElement("div")
  listTitle.textContent = "Detected Issues:"
  listTitle.style.cssText = `
    font-weight: 600;
    margin-bottom: 12px;
    color: #111827;
    font-size: 14px;
  `
  detectedList.appendChild(listTitle)
  
  sensitiveCheck.detectedItems.forEach((item, index) => {
    const itemDiv = document.createElement("div")
    itemDiv.style.cssText = `
      padding: 8px;
      margin-bottom: 8px;
      background: white;
      border-left: 3px solid ${item.severity === 'high' ? '#dc2626' : item.severity === 'medium' ? '#f59e0b' : '#3b82f6'};
      border-radius: 4px;
      font-size: 13px;
    `
    itemDiv.innerHTML = `
      <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">
        ${index + 1}. ${item.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
        <span style="color: ${item.severity === 'high' ? '#dc2626' : item.severity === 'medium' ? '#f59e0b' : '#3b82f6'}; font-size: 11px; margin-left: 8px;">
          [${item.severity.toUpperCase()}]
        </span>
      </div>
      <div style="color: #6b7280; font-size: 12px;">${item.suggestion}</div>
      ${item.value ? `<div style="color: #9ca3af; font-size: 11px; margin-top: 4px; font-family: monospace;">Found: ${item.value}</div>` : ''}
    `
    detectedList.appendChild(itemDiv)
  })
  
  // Buttons
  const buttons = document.createElement("div")
  buttons.style.cssText = `
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  `
  
  const cancelBtn = document.createElement("button")
  cancelBtn.textContent = "Cancel & Edit"
  cancelBtn.style.cssText = `
    padding: 10px 20px;
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  `
  cancelBtn.onmouseover = () => {
    cancelBtn.style.background = "#e5e7eb"
  }
  cancelBtn.onmouseout = () => {
    cancelBtn.style.background = "#f3f4f6"
  }
  cancelBtn.onclick = () => {
    overlay.remove()
    textArea.focus()
  }
  
  const proceedBtn = document.createElement("button")
  proceedBtn.textContent = "Proceed Anyway (Not Recommended)"
  proceedBtn.style.cssText = `
    padding: 10px 20px;
    background: ${sensitiveCheck.riskScore >= 70 ? '#dc2626' : '#f59e0b'};
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  `
  proceedBtn.onmouseover = () => {
    proceedBtn.style.opacity = "0.9"
  }
  proceedBtn.onmouseout = () => {
    proceedBtn.style.opacity = "1"
  }
  proceedBtn.onclick = () => {
    overlay.remove()
    // Allow the original submission to proceed
    // Re-trigger the submit event
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    })
    textArea.dispatchEvent(enterEvent)
    
    // Also try clicking submit button if available
    const submitBtn = findSubmitButton(textArea)
    if (submitBtn) {
      submitBtn.click()
    }
  }
  
  buttons.appendChild(cancelBtn)
  buttons.appendChild(proceedBtn)
  
  // Assemble modal
  modal.appendChild(header)
  modal.appendChild(riskScore)
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
      overlay.remove()
      textArea.focus()
    }
  }
  
  // Close on Escape key
  const escapeHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      overlay.remove()
      textArea.focus()
      document.removeEventListener('keydown', escapeHandler)
    }
  }
  document.addEventListener('keydown', escapeHandler)
  
  document.body.appendChild(overlay)
  console.log("[PromptPrune] Warning modal added to DOM, z-index:", overlay.style.zIndex)
  
  // Focus the cancel button for accessibility
  cancelBtn.focus()
  
  // Verify modal is visible
  setTimeout(() => {
    const modalCheck = document.getElementById("promptprune-sensitive-warning")
    if (modalCheck) {
      const computed = window.getComputedStyle(modalCheck)
      console.log("[PromptPrune] Modal check - display:", computed.display, "opacity:", computed.opacity, "visibility:", computed.visibility)
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

// Position dropdown relative to icon (drop UP to avoid being cut off by responses above)
function positionDropdown(iconButton: HTMLElement, dropdown: HTMLElement) {
  const iconRect = iconButton.getBoundingClientRect()
  const dropdownElement = dropdown.shadowRoot?.querySelector(".dropdown") as HTMLElement
  const dropdownHeight = dropdownElement?.offsetHeight || 150
  
  dropdown.style.position = "fixed"
  
  // Check if there's enough space above, otherwise drop down
  const spaceAbove = iconRect.top
  const spaceBelow = window.innerHeight - iconRect.bottom
  
  // Prefer dropping UP (above icon) to avoid being cut off by prompt responses
  if (spaceAbove >= dropdownHeight + 8 || spaceAbove > spaceBelow) {
    // Drop UP (above the icon)
    dropdown.style.bottom = `${window.innerHeight - iconRect.top + 8}px`
    dropdown.style.top = "auto"
    dropdown.style.right = `${window.innerWidth - iconRect.right}px`
  } else {
    // Drop DOWN (below the icon) - fallback if not enough space above
    dropdown.style.top = `${iconRect.bottom + 8}px`
    dropdown.style.bottom = "auto"
    dropdown.style.right = `${window.innerWidth - iconRect.right}px`
  }
}

// Show dropdown
function showDropdown(textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement) {
  const dropdown = textAreaDropdowns.get(textArea)
  const iconButton = textAreaIcons.get(textArea)
  if (!dropdown || !iconButton) return
  
  positionDropdown(iconButton, dropdown)
  dropdown.style.display = "block"
  dropdown.style.pointerEvents = "auto"
}

// Hide dropdown
function hideDropdown(textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement) {
  const dropdown = textAreaDropdowns.get(textArea)
  if (dropdown) {
    dropdown.style.display = "none"
    dropdown.style.pointerEvents = "none"
  }
}


// Attach icon to textarea
function attachIconToTextArea(textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement) {
  // Skip if already attached
  if (textAreaIcons.has(textArea)) {
    console.log("[PromptPrune] Icon already attached to textarea, skipping")
    return
  }
  
  // Also check if this textarea already has an icon in the DOM (prevent duplicates)
  // Check both in parent and in document body
  const rect = textArea.getBoundingClientRect()
  const textAreaId = textArea.id || textArea.getAttribute('data-id') || textArea.getAttribute('name') || ''
  const stableId = textAreaId || `textarea-${Math.round(rect.top)}-${Math.round(rect.left)}`
  const expectedIconId = `promptprune-icon-${stableId}`
  
  const existingIcon = document.querySelector(`#${expectedIconId}`)
  if (existingIcon) {
    console.log("[PromptPrune] Existing icon found in DOM with ID:", expectedIconId, "- skipping attachment")
    // Still add to WeakMap to track it
    textAreaIcons.set(textArea, existingIcon as HTMLElement)
    return
  }
  
  // Also check for any icons near this textarea's position
  const allIcons = document.querySelectorAll('[id^="promptprune-icon-"]')
  for (const icon of Array.from(allIcons)) {
    const iconRect = icon.getBoundingClientRect()
    // If icon is very close to this textarea's position, it's likely a duplicate
    if (Math.abs(iconRect.top - rect.top) < 50 && Math.abs(iconRect.left - rect.left) < 200) {
      console.log("[PromptPrune] Icon found at similar position, removing duplicate")
      icon.remove()
    }
  }

  // Get textarea position and parent
  const parent = textArea.parentElement
  if (!parent) return

  // Create icon button
  const iconButton = createIconButton(textArea)
  textAreaIcons.set(textArea, iconButton)
  
  // Store reference for template tracking
  if (iconButton.shadowRoot) {
    const host = iconButton.shadowRoot.host as HTMLElement
    host.setAttribute("data-textarea-ref", String(Math.random()))
  }
  
  // Create dropdown
  const dropdownMenu = createDropdownMenu(textArea)
  textAreaDropdowns.set(textArea, dropdownMenu)
  document.body.appendChild(dropdownMenu)
  
  // Create dual analyze buttons (Smart and Basic)
  const { smartButton, basicButton } = createDualAnalyzeButtons(textArea, iconButton)
  textAreaSmartButtons.set(textArea, smartButton)
  textAreaBasicButtons.set(textArea, basicButton)
  document.body.appendChild(smartButton)
  document.body.appendChild(basicButton)
  
  // Track active mode
  let activeMode: 'smart' | 'basic' = (localStorage.getItem('promptprune-analysis-mode') || 'smart') as 'smart' | 'basic'
  ;(window as any).__promptprune_analysis_mode = activeMode
  
  // Wire up smart button click
  const smartButtonElement = smartButton.shadowRoot?.querySelector(".analyze-btn") as HTMLElement
  if (smartButtonElement) {
    smartButtonElement.addEventListener("click", (e) => {
      e.stopPropagation()
      e.preventDefault()
      const text = getText(textArea)
      if (!text.trim()) {
        showNotification("Please enter some text first", "warning")
        return
      }
      // Set active mode to smart
      activeMode = 'smart'
      localStorage.setItem('promptprune-analysis-mode', 'smart')
      ;(window as any).__promptprune_analysis_mode = 'smart'
      
      // Update button positions and visibility
      updateButtonPositions(smartButton, basicButton, iconButton, textArea, 'smart')
      updateFieldButtonsVisibility(textArea, 'smart')
      
      // Run smart analysis
      analyzeWithSmartOptimizer(textArea, text)
    })
  }
  
  // Wire up basic button click
  const basicButtonElement = basicButton.shadowRoot?.querySelector(".analyze-btn") as HTMLElement
  if (basicButtonElement) {
    basicButtonElement.addEventListener("click", (e) => {
      e.stopPropagation()
      e.preventDefault()
      const text = getText(textArea)
      if (!text.trim()) {
        showNotification("Please enter some text first", "warning")
        return
      }
      // Set active mode to basic
      activeMode = 'basic'
      localStorage.setItem('promptprune-analysis-mode', 'basic')
      ;(window as any).__promptprune_analysis_mode = 'basic'
      
      // Update button positions and visibility
      updateButtonPositions(smartButton, basicButton, iconButton, textArea, 'basic')
      updateFieldButtonsVisibility(textArea, 'basic')
      
      // Run basic analysis
      analyzeWithBestFramework(textArea, text)
    })
  }
  
  // Create field buttons (always create, but show/hide based on mode)
  let fieldButtonHost: HTMLElement | null = null
  try {
    fieldButtonHost = createFieldButton(textArea)
    textAreaFieldButtons.set(textArea, fieldButtonHost)
    document.body.appendChild(fieldButtonHost)
    // Initially hide if smart mode
    if (activeMode === 'smart') {
      fieldButtonHost.style.display = 'none'
    }
  } catch (error) {
    console.error("[PromptPrune] Error creating field buttons:", error)
  }
  
  // Update button positions based on initial mode
  updateButtonPositions(smartButton, basicButton, iconButton, textArea, activeMode)

  // Position icon inside textarea using fixed positioning
  const updateIconPosition = () => {
    if (!iconButton || !textArea) return
    
    // Check if textarea is still in DOM
    if (!document.body.contains(textArea) && !textArea.isConnected) {
      return
    }
    
    const rect = textArea.getBoundingClientRect()
    
    // Only position if textarea is visible and has dimensions
    if (rect.width === 0 || rect.height === 0 || rect.top < 0) {
      iconButton.style.display = "none"
      return
    }
    
    // Consistent positioning: always 8px from top and 8px from right edge of textarea
    // This ensures the icon appears in the same column across all platforms
    iconButton.style.position = "fixed"
    iconButton.style.top = `${rect.top + 8}px`
    iconButton.style.right = `${window.innerWidth - rect.right + 8}px`
    iconButton.style.left = "auto" // Ensure left is not set
    iconButton.style.bottom = "auto" // Ensure bottom is not set
    
    // Show icon if textarea has text or is focused
    const text = getText(textArea).trim()
    const isFocused = document.activeElement === textArea
    if (text.length > 0 || isFocused) {
      iconButton.style.display = "block"
      iconButton.style.opacity = "1"
      iconButton.style.visibility = "visible"
    } else {
      iconButton.style.display = "none"
    }
  }

  updateIconPosition()
  
  // Append icon to body (fixed positioning)
  document.body.appendChild(iconButton)

  // Handle icon click - toggle dropdown
  const iconButtonElement = iconButton.shadowRoot?.querySelector(".icon-button") as HTMLElement
  if (iconButtonElement) {
    iconButtonElement.addEventListener("click", (e) => {
      e.stopPropagation()
      e.preventDefault()
      const dropdown = textAreaDropdowns.get(textArea)
      if (dropdown) {
        // Check if dropdown is currently visible (check shadow host display)
        const isVisible = dropdown.style.display === "block"
        if (isVisible) {
          hideDropdown(textArea)
        } else {
          showDropdown(textArea)
        }
      }
    })
  }

  // Hide dropdown on outside click
  const handleOutsideClick = (e: MouseEvent) => {
    const dropdown = textAreaDropdowns.get(textArea)
    const iconBtn = textAreaIcons.get(textArea)
    if (dropdown && iconBtn) {
      const target = e.target as Node
      const dropdownElement = dropdown.shadowRoot?.querySelector(".dropdown")
      const iconElement = iconBtn.shadowRoot?.querySelector(".icon-button")
      
      if (dropdownElement && iconElement) {
        if (!dropdownElement.contains(target) && !iconElement.contains(target) && !textArea.contains(target)) {
          hideDropdown(textArea)
        }
      }
    }
  }

  document.addEventListener("click", handleOutsideClick, true)

  // Update position on scroll/resize
  let positionUpdateTimeout: number | null = null
  const updatePosition = () => {
    if (positionUpdateTimeout) {
      clearTimeout(positionUpdateTimeout)
    }
    positionUpdateTimeout = window.setTimeout(() => {
      updateIconPosition()
      const dropdown = textAreaDropdowns.get(textArea)
      const iconBtn = textAreaIcons.get(textArea)
      if (dropdown && dropdown.style.display === "block" && iconBtn) {
        positionDropdown(iconBtn, dropdown)
      }
    }, 10)
  }

  // Combined position update for icon, smart button, toggle, and field buttons
  const updateAllPositions = () => {
    updatePosition()
    
    // Update dual button positions
    const smartBtn = textAreaSmartButtons.get(textArea)
    const basicBtn = textAreaBasicButtons.get(textArea)
    if (smartBtn && basicBtn && iconButton && textArea && textArea.isConnected) {
      const activeMode = (window as any).__promptprune_analysis_mode || localStorage.getItem('promptprune-analysis-mode') || 'smart'
      updateButtonPositions(smartBtn, basicBtn, iconButton, textArea, activeMode as 'smart' | 'basic')
      
      // Show/hide based on textarea visibility
      const rect = textArea.getBoundingClientRect()
      const text = getText(textArea).trim()
      const isFocused = document.activeElement === textArea
      if ((text.length > 0 || isFocused) && rect.width > 0 && rect.height > 0) {
        smartBtn.style.display = "block"
        basicBtn.style.display = "block"
      } else {
        smartBtn.style.display = "none"
        basicBtn.style.display = "none"
      }
    }
    
    // Update field button position - align BELOW Basic button in same column
    const fieldBtn = textAreaFieldButtons.get(textArea)
    const iconBtn = textAreaIcons.get(textArea)
    if (fieldBtn && iconBtn && textArea && textArea.isConnected) {
      const rect = textArea.getBoundingClientRect()
      const iconRect = iconBtn.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        // Position field buttons below Basic button (which is below Smart button)
        // Same left alignment as Smart/Basic buttons (right of P icon)
        const iconLeft = iconRect.left
        const iconWidth = iconRect.width || 28
        const buttonGap = 8
        const basicTop = iconRect.top + 36 // Basic button is 36px below P icon
        
        fieldBtn.style.position = "fixed"
        fieldBtn.style.top = `${basicTop + 36}px` // Below Basic button (28px button + 8px gap)
        fieldBtn.style.left = `${iconLeft + iconWidth + buttonGap}px` // Same left as Smart/Basic buttons
        fieldBtn.style.right = "auto"
        fieldBtn.style.bottom = "auto"
        fieldBtn.style.zIndex = "10001"
        fieldBtn.style.visibility = "visible"
        fieldBtn.style.opacity = "1"
      }
    }
  }
  
  window.addEventListener("scroll", updateAllPositions, true)
  window.addEventListener("resize", updateAllPositions)

  // Make buttons draggable (P icon + field buttons + analyze buttons)
  const fieldButton = textAreaFieldButtons.get(textArea)
  const smartBtn = textAreaSmartButtons.get(textArea)
  const basicBtn = textAreaBasicButtons.get(textArea)
  if (fieldButton && smartBtn && basicBtn) {
    makeButtonsDraggable(textArea, iconButton, fieldButton, smartBtn, basicBtn)
  }

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
        
        // Debug logging
        console.log("[PromptPrune] Follow-up detection:", {
          hasRoleBefore,
          globalRoleProvided,
          hasPreviousMessages,
          hasRoleInPreviousMessages,
          isFollowUp,
          textAreaId: textArea.id || "no-id"
        })
        
        // Use different template for follow-ups
        // Follow-ups: Only Task (with default "Summarize in 100 words") and Context
        // First prompts: Role, Task, Topic, Format, Tone
        let template: string
        if (isFollowUp) {
          template = generateFollowUpTemplate()
          // Verify template is correct (should only have Task and Context)
          console.log("[PromptPrune] Follow-up template (role provided:", hasRoleBefore, ", has messages:", hasPreviousMessages, "):", template)
        } else {
          template = generateFirstPromptTemplate()
          console.log("[PromptPrune] First prompt template:", template)
        }
        
        // Set the template text
        setText(textArea, template)
        templatePreFilled = true
        
        // Track if role is in the template (for future follow-up detection)
        // This helps detect follow-ups even if DOM detection fails
        if (!isFollowUp && hasRoleInText(template)) {
          roleProvidedInFirstPrompt.set(textArea, true)
          globalRoleProvided = true // Set global flag too
          console.log("[PromptPrune] Role detected in first prompt template, marking for follow-ups")
        } else if (isFollowUp) {
          console.log("[PromptPrune] Follow-up detected - using follow-up template")
        }
        
        // Show minimal notification
        setTimeout(() => {
          const message = isFollowUp 
            ? "✨ Context-aware template ready" 
            : "✨ Template pre-filled for better results"
          showMinimalNotification(message)
        }, 300)
        
        // Store in icon for tooltip
        const iconBtn = textAreaIcons.get(textArea)
        if (iconBtn && iconBtn.shadowRoot) {
          const host = iconBtn.shadowRoot.host as HTMLElement
          host.setAttribute("data-template-prefilled", "true")
        }
        
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
      console.log("[PromptPrune] Role detected in user input, marking for follow-ups")
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
      console.log("[PromptPrune] New conversation detected, reset role tracking")
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
    const iconBtn = textAreaIcons.get(textArea)
    if (iconBtn) {
      // Update position first
      updateIconPosition()
      // Then ensure visibility
      iconBtn.style.display = "block"
      iconBtn.style.opacity = "1"
      iconBtn.style.visibility = "visible"
    }
    
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
      const iconBtn = textAreaIcons.get(textArea)
      const dropdown = textAreaDropdowns.get(textArea)
      const hasText = getText(textArea).trim().length > 0
      
      // Don't hide if:
      // 1. Textarea is still focused
      // 2. Dropdown is open
      // 3. Framework UI is open
      // 4. Textarea has text (keep visible for easy access)
      if (iconBtn && document.activeElement !== textArea) {
        const dropdownElement = dropdown?.shadowRoot?.querySelector(".dropdown")
        const isDropdownOpen = dropdownElement && dropdownElement.style.display === "block"
        const isFrameworkUIOpen = frameworkUI && frameworkUI.style.display === "block"
        
        // Only hide if dropdown is closed, framework UI is closed, no text, and not focused
        if (!isDropdownOpen && !isFrameworkUIOpen && !hasText && document.activeElement !== textArea) {
          iconBtn.style.opacity = "0"
          setTimeout(() => {
            const iconBtn2 = textAreaIcons.get(textArea)
            if (iconBtn2 && document.activeElement !== textArea && !hasText) {
              const dropdown2 = textAreaDropdowns.get(textArea)
              const dropdownElement2 = dropdown2?.shadowRoot?.querySelector(".dropdown")
              const isDropdownOpen2 = dropdownElement2 && dropdownElement2.style.display === "block"
              const isFrameworkUIOpen2 = frameworkUI && frameworkUI.style.display === "block"
              
              // Double check before hiding
              const currentText = getText(textArea).trim()
              if (!isDropdownOpen2 && !isFrameworkUIOpen2 && document.activeElement !== textArea && !currentText) {
                iconBtn2.style.display = "none"
                iconBtn2.style.visibility = "hidden"
              } else {
                // Show it again if conditions changed
                iconBtn2.style.display = "block"
                iconBtn2.style.opacity = "1"
                iconBtn2.style.visibility = "visible"
              }
            }
          }, 200)
        } else {
          // Keep icon visible if any condition is met
          iconBtn.style.display = "block"
          iconBtn.style.opacity = "1"
          iconBtn.style.visibility = "visible"
        }
      }
    }, 150)
  }

  textArea.addEventListener("focus", (e) => {
    showIcon()
    // Pre-fill template on focus if empty
    preFillTemplate(e)
  }, true)
  textArea.addEventListener("blur", hideIcon, true)
  textArea.addEventListener("input", (e) => {
    if (document.activeElement === textArea) {
      updateIconPosition()
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
    const iconBtn = textAreaIcons.get(textArea)
    if (iconBtn) {
      if (currentText.length > 0 || document.activeElement === textArea) {
        iconBtn.style.display = "block"
        iconBtn.style.opacity = "1"
        iconBtn.style.visibility = "visible"
        updateIconPosition()
      }
    }
    // Reset original prompt when user significantly changes the text
    // This also tracks role in the text (see resetOriginalPrompt function)
    resetOriginalPrompt(e)
  }, true)
  
  // Also track when user submits/sends the message (Enter key or submit button)
  console.log("[PromptPrune] Attaching keydown listener to textarea for sensitive content detection")
  textArea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      const currentText = getText(textArea).trim()
      console.log("[PromptPrune] Enter key pressed, text length:", currentText.length)
      if (currentText.length > 0) {
        // Check for sensitive content BEFORE submission
        const sensitiveCheck = detectSensitiveContent(currentText)
        console.log("[PromptPrune] Sensitive content check:", {
          hasSensitiveContent: sensitiveCheck.hasSensitiveContent,
          riskScore: sensitiveCheck.riskScore,
          detectedItems: sensitiveCheck.detectedItems.length,
          items: sensitiveCheck.detectedItems
        })
        if (sensitiveCheck.hasSensitiveContent) {
          console.log("[PromptPrune] BLOCKING submission - sensitive content detected!")
          // Prevent default submission
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          
          // Show warning modal
          showSensitiveContentWarning(textArea, currentText, sensitiveCheck)
          return false
        }
        
        // Track role if no sensitive content
        if (hasRoleInText(currentText)) {
          roleProvidedInFirstPrompt.set(textArea, true)
          globalRoleProvided = true // Set global flag too
          console.log("[PromptPrune] Role detected before sending message, marking for follow-ups")
        }
      }
    }
  }, true)
  
  // Also intercept submit button clicks - use MutationObserver to catch dynamically added buttons
  const setupSubmitButtonListener = () => {
    const submitButton = findSubmitButton(textArea)
    if (submitButton) {
      // Remove old listener if exists
      const existingListener = (submitButton as any).__promptprune_listener
      if (existingListener) {
        submitButton.removeEventListener("click", existingListener, true)
      }
      
      const listener = (e: Event) => {
        const currentText = getText(textArea).trim()
        console.log("[PromptPrune] Submit button clicked, text length:", currentText.length)
        if (currentText.length > 0) {
          const sensitiveCheck = detectSensitiveContent(currentText)
          console.log("[PromptPrune] Submit button - Sensitive content check:", {
            hasSensitiveContent: sensitiveCheck.hasSensitiveContent,
            riskScore: sensitiveCheck.riskScore,
            detectedItems: sensitiveCheck.detectedItems.length,
            items: sensitiveCheck.detectedItems
          })
          if (sensitiveCheck.hasSensitiveContent) {
            console.log("[PromptPrune] BLOCKING submit button - sensitive content detected!")
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
            showSensitiveContentWarning(textArea, currentText, sensitiveCheck)
            return false
          }
        }
      }
      
      submitButton.addEventListener("click", listener, true)
      ;(submitButton as any).__promptprune_listener = listener
      console.log("[PromptPrune] Submit button listener attached successfully")
    } else {
      console.log("[PromptPrune] No submit button found, will retry on DOM changes")
    }
  }
  
  // Setup initially
  setupSubmitButtonListener()
  
  // Also try to setup after a short delay (in case button is added dynamically)
  setTimeout(() => {
    setupSubmitButtonListener()
  }, 1000)
  
  // Re-setup if DOM changes (for dynamically added buttons)
  const observer = new MutationObserver(() => {
    setupSubmitButtonListener()
  })
  
  // Observe parent container for button changes
  let submitButtonParent = textArea.parentElement
  let depth = 0
  while (submitButtonParent && depth < 3) {
    observer.observe(submitButtonParent, { childList: true, subtree: true })
    submitButtonParent = submitButtonParent.parentElement
    depth++
  }
  
  // Expose test function for this textarea
  ;(textArea as any).__testSensitiveDetection = (testText?: string) => {
    const text = testText || getText(textArea).trim()
    console.log("[PromptPrune] Testing sensitive detection with text:", text.substring(0, 100))
    const result = detectSensitiveContent(text)
    console.log("[PromptPrune] Detection result:", result)
    if (result.hasSensitiveContent) {
      showSensitiveContentWarning(textArea, text, result)
    } else {
      console.log("[PromptPrune] No sensitive content detected")
    }
    return result
  }
  console.log("[PromptPrune] Test function available: textarea.__testSensitiveDetection('your text here')")
}

// Expose test functions globally for browser console testing
// Note: Content scripts run in isolated world, so we need to inject into page context
if (typeof window !== "undefined") {
  // First, expose in content script context (for internal use)
  ;(window as any).testComplexPrompt = testComplexPrompt
  ;(window as any).quickTestShorten = quickTestShorten
  ;(window as any).quickTestFrameworkSwitching = quickTestFrameworkSwitching
  ;(window as any).testSmartOptimizer = testSmartOptimizer
  ;(window as any).runAllPromptTests = runAllTests
  ;(window as any).quickPromptTest = quickTest
  ;(window as any).PROMPT_TEST_CASES = PROMPT_TEST_CASES
  
  // Inject into page context (so user can access from page console)
  // Use a more reliable injection method that works even with CSP
  function injectTestBridge() {
    try {
      // Check if already injected
      if ((document as any).__promptpruneBridgeInjected) {
        console.log('[PromptPrune] Test bridge already injected, skipping')
        return
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
  
  console.log("🧪 PromptPrune Test Functions Available (Page Context):");
  console.log("  - runAllPromptTests() - Run comprehensive test suite with 20+ prompt types");
  console.log("  - quickPromptTest('your prompt') - Quick test for a specific prompt");
  console.log("  - PROMPT_TEST_CASES - Array of all test cases");
  console.log("\\n💡 To test: await runAllPromptTests()");
  console.log("\\n✅ Test bridge ready!");
})();
`
      
      script.textContent = bridgeCode
      
      // Inject into page
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
  
  // Inject immediately and also on DOM ready
  if (document.head || document.documentElement) {
    console.log('[PromptPrune] Attempting to inject test bridge...')
    injectTestBridge()
  } else {
    console.warn('[PromptPrune] Document head/body not available yet')
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[PromptPrune] DOM loaded, injecting test bridge...')
      injectTestBridge()
    })
  } else {
    // DOM already ready, inject after a short delay to ensure page is ready
    setTimeout(() => {
      console.log('[PromptPrune] DOM ready, injecting test bridge...')
      injectTestBridge()
    }, 100)
  }
  
  // Also try injecting after page fully loads
  window.addEventListener('load', () => {
    console.log('[PromptPrune] Page loaded, injecting test bridge...')
    setTimeout(injectTestBridge, 200)
  })
  
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
  
  console.log("🧪 PromptPrune Test Functions Available (Content Script):")
  console.log("  - runAllPromptTests() - Run comprehensive test suite with 20+ prompt types")
  console.log("  - quickPromptTest('your prompt') - Quick test for a specific prompt")
  console.log("  - PROMPT_TEST_CASES - Array of all test cases")
}

// Initialize
function init() {
  const textAreas = findTextAreas()
  
  if (textAreas.length === 0) {
    setTimeout(init, 1000)
    return
  }

  // Attach to all textareas
  textAreas.forEach(textArea => {
    attachIconToTextArea(textArea)
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
}

// Start when page is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  setTimeout(init, 500)
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
      
      // Double check it's valid and not already attached
      if (!textAreaIcons.has(textArea) && textArea.isConnected) {
        if (rect.width > 0 && rect.height > 0 && textArea.offsetParent !== null) {
          attachIconToTextArea(textArea)
        }
      }
    })
  }, 300)
})

observer.observe(document.body, {
  childList: true,
  subtree: true,
})

// Re-initialize on navigation (for SPAs)
let lastUrl = location.href
const urlObserver = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    setTimeout(init, 1000)
  }
})

urlObserver.observe(document, { subtree: true, childList: true })
