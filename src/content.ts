/**
 * Content Script - Inline Icon Button (Grammarly-style)
 * Shows "P" icon inside textarea when focused, with dropdown menu
 */

import type { PlasmoCSConfig } from "plasmo"
import { compressPrompt } from "~/lib/prompt-compressor"
import { applyFramework, rankFrameworks, FRAMEWORKS, type FrameworkType } from "~/lib/prompt-frameworks"
import { getAllTokenCounts } from "~/lib/tokenizers"

export const config: PlasmoCSConfig = {
  matches: [
    "https://chat.openai.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*",
    "https://www.perplexity.ai/*",
    "https://poe.com/*",
  ],
  run_at: "document_idle",
}

// PromptPrune content script loaded

// Track icons and dropdowns per textarea
const textAreaIcons = new WeakMap<HTMLTextAreaElement | HTMLDivElement, HTMLElement>()
const textAreaDropdowns = new WeakMap<HTMLTextAreaElement | HTMLDivElement, HTMLElement>()
let frameworkUI: HTMLElement | null = null

// Enhanced platform detection
function findTextAreas(): Array<HTMLTextAreaElement | HTMLDivElement> {
  const textAreas: Array<HTMLTextAreaElement | HTMLDivElement> = []
  
  // ChatGPT - multiple selectors
  const chatgptSelectors = [
    "#prompt-textarea",
    "textarea[data-id='root']",
    "textarea[placeholder*='Message']",
    "textarea[id*='prompt']",
    "textarea[aria-label*='message']",
    "textarea[aria-label*='Message']",
  ]
  
  for (const selector of chatgptSelectors) {
    const elements = document.querySelectorAll(selector)
    elements.forEach(el => {
      if (el instanceof HTMLTextAreaElement && !textAreas.includes(el)) {
        textAreas.push(el)
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
      if (el instanceof HTMLDivElement && el.isContentEditable && !textAreas.includes(el)) {
        textAreas.push(el)
      }
    })
  }

  // Gemini
  const geminiElements = document.querySelectorAll("textarea[aria-label*='prompt']")
  geminiElements.forEach(el => {
    if (el instanceof HTMLTextAreaElement && !textAreas.includes(el)) {
      textAreas.push(el)
    }
  })

  return textAreas
}

function getText(element: HTMLTextAreaElement | HTMLDivElement): string {
  if (element instanceof HTMLTextAreaElement) {
    return element.value
  }
  return element.innerText || element.textContent || ""
}

function setText(element: HTMLTextAreaElement | HTMLDivElement, text: string): void {
  if (element instanceof HTMLTextAreaElement) {
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
function createIconButton(textArea: HTMLTextAreaElement | HTMLDivElement): HTMLElement {
  // Create shadow host
  const shadowHost = document.createElement("div")
  shadowHost.id = "promptprune-icon-host"
  shadowHost.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 10000;
    pointer-events: none;
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
  button.title = "PromptPrune - Click to analyze your prompt"

  shadowRoot.appendChild(style)
  shadowRoot.appendChild(button)

  return shadowHost
}

// Create dropdown menu using Shadow DOM
function createDropdownMenu(textArea: HTMLTextAreaElement | HTMLDivElement): HTMLElement {
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

  // Menu items
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
function handleMenuAction(action: string, textArea: HTMLTextAreaElement | HTMLDivElement) {
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
function analyzeWithBestFramework(textArea: HTMLTextAreaElement | HTMLDivElement, text: string) {
  showNotification("Analyzing...", "info")
  
  setTimeout(() => {
    try {
      const rankings = rankFrameworks(text)
      if (rankings.length === 0) {
        showNotification("Unable to analyze prompt", "error")
        return
      }

      const bestFit = rankings[0]
      const optimized = bestFit.output.optimized
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
  
  if (hostname.includes("openai.com") || hostname.includes("chatgpt.com")) {
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
    return { platform: "Perplexity", model: "pplx-70b-online" }
  } else if (hostname.includes("poe.com")) {
    return { platform: "Poe", model: "gpt-4" }
  }
  
  // Default to OpenAI GPT-4
  return { platform: "OpenAI", model: "gpt-4" }
}

// Shorten prompt with token reduction display
async function shortenPrompt(textArea: HTMLTextAreaElement | HTMLDivElement, text: string) {
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

// Show framework selector
function showFrameworkSelector(textArea: HTMLTextAreaElement | HTMLDivElement, text: string) {
  if (!frameworkUI) {
    frameworkUI = createFrameworkUI(textArea)
    document.body.appendChild(frameworkUI)
  }

  const content = frameworkUI.querySelector("#promptprune-framework-content")!
  content.innerHTML = "<div style='text-align: center; padding: 20px;'>⏳ Analyzing frameworks...</div>"
  frameworkUI.style.display = "block"

  setTimeout(() => {
    try {
      const rankings = rankFrameworks(text)
      
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
          const optimized = rank.output.optimized
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
function createFrameworkUI(textArea: HTMLTextAreaElement | HTMLDivElement): HTMLElement {
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

// Position dropdown relative to icon
function positionDropdown(iconButton: HTMLElement, dropdown: HTMLElement) {
  const iconRect = iconButton.getBoundingClientRect()
  
  dropdown.style.position = "fixed"
  dropdown.style.top = `${iconRect.bottom + 8}px`
  dropdown.style.right = `${window.innerWidth - iconRect.right}px`
}

// Show dropdown
function showDropdown(textArea: HTMLTextAreaElement | HTMLDivElement) {
  const dropdown = textAreaDropdowns.get(textArea)
  const iconButton = textAreaIcons.get(textArea)
  if (!dropdown || !iconButton) return
  
  positionDropdown(iconButton, dropdown)
  dropdown.style.display = "block"
  dropdown.style.pointerEvents = "auto"
}

// Hide dropdown
function hideDropdown(textArea: HTMLTextAreaElement | HTMLDivElement) {
  const dropdown = textAreaDropdowns.get(textArea)
  if (dropdown) {
    dropdown.style.display = "none"
  }
}

// Attach icon to textarea
function attachIconToTextArea(textArea: HTMLTextAreaElement | HTMLDivElement) {
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
  
  // Create dropdown
  const dropdownMenu = createDropdownMenu(textArea)
  textAreaDropdowns.set(textArea, dropdownMenu)
  document.body.appendChild(dropdownMenu)

  // Position icon inside textarea using fixed positioning
  const updateIconPosition = () => {
    if (!iconButton || !textArea) return
    const rect = textArea.getBoundingClientRect()
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
    
    // Position at top-right corner of textarea
    iconButton.style.position = "fixed"
    iconButton.style.top = `${rect.top + scrollTop + 8}px`
    iconButton.style.right = `${window.innerWidth - rect.right - scrollLeft + 8}px`
    iconButton.style.display = "none" // Hidden by default, shown on focus
  }

  updateIconPosition()
  
  // Append icon to body (fixed positioning)
  document.body.appendChild(iconButton)

  // Handle icon click
  const iconButtonElement = iconButton.shadowRoot?.querySelector(".icon-button") as HTMLElement
  if (iconButtonElement) {
    iconButtonElement.addEventListener("click", (e) => {
      e.stopPropagation()
      e.preventDefault()
      const dropdown = textAreaDropdowns.get(textArea)
      if (dropdown && dropdown.style.display === "block") {
        hideDropdown(textArea)
      } else {
        showDropdown(textArea)
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

  window.addEventListener("scroll", updatePosition, true)
  window.addEventListener("resize", updatePosition)

  // Show icon on focus
  const showIcon = () => {
    const iconBtn = textAreaIcons.get(textArea)
    if (iconBtn) {
      updateIconPosition()
      iconBtn.style.display = "block"
      iconBtn.style.opacity = "1"
      iconBtn.style.visibility = "visible"
    }
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
        
        if (!isDropdownOpen && !isFrameworkUIOpen && !hasText) {
          iconBtn.style.opacity = "0"
          setTimeout(() => {
            const iconBtn2 = textAreaIcons.get(textArea)
            if (iconBtn2 && document.activeElement !== textArea && !hasText) {
              const dropdown2 = textAreaDropdowns.get(textArea)
              const dropdownElement2 = dropdown2?.shadowRoot?.querySelector(".dropdown")
              const isDropdownOpen2 = dropdownElement2 && dropdownElement2.style.display === "block"
              const isFrameworkUIOpen2 = frameworkUI && frameworkUI.style.display === "block"
              
              if (!isDropdownOpen2 && !isFrameworkUIOpen2) {
                iconBtn2.style.display = "none"
                iconBtn2.style.visibility = "hidden"
              }
            }
          }, 200)
        }
      }
    }, 150)
  }

  textArea.addEventListener("focus", showIcon, true)
  textArea.addEventListener("blur", hideIcon, true)
  textArea.addEventListener("input", () => {
    if (document.activeElement === textArea) {
      updateIconPosition()
    }
  }, true)

  // Show icon initially if textarea has focus or has text
  const initialText = getText(textArea).trim()
  if (document.activeElement === textArea || initialText.length > 0) {
    showIcon()
  }
  
  // Show icon when text is added
  textArea.addEventListener("input", () => {
    const currentText = getText(textArea).trim()
    if (currentText.length > 0) {
      const iconBtn = textAreaIcons.get(textArea)
      if (iconBtn) {
        iconBtn.style.display = "block"
        iconBtn.style.opacity = "1"
        iconBtn.style.visibility = "visible"
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
}

// Start when page is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  setTimeout(init, 500)
}

// Watch for new textareas (SPA navigation)
const observer = new MutationObserver(() => {
  const textAreas = findTextAreas()
  textAreas.forEach(textArea => {
    if (!textAreaIcons.has(textArea)) {
      attachIconToTextArea(textArea)
    }
  })
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
