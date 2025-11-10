/**
 * Smart Field Toggle Buttons
 * Shows individual toggle buttons for each field (green when present, grey when missing)
 * Positioned on the right side like the P icon
 */

import { detectFields, getMissingFields, insertFieldsIntoText, removeField, generateSingleField } from "~/lib/field-detector"
import { isFollowUpMessage } from "~/lib/prompt-guide"

// Helper functions (duplicated from content.ts to avoid circular dependency)
function getText(element: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement): string {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    return element.value
  }
  return element.innerText || element.textContent || ""
}

function setText(element: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement, text: string): void {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    element.value = text
    element.dispatchEvent(new Event("input", { bubbles: true }))
    element.dispatchEvent(new Event("change", { bubbles: true }))
  } else {
    element.innerText = text
    element.dispatchEvent(new Event("input", { bubbles: true }))
    element.dispatchEvent(new Event("change", { bubbles: true }))
  }
}

// Define all possible fields in order
const ALL_FIELDS = [
  { key: "role", label: "Role" },
  { key: "task", label: "Task" },
  { key: "topic", label: "Topic" },
  { key: "format", label: "Format" },
  { key: "tone", label: "Tone" },
  { key: "context", label: "Context" },
]

/**
 * Create smart field toggle buttons (always visible, toggle green/grey)
 */
