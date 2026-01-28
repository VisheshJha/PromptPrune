/**
 * Content Script - Inline Icon Button (Grammarly-style)
 * Shows "P" icon inside textarea when focused, with dropdown menu
 */

import type { PlasmoCSConfig } from "plasmo"
import { compressPrompt } from "~/lib/prompt-compressor"
import { applyFramework, rankFrameworks, FRAMEWORKS, type FrameworkType } from "~/lib/prompt-frameworks"
import { getAllTokenCounts } from "~/lib/tokenizers"

declare global {
  interface Window {
    hasCapsuleListeners?: boolean;
  }
}

import { getCapsuleUI } from "~/content/capsule-ui"

import { detectSensitiveContent, type SensitiveContentResult } from "~/lib/sensitive-content-detector"

import { RealTimeAssistant } from "~/components/realtime"
import { getPreviewModal } from "~/content/preview-modal"
import { authService, type AuditLogData } from "~/lib/auth-service"

// "Extension context invalidated" is thrown when the extension is reloaded (e.g. HMR) while the
// content script is still running. Chrome APIs (runtime, storage) throw; we catch and degrade.
const EXT_CTX_INVALID = 'Extension context invalidated.'
function isExtCtxInvalid(e: unknown): boolean {
  return (e instanceof Error && e.message === EXT_CTX_INVALID) || String(e) === EXT_CTX_INVALID
}

