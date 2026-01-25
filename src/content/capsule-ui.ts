/**
 * PromptPrune Capsule UI
 * A premium, glassmorphic floating capsule that provides a unified entry point for all features.
 * Replaces scattered buttons with a sleek, context-aware interface.
 */

export class CapsuleUI {
  private element: HTMLElement
  private shadowRoot: ShadowRoot
  private state: 'collapsed' | 'expanded' | 'alert' = 'collapsed'
  private isLocked: boolean = false
  private listeners: { [key: string]: Function[] } = {}
  private sensitiveCount: number = 0
  private tokenCount: number = 0
  private currentTarget: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement | null = null
  private downloadProgress: number = 0
  private isDownloading: boolean = false

  /**
   * Set the target textarea for this capsule
   */
  setTarget(target: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement) {
    this.currentTarget = target
    this.updatePosition(target.getBoundingClientRect())

    // Initial state update
    const text = this.getText(target)
    // We'll update tokens/sensitive state from the content script
  }

  private getText(element: HTMLElement): string {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      return element.value
    }
    return element.innerText || element.textContent || ""
  }

  constructor() {
    this.element = document.createElement('div')
    this.element.id = 'promptprune-capsule-host'
    this.element.style.cssText = `
      position: fixed;
      z-index: 2147483647; /* Max z-index */
      pointer-events: none; /* Allow clicks to pass through wrapper */
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    `
    this.shadowRoot = this.element.attachShadow({ mode: 'open' })
    this.render()
  }

  /**
   * Mount the capsule to the DOM
   */
  mount(container: HTMLElement = document.body) {
    if (!document.getElementById('promptprune-capsule-host')) {
      container.appendChild(this.element)
    }
  }

  /**
   * Set the lock state (unauthenticated)
   */
  setLocked(locked: boolean) {
    this.isLocked = locked
    this.renderContent()
  }

  /**
   * Update position relative to the active textarea
   */
  updatePosition(rect: DOMRect) {
    // Position: Bottom-right of the textarea, floating slightly above
    const bottom = window.innerHeight - rect.bottom
    const right = window.innerWidth - rect.right

    // Ensure it stays within viewport
    const safeBottom = Math.max(20, bottom + 20)
    const safeRight = Math.max(20, right + 20)

    this.element.style.bottom = `${safeBottom}px`
    this.element.style.right = `${safeRight}px`
    this.element.style.position = 'fixed'
  }

  public get target() {
    return this.currentTarget
  }

  /**
   * Set loading state
   */
  setLoading(loading: boolean) {
    if (this.isLocked) return

    const optimizeBtn = this.shadowRoot.getElementById('optimize-btn')
    if (optimizeBtn) {
      // Optimize feature disabled - keep button disabled with "soon" text
      optimizeBtn.textContent = 'Optimise (soon)'
      optimizeBtn.setAttribute('disabled', 'true')
      // Don't change cursor or state for disabled optimize button
    }
  }

  show() {
    this.element.style.display = 'block'
  }

  hide() {
    this.element.style.display = 'none'
  }

  /**
   * Update state (tokens, sensitive data)
   */
  updateState(tokens: number, sensitiveItems: number) {
    if (this.isLocked) return

    this.tokenCount = tokens
    this.sensitiveCount = sensitiveItems

    if (sensitiveItems > 0) {
      this.state = 'alert'
    } else if (this.state === 'alert') {
      this.state = 'collapsed'
    }

    this.renderContent()
  }

  /**
   * Update token count
   */
  updateTokenCount(count: number) {
    if (this.isLocked) return
    this.tokenCount = count
    this.renderContent()
  }

  /**
   * Update sensitive content warning
   */
  updateSensitiveWarning(hasSensitive: boolean, details: any[]) {
    if (this.isLocked) return
    const sensitiveCount = hasSensitive ? (details?.length || 1) : 0
    this.updateState(this.tokenCount, sensitiveCount)
  }

  /**
   * Register event listeners
   */
  on(event: 'optimize' | 'grammar' | 'frameworks' | 'expand' | 'mask' | 'clear', callback: Function) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(callback)
  }

  /**
   * Set download progress
   */
  setDownloadProgress(progress: number) {
    this.downloadProgress = progress
    this.isDownloading = progress > 0 && progress < 100
    this.renderContent()
  }

  private emit(event: string, data?: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data))
    }
  }

  private render() {
    const style = document.createElement('style')
    style.textContent = `
      :host {
        --pp-primary: #10b981;
        --pp-primary-dark: #059669;
        --pp-danger: #ef4444;
        --pp-bg: rgba(255, 255, 255, 0.85);
        --pp-bg-dark: rgba(30, 30, 30, 0.85);
        --pp-border: rgba(255, 255, 255, 0.5);
        --pp-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        --pp-glass: blur(12px);
      }

      @media (prefers-color-scheme: dark) {
        :host {
          --pp-bg: var(--pp-bg-dark);
          --pp-border: rgba(255, 255, 255, 0.1);
        }
      }

      .capsule {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        background: var(--pp-bg);
        backdrop-filter: var(--pp-glass);
        -webkit-backdrop-filter: var(--pp-glass);
        border: 1px solid var(--pp-border);
        border-radius: 999px;
        box-shadow: var(--pp-shadow);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: auto;
        cursor: pointer;
        max-width: 40px;
        overflow: hidden;
        white-space: nowrap;
      }

      .capsule:hover, .capsule.expanded {
        max-width: 350px;
        padding: 6px 12px;
      }

      .capsule.alert, .capsule.locked {
        border-color: var(--pp-danger);
        box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
      }

      /* Logo Section */
      .logo-container {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        background: linear-gradient(135deg, var(--pp-primary) 0%, var(--pp-primary-dark) 100%);
        border-radius: 50%;
        color: white;
        font-weight: bold;
        font-size: 14px;
        flex-shrink: 0;
        transition: background 0.3s;
      }

      .capsule.locked .logo-container {
        background: var(--pp-danger);
      }

      /* Content Section (Hidden when collapsed) */
      .content {
        display: flex;
        align-items: center;
        gap: 12px;
        opacity: 0;
        transform: translateX(-10px);
        transition: all 0.2s ease-out;
      }

      .capsule:hover .content, .capsule.expanded .content {
        opacity: 1;
        transform: translateX(0);
      }

      /* Stats */
      .stats {
        display: flex;
        flex-direction: column;
        font-size: 10px;
        color: #6b7280;
        line-height: 1.2;
      }
      
      .stats strong {
        color: #111827;
        font-weight: 600;
      }

      @media (prefers-color-scheme: dark) {
        .stats { color: #9ca3af; }
        .stats strong { color: #f3f4f6; }
      }

      /* Actions */
      .actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .btn {
        border: none;
        background: transparent;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        color: #374151;
        cursor: pointer;
        transition: background 0.2s;
      }

      .btn:hover {
        background: rgba(0, 0, 0, 0.05);
      }
      
      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      @media (prefers-color-scheme: dark) {
        .btn { color: #d1d5db; }
        .btn:hover { background: rgba(255, 255, 255, 0.1); }
      }

      .btn-primary {
        background: linear-gradient(135deg, var(--pp-primary) 0%, var(--pp-primary-dark) 100%);
        color: white !important;
        box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
      }

      .btn-primary:hover {
        opacity: 0.9;
      }

      .btn-primary:disabled {
        background: #9ca3af !important;
        color: white !important;
        cursor: not-allowed;
        opacity: 0.6;
      }

      .btn-danger {
        background: var(--pp-danger);
        color: white !important;
        display: none; /* Hidden by default */
      }
      
      .btn-danger.visible {
        display: block;
      }

      .divider {
        width: 1px;
        height: 16px;
        background: rgba(0, 0, 0, 0.1);
      }

      @media (prefers-color-scheme: dark) {
        .divider { background: rgba(255, 255, 255, 0.1); }
      }
      
      /* Alert Badge */
      .alert-badge, .lock-badge {
        background: var(--pp-danger);
        color: white;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 600;
        display: none;
      }
      
      .capsule.alert .alert-badge, .capsule.locked .lock-badge {
        display: block;
      }

      .locked-message {
        font-size: 11px;
        color: var(--pp-danger);
        font-weight: 600;
        display: none;
      }

      .capsule.locked .locked-message {
        display: block;
      }

      .capsule.locked .actions, 
      .capsule.locked .divider,
      .capsule.locked #token-display {
        display: none;
      }
    `

    const container = document.createElement('div')
    container.className = 'capsule'
    container.id = 'pp-capsule'

    container.innerHTML = `
      <div class="logo-container" id="logo-btn">P</div>
      <div class="content">
        <div class="stats">
          <span id="token-display">0 tokens</span>
          <span class="alert-badge">Sensitive Data!</span>
          <span class="lock-badge">Locked</span>
          <span class="locked-message">Login from extension</span>
        </div>
        <div class="divider"></div>
        <div class="actions">
          <button class="btn btn-danger" id="mask-btn">Mask</button>
          <button class="btn btn-danger visible" id="clear-btn" title="Clear text" style="display: block;">Clear</button>
          <button class="btn btn-primary" id="optimize-btn" title="Optimize prompt using AI" disabled>Optimise (soon)</button>
          <button class="btn" id="framework-btn" title="Frameworks">⌘</button>
        </div>
      </div>
    `

    this.shadowRoot.appendChild(style)
    this.shadowRoot.appendChild(container)

    // Event Listeners
    const optimizeBtn = this.shadowRoot.getElementById('optimize-btn')
    const frameworkBtn = this.shadowRoot.getElementById('framework-btn')
    const maskBtn = this.shadowRoot.getElementById('mask-btn')
    const logoBtn = this.shadowRoot.getElementById('logo-btn')

    optimizeBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      e.preventDefault()
      // Optimize feature disabled for now - coming soon
      // if (this.isLocked) return
      // this.emit('optimize')
    })

    frameworkBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      if (this.isLocked) return
      this.emit('frameworks')
    })

    maskBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      if (this.isLocked) return
      this.emit('mask')
    })

    const clearBtn = this.shadowRoot.getElementById('clear-btn')
    clearBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      if (this.isLocked) return
      // Emit clear event so content script can handle it properly
      this.emit('clear')
    })

    logoBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      container.classList.toggle('expanded')
    })

    container.addEventListener('mouseenter', () => {
      this.emit('expand')
    })
  }

  private renderContent() {
    const tokenDisplay = this.shadowRoot.getElementById('token-display')
    const capsule = this.shadowRoot.getElementById('pp-capsule')
    const maskBtn = this.shadowRoot.getElementById('mask-btn')

    if (tokenDisplay) {
      tokenDisplay.textContent = `${this.tokenCount} tokens`
    }

    if (capsule) {
      if (this.isLocked) {
        capsule.classList.add('locked')
        capsule.classList.remove('alert')
      } else if (this.isDownloading) {
        const optimizeBtn = this.shadowRoot.getElementById('optimize-btn')
        if (optimizeBtn) {
          optimizeBtn.textContent = `⬇️ ${Math.round(this.downloadProgress)}%`
          optimizeBtn.setAttribute('disabled', 'true')
        }
      } else if (this.state === 'alert') {
        capsule.classList.add('alert')
        capsule.classList.remove('locked')
        maskBtn?.classList.add('visible')
        // Restore optimize button text if it was showing progress
        const optimizeBtn = this.shadowRoot.getElementById('optimize-btn')
        if (optimizeBtn && optimizeBtn.textContent?.includes('%')) {
          optimizeBtn.textContent = 'Optimize'
          optimizeBtn.removeAttribute('disabled')
        }
      } else {
        capsule.classList.remove('alert')
        capsule.classList.remove('locked')
        maskBtn?.classList.remove('visible')
        // Restore optimize button text
        const optimizeBtn = this.shadowRoot.getElementById('optimize-btn')
        if (optimizeBtn && optimizeBtn.textContent?.includes('%')) {
          optimizeBtn.textContent = 'Optimize'
          optimizeBtn.removeAttribute('disabled')
        }
      }
    }
  }

}

// Singleton instance
let capsuleInstance: CapsuleUI | null = null

export function getCapsuleUI(): CapsuleUI {
  if (!capsuleInstance) {
    capsuleInstance = new CapsuleUI()
  }
  return capsuleInstance
}