export function createFieldButton(textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement): HTMLElement {
  const buttonHost = document.createElement("div")
  buttonHost.id = "promptprune-field-buttons-host"
  buttonHost.style.cssText = `
    position: fixed;
    z-index: 10001;
    pointer-events: none;
    display: none;
    flex-direction: column;
    gap: 3px;
    width: 70px;
  `
  
  const shadowRoot = buttonHost.attachShadow({ mode: "open" })
  
  const style = document.createElement("style")
  style.textContent = `
    .field-buttons-container {
      display: flex;
      flex-direction: column;
      gap: 3px;
      align-items: stretch;
      width: 100%;
    }
    .field-button {
      background: #6b7280;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 5px 10px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      transition: all 0.2s;
      pointer-events: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      white-space: nowrap;
      width: 100%;
      min-width: 70px;
    }
    .field-button.active {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
    }
    .field-button:hover {
      transform: translateX(-2px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    }
    .field-button.active:hover {
      box-shadow: 0 3px 10px rgba(16, 185, 129, 0.4);
    }
    .field-button:active {
      transform: translateX(0);
    }
    .field-button-label {
      font-weight: 500;
    }
  `
  
  const container = document.createElement("div")
  container.className = "field-buttons-container"
  container.id = "field-buttons-container"
  
  // Add Clear button at the bottom
  const clearButton = document.createElement("button")
  clearButton.className = "field-button"
  clearButton.style.cssText = `
    background: #ef4444;
    color: white;
    margin-top: 6px;
    font-size: 10px;
    padding: 4px 8px;
  `
  clearButton.innerHTML = `<span class="field-button-label">Clear All</span>`
  clearButton.title = "Remove all fields from template"
  clearButton.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Clear everything in the textbox - completely empty, no template
    // Set a flag to prevent preFillTemplate from re-filling
    textArea.setAttribute("data-cleared-by-user", "true")
    
    // Clear the text directly without triggering events that might re-fill
    if (textArea instanceof HTMLTextAreaElement || textArea instanceof HTMLInputElement) {
      textArea.value = ""
    } else {
      textArea.innerText = ""
      textArea.textContent = ""
    }
    
    // Clear role tracking when user clears (new conversation)
    // Note: We can't access roleProvidedInFirstPrompt from here, but the resetOriginalPrompt will handle it
    
    // Dispatch events manually but with a flag to prevent re-filling
    const inputEvent = new Event("input", { bubbles: true })
    const changeEvent = new Event("change", { bubbles: true })
    ;(inputEvent as any).preventRefill = true
    ;(changeEvent as any).preventRefill = true
    textArea.dispatchEvent(inputEvent)
    textArea.dispatchEvent(changeEvent)
    
    // Focus and place cursor at start
    textArea.focus()
    if (textArea instanceof HTMLTextAreaElement || textArea instanceof HTMLInputElement) {
      textArea.setSelectionRange(0, 0)
    }
    
    // Remove the flag after a delay to allow normal pre-filling on next focus
    setTimeout(() => {
      textArea.removeAttribute("data-cleared-by-user")
    }, 1000)
    
    // Update buttons after clear
    setTimeout(updateButtons, 100)
  })
  
  // Create summary button (only for follow-ups)
  const summaryButton = document.createElement("button")
  summaryButton.className = "field-button"
  summaryButton.style.cssText = `
    background: #3b82f6;
    color: white;
    margin-top: 6px;
    font-size: 10px;
    padding: 4px 8px;
    display: none;
  `
  summaryButton.innerHTML = `<span class="field-button-label">Summarize</span>`
  summaryButton.title = "Summarize in 100 words"
  summaryButton.addEventListener("click", async (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    const currentText = getText(textArea).trim()
    if (!currentText) {
      // If empty, set default summarize task with brackets for context
      setText(textArea, "Task: Summarize in 100 words\nContext: [context]")
    } else {
      // Import and use summarize function
      try {
        const { compressPrompt } = await import("~/lib/prompt-compressor")
        const summary = compressPrompt(currentText, {
          targetLength: 100,
          preserveKeywords: true,
          removeRedundancy: true,
          simplifyPhrases: true
        })
        setText(textArea, summary)
      } catch (error) {
        console.error("Summarize error:", error)
      }
    }
    
    // Focus and place cursor at end
    textArea.focus()
    if (textArea instanceof HTMLTextAreaElement || textArea instanceof HTMLInputElement) {
      const newValue = textArea.value
      textArea.setSelectionRange(newValue.length, newValue.length)
    }
    
    // Update buttons after summarize
    setTimeout(updateButtons, 100)
  })
  
  shadowRoot.appendChild(style)
  shadowRoot.appendChild(container)
  shadowRoot.appendChild(clearButton)
  shadowRoot.appendChild(summaryButton)
  
  // Create buttons for all fields
  const buttons = new Map<string, HTMLButtonElement>()
  
  ALL_FIELDS.forEach(field => {
    const button = document.createElement("button")
    button.className = "field-button"
    button.dataset.fieldKey = field.key
    button.innerHTML = `
      <span class="field-button-label">${field.label}</span>
    `
    button.title = `${field.label} field`
    
    button.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      
      const currentText = getText(textArea).trim()
      const fields = detectFields(currentText)
      const isFollowUp = isFollowUpMessage(textArea)
      
      // Check if field is present - handle both "task" and "action" for Task field
      let hasField = false
      if (field.key === "task") {
        hasField = fields.hasTask || false
      } else {
        const fieldKey = field.key as keyof typeof fields
        const hasFieldKey = `has${fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1)}` as keyof typeof fields
        hasField = fields[hasFieldKey] as boolean || false
      }
      
      if (hasField) {
        // Remove field
        const newText = removeField(currentText, field.key)
        setText(textArea, newText)
      } else {
        // Add field
        const fieldDef = {
          key: field.key,
          label: field.label,
          placeholder: field.key === "role" ? "expert type" : 
                      field.key === "task" ? "action" : 
                      field.key === "topic" ? "subject" : 
                      field.key === "format" ? "output format" : 
                      field.key === "tone" ? "tone" : 
                      "background information"
        }
        const newText = insertFieldsIntoText(currentText, [fieldDef])
        setText(textArea, newText)
      }
      
      // Focus and place cursor at end
      textArea.focus()
      if (textArea instanceof HTMLTextAreaElement || textArea instanceof HTMLInputElement) {
        const newValue = textArea.value
        textArea.setSelectionRange(newValue.length, newValue.length)
      }
      
      // Update buttons after toggle
      setTimeout(updateButtons, 100)
    })
    
    buttons.set(field.key, button)
    container.appendChild(button)
  })
  
  // Debounce function for performance
  let updateTimeout: ReturnType<typeof setTimeout> | null = null
  const debouncedUpdate = () => {
    if (updateTimeout) clearTimeout(updateTimeout)
    updateTimeout = setTimeout(updateButtons, 150)
  }
  
  // Update button states
  const updateButtons = () => {
    // Check if textarea is still valid
    if (!textArea || !textArea.isConnected) {
      buttonHost.style.display = "none"
      return
    }
    
    const rect = textArea.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      buttonHost.style.display = "none"
      return
    }
    
    const text = getText(textArea).trim()
    
    // Show buttons when textarea is focused OR has text (for better UX)
    const isFocused = document.activeElement === textArea
    const hasText = text.length > 0
    const shouldShow = hasText || isFocused
    
    if (!shouldShow) {
      // Hide all buttons when textarea is empty and not focused
      buttonHost.style.display = "none"
      return
    }
    
    // Show buttons - ensure visibility
    buttonHost.style.display = "flex"
    buttonHost.style.visibility = "visible"
    buttonHost.style.opacity = "1"
    
    const fields = detectFields(text)
    const isFollowUp = isFollowUpMessage(textArea)
    
    // Show/hide summary button based on follow-up status
    const summaryBtn = shadowRoot.querySelector('button[title="Summarize in 100 words"]') as HTMLButtonElement
    if (summaryBtn) {
      if (isFollowUp) {
        summaryBtn.style.display = "flex"
      } else {
        summaryBtn.style.display = "none"
      }
    }
    
    // Update each button's active state directly from fields
    ALL_FIELDS.forEach(field => {
      const button = buttons.get(field.key)
      if (!button) return
      
      // For follow-up messages: only show Task and Context buttons
      // Hide Role, Topic, Format, Tone for follow-ups
      if (isFollowUp) {
        if (field.key === "task" || field.key === "context") {
          // Task and Context are enabled for follow-ups
          button.style.display = "flex"
          button.style.opacity = "1"
          button.style.pointerEvents = "auto"
          button.style.cursor = "pointer"
          button.title = `${field.label} field`
        } else {
          // Hide Role, Topic, Format, Tone for follow-ups
          button.style.display = "none"
        }
      } else {
        // First prompt: all fields enabled
        button.style.display = "flex"
        button.style.opacity = "1"
        button.style.pointerEvents = "auto"
        button.style.cursor = "pointer"
        button.title = `${field.label} field`
      }
      
      // Check field presence directly - handle both "task" and "action" for Task field
      let hasField = false
      if (field.key === "task") {
        hasField = fields.hasTask || false
      } else {
        const fieldKey = field.key as keyof typeof fields
        const hasFieldKey = `has${fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1)}` as keyof typeof fields
        hasField = fields[hasFieldKey] as boolean || false
      }
      
      button.classList.toggle("active", hasField)
    })
  }
  
  // Update on input (debounced for performance)
  textArea.addEventListener("input", debouncedUpdate)
  textArea.addEventListener("focus", () => {
    updateButtons()
    // Trigger position update when focused
    if (buttonHost.parentElement) {
      const event = new Event("resize")
      window.dispatchEvent(event)
    }
  })
  textArea.addEventListener("blur", debouncedUpdate)
  
  // Initial update with delay to ensure textarea is ready
  setTimeout(updateButtons, 200)
  
  return buttonHost
}

/**
 * Position field buttons on the right side of textarea (like P icon)
 */
export function positionFieldButton(
  button: HTMLElement,
  textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
) {
  const rect = textArea.getBoundingClientRect()
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
  
  // Position buttons on the right side, vertically centered
  button.style.position = "fixed"
  button.style.top = `${rect.top + scrollTop + 8}px`
  button.style.right = `${window.innerWidth - rect.right + scrollLeft + 8}px`
  button.style.zIndex = "10001"
}