export const config: PlasmoCSConfig = {
  matches: [
    // Major AI Chat Platforms
    "https://chat.openai.com/*",
    "https://chatgpt.com/*",
    "https://www.chatgpt.com/*",
    "https://claude.ai/*",
    "https://www.claude.ai/*",
    "https://console.anthropic.com/*",
    "https://gemini.google.com/*",
    "https://gemini.google.com/app/*",
    "https://bard.google.com/*",
    "https://copilot.microsoft.com/*",
    "https://www.copilot.microsoft.com/*",
    "https://*.copilot.microsoft.com/*",
    "https://www.bing.com/chat/*",
    "https://bing.com/chat/*",
    "https://www.perplexity.ai/*",
    "https://perplexity.ai/*",

    // AI-Powered Productivity Tools
    "https://www.canva.com/*",
    "https://canva.com/*",
    "https://www.notion.so/*",
    "https://notion.so/*",
    "https://www.jasper.ai/*",
    "https://jasper.ai/*",
    "https://www.copy.ai/*",
    "https://copy.ai/*",
    "https://www.grammarly.com/*",
    "https://grammarly.com/*",
    "https://www.quillbot.com/*",
    "https://quillbot.com/*",
    "https://www.wordtune.com/*",
    "https://wordtune.com/*",
    "https://www.rytr.me/*",
    "https://rytr.me/*",
    "https://writesonic.com/*",
    "https://www.writesonic.com/*",

    // AI Development Tools
    "https://github.com/*",
    "https://cursor.sh/*",
    "https://www.cursor.sh/*",
    "https://codeium.com/*",
    "https://www.codeium.com/*",
    "https://www.tabnine.com/*",
    "https://tabnine.com/*",
    "https://replit.com/*",
    "https://www.replit.com/*",
    "https://sourcegraph.com/*",
    "https://www.sourcegraph.com/*",

    // AI Research & Analysis
    "https://elicit.com/*",
    "https://www.elicit.com/*",
    "https://consensus.app/*",
    "https://www.consensus.app/*",
    "https://www.scholarcy.com/*",
    "https://scholarcy.com/*",
    "https://www.semanticscholar.org/*",
    "https://semanticscholar.org/*",

    // AI Image & Design
    "https://www.midjourney.com/*",
    "https://midjourney.com/*",
    "https://labs.openai.com/*",
    "https://www.leonardo.ai/*",
    "https://leonardo.ai/*",
    "https://www.figma.com/*",
    "https://figma.com/*",
    "https://www.adobe.com/*",
    "https://adobe.com/*",
    "https://www.runwayml.com/*",
    "https://runwayml.com/*",

    // AI Video & Media
    "https://www.synthesia.io/*",
    "https://synthesia.io/*",
    "https://lumalabs.ai/*",
    "https://www.lumalabs.ai/*",
    "https://pika.art/*",
    "https://www.pika.art/*",
    "https://www.descript.com/*",
    "https://descript.com/*",

    // AI Business & Marketing Tools
    "https://surferseo.com/*",
    "https://www.surferseo.com/*",
    "https://www.frase.io/*",
    "https://frase.io/*",
    "https://outranking.io/*",
    "https://www.outranking.io/*",
    "https://anyword.com/*",
    "https://www.anyword.com/*",

    // AI Platforms & APIs
    "https://character.ai/*",
    "https://www.character.ai/*",
    "https://huggingface.co/*",
    "https://*.huggingface.co/*",
    "https://replicate.com/*",
    "https://www.replicate.com/*",
    "https://platform.openai.com/*",
    "https://aistudio.google.com/*",
    "https://cohere.com/*",
    "https://www.cohere.com/*",
    "https://www.ai21.com/*",
    "https://ai21.com/*",
    "https://you.com/*",
    "https://www.you.com/*",
    "https://poe.com/*",
    "https://www.poe.com/*",
    "https://heypi.com/*",
    "https://www.heypi.com/*",
    "https://inflection.ai/*",
    "https://www.inflection.ai/*",
    "https://www.meta.ai/*",
    "https://meta.ai/*",
    "https://grok.com/*",
    "https://www.grok.com/*",
    "https://x.com/*",
    "https://twitter.com/*",
    "https://mistral.ai/*",
    "https://www.mistral.ai/*",
    "https://together.ai/*",
    "https://www.together.ai/*",
    "https://manus.im/*",
    "https://www.deepseek.com/*",
    "https://deepseek.com/*",

    // Local development
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

// Track cleared textareas by stable ID (persists across DOM replacements like Midjourney)
const clearedTextAreaIds = new Set<string>()

// Helper to get stable ID for a textarea
const getStableTextAreaId = (textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement): string => {
  // Try to get a stable identifier first
  const textAreaId = textArea.id ||
    textArea.getAttribute('data-id') ||
    textArea.getAttribute('name') ||
    textArea.getAttribute('aria-label') ||
    (textArea as HTMLElement).getAttribute('role')

  if (textAreaId) {
    return textAreaId
  }

  // Fallback to position-based ID (less stable but works)
  const rect = textArea.getBoundingClientRect()
  // Use a more stable position calculation (round to nearest 10px for better matching)
  const stableTop = Math.round(rect.top / 10) * 10
  const stableLeft = Math.round(rect.left / 10) * 10
  return `textarea-${stableTop}-${stableLeft}`
}

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

  // Only smart mode now - basic mode removed
  ; (window as any).__promptprune_analysis_mode = 'smart'
const textAreaFieldButtons = new WeakMap<HTMLTextAreaElement | HTMLDivElement | HTMLInputElement | HTMLInputElement, HTMLElement>()
let frameworkUI: HTMLElement | null = null

// Function to update capsule auth state (can be called from multiple places)
let lastAuthState: boolean | null = null
function updateCapsuleAuthState(loggedIn: boolean) {
  try {
    // Only log if state actually changed
    if (lastAuthState !== loggedIn) {
      console.log(`[PromptPrune] ${loggedIn ? '✅' : '🔒'} Auth state updated: ${loggedIn ? 'Unlocked' : 'Locked'} capsule`)
      lastAuthState = loggedIn
    }
    const capsule = getCapsuleUI()
    capsule.setLocked(!loggedIn)
  } catch (err) {
    console.warn('[PromptPrune] Failed to update capsule auth state:', err)
  }
}

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
    const textArea = el as HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
    textAreas.push(textArea)

    // Always initialize capsule, but set locked state based on auth
    initializeCapsuleForTextArea(textArea)

    // Check auth state and update capsule
    authService.getCurrentUser().then(user => {
      updateCapsuleAuthState(user !== null)
    }).catch(err => {
      console.error("Auth check failed in content script", err)
      updateCapsuleAuthState(false)
    })

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

/**
 * Call ML engine for hybrid PII detection (regex + GLiNER)
 * Falls back to regex-only if ML engine is unavailable
 */
async function detectPIIWithML(text: string): Promise<SensitiveContentResult> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({
        type: 'DETECT_PII_ML',
        text: text
      }, (response) => {
        if (chrome.runtime.lastError) {
          // ML engine unavailable, fallback to regex
          console.warn('[PromptPrune] ML engine unavailable, using regex-only:', chrome.runtime.lastError.message);
          resolve(detectSensitiveContent(text));
          return;
        }
        
        if (response && response.success && response.result) {
          // ML engine returns hybrid result (regex + GLiNER merged)
          resolve({
            hasSensitiveContent: response.result.hasSensitiveContent || false,
            detectedItems: response.result.detectedItems || [],
            riskScore: response.result.riskScore || 0,
            shouldBlock: response.result.hasSensitiveContent || false,
            verifiedByML: response.result.verifiedByML || false
          });
        } else {
          // Fallback to regex if ML fails
          resolve(detectSensitiveContent(text));
        }
      });
    } catch (error) {
      // Fallback to regex on error
      console.warn('[PromptPrune] ML detection error, using regex-only:', error);
      resolve(detectSensitiveContent(text));
    }
  });
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
      // Optimize feature disabled for now - coming soon
      showNotification("Optimize feature coming soon!", "info")
      // analyzeWithSmartOptimizer(textArea, text)
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
      // Clear all text in textarea - handle all element types properly with maximum compatibility
      const clearElement = (elem: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement) => {
        if (elem instanceof HTMLTextAreaElement || elem instanceof HTMLInputElement) {
          // Standard input/textarea clearing
          elem.value = ""
          elem.defaultValue = "" // Also clear default to prevent restoration

          // Trigger comprehensive events for React/Vue/Angular
          elem.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }))
          elem.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }))
          elem.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Backspace" }))
          elem.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Backspace" }))

          // Force React to re-render (set value descriptor)
          try {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
            const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set
            if (elem instanceof HTMLInputElement && nativeInputValueSetter) {
              nativeInputValueSetter.call(elem, "")
            } else if (elem instanceof HTMLTextAreaElement && nativeTextAreaValueSetter) {
              nativeTextAreaValueSetter.call(elem, "")
            }
            elem.dispatchEvent(new Event("input", { bubbles: true }))
          } catch (e) {
            console.warn('[PromptPrune] Native setter clear failed:', e)
          }
        } else if (elem instanceof HTMLElement && elem.isContentEditable) {
          // Contenteditable div (Perplexity, Claude, etc.) - NUCLEAR option
          elem.focus()

          // STAGE 1: Selection-based clearing
          const selection = window.getSelection()
          if (selection) {
            try {
              const range = document.createRange()
              range.selectNodeContents(elem)
              selection.removeAllRanges()
              selection.addRange(range)
              selection.deleteFromDocument()
              selection.removeAllRanges()
            } catch (e) {
              console.warn('[PromptPrune] Selection clear failed:', e)
            }
          }

          // STAGE 2: DOM manipulation clearing (most aggressive)
          while (elem.firstChild) {
            elem.removeChild(elem.firstChild)
          }
          elem.innerHTML = ""
          elem.innerText = ""
          elem.textContent = ""

          // STAGE 3: Clear nested contenteditable children (Perplexity nested structure)
          const nestedEditables = elem.querySelectorAll('[contenteditable="true"]')
          nestedEditables.forEach((nested: Element) => {
            if (nested instanceof HTMLElement && nested !== elem) {
              while (nested.firstChild) {
                nested.removeChild(nested.firstChild)
              }
              nested.innerHTML = ""
              nested.innerText = ""
              nested.textContent = ""
            }
          })

          // STAGE 4: Try execCommand (legacy browser support)
          try {
            document.execCommand('selectAll', false)
            document.execCommand('delete', false)
            document.execCommand('removeFormat', false)
          } catch (e) {
            // execCommand may not be available
          }

          // STAGE 5: Insert and remove placeholder to reset DOM state
          const placeholder = document.createTextNode('')
          elem.appendChild(placeholder)
          placeholder.remove()

          // STAGE 6: Remove all text nodes recursively
          const removeAllTextNodes = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              node.parentNode?.removeChild(node)
            } else {
              Array.from(node.childNodes).forEach(removeAllTextNodes)
            }
          }
          removeAllTextNodes(elem)

          // STAGE 7: Force re-render by toggling contenteditable
          try {
            elem.contentEditable = "false"
            elem.contentEditable = "true"
          } catch (e) {
            // May fail in some cases
          }

          // STAGE 8: Trigger comprehensive event cascade for frameworks
          const triggerEvents = () => {
            // beforeinput (modern frameworks)
            try {
              const beforeInputEvent = new InputEvent("beforeinput", {
                bubbles: true,
                cancelable: true,
                inputType: "deleteContent",
                data: null
              })
              elem.dispatchEvent(beforeInputEvent)
            } catch (e) { }

            // input event (CRITICAL for React/Vue/Angular)
            const inputEvent = new Event("input", { bubbles: true, cancelable: true })
            Object.defineProperty(inputEvent, 'target', { value: elem, enumerable: true })
            elem.dispatchEvent(inputEvent)

            // change event
            const changeEvent = new Event("change", { bubbles: true, cancelable: true })
            Object.defineProperty(changeEvent, 'target', { value: elem, enumerable: true })
            elem.dispatchEvent(changeEvent)

            // blur/focus cycle to force framework re-render
            elem.blur()
            setTimeout(() => elem.focus(), 10)

            // Composition events for IME frameworks
            try {
              elem.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }))
            } catch (e) { }

            // Keyboard events to simulate user deletion
            elem.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Backspace" }))
            elem.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Backspace" }))
          }

          triggerEvents()
          // Trigger events again after a micro-delay for stubborn frameworks
          setTimeout(triggerEvents, 10)
        } else {
          // Fallback for unknown element types
          elem.innerText = ""
          elem.textContent = ""
          if ('innerHTML' in elem) {
            (elem as any).innerHTML = ""
          }
          if ('value' in elem) {
            (elem as any).value = ""
          }
          elem.dispatchEvent(new Event("input", { bubbles: true }))
        }
      }

      // Execute initial clear
      clearElement(textArea)

      // VERIFICATION AND RETRY LOOP (handles Midjourney restoration issue)
      const verifyClearWithRetry = (attemptCount = 0) => {
        const currentText = getText(textArea).trim()
        if (currentText.length > 0 && attemptCount < 5) {
          console.log(`[PromptPrune] Clear verification failed (attempt ${attemptCount + 1}), text still present: "${currentText.substring(0, 50)}...". Retrying.`)

          // More aggressive clearing on retry
          clearElement(textArea)

          // Schedule next verification with increasing delays
          const nextDelay = 50 * Math.pow(2, attemptCount) // Exponential backoff: 50, 100, 200, 400, 800ms
          setTimeout(() => verifyClearWithRetry(attemptCount + 1), nextDelay)
        } else if (currentText.length > 0) {
          console.warn(`[PromptPrune] Clear failed after 5 attempts. Platform may be restoring content.`)
          showNotification("Clear partially successful - platform may restore content", "warning")
        } else {
          // Successfully cleared
          console.log(`[PromptPrune] Clear successful after ${attemptCount} retries`)
        }
      }

      // Start verification loop
      setTimeout(() => verifyClearWithRetry(0), 50)

      // Mark as cleared by user to prevent re-triggering
      textArea.setAttribute("data-cleared-by-user", "true")

      // Create stable ID and track it as cleared (persists across DOM replacements)
      const stableId = getStableTextAreaId(textArea)
      clearedTextAreaIds.add(stableId)

      // Clear any stored original prompt for this textarea
      originalPrompts.delete(textArea)

      // Reset bypass flag
      const bypassFlag = getBypassFlagForTextarea(textArea)
      bypassFlag.bypass = false
      if (bypassFlag.timeout) {
        clearTimeout(bypassFlag.timeout)
        bypassFlag.timeout = null
      }

      // Clear the cleared attribute and ID tracking when user starts typing again
      const checkAndClearFlag = () => {
        if (textArea.isConnected) {
          const currentText = getText(textArea).trim()
          if (currentText.length > 0) {
            textArea.removeAttribute("data-cleared-by-user")
            clearedTextAreaIds.delete(stableId)
          } else {
            // Still empty, check again later
            setTimeout(checkAndClearFlag, 500)
          }
        }
      }
      setTimeout(checkAndClearFlag, 500)

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

  try {
    showNotification("Initializing AI analysis...", "info")

    // Dispatch to background ML engine
    const response = await chrome.runtime.sendMessage({
      type: "OPTIMIZE_PROMPT",
      payload: {
        text: originalPrompt,
        mode: "OPTIMIZE"
      }
    })

    if (response && response.optimized) {
      console.log("[PromptPrune] Received optimized prompt from background:", response)
      setText(textArea, response.optimized)
      showNotification("Prompt optimized successfully", "success")
    } else {
      throw new Error("Invalid response from background")
    }
  } catch (err) {
    console.error("Analysis error:", err)
    showNotification("AI analysis failed - using fallback", "warning")

    // Fallback: use simple framework ranking (local)
    const rankings = await rankFrameworks(originalPrompt)
    if (rankings.length > 0) {
      const best = rankings[0]
      const frameworkOutput = await applyFramework(originalPrompt, best.framework)
      if (frameworkOutput && frameworkOutput.optimized) {
        setText(textArea, frameworkOutput.optimized)
        showNotification(`Optimized using ${FRAMEWORKS[best.framework].name} (fallback)`, "success")
      }
    }
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

      Object.values(originalCounts).forEach((providerCounts: any) => {
        if (Array.isArray(providerCounts)) {
          providerCounts.forEach((count: { count: number }) => allOriginal.push(count.count))
        }
      })
      Object.values(compressedCounts).forEach((providerCounts: any) => {
        if (Array.isArray(providerCounts)) {
          providerCounts.forEach((count: { count: number }) => allCompressed.push(count.count))
        }
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
  sensitiveCheck: SensitiveContentResult
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
  modal.setAttribute("role", "alertdialog")
  modal.setAttribute("aria-labelledby", "warning-title")
  modal.setAttribute("aria-modal", "true")
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
  title.id = "warning-title"
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
        padding: 14px;
        margin-bottom: 10px;
        background: #f9fafb;
        border-radius: 8px;
        font-size: 13px;
        border-left: 4px solid ${item.severity === 'high' ? '#dc2626' : item.severity === 'medium' ? '#f59e0b' : '#3b82f6'};
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      `
      // Clean up type name for display
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
      if (typeName.toLowerCase().includes('api key')) typeName = 'API Key/Token'
      if (typeName.toLowerCase().includes('phone')) typeName = 'Phone Number'
      if (typeName.toLowerCase().includes('email')) typeName = 'Email Address'
      if (typeName.toLowerCase().includes('indian state')) typeName = 'Indian State'
      if (typeName.toLowerCase().includes('indian city')) typeName = 'Indian City/District'
      if (typeName.toLowerCase().includes('indian address')) typeName = 'Indian Address'

      // Show the actual flagged value (masked)
      const flaggedValue = item.value || item.originalValue?.replace(/./g, '*') || '[REDACTED]'

      itemDiv.innerHTML = `
        <div style="display: flex; align-items: start; gap: 10px; margin-bottom: 8px;">
          <span style="width: 10px; height: 10px; border-radius: 50%; background: ${item.severity === 'high' ? '#dc2626' : item.severity === 'medium' ? '#f59e0b' : '#3b82f6'}; margin-top: 4px; flex-shrink: 0;"></span>
          <div style="flex: 1;">
            <div style="font-weight: 700; color: #111827; margin-bottom: 6px; font-size: 14px;">
              ${typeName}
            </div>
            <div style="background: #ffffff; border: 1px solid #e5e7eb; padding: 8px 10px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 13px; color: #dc2626; font-weight: 600; margin-bottom: 6px; word-break: break-all;">
              "${flaggedValue}"
            </div>
            <div style="color: #6b7280; font-size: 12px; line-height: 1.5;">
              ${item.suggestion.replace(/🚨|⚠️/g, '').trim()}
            </div>
          </div>
        </div>
      `
      detectedList.appendChild(itemDiv)
    })

    if (sensitiveCheck.detectedItems.length > 5) {
      const moreDiv = document.createElement("div")
      moreDiv.style.cssText = `
        text-align: center;
        color: #6b7280;
        font-size: 12px;
        padding: 12px;
        font-weight: 600;
        background: #f3f4f6;
        border-radius: 6px;
        margin-top: 4px;
      `
      moreDiv.textContent = `+${sensitiveCheck.detectedItems.length - 5} more sensitive items detected`
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

    // Send Audit Log (User explicitly bypassed warning)
    try {
      const text = getText(textArea)
      const { platform, model } = detectPlatformAndModel()

      authService.getCurrentUser().then(user => {
        const logData: AuditLogData = {
          userEmail: user?.email || "anonymous",
          platform: platform,
          prompt: text, // Capture the prompt that was forced through
          detectedItems: sensitiveCheck.detectedItems, // Use the check result that triggered the warning
          riskScore: sensitiveCheck.riskScore,
          classifications: sensitiveCheck.classifications || [], // GDPR, HIPAA, PCI-DSS, etc.
          metadata: {
            userAgent: navigator.userAgent,
            url: window.location.href,
            model: model,
            extensionVersion: chrome.runtime.getManifest().version
          }
        }

        // Send via service worker to avoid CORS issues (content scripts can't fetch localhost)
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
          chrome.runtime.sendMessage(
            { type: 'AUDIT_LOG', data: logData },
            (response) => {
              if (chrome.runtime.lastError) {
                const error = chrome.runtime.lastError.message || 'Unknown error'
                console.error("❌ Failed to send audit log via service worker:", error)
                if (error.includes("Receiving end does not exist")) {
                  console.error("💡 Service worker is not active. Try:")
                  console.error("   1. Reload the extension in chrome://extensions")
                  console.error("   2. Check service worker console (chrome://extensions → Inspect views: service worker)")
                  console.error("   3. Make sure the extension is enabled")
                }
              } else if (response?.success) {
                console.log("✅ Audit log sent successfully via service worker")
              } else {
                console.error("❌ Failed to send audit log:", response?.error || "Unknown error")
              }
            }
          )
        } else {
          console.error("❌ Chrome runtime not available, cannot send audit log")
        }
      })
    } catch (err) {
      console.error("Error sending audit log on proceed:", err)
    }

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
function showNotification(message: string, type: "success" | "error" | "warning" | "info", duration: number = 3000) {
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

  // Auto-remove after duration (0 = never auto-remove, for loading states)
  if (duration > 0) {
    setTimeout(() => {
      notification.style.animation = "slideIn 0.3s ease-out reverse"
      setTimeout(() => notification.remove(), 300)
    }, duration)
  }
  // Return notification element so caller can manually remove it if needed
  return notification
}

// --- One-time model download overlay (blocking "please wait" screen) ---
const MODEL_DOWNLOAD_OVERLAY_ID = 'promptprune-model-download-overlay'
let _downloadOverlayRef: { progFill: HTMLDivElement; pctText: HTMLSpanElement } | null = null

function createModelDownloadOverlay(): void {
  if (document.getElementById(MODEL_DOWNLOAD_OVERLAY_ID)) return
  const wrap = document.createElement('div')
  wrap.id = MODEL_DOWNLOAD_OVERLAY_ID
  wrap.style.cssText = `
    position: fixed; inset: 0; z-index: 10000001;
    background: rgba(0,0,0,0.78); backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: ppFadeIn 0.25s ease-out;
    pointer-events: auto;
  `
  const card = document.createElement('div')
  card.style.cssText = `
    background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
    border-radius: 16px; padding: 32px; max-width: 400px; width: 90%;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3);
    border: 1px solid rgba(0,0,0,0.06);
    text-align: center;
  `
  const icon = document.createElement('div')
  icon.textContent = '📥'
  icon.style.cssText = 'font-size: 48px; margin-bottom: 12px;'
  const title = document.createElement('h2')
  title.textContent = 'Downloading AI models (one-time)'
  title.style.cssText = 'margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #111827;'
  const sub = document.createElement('p')
  sub.textContent = 'Downloading in background • You can continue using the extension'
  sub.style.cssText = 'margin: 0 0 20px 0; color: #6b7280; font-size: 14px;'
  const progWrap = document.createElement('div')
  progWrap.style.cssText = 'height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin-bottom: 8px;'
  const progFill = document.createElement('div')
  progFill.style.cssText = 'height: 100%; background: #10b981; width: 0%; transition: width 0.3s ease;'
  progWrap.appendChild(progFill)
  const pctText = document.createElement('span')
  pctText.textContent = '0%'
  pctText.style.cssText = 'font-size: 13px; font-weight: 600; color: #374151;'
  const hint = document.createElement('div')
  hint.id = 'promptprune-download-hint'
  hint.style.cssText = 'margin-top: 12px; font-size: 12px; color: #9ca3af; display: none; line-height: 1.4;'
  
  // Add close button
  const closeBtn = document.createElement('button')
  closeBtn.textContent = '✕'
  closeBtn.setAttribute('aria-label', 'Close')
  closeBtn.style.cssText = `
    position: absolute;
    top: 12px;
    right: 12px;
    background: rgba(0,0,0,0.05);
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    cursor: pointer;
    font-size: 18px;
    color: #6b7280;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    z-index: 1000;
    pointer-events: auto;
    user-select: none;
    -webkit-user-select: none;
  `
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.background = 'rgba(0,0,0,0.1)'
    closeBtn.style.color = '#111827'
  })
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.background = 'rgba(0,0,0,0.05)'
    closeBtn.style.color = '#6b7280'
  })
  const handleClose = (e?: Event) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    }
    console.log('[PromptPrune] User closed download overlay - continuing in background')
    
    // Hide overlay immediately
    const overlay = document.getElementById(MODEL_DOWNLOAD_OVERLAY_ID)
    if (overlay) {
      overlay.style.opacity = '0'
      overlay.style.pointerEvents = 'none'
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay)
        }
        _downloadOverlayRef = null
      }, 200)
    }
    
    // Set status to allow background download
    if (typeof chrome !== 'undefined' && chrome.storage?.local?.set) {
      chrome.storage.local.set({ 
        'promptprune-model-download-status': 'downloading-background',
        'promptprune-models-ready': false
      }, () => {
        console.log('[PromptPrune] ✅ Download status set to background mode - models will continue downloading')
      })
    }
    showNotification('Download will continue in background. You can continue using the extension.', 'info', 4000)
  }
  
  // Multiple event handlers to ensure it works
  const closeHandler = (e: Event) => {
    console.log('[PromptPrune] Close button clicked!', e.type);
    handleClose(e);
  };
  
  closeBtn.addEventListener('click', closeHandler, { capture: true });
  closeBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Also trigger close on mousedown for better responsiveness
    setTimeout(() => handleClose(e), 0);
  }, { capture: true });
  
  // Also add pointer events for better compatibility
  closeBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleClose(e);
  }, { capture: true });
  
  // Ensure button is visible and clickable
  closeBtn.style.pointerEvents = 'auto';
  closeBtn.style.cursor = 'pointer';
  closeBtn.setAttribute('tabindex', '0'); // Make it focusable
  
  const style = document.createElement('style')
  style.textContent = `@keyframes ppFadeIn { from { opacity: 0; } to { opacity: 1; } }`
  if (!document.head.querySelector('#promptprune-download-overlay-style')) {
    style.id = 'promptprune-download-overlay-style'
    document.head.appendChild(style)
  }
  
  // Make card position relative for close button
  card.style.position = 'relative'
  card.append(icon, title, sub, progWrap, pctText, hint, closeBtn)
  wrap.appendChild(card)
  document.body.appendChild(wrap)
  _downloadOverlayRef = { progFill, pctText }
  
  // Store handleClose reference for debugging
  (wrap as any).__handleClose = handleClose;
  (closeBtn as any).__handleClose = handleClose;
  
  // Also allow clicking outside to close (optional - user can still use close button)
  wrap.addEventListener('click', (e) => {
    // Only close if clicking on the overlay background, not on the card
    if (e.target === wrap) {
      console.log('[PromptPrune] Overlay background clicked, closing...');
      handleClose(e)
    }
  }, true)
  
  // Prevent card clicks from closing
  card.addEventListener('click', (e) => {
    e.stopPropagation()
  }, true)
  
  // Debug: Log when button is created
  console.log('[PromptPrune] Close button created and attached to overlay');
}

function updateModelDownloadOverlay(pct: number): void {
  const p = Math.min(100, Math.max(0, Math.round(pct)))
  if (_downloadOverlayRef) {
    _downloadOverlayRef.progFill.style.width = `${p}%`
    _downloadOverlayRef.pctText.textContent = `${p}%`
  }
}

function hideModelDownloadOverlay(): void {
  const el = document.getElementById(MODEL_DOWNLOAD_OVERLAY_ID)
  if (el) el.remove()
  _downloadOverlayRef = null
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

    // Use type-specific label format: [TYPE_REDACTED] for better clarity
    // Types are already in snake_case (e.g., 'indian_pincode', 'us_address')
    // Just convert to uppercase for the label
    const typeLabel = item.type.toUpperCase()
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
  const capsule = getCapsuleUI()

  // Skip if already initialized for this textarea
  if (textAreaCapsules.get(textArea) === capsule) {
    return capsule
  }

  // Initialize Capsule UI (Singleton)
  capsule.mount()

  // Detect if this is a follow-up message (second prompt in chat)
  function isFollowUpMessage(textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement): boolean {
    // Look for already-sent user messages in the conversation
    // We want to detect if there are previous user messages that have been sent
    
    // ChatGPT-specific: Look for user messages with data-message-author-role="user"
    const chatGPTUserMessages = document.querySelectorAll('[data-message-author-role="user"]')
    if (chatGPTUserMessages.length > 0) {
      console.log('[PromptPrune] Follow-up detected: ChatGPT user messages found:', chatGPTUserMessages.length)
      return true
    }
    
    // ChatGPT: Also check for message containers that are not the current textarea
    const chatGPTMessages = document.querySelectorAll('[data-testid*="message"]')
    if (chatGPTMessages.length > 1) { // More than 1 means there's at least one sent message
      console.log('[PromptPrune] Follow-up detected: ChatGPT messages found:', chatGPTMessages.length)
      return true
    }
    
    // Claude: Look for conversation turns
    const claudeTurns = document.querySelectorAll('.conversation-turn')
    if (claudeTurns.length > 0) {
      console.log('[PromptPrune] Follow-up detected: Claude conversation turns found:', claudeTurns.length)
      return true
    }
    
    // Generic: Look for user message indicators
    const userMessageSelectors = [
      '[data-author="user"]',
      '[data-role="user"]',
      '.user-message',
      '.message.user',
      '[class*="user"][class*="message"]',
    ]
    
    for (const selector of userMessageSelectors) {
      try {
        const messages = document.querySelectorAll(selector)
        if (messages.length > 0) {
          console.log('[PromptPrune] Follow-up detected: User messages found with selector:', selector, messages.length)
          return true
        }
      } catch (e) {
        // Ignore selector errors
      }
    }
    
    // Check if there are assistant/AI responses (indicates conversation has started)
    const assistantSelectors = [
      '[data-message-author-role="assistant"]',
      '[data-author="assistant"]',
      '[data-role="assistant"]',
      '.assistant-message',
      '.message.assistant',
      '[class*="assistant"][class*="message"]',
    ]
    
    for (const selector of assistantSelectors) {
      try {
        const messages = document.querySelectorAll(selector)
        if (messages.length > 0) {
          console.log('[PromptPrune] Follow-up detected: Assistant messages found with selector:', selector, messages.length)
          return true
        }
      } catch (e) {
        // Ignore selector errors
      }
    }
    
    // Check if textarea is positioned after other elements (indicating it's not the first)
    // This is a fallback - if the textarea has siblings before it that look like messages
    if (textArea.parentElement) {
      const siblings = Array.from(textArea.parentElement.children)
      const textAreaIndex = siblings.indexOf(textArea as HTMLElement)
      
      // If there are elements before the textarea, check if they look like messages
      if (textAreaIndex > 0) {
        const previousElements = siblings.slice(0, textAreaIndex)
        for (const elem of previousElements) {
          // Check if element contains text that looks like a message
          const text = elem.textContent || ''
          if (text.trim().length > 10) { // Has substantial content
            // Check if it's not just UI elements
            const hasMessageIndicators = elem.querySelector('[class*="message"]') ||
                                       elem.querySelector('[class*="Message"]') ||
                                       elem.getAttribute('data-message-author-role')
            if (hasMessageIndicators) {
              console.log('[PromptPrune] Follow-up detected: Previous sibling element looks like a message')
              return true
            }
          }
        }
      }
    }
    
    // Additional check: Look for any visible conversation history in the viewport
    // Check for common message container patterns that indicate a conversation exists
    const allMessageContainers = document.querySelectorAll('[class*="message"], [class*="Message"], [data-testid*="message"], [role="article"]')
    if (allMessageContainers.length > 0) {
      // Filter to only visible, substantial messages (not empty containers)
      const visibleMessages = Array.from(allMessageContainers).filter(msg => {
        const rect = msg.getBoundingClientRect()
        const isVisible = rect.width > 0 && rect.height > 0
        const hasContent = (msg.textContent || '').trim().length > 20
        return isVisible && hasContent
      })
      
      if (visibleMessages.length > 0) {
        console.log('[PromptPrune] Follow-up detected: Visible message containers found:', visibleMessages.length)
        return true
      }
    }
    
    console.log('[PromptPrune] No follow-up detected - treating as first message')
    return false
  }

  // Prefill template when textarea is focused and empty
  function prefillTemplate() {
    const currentText = getText(textArea).trim()
    
    // Only prefill if:
    // 1. Textarea is empty
    // 2. User hasn't explicitly cleared it
    // 3. It's not already a template format
    if (currentText.length === 0 && 
        !textArea.hasAttribute("data-cleared-by-user") &&
        !/^(Role:|Task:|Context:|Format:|Tone:|Summarize)/m.test(currentText)) {
      
      // Check if this is a follow-up message
      const isFollowUp = isFollowUpMessage(textArea)
      console.log('[PromptPrune] Prefill check:', { isFollowUp, textArea: textArea.tagName })
      
      let template: string
      let cursorPos: number
      
      if (isFollowUp) {
        // For follow-up messages, use "Summarize"
        console.log('[PromptPrune] Using "Summarize" template for follow-up')
        template = 'Summarize'
        cursorPos = template.length
      } else {
        // For first message, use full template
        console.log('[PromptPrune] Using full template for first message')
        template = `Role: 
Task: 
Context: 
Format: 
Tone: `
        cursorPos = template.indexOf("Role: ") + 6
      }
      
      setText(textArea, template)
      
      // Focus and place cursor at appropriate position
      setTimeout(() => {
        if (textArea instanceof HTMLTextAreaElement || textArea instanceof HTMLInputElement) {
          textArea.setSelectionRange(cursorPos, cursorPos)
          textArea.focus()
        } else if (textArea instanceof HTMLElement && textArea.isContentEditable) {
          // For content-editable divs (ChatGPT, Claude, etc.)
          textArea.focus()
          const range = document.createRange()
          const selection = window.getSelection()
          if (selection && textArea.firstChild) {
            const textNode = textArea.firstChild
            const textContent = textNode.textContent || ''
            const index = isFollowUp ? textContent.length : (textContent.indexOf("Role: ") + 6)
            if (index >= 0) {
              range.setStart(textNode, Math.min(index, textContent.length))
              range.setEnd(textNode, Math.min(index, textContent.length))
              selection.removeAllRanges()
              selection.addRange(range)
            }
          }
        }
      }, 10)
    }
  }

  // Update capsule target when textarea is focused or hovered
  const updateCapsule = () => {
    capsule.setTarget(textArea)
    textAreaCapsules.set(textArea, capsule)
    // Prefill template on focus if empty
    prefillTemplate()
  }

  textArea.addEventListener('focus', updateCapsule)
  textArea.addEventListener('mouseenter', () => {
    capsule.setTarget(textArea)
    textAreaCapsules.set(textArea, capsule)
  })

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

        // Show loading state
        capsule.setLoading(true)
        let loadingNotification = showNotification("🔄 Optimizing prompt with AI... This may take a moment.", "info", 0) // 0 = no auto-dismiss

        // Track start time for timeout
        const startTime = Date.now()
        const maxWaitTime = 60000 // 60 seconds max

        try {
          // Check if models are downloading first
          const modelStatus = await new Promise<any>((resolve) => {
            try {
              chrome.runtime.sendMessage({ type: 'CHECK_MODEL_STATUS' }, (response) => {
                resolve(response || {})
              })
            } catch (e) {
              if (isExtCtxInvalid(e)) {
                resolve({ piiReady: false, _ctxInvalid: true })
                return
              }
              throw e
            }
          })

          if (modelStatus && modelStatus._ctxInvalid) {
            if (loadingNotification) loadingNotification.remove()
            showNotification('Extension was updated. Please refresh the page to continue.', 'warning')
            capsule.setLoading(false)
            return
          }

          // If models are not ready, show download progress (via Capsule)
          if (modelStatus && !modelStatus.piiReady) {
            // Request model initialization (only once)
            chrome.runtime.sendMessage({ type: 'INIT_MODELS' }, () => {
              // Models will download in background or load from cache
            })

            // Poll for model readiness with progress updates
            const checkModelReady = setInterval(async () => {
              try {
                const status = await new Promise<any>((resolve) => {
                  try {
                    chrome.runtime.sendMessage({ type: 'CHECK_MODEL_STATUS' }, (response) => {
                      resolve(response || {})
                    })
                  } catch (e) {
                    if (isExtCtxInvalid(e)) {
                      resolve({ _ctxInvalid: true })
                      return
                    }
                    throw e
                  }
                })
                if (status && status._ctxInvalid) {
                  clearInterval(checkModelReady)
                  if (loadingNotification) loadingNotification.remove()
                  showNotification('Extension was updated. Please refresh the page to continue.', 'warning')
                  capsule.setLoading(false)
                  return
                }
                try {
                  chrome.storage.local.get(['pii_model_progress', 'optimizer_model_progress', 'promptprune-models-ready'], (result) => {
                    const piiProgress = result?.pii_model_progress || 0
                    const optProgress = result?.optimizer_model_progress || 0
                    // Weighted average: PII model is ~50MB, Optimizer is ~150MB, so weight optimizer more
                    // But for UX, show progress based on both models being ready
                    const totalProgress = Math.round((piiProgress * 0.25 + optProgress * 0.75))
                    if (totalProgress > 0 && totalProgress < 100) {
                      capsule.setDownloadProgress(totalProgress)
                    }
                    // Check both status and storage flag for models ready (cache loads quickly)
                    // Note: We proceed when PII is ready (required), optimizer is optional
                    if (status?.piiReady || result?.['promptprune-models-ready']) {
                      capsule.setDownloadProgress(100)
                      clearInterval(checkModelReady)
                      proceedWithOptimization()
                    }
                  })
                } catch (e) {
                  if (isExtCtxInvalid(e)) {
                    clearInterval(checkModelReady)
                    if (loadingNotification) loadingNotification.remove()
                    showNotification('Extension was updated. Please refresh the page to continue.', 'warning')
                    capsule.setLoading(false)
                  } else {
                    throw e
                  }
                }
              } catch (e) {
                if (isExtCtxInvalid(e)) {
                  clearInterval(checkModelReady)
                  if (loadingNotification) loadingNotification.remove()
                  showNotification('Extension was updated. Please refresh the page to continue.', 'warning')
                  capsule.setLoading(false)
                }
              }
            }, 200) // Faster polling to detect cache usage quickly

            // Timeout after max wait time
            setTimeout(() => {
              clearInterval(checkModelReady)
              if (!modelStatus.piiReady) {
                showNotification("⏱️ Model download is taking longer than expected. Please try again in a moment.", "warning")
                capsule.setLoading(false)
              }
            }, maxWaitTime)

            return // Exit early, proceedWithOptimization will be called when ready
          }

          // Models are ready, proceed with optimization
          proceedWithOptimization()

        } catch (error) {
          if (loadingNotification) loadingNotification.remove()
          if (isExtCtxInvalid(error)) {
            showNotification('Extension was updated. Please refresh the page to continue.', 'warning')
          } else {
            console.error('[PromptPrune] Optimization setup error:', error)
            const errorMsg = error instanceof Error ? error.message : String(error)
            showNotification(`Setup failed: ${errorMsg}`, "error")
          }
          capsule.setLoading(false)
        }

        // Function to proceed with actual optimization
        async function proceedWithOptimization() {
          try {
            // Update notification
            if (loadingNotification) {
              loadingNotification.textContent = "🔄 Optimizing prompt..."
            } else {
              loadingNotification = showNotification("🔄 Optimizing prompt...", "info", 0)
            }

            // Send optimization request with timeout
            const response = await Promise.race([
              new Promise<any>((resolve) => {
                chrome.runtime.sendMessage({
                  type: "OPTIMIZE_PROMPT",
                  text: text,
                  mode: "OPTIMIZE"
                }, (response) => {
                  resolve(response)
                })
              }),
              new Promise<any>((_, reject) => {
                setTimeout(() => reject(new Error('Optimization timeout - please try again')), 90000) // Increased to 90s to match ML engine timeout
              })
            ])

            if (response && response.success) {
              const optimized = response.result

              console.log('[PromptPrune] Optimization response:', {
                success: response.success,
                resultType: typeof optimized,
                resultLength: typeof optimized === 'string' ? optimized.length : 'N/A',
                originalLength: text.length,
                preview: typeof optimized === 'string' ? optimized.substring(0, 100) : optimized
              })

              // Ensure we have a valid string result
              if (typeof optimized !== 'string') {
                console.error('[PromptPrune] Invalid optimized result type:', typeof optimized, optimized)
                throw new Error('Optimization returned invalid result')
              }

              // Remove loading notification
              if (loadingNotification) loadingNotification.remove()

              // Show preview modal with optimized result
              const previewModal = getPreviewModal()
              previewModal.show(text, optimized, (newText) => {
                if (target) {
                  setText(target, newText)
                  showNotification("✅ Prompt optimized successfully", "success")
                }
              })
            } else {
              const errorMsg = response?.error || "Optimization failed"
              console.error('[PromptPrune] Optimization error:', errorMsg)
              if (loadingNotification) loadingNotification.remove()
              showNotification(`Optimization failed: ${errorMsg}`, "error")
            }
          } catch (error) {
            if (loadingNotification) loadingNotification.remove()
            if (isExtCtxInvalid(error)) {
              showNotification('Extension was updated. Please refresh the page to continue.', 'warning')
            } else {
              console.error('[PromptPrune] Optimization error:', error)
              const errorMsg = error instanceof Error ? error.message : String(error)
              
              // Check if it's a timeout
              if (errorMsg.includes('timeout')) {
                showNotification('Optimization is taking longer than expected. The model may still be downloading. Please try again in a moment.', "warning", 6000)
              } else {
                showNotification(`Optimization failed: ${errorMsg}`, "error")
              }
            }
          } finally {
            capsule.setLoading(false)
          }
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

    capsule.on('clear', () => {
      const target = capsule.target
      if (target) {
        handleMenuAction('clear', target)
        // Update capsule state after clearing
        setTimeout(() => {
          const capsule = getCapsuleUI()
          capsule.updateTokenCount(0)
          capsule.updateSensitiveWarning(false, [])
        }, 100)
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

    // Regex is clean - check with ML engine (GLiNER + regex hybrid) in background (non-blocking, with timeout)
    // Don't block UI - if ML is slow, allow submission
    try {
      const mlCheckPromise = detectPIIWithML(textTrimmed)
      
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
        const mlCheckPromise = Promise.resolve(detectSensitiveContent(textTrimmed))
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

        // Check with regex (sync)
        Promise.resolve(detectSensitiveContent(currentText.trim())).then(syncCheck => {
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

      const listener = async (e: Event) => {
        const currentText = getText(textArea)
        console.log("[PromptPrune] Submit button clicked, text length:", currentText.length)
        console.log("[PromptPrune] Submit button event:", e.type, e.target)

        const shouldBlock = await checkAndBlockSubmission(currentText, e)
        if (shouldBlock) {
          return false
        }
      }

      submitButton.addEventListener("click", listener, { capture: true, passive: false })
        ; (submitButton as any).__promptprune_listener = listener
    }
  }

  // Also add document-level click listener as backup to catch any submit buttons
  const documentClickListener = async (e: MouseEvent) => {
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
        const shouldBlock = await checkAndBlockSubmission(currentText, e)
        if (shouldBlock) {
          return false
        }
      } else {
        // Also check if textarea is nearby (same container)
        const textAreaContainer = textArea.closest('div[class*="input"], div[class*="textarea"], div[class*="chat"], form')
        const buttonContainer = target.closest('div[class*="input"], div[class*="textarea"], div[class*="chat"], form')
        if (textAreaContainer && buttonContainer && textAreaContainer === buttonContainer) {
          const currentText = getText(textArea)
          console.log("[PromptPrune] Checking textarea in same container")
          const shouldBlock = await checkAndBlockSubmission(currentText, e)
          if (shouldBlock) {
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
    // Use regex detection
    detectPIIWithML(text).then(result => {
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
      const result = detectSensitiveContent(testText)
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
    const result = detectSensitiveContent(text)
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
  // Track last processed text per textarea to avoid duplicate checks
  const lastProcessedTextMap = new WeakMap<HTMLElement, { text: string; time: number }>()

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

        // Check if textarea was cleared by user - skip processing if so
        const stableId = getStableTextAreaId(textArea)
        const isCleared = textArea.hasAttribute("data-cleared-by-user") || clearedTextAreaIds.has(stableId)
        if (isCleared) {
          const currentText = getText(textArea).trim()
          if (currentText.length === 0) {
            return // Still empty, don't process
          }
          // User started typing again, remove the cleared flag and ID tracking
          textArea.removeAttribute("data-cleared-by-user")
          clearedTextAreaIds.delete(stableId)
        }

        // Type guard to ensure activeEl is the correct type
        if (!(activeEl instanceof HTMLTextAreaElement || activeEl instanceof HTMLDivElement || activeEl instanceof HTMLInputElement)) {
          return
        }

        const text = getText(activeEl)
        const textTrimmed = text?.trim() || ''
        if (textTrimmed.length > 0) {
          // Debounce: Skip if we just processed the same text for this textarea within 500ms
          const now = Date.now()
          const lastProcessed = lastProcessedTextMap.get(textArea)
          if (lastProcessed && lastProcessed.text === textTrimmed && (now - lastProcessed.time) < 500) {
            return
          }

          // CRITICAL: Prevent default IMMEDIATELY to block submission
          // We'll allow it later if no sensitive content is found
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()

          // Mark as processing and track text per textarea
          isProcessingKeydown = true
          lastProcessedTextMap.set(textArea, { text: textTrimmed, time: now })


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
          const mlCheckPromise = detectPIIWithML(textTrimmed)
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
          // Check if textarea was cleared by user - skip processing if so
          const stableId = getStableTextAreaId(textArea)
          const isCleared = textArea.hasAttribute("data-cleared-by-user") || clearedTextAreaIds.has(stableId)
          if (isCleared) {
            const currentText = getText(textArea).trim()
            if (currentText.length === 0) {
              return // Still empty, don't process
            }
            // User started typing again, remove the cleared flag and ID tracking
            textArea.removeAttribute("data-cleared-by-user")
            clearedTextAreaIds.delete(stableId)
          }

          // Check bypass flag if textarea is tracked
          const bypassFlag = textAreaBypassFlags.get(textArea)
          if (bypassFlag && bypassFlag.bypass) {
            return
          }

          // Debounce: Skip if we just processed the same text for this textarea within 500ms
          const now = Date.now()
          const lastProcessed = lastProcessedTextMap.get(textArea)
          if (lastProcessed && lastProcessed.text === textTrimmed && (now - lastProcessed.time) < 500) {
            return
          }

          // CRITICAL: Prevent default IMMEDIATELY to block submission
          // We'll allow it later if no sensitive content is found
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()

          // Mark as processing and track text per textarea
          isProcessingClick = true
          lastProcessedTextMap.set(textArea, { text: textTrimmed, time: now })


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
          const mlCheckPromise = detectPIIWithML(textTrimmed)
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
        try {
          chrome.storage.local.get([
            'promptprune-models-ready',
            'promptprune-model-download-attempted',
            'promptprune-model-download-status',
            'promptprune-model-download-progress',
            'pii_model_progress',
            'promptprune-model-download-error'
          ], resolve)
        } catch (e) {
          if (isExtCtxInvalid(e)) {
            resolve({})
            return
          }
          throw e
        }
      } else {
        console.warn('[PromptPrune] ⚠️ Chrome storage not available')
        resolve({})
      }
    })

    const modelsReady = result['promptprune-models-ready'] === true
    const downloadAttempted = result['promptprune-model-download-attempted'] === 'true'
    const downloadStatus = result['promptprune-model-download-status'] || 'unknown'
    const downloadProgress = result['promptprune-model-download-progress'] ?? result['pii_model_progress'] ?? 0

    // Poll to update overlay and hide when done/failed
    let pollTid: ReturnType<typeof setInterval> | null = null
    let pollCount = 0
    const startPoll = () => {
      if (pollTid) return
      console.log('[PromptPrune] 📊 Poll: started (every 600ms), will hide overlay on modelsReady/failed or after 90s')
      // Timeout: if still downloading after 45s, dismiss overlay and let user continue with default mode
      setTimeout(() => {
        if (document.getElementById(MODEL_DOWNLOAD_OVERLAY_ID) && pollTid) {
          clearInterval(pollTid)
          pollTid = null
          hideModelDownloadOverlay()
          if (typeof chrome !== 'undefined' && chrome.storage?.local?.set) {
            chrome.storage.local.set({ 'promptprune-model-download-status': 'timeout' })
          }
          showNotification('Download is taking longer than expected. Using default mode.', 'warning', 5000)
        }
      }, 45_000)
      pollTid = setInterval(() => {
        pollCount += 1
        try {
          if (typeof chrome === 'undefined' || !chrome.storage) return
          chrome.storage.local.get([
            'promptprune-models-ready',
            'promptprune-model-download-status',
            'pii_model_progress',
            'promptprune-model-download-progress'
          ], (r: Record<string, any>) => {
            try {
              // Check for both models ready
              chrome.storage.local.get(['pii-model-ready', 'optimizer-model-ready'], (modelStatus: Record<string, any>) => {
                const bothReady = r['promptprune-models-ready'] === true || 
                                 (modelStatus['pii-model-ready'] === true && modelStatus['optimizer-model-ready'] === true);
                
                if (bothReady) {
                  console.log('[PromptPrune] 📊 Poll: Both models ready → hiding overlay')
                  console.log('[PromptPrune] ✅ PII Model: Ready | Optimizer Model: Ready')
                  console.log('[PromptPrune] 🎉 Download complete: Both AI models are now available!')
                  if (pollTid) clearInterval(pollTid)
                  pollTid = null
                  hideModelDownloadOverlay()
                  showNotification('✅ Both AI models downloaded successfully! PII detection and prompt optimization are now available.', 'success', 5000)
                  return
                }
              })
              
              if (r['promptprune-models-ready'] === true) {
                // Fallback for old status format
                if (pollTid) clearInterval(pollTid)
                pollTid = null
                hideModelDownloadOverlay()
                showNotification('✅ Both AI models downloaded successfully!', 'success', 5000)
                return
              }
              if (r['promptprune-model-download-status'] === 'failed' || r['promptprune-model-download-status'] === 'timeout') {
                console.log('[PromptPrune] 📊 Poll: status=' + r['promptprune-model-download-status'] + ' → hiding overlay')
                if (pollTid) clearInterval(pollTid)
                pollTid = null
                hideModelDownloadOverlay()
                showNotification('Using default mode. You can continue.', 'info', 4000)
                return
              }
              // Background download - hide overlay but continue polling silently
              if (r['promptprune-model-download-status'] === 'downloading-background') {
                hideModelDownloadOverlay()
                // Continue polling but don't show overlay
                return // Don't update overlay if in background mode
              }
              // Calculate progress from both models
              const piiProgress = r['pii_model_progress'] ?? 0
              const optProgress = r['optimizer_model_progress'] ?? 0
              // Weighted: PII ~50MB, Optimizer ~150MB, so PII = 25%, Optimizer = 75%
              const totalProgress = Math.round((Number(piiProgress) * 0.25) + (Number(optProgress) * 0.75))
              const pctNum = totalProgress || Number(r['promptprune-model-download-progress']) || 0
              
              // Only update overlay if it exists (not in background mode)
              if (document.getElementById(MODEL_DOWNLOAD_OVERLAY_ID)) {
                updateModelDownloadOverlay(pctNum)
              }
              if (pollCount === 5 && pctNum === 0) {
                console.log('[PromptPrune] 📊 Poll: 5 ticks, still 0% — check Service Worker console for [ServiceWorker] / [ML Engine] logs')
              }
              // After ~15s at 0%, show hint: Groot or SW might not be running
              if (pollCount >= 25 && pctNum === 0) {
                const h = document.getElementById('promptprune-download-hint')
                if (h) {
                  h.style.display = 'block'
                  h.textContent = ''
                }
              }
            } catch (e) {
              if (isExtCtxInvalid(e) && pollTid) {
                clearInterval(pollTid)
                pollTid = null
                hideModelDownloadOverlay()
              }
            }
          })
        } catch (e) {
          if (isExtCtxInvalid(e) && pollTid) {
            clearInterval(pollTid)
            pollTid = null
            hideModelDownloadOverlay()
          }
        }
      }, 600)
    }

    if (modelsReady) {
      console.log('[PromptPrune] ✅ Shared models: READY')
      return
    }
    if (downloadStatus === 'downloading' || downloadStatus === 'downloading-background') {
      console.log(`[PromptPrune] ⏳ Shared models: DOWNLOADING (${downloadProgress}%)`)
      // Only show overlay if not in background mode
      if (downloadStatus === 'downloading') {
        createModelDownloadOverlay()
        updateModelDownloadOverlay(downloadProgress)
        startPoll()
      } else {
        // Background download - just poll silently
        startPoll()
      }
      return
    }
    if (downloadStatus === 'failed' || downloadStatus === 'timeout') {
      console.log('[PromptPrune] ⚠️ Shared models:', downloadStatus === 'timeout' ? 'DOWNLOAD TIMED OUT' : 'DOWNLOAD FAILED')
      showNotification('Using default mode. You can continue.', 'info', 4000)
      return
    }
    if (!downloadAttempted) {
      console.log('[PromptPrune] 📥 Shared models: NOT DOWNLOADED — showing one-time download screen')
      createModelDownloadOverlay()
      updateModelDownloadOverlay(0)
      startPoll()
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        try {
          console.log('[PromptPrune] 📤 Sending INIT_MODELS to background (check Service Worker console for [ServiceWorker] / [ML Engine] logs)')
          chrome.runtime.sendMessage({ type: 'INIT_MODELS' }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('[PromptPrune] ❌ INIT_MODELS callback: lastError=', chrome.runtime.lastError.message || chrome.runtime.lastError)
              if (pollTid) { clearInterval(pollTid); pollTid = null }
              hideModelDownloadOverlay()
              showNotification('Extension couldn\'t start. Reload the extension (chrome://extensions) and try again.', 'error', 6000)
            } else if (response?.success) {
              console.log('[PromptPrune] ✅ INIT_MODELS callback: success, download started in background')
            } else if (response?.error) {
              console.error('[PromptPrune] ❌ INIT_MODELS callback: error=', response.error)
            } else {
              console.warn('[PromptPrune] ⚠️ INIT_MODELS callback: no lastError, response=', response)
            }
          })
        } catch (e) {
          if (isExtCtxInvalid(e)) return
          throw e
        }
      }
      return
    }
    console.log('[PromptPrune] ⏭️ Shared models: Download previously attempted')
  } catch (error) {
    if (isExtCtxInvalid(error)) return
    console.error('[PromptPrune] ❌ Model check failed:', error)
  }
}

// Removed - models now download in background service worker (shared storage)

// Start IMMEDIATELY - don't wait for DOM
// Attach global listeners right away to catch early submissions
attachGlobalSensitiveContentListeners()

// Listen for auth state changes from popup
if (typeof chrome !== 'undefined' && chrome.runtime) {
  // Listen for model download completion (multiple methods for reliability)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'MODELS_DOWNLOADED') {
      console.log('[PromptPrune] 📨 Received MODELS_DOWNLOADED message - both models ready!')
      console.log('[PromptPrune] ✅ PII Model: Ready | Optimizer Model: Ready')
      console.log('[PromptPrune] 🎉 Download complete: Both AI models are now available!')
      hideModelDownloadOverlay()
      showNotification('✅ Both AI models downloaded successfully! PII detection and prompt optimization are now available.', 'success', 5000)
      return false
    }
  })
  
  // Also listen for storage changes (backup method)
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes['models-download-complete']?.newValue === true) {
        console.log('[PromptPrune] 📨 Storage change detected - both models ready!')
        console.log('[PromptPrune] ✅ PII Model: Ready | Optimizer Model: Ready')
        console.log('[PromptPrune] 🎉 Download complete: Both AI models are now available!')
        hideModelDownloadOverlay()
        showNotification('✅ Both AI models downloaded successfully! PII detection and prompt optimization are now available.', 'success', 5000)
      }
    })
  }
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'AUTH_STATE_CHANGED') {
      updateCapsuleAuthState(message.loggedIn)
      sendResponse({ success: true })
    }
    return true
  })
}

// Periodic auth check (every 30 seconds) as fallback
// This ensures capsule updates even if message passing fails
// Reduced frequency to avoid excessive logging
setInterval(async () => {
  try {
    const user = await authService.getCurrentUser()
    updateCapsuleAuthState(user !== null)
  } catch (err) {
    // Silently ignore - auth check might fail if not configured
  }
}, 30000) // Changed from 5 seconds to 30 seconds

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
        // Check if this textarea was previously cleared (by stable ID)
        const currentText = getText(textArea).trim()
        if (clearedTextAreaIds.has(stableId) && currentText.length === 0) {
          // This is a replacement for a cleared textarea - mark it as cleared
          textArea.setAttribute("data-cleared-by-user", "true")
        }
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
