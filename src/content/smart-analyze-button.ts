/**
 * Smart Analyze Button
 * Creates a visible button next to the P icon for one-click smart analysis
 */

export function createSmartAnalyzeButton(
  textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement,
  iconButton: HTMLElement
): HTMLElement {
  const rect = textArea.getBoundingClientRect()
  const textAreaId = textArea.id || textArea.getAttribute('data-id') || textArea.getAttribute('name') || ''
  const stableId = textAreaId || `textarea-${Math.round(rect.top)}-${Math.round(rect.left)}`
  const buttonId = `promptprune-smart-btn-${stableId}`
  
  // Check if button already exists
  const existing = document.querySelector(`#${buttonId}`)
  if (existing) {
    return existing as HTMLElement
  }
  
  const shadowHost = document.createElement("div")
  shadowHost.id = buttonId
  shadowHost.style.cssText = `
    position: fixed;
    z-index: 10000;
    pointer-events: none;
    display: none;
  `
  
  const shadowRoot = shadowHost.attachShadow({ mode: "open" })
  
  const style = document.createElement("style")
  style.textContent = `
    .smart-analyze-btn {
      padding: 6px 12px;
      border-radius: 6px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      border: none;
      cursor: pointer;
      font-weight: 600;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
      transition: all 0.2s;
      pointer-events: auto;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .smart-analyze-btn:hover {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
    }
    .smart-analyze-btn:active {
      transform: translateY(0);
    }
    .smart-analyze-btn-icon {
      font-size: 14px;
    }
    .smart-analyze-btn-mode {
      font-size: 10px;
      opacity: 0.9;
      font-weight: 500;
    }
  `
  
  const button = document.createElement("button")
  button.className = "smart-analyze-btn"
  
  // Check current mode to show appropriate button
  const currentMode = localStorage.getItem('promptprune-analysis-mode') || 'smart'
  if (currentMode === 'smart') {
    button.innerHTML = `
      <span class="smart-analyze-btn-icon">✨</span>
      <span>Smart Analyze</span>
    `
    button.setAttribute("aria-label", "Smart Analyze with AI")
    button.title = "Smart Analyze - Uses AI models for better results"
  } else {
    button.innerHTML = `
      <span class="smart-analyze-btn-icon">📝</span>
      <span>Basic Analyze</span>
    `
    button.setAttribute("aria-label", "Basic Analyze")
    button.title = "Basic Analyze - Uses keyword-based analysis"
    button.style.background = "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)"
  }
  
  shadowRoot.appendChild(style)
  shadowRoot.appendChild(button)
  
  return shadowHost
}

