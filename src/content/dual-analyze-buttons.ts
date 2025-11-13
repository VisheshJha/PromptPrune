/**
 * Dual Analyze Buttons
 * Two separate buttons: Smart and Basic
 * When Basic is active, Smart moves down and becomes grey, field buttons appear
 */

export function createDualAnalyzeButtons(
  textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement,
  iconButton: HTMLElement
): { smartButton: HTMLElement; basicButton: HTMLElement } {
  const rect = textArea.getBoundingClientRect()
  const textAreaId = textArea.id || textArea.getAttribute('data-id') || textArea.getAttribute('name') || ''
  const stableId = textAreaId || `textarea-${Math.round(rect.top)}-${Math.round(rect.left)}`
  const smartButtonId = `promptprune-smart-btn-${stableId}`
  const basicButtonId = `promptprune-basic-btn-${stableId}`
  
  // Check if buttons already exist
  const existingSmart = document.querySelector(`#${smartButtonId}`)
  const existingBasic = document.querySelector(`#${basicButtonId}`)
  
  if (existingSmart && existingBasic) {
    return {
      smartButton: existingSmart as HTMLElement,
      basicButton: existingBasic as HTMLElement
    }
  }
  
  // Create Smart button
  const smartButton = createButton(smartButtonId, "✨", "Smart Analyze", true)
  
  // Create Basic button
  const basicButton = createButton(basicButtonId, "📝", "Basic Analyze", false)
  
  return { smartButton, basicButton }
}

function createButton(id: string, icon: string, label: string, isSmart: boolean): HTMLElement {
  const shadowHost = document.createElement("div")
  shadowHost.id = id
  shadowHost.style.cssText = `
    position: fixed;
    z-index: 10000;
    pointer-events: none;
    display: none;
  `
  
  const shadowRoot = shadowHost.attachShadow({ mode: "open" })
  
  const style = document.createElement("style")
  style.textContent = `
    .analyze-btn {
      padding: 6px 12px;
      border-radius: 6px;
      color: white;
      border: none;
      cursor: pointer;
      font-weight: 600;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: all 0.2s;
      pointer-events: auto;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    .analyze-btn.smart {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    }
    .analyze-btn.smart:hover {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
    }
    .analyze-btn.basic {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    }
    .analyze-btn.basic:hover {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }
    .analyze-btn.inactive {
      background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
      opacity: 0.7;
    }
    .analyze-btn.inactive:hover {
      opacity: 0.9;
    }
    .analyze-btn-icon {
      font-size: 14px;
    }
  `
  
  const button = document.createElement("button")
  button.className = `analyze-btn ${isSmart ? 'smart' : 'basic'}`
  button.innerHTML = `
    <span class="analyze-btn-icon">${icon}</span>
    <span>${label}</span>
  `
  button.setAttribute("aria-label", label)
  button.title = isSmart 
    ? "Smart Analyze - Uses AI models for better results" 
    : "Basic Analyze - Uses keyword-based analysis with field buttons"
  
  shadowRoot.appendChild(style)
  shadowRoot.appendChild(button)
  
  return shadowHost
}

export function updateButtonPositions(
  smartButton: HTMLElement,
  basicButton: HTMLElement,
  iconButton: HTMLElement,
  textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement,
  activeMode: 'smart' | 'basic'
): void {
  const iconRect = iconButton.getBoundingClientRect()
  const iconLeft = iconRect.left
  const iconTop = iconRect.top
  const iconWidth = iconRect.width || 28
  const buttonGap = 8 // Gap between buttons
  
  // Smart button always on the RIGHT of P icon, same top
  smartButton.style.position = "fixed"
  smartButton.style.top = `${iconTop}px`
  smartButton.style.left = `${iconLeft + iconWidth + buttonGap}px` // To the right of P icon
  smartButton.style.right = "auto"
  smartButton.style.display = "block"
  
  // Basic button always BELOW Smart button
  basicButton.style.position = "fixed"
  basicButton.style.top = `${iconTop + 36}px` // Below smart button (28px button + 8px gap)
  basicButton.style.left = `${iconLeft + iconWidth + buttonGap}px` // Same left as smart button
  basicButton.style.right = "auto"
  basicButton.style.display = "block"
  
  // Update button states based on active mode
  const smartBtn = smartButton.shadowRoot?.querySelector('.analyze-btn') as HTMLElement
  const basicBtn = basicButton.shadowRoot?.querySelector('.analyze-btn') as HTMLElement
  
  if (activeMode === 'smart') {
    // Smart button active (green)
    if (smartBtn) {
      smartBtn.classList.remove('inactive')
      smartBtn.classList.add('smart')
      smartBtn.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)"
    }
    // Basic button inactive (grey)
    if (basicBtn) {
      basicBtn.classList.add('inactive')
      basicBtn.classList.remove('basic')
      basicBtn.style.background = "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)"
    }
  } else {
    // Basic button active (blue)
    if (basicBtn) {
      basicBtn.classList.remove('inactive')
      basicBtn.classList.add('basic')
      basicBtn.style.background = "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
    }
    // Smart button inactive (grey)
    if (smartBtn) {
      smartBtn.classList.add('inactive')
      smartBtn.classList.remove('smart')
      smartBtn.style.background = "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)"
    }
  }
}

