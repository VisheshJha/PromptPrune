/**
 * Prompt Guidance UI Component
 * Shows interactive guidance in a modal dialog
 */

import { analyzePromptComponents, PROMPT_COMPONENTS, buildPromptFromComponents, isFollowUpMessage, type PromptAnalysis } from "~/lib/prompt-guide"

// Store textarea reference for apply button
let currentTextArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement | null = null

/**
 * Create prompt guidance modal dialog
 */
export function createPromptGuideModal(textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement): HTMLElement {
  const modal = document.createElement("div")
  modal.id = "promptprune-guide-modal"
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000000;
    display: none;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `

  const shadowRoot = modal.attachShadow({ mode: "open" })

  const style = document.createElement("style")
  style.textContent = `
    .modal-content {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 600px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }
    .modal-header {
      padding: 20px 24px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
    }
    .modal-title {
      font-size: 18px;
      font-weight: 600;
      margin: 0;
    }
    .modal-close {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .modal-close:hover {
      background: rgba(255, 255, 255, 0.3);
    }
    .modal-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }
    .analysis-banner {
      padding: 12px 16px;
      background: #f3f4f6;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 13px;
    }
    .score {
      font-weight: 600;
      margin-right: 8px;
    }
    .score-high { color: #059669; }
    .score-medium { color: #f59e0b; }
    .score-low { color: #ef4444; }
    .suggestions {
      margin-top: 8px;
      padding-left: 20px;
      color: #6b7280;
    }
    .suggestions li {
      margin: 4px 0;
    }
    .prompt-template {
      background: #f9fafb;
      border: 2px dashed #d1d5db;
      border-radius: 8px;
      padding: 16px;
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.8;
      white-space: pre-wrap;
      word-wrap: break-word;
      margin-bottom: 20px;
      min-height: 200px;
      color: #111827;
      width: 100%;
      box-sizing: border-box;
    }
    .prompt-template:focus {
      outline: none;
      border-color: #10b981;
      background: white;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    }
    .template-hint {
      font-size: 11px;
      color: #6b7280;
      margin-top: 8px;
      font-style: italic;
    }
    .required-fields {
      margin-bottom: 16px;
    }
    .field-label {
      font-size: 12px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 6px;
      display: block;
    }
    .field-label .required {
      color: #ef4444;
      margin-left: 4px;
    }
    .field-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 13px;
      font-family: inherit;
      margin-bottom: 12px;
      box-sizing: border-box;
    }
    .field-input:focus {
      outline: none;
      border-color: #10b981;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    }
    .field-example {
      font-size: 11px;
      color: #6b7280;
      margin-top: -8px;
      margin-bottom: 8px;
      font-style: italic;
    }
    .optional-fields {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    .optional-title {
      font-size: 13px;
      font-weight: 600;
      color: #6b7280;
      margin-bottom: 12px;
    }
    .modal-footer {
      padding: 16px 24px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      background: #f9fafb;
    }
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-primary {
      background: #10b981;
      color: white;
    }
    .btn-primary:hover {
      background: #059669;
    }
    .btn-secondary {
      background: white;
      color: #374151;
      border: 1px solid #d1d5db;
    }
    .btn-secondary:hover {
      background: #f3f4f6;
    }
  `

  const content = document.createElement("div")
  content.className = "modal-content"

  const header = document.createElement("div")
  header.className = "modal-header"
  header.innerHTML = `
    <h2 class="modal-title">✨ Build Better Prompt</h2>
    <button class="modal-close" aria-label="Close">×</button>
  `

  const body = document.createElement("div")
  body.className = "modal-body"
  body.id = "guide-modal-body"

  const footer = document.createElement("div")
  footer.className = "modal-footer"
  footer.innerHTML = `
    <button class="btn btn-secondary" id="guide-cancel">Cancel</button>
    <button class="btn btn-primary" id="guide-apply">Apply to Prompt</button>
  `

  content.appendChild(header)
  content.appendChild(body)
  content.appendChild(footer)

  shadowRoot.appendChild(style)
  shadowRoot.appendChild(content)

  // Use event delegation for buttons
  shadowRoot.addEventListener("click", (e) => {
    const target = e.target as HTMLElement
    if (target.id === "guide-apply") {
      e.preventDefault()
      e.stopPropagation()
      handleApply(shadowRoot, textArea)
    } else if (target.id === "guide-cancel" || target.classList.contains("modal-close")) {
      e.preventDefault()
      e.stopPropagation()
      modal.style.display = "none"
    }
  })

  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none"
    }
  })

  return modal
}

/**
 * Handle apply button click
 */
function handleApply(
  shadowRoot: ShadowRoot,
  textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
) {
  // Get final template
  const template = shadowRoot.querySelector("#guide-template") as HTMLTextAreaElement
  let finalPrompt = template?.value.trim() || ""
  
  // If template is empty, build from components
  if (!finalPrompt) {
    const components: Record<string, string> = {}
    PROMPT_COMPONENTS.forEach(comp => {
      const input = shadowRoot.querySelector(`#guide-${comp.id}`) as HTMLInputElement
      if (input && input.value.trim()) {
        components[comp.id] = input.value.trim()
      }
    })
    finalPrompt = buildPromptFromComponents(components)
  } else {
    // Convert template format to natural prompt
    finalPrompt = convertTemplateToPrompt(finalPrompt)
  }
  
  if (finalPrompt) {
    if (textArea instanceof HTMLTextAreaElement || textArea instanceof HTMLInputElement) {
      textArea.value = finalPrompt
    } else {
      textArea.innerText = finalPrompt
    }
    textArea.dispatchEvent(new Event("input", { bubbles: true }))
    textArea.dispatchEvent(new Event("change", { bubbles: true }))
    
    // Focus the textarea
    textArea.focus()
    
    // Close modal
    const modal = shadowRoot.host as HTMLElement
    if (modal) {
      modal.style.display = "none"
    }
  }
}

/**
 * Update guide modal with current prompt analysis
 */
export function updatePromptGuide(
  modal: HTMLElement,
  prompt: string,
  textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
) {
  const shadowRoot = modal.shadowRoot
  if (!shadowRoot) return

  currentTextArea = textArea
  const isFollowUp = isFollowUpMessage(textArea)
  const analysis = analyzePromptComponents(prompt, isFollowUp)

  // Get required and optional components
  const requiredComponents = PROMPT_COMPONENTS.filter(comp => 
    comp.required && (!isFollowUp || comp.id !== "role")
  )
  const optionalComponents = PROMPT_COMPONENTS.filter(comp => 
    !comp.required && (!isFollowUp || comp.id !== "role")
  )

  // Extract current values with improved extraction
  const currentValues: Record<string, string> = {}
  PROMPT_COMPONENTS.forEach(comp => {
    const value = getComponentValue(prompt, comp.id)
    currentValues[comp.id] = value
  })

  // Build template preview - always show structure even if empty
  const buildTemplate = (values: Record<string, string>): string => {
    let template = ""
    
    if (!isFollowUp) {
      template += `Role: ${values.role || "expert in the field"}\n`
    }
    template += `Action: ${values.action || "write"}\n`
    template += `Topic: ${values.topic || "the specified topic"}\n`
    
    if (values.audience) {
      template += `Audience: ${values.audience}\n`
    }
    if (values.format) {
      template += `Format: ${values.format}\n`
    }
    if (values.tone) {
      template += `Tone: ${values.tone}\n`
    }
    if (values.length) {
      template += `Length: ${values.length}\n`
    }
    if (values.constraints) {
      template += `Constraints: ${values.constraints}\n`
    }
    if (values.context) {
      template += `Context: ${values.context}\n`
    }
    
    return template.trim()
  }

  const body = shadowRoot.querySelector("#guide-modal-body")
  if (body) {
    const scoreClass = analysis.score >= 70 ? "score-high" : analysis.score >= 50 ? "score-medium" : "score-low"
    
    body.innerHTML = `
      <div class="analysis-banner">
        <span class="score ${scoreClass}">Prompt Score: ${analysis.score}/100</span>
        ${analysis.suggestions.length > 0 ? `
          <div class="suggestions">
            <strong>Suggestions:</strong>
            <ul>
              ${analysis.suggestions.map(s => `<li>${s}</li>`).join("")}
            </ul>
          </div>
        ` : '<div style="margin-top: 8px; color: #059669;">✓ Your prompt looks good! Fill in the fields below to enhance it.</div>'}
      </div>

      <div class="required-fields">
        ${requiredComponents.map(comp => `
          <label class="field-label">
            ${comp.label} <span class="required">*</span>
          </label>
          <input
            type="text"
            class="field-input"
            id="guide-${comp.id}"
            placeholder="${comp.placeholder}"
            value="${currentValues[comp.id] || ''}"
            data-component="${comp.id}"
          />
          ${comp.examples && comp.examples.length > 0 ? `
            <div class="field-example">Examples: ${comp.examples.slice(0, 2).join(", ")}</div>
          ` : ''}
        `).join("")}
      </div>

      ${optionalComponents.length > 0 ? `
        <div class="optional-fields">
          <div class="optional-title">Optional Fields (for better results)</div>
          ${optionalComponents.map(comp => `
            <label class="field-label">${comp.label}</label>
            <input
              type="text"
              class="field-input"
              id="guide-${comp.id}"
              placeholder="${comp.placeholder}"
              value="${currentValues[comp.id] || ''}"
              data-component="${comp.id}"
            />
            ${comp.examples && comp.examples.length > 0 ? `
              <div class="field-example">Examples: ${comp.examples.slice(0, 2).join(", ")}</div>
            ` : ''}
          `).join("")}
        </div>
      ` : ''}

      <div style="margin-top: 20px;">
        <label class="field-label">Preview (Edit directly if needed)</label>
        <textarea
          class="prompt-template"
          id="guide-template"
          placeholder="Fill in the fields above to see the template..."
        >${buildTemplate(currentValues)}</textarea>
        <div class="template-hint">💡 Tip: You can edit the template directly, or fill in the fields above</div>
      </div>
    `

    // Add real-time template update
    const updateTemplate = () => {
      const values: Record<string, string> = {}
      PROMPT_COMPONENTS.forEach(comp => {
        const input = shadowRoot.querySelector(`#guide-${comp.id}`) as HTMLInputElement
        if (input) {
          values[comp.id] = input.value.trim()
        }
      })
      const template = shadowRoot.querySelector("#guide-template") as HTMLTextAreaElement
      if (template) {
        template.value = buildTemplate(values)
      }
    }

    // Add input listeners to all inputs
    PROMPT_COMPONENTS.forEach(comp => {
      const input = shadowRoot.querySelector(`#guide-${comp.id}`) as HTMLInputElement
      if (input) {
        input.addEventListener("input", updateTemplate)
        input.addEventListener("change", updateTemplate)
      }
    })

    // Template can also update fields (reverse sync)
    const templateInput = shadowRoot.querySelector("#guide-template") as HTMLTextAreaElement
    if (templateInput) {
      templateInput.addEventListener("input", () => {
        // Parse template and update fields
        const templateText = templateInput.value
        PROMPT_COMPONENTS.forEach(comp => {
          const regex = new RegExp(`${comp.label}:\\s*(.+?)(?:\\n|$)`, "i")
          const match = templateText.match(regex)
          if (match) {
            const input = shadowRoot.querySelector(`#guide-${comp.id}`) as HTMLInputElement
            if (input) {
              input.value = match[1].trim()
            }
          }
        })
      })
    }
  }
}

/**
 * Convert template format to natural prompt
 */
function convertTemplateToPrompt(template: string): string {
  // Parse template lines
  const lines = template.split("\n").filter(l => l.trim())
  const parts: Record<string, string> = {}
  
  lines.forEach(line => {
    const match = line.match(/^(\w+):\s*(.+)$/i)
    if (match) {
      const key = match[1].toLowerCase()
      const value = match[2].trim()
      parts[key] = value
    }
  })
  
  // Build natural prompt
  return buildPromptFromComponents(parts)
}

/**
 * Extract component value from prompt - IMPROVED VERSION
 */
function getComponentValue(prompt: string, componentId: string): string {
  if (!prompt || !prompt.trim()) return ""
  
  const lowerPrompt = prompt.toLowerCase()
  
  switch (componentId) {
    case "role": {
      // Try multiple patterns
      const patterns = [
        /(?:you are|act as|role|as a|as an|as the)\s+(?:an |a )?([^.,!?\n]+?)(?:\s+who|\s+that|\s+in|$)/i,
        /(?:you are|act as|role|as a|as an|as the)\s+(?:an |a )?([^.,!?\n]+)/i,
        /role:\s*(.+?)(?:\n|$)/i,
      ]
      for (const pattern of patterns) {
        const match = prompt.match(pattern)
        if (match && match[1]) {
          return match[1].trim()
        }
      }
      return ""
    }
    case "action": {
      // Look for action verbs
      const actionVerbs = ["write", "create", "make", "generate", "tell", "explain", "describe", "analyze", "discuss", "build", "design", "develop", "summarize", "list", "outline"]
      for (const verb of actionVerbs) {
        const regex = new RegExp(`\\b${verb}\\b`, "i")
        if (regex.test(prompt)) {
          return verb
        }
      }
      return ""
    }
    case "topic": {
      // Try multiple patterns for topic
      const patterns = [
        /(?:about|on|regarding|concerning|topic|subject|theme)\s+(?:the\s+)?([^.,!?\n]+?)(?:\s+for|\s+to|\s+in|\s+with|$)/i,
        /(?:about|on|regarding|concerning)\s+(?:the\s+)?([^.,!?\n]+)/i,
        /topic:\s*(.+?)(?:\n|$)/i,
        /write\s+(?:about|on)\s+(?:the\s+)?([^.,!?\n]+?)(?:\s+for|\s+to|$)/i,
      ]
      for (const pattern of patterns) {
        const match = prompt.match(pattern)
        if (match && match[1]) {
          const topic = match[1].trim()
          // Remove common trailing words
          return topic.replace(/\s+(for|to|in|with|about|on)$/i, "").trim()
        }
      }
      return ""
    }
    case "audience": {
      const patterns = [
        /(?:for|to|target|audience)\s+(?:the\s+)?([^.,!?\n]+?)(?:\s+who|\s+that|\s+in|$)/i,
        /(?:for|to|target|audience)\s+(?:the\s+)?([^.,!?\n]+)/i,
        /audience:\s*(.+?)(?:\n|$)/i,
      ]
      for (const pattern of patterns) {
        const match = prompt.match(pattern)
        if (match && match[1]) {
          return match[1].trim()
        }
      }
      return ""
    }
    case "format": {
      const formats = ["article", "report", "blog", "post", "summary", "list", "table", "code", "essay", "letter", "email", "outline", "guide"]
      for (const format of formats) {
        const regex = new RegExp(`\\b${format}\\b`, "i")
        if (regex.test(prompt)) {
          return format
        }
      }
      return ""
    }
    case "tone": {
      const tones = ["professional", "casual", "friendly", "formal", "informal", "technical", "simple", "engaging", "persuasive", "academic", "conversational"]
      for (const tone of tones) {
        const regex = new RegExp(`\\b${tone}\\b`, "i")
        if (regex.test(prompt)) {
          return tone
        }
      }
      return ""
    }
    case "length": {
      const patterns = [
        /(\d+\s*(?:words?|pages?|characters?))/i,
        /\b(short|long|brief|detailed|comprehensive|concise)\b/i,
        /length:\s*(.+?)(?:\n|$)/i,
      ]
      for (const pattern of patterns) {
        const match = prompt.match(pattern)
        if (match) {
          // For word boundary matches, return the matched word
          if (match[0] && !match[1]) {
            return match[0].trim()
          }
          // For patterns with capture groups
          if (match[1]) {
            return match[1].trim()
          }
        }
      }
      return ""
    }
    case "constraints": {
      const patterns = [
        /(?:constraints?|requirements?|must|should):\s*([^.,!?\n]+)/i,
        /(?:include|must|should|require)\s+([^.,!?\n]+?)(?:\s+and|\s+or|$)/i,
      ]
      for (const pattern of patterns) {
        const match = prompt.match(pattern)
        if (match && match[1]) {
          return match[1].trim()
        }
      }
      return ""
    }
    case "context": {
      const patterns = [
        /(?:context|background|situation):\s*([^.,!?\n]+)/i,
        /(?:for|context|background)\s+(?:a|an|the)\s+([^.,!?\n]+?)(?:\s+that|\s+which|$)/i,
      ]
      for (const pattern of patterns) {
        const match = prompt.match(pattern)
        if (match && match[1]) {
          return match[1].trim()
        }
      }
      return ""
    }
    default:
      return ""
  }
}