export function createModeToggle(
  textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement,
  iconButton: HTMLElement
): HTMLElement {
  const rect = textArea.getBoundingClientRect()
  const textAreaId = textArea.id || textArea.getAttribute('data-id') || textArea.getAttribute('name') || ''
  const stableId = textAreaId || `textarea-${Math.round(rect.top)}-${Math.round(rect.left)}`
  const toggleId = `promptprune-mode-toggle-${stableId}`
  
  // Check if toggle already exists
  const existing = document.querySelector(`#${toggleId}`)
  if (existing) {
    return existing as HTMLElement
  }
  
  const shadowHost = document.createElement("div")
  shadowHost.id = toggleId
  shadowHost.style.cssText = `
    position: fixed;
    z-index: 10000;
    pointer-events: none;
    display: none;
  `
  
  const shadowRoot = shadowHost.attachShadow({ mode: "open" })
  
  const style = document.createElement("style")
  style.textContent = `
    .mode-toggle {
      padding: 4px 8px;
      border-radius: 6px;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      cursor: pointer;
      font-size: 10px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: all 0.2s;
      pointer-events: auto;
      white-space: nowrap;
      color: #6b7280;
    }
    .mode-toggle:hover {
      background: #e5e7eb;
      border-color: #d1d5db;
    }
    .mode-toggle.smart {
      background: #dbeafe;
      border-color: #3b82f6;
      color: #1e40af;
    }
    .mode-toggle.basic {
      background: #f3f4f6;
      border-color: #e5e7eb;
      color: #6b7280;
    }
  `
  
  const toggle = document.createElement("button")
  toggle.className = "mode-toggle smart"
  toggle.textContent = "Smart"
  toggle.setAttribute("aria-label", "Toggle analysis mode")
  toggle.title = "Click to switch between Smart and Basic analysis"
  
  // Load saved mode from localStorage
  const savedMode = localStorage.getItem('promptprune-analysis-mode') || 'smart'
  if (savedMode === 'basic') {
    toggle.className = "mode-toggle basic"
    toggle.textContent = "Basic"
  }
  
  toggle.addEventListener("click", (e) => {
    e.stopPropagation()
    const currentMode = toggle.textContent === "Smart" ? 'smart' : 'basic'
    const newMode = currentMode === 'smart' ? 'basic' : 'smart'
    
    toggle.className = `mode-toggle ${newMode}`
    toggle.textContent = newMode === 'smart' ? "Smart" : "Basic"
    
    // Save to localStorage
    localStorage.setItem('promptprune-analysis-mode', newMode)
    
    // Update global mode
    ;(window as any).__promptprune_analysis_mode = newMode
    
    // Update all toggles on the page
    document.querySelectorAll('[id^="promptprune-mode-toggle-"]').forEach((el) => {
      const shadowRoot = (el as HTMLElement).shadowRoot
      const toggleBtn = shadowRoot?.querySelector('.mode-toggle') as HTMLElement
      if (toggleBtn) {
        toggleBtn.className = `mode-toggle ${newMode}`
        toggleBtn.textContent = newMode === 'smart' ? "Smart" : "Basic"
      }
    })
    
    // Update all smart buttons on the page
    document.querySelectorAll('[id^="promptprune-smart-btn-"]').forEach((el) => {
      const shadowRoot = (el as HTMLElement).shadowRoot
      const smartBtn = shadowRoot?.querySelector('.smart-analyze-btn') as HTMLElement
      if (smartBtn) {
        if (newMode === 'smart') {
          smartBtn.innerHTML = `<span class="smart-analyze-btn-icon">✨</span><span>Smart Analyze</span>`
          smartBtn.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)"
          smartBtn.setAttribute("aria-label", "Smart Analyze with AI")
          smartBtn.title = "Smart Analyze - Uses AI models for better results"
        } else {
          smartBtn.innerHTML = `<span class="smart-analyze-btn-icon">📝</span><span>Basic Analyze</span>`
          smartBtn.style.background = "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)"
          smartBtn.setAttribute("aria-label", "Basic Analyze")
          smartBtn.title = "Basic Analyze - Uses keyword-based analysis"
        }
      }
    })
    
    // Show/hide field buttons based on mode
    // In basic mode, show field buttons; in smart mode, hide them
    const fieldButtons = document.querySelectorAll('[id^="promptprune-field-buttons-host"]')
    fieldButtons.forEach((btn) => {
      if (newMode === 'basic') {
        ;(btn as HTMLElement).style.display = "block"
      } else {
        ;(btn as HTMLElement).style.display = "none"
      }
    })
    
    // Show notification
    const notification = document.createElement("div")
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 8px 12px;
      background: ${newMode === 'smart' ? '#10b981' : '#6b7280'};
      color: white;
      border-radius: 6px;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 1000000;
      animation: slideIn 0.3s ease-out;
    `
    notification.textContent = `Switched to ${newMode === 'smart' ? 'Smart' : 'Basic'} mode`
    document.body.appendChild(notification)
    setTimeout(() => notification.remove(), 2000)
  })
  
  shadowRoot.appendChild(style)
  shadowRoot.appendChild(toggle)
  
  return shadowHost
}

export function updateSmartButtonPosition(
  smartButton: HTMLElement,
  iconButton: HTMLElement,
  textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
): void {
  const iconRect = iconButton.getBoundingClientRect()
  
  // Position smart button to the left of P icon (8px gap)
  smartButton.style.position = "fixed"
  smartButton.style.top = `${iconRect.top}px`
  smartButton.style.right = `${window.innerWidth - iconRect.left + 8}px` // 8px gap from P icon
  smartButton.style.display = "block"
  smartButton.style.pointerEvents = "auto"
}

export function updateTogglePosition(
  toggle: HTMLElement,
  smartButton: HTMLElement,
  iconButton: HTMLElement
): void {
  const smartRect = smartButton.getBoundingClientRect()
  
  // Position toggle above smart button
  toggle.style.position = "fixed"
  toggle.style.top = `${smartRect.top - 28}px` // Above smart button
  toggle.style.right = `${window.innerWidth - smartRect.right}px`
  toggle.style.display = "block"
  toggle.style.pointerEvents = "auto"
}

