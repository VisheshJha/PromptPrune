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
const textAreaFieldButtons = new WeakMap<HTMLTextAreaElement | HTMLDivElement | HTMLInputElement | HTMLInputElement, HTMLElement>()
let frameworkUI: HTMLElement | null = null

// Helper to add element to textareas if valid and not seen
function addIfValid(
  el: HTMLElement,
  textAreas: Array<HTMLTextAreaElement | HTMLDivElement | HTMLInputElement>,
  seen: WeakSet<HTMLElement>
): boolean {
  if (seen.has(el)) return false
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
  // Create shadow host with unique ID per textarea
  const shadowHost = document.createElement("div")
  shadowHost.id = `promptprune-icon-host-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
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

  // Menu items (summary removed - only shown for follow-ups as separate button)
  const items = [
    { icon: "✨", text: "Analyze with Best Framework", action: "analyze" },
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

  switch (action) {
    case "analyze":
      analyzeWithBestFramework(textArea, text)
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

// Analyze with best framework
function analyzeWithBestFramework(textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement, text: string) {
  // Store original prompt if not already stored
  if (!originalPrompts.has(textArea)) {
    originalPrompts.set(textArea, text)
  }
  
  // Always use original prompt for analysis
  const originalPrompt = originalPrompts.get(textArea) || text
  
  showNotification("Analyzing...", "info")
  
  setTimeout(() => {
    try {
      const rankings = rankFrameworks(originalPrompt)
      if (rankings.length === 0) {
        showNotification("Unable to analyze prompt", "error")
        return
      }

      const bestFit = rankings[0]
      // Always apply framework to original prompt
      const frameworkOutput = applyFramework(originalPrompt, bestFit.framework)
      const optimized = frameworkOutput.optimized
      setText(textArea, optimized)
      showNotification(`Applied ${FRAMEWORKS[bestFit.framework].name} framework`, "success")
    } catch (error) {
      console.error("Analysis error:", error)
      showNotification("Analysis failed", "error")
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

  setTimeout(() => {
    try {
      // Always use original prompt for ranking and framework application
      const rankings = rankFrameworks(originalPrompt)
      
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
        frameworkCard.addEventListener("click", () => {
          // CRITICAL: Always use the stored original prompt, never the current textarea content
          // This prevents framework-to-framework duplication of words like "action", "you are", etc.
          const storedOriginal = originalPrompts.get(textArea)
          if (!storedOriginal) {
            // If no stored original, store the current text as original before applying framework
            const currentText = getText(textArea).trim()
            originalPrompts.set(textArea, currentText)
          }
          const originalPrompt = originalPrompts.get(textArea) || text
          
          // Apply framework to the ORIGINAL prompt only
          const frameworkOutput = applyFramework(originalPrompt, rank.framework)
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
    return
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

  // Combined position update for both icon and field buttons
  const updateAllPositions = () => {
    updatePosition()
    // Update field button position - align with P icon column
    const btn = textAreaFieldButtons.get(textArea)
    const iconBtn = textAreaIcons.get(textArea)
    if (btn && textArea && textArea.isConnected) {
      const rect = textArea.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        // Position field buttons in the same column as P icon (same right offset)
        btn.style.position = "fixed"
        btn.style.top = `${Math.max(0, rect.top + 36)}px`
        btn.style.right = `${window.innerWidth - rect.right + 8}px` // Same right offset as P icon
        btn.style.left = "auto"
        btn.style.bottom = "auto"
        btn.style.zIndex = "10001"
        btn.style.visibility = "visible"
        btn.style.opacity = "1"
      }
    }
  }
  
  window.addEventListener("scroll", updateAllPositions, true)
  window.addEventListener("resize", updateAllPositions)

  // Create and attach field button (ensure it's created for all platforms)
  try {
    const fieldButton = createFieldButton(textArea)
    textAreaFieldButtons.set(textArea, fieldButton)
    document.body.appendChild(fieldButton)
    
    // Position field button (debounced for performance)
    let positionTimeout: ReturnType<typeof setTimeout> | null = null
    const updateFieldButtonPosition = () => {
      if (positionTimeout) clearTimeout(positionTimeout)
      positionTimeout = setTimeout(() => {
        const btn = textAreaFieldButtons.get(textArea)
        if (!btn || !textArea) return
        
        // Check if textarea is still valid
        if (!textArea.isConnected) return
        
        const rect = textArea.getBoundingClientRect()
        
        // Only position if textarea is visible
        if (rect.width === 0 || rect.height === 0) {
          btn.style.display = "none"
          return
        }
        
        // Position field buttons on the right side, below the P icon (which is at rect.top + 8)
        // Field buttons should be below the icon, so add icon height (28px) + gap (8px) = 36px
        // Use same right offset as P icon for consistent column alignment
        btn.style.position = "fixed"
        btn.style.top = `${Math.max(0, rect.top + 36)}px`
        btn.style.right = `${window.innerWidth - rect.right + 8}px` // Same right offset as P icon
        btn.style.left = "auto"
        btn.style.bottom = "auto"
        btn.style.zIndex = "10001"
        btn.style.visibility = "visible"
        btn.style.opacity = "1"
        
        // Ensure buttons are visible if textarea has text or is focused
        const text = getText(textArea).trim()
        const isFocused = document.activeElement === textArea
        if (text.length > 0 || isFocused) {
          btn.style.display = "flex"
        }
      }, 50)
    }
    
    updateFieldButtonPosition()
    window.addEventListener("scroll", updateFieldButtonPosition, true)
    window.addEventListener("resize", updateFieldButtonPosition)
  } catch (error) {
    console.error("Error creating field button:", error)
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
  textArea.addEventListener("keydown", (e) => {
    // Track role before message is sent (final check)
    if (e.key === "Enter" && !e.shiftKey) {
      const currentText = getText(textArea).trim()
      if (currentText.length > 0 && hasRoleInText(currentText)) {
        roleProvidedInFirstPrompt.set(textArea, true)
        globalRoleProvided = true // Set global flag too
        console.log("[PromptPrune] Role detected before sending message, marking for follow-ups")
      }
    }
  }, true)
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
    textAreas.forEach(textArea => {
      // Double check it's valid and not already attached
      if (!textAreaIcons.has(textArea) && textArea.isConnected) {
        const rect = textArea.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
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
