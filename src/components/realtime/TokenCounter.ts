/**
 * Real-Time Token Counter Component
 * Displays live token count with cost estimation
 */

import { getAllTokenCounts } from '../../lib/tokenizers'
import { getModelPricing, calculateCost, getAveragePricing } from '../../lib/pricing'
import { debounce } from '../../lib/debounce'

export interface TokenCounterOptions {
  textarea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  model?: string
  onModelChange?: (model: string) => void
}

export interface TokenCount {
  tokens: number
  cost: number
  model: string
  provider: string
}

export class TokenCounter {
  private textarea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
  private position: string
  private model: string
  private onModelChange?: (model: string) => void
  private container: HTMLElement | null = null
  private shadowRoot: ShadowRoot | null = null
  private debounceTimer: number | null = null
  private currentCount: TokenCount | null = null

  constructor(options: TokenCounterOptions) {
    this.textarea = options.textarea
    this.position = options.position || 'top-right'
    this.model = options.model || 'gpt-4'
    this.onModelChange = options.onModelChange
    this.init()
  }

  private init(): void {
    this.createContainer()
    this.attachListeners()
    this.update()
  }

  private createContainer(): void {
    const shadowHost = document.createElement('div')
    shadowHost.id = `pp-token-counter-${Date.now()}`
    shadowHost.style.cssText = `
      position: fixed;
      z-index: 10001;
      pointer-events: none;
    `

    this.shadowRoot = shadowHost.attachShadow({ mode: 'open' })
    this.container = shadowHost

    // Inject styles
    const style = document.createElement('style')
    style.textContent = this.getStyles()
    this.shadowRoot.appendChild(style)

    // Create counter element
    const counter = document.createElement('div')
    counter.className = 'pp-token-counter'
    counter.innerHTML = `
      <div class="pp-token-counter-content">
        <span class="pp-token-count">0</span>
        <span class="pp-token-label">tokens</span>
        <span class="pp-token-cost">$0.00</span>
      </div>
    `
    this.shadowRoot.appendChild(counter)

    document.body.appendChild(shadowHost)
    this.updatePosition()
    
    // Make draggable
    this.makeDraggable()
  }

  private makeDraggable(): void {
    if (!this.container) return
    
    let isDragging = false
    let currentX = 0
    let currentY = 0
    let initialX = 0
    let initialY = 0

    this.container.style.cursor = 'move'
    this.container.style.userSelect = 'none'

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      isDragging = true
      initialX = e.clientX
      initialY = e.clientY
      const rect = this.container!.getBoundingClientRect()
      currentX = rect.left
      currentY = rect.top
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      e.preventDefault()
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const deltaX = e.clientX - initialX
      const deltaY = e.clientY - initialY
      this.container!.style.left = `${currentX + deltaX}px`
      this.container!.style.top = `${currentY + deltaY}px`
      this.container!.style.right = 'auto'
      this.container!.style.bottom = 'auto'
    }

    const onMouseUp = () => {
      isDragging = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    this.container.addEventListener('mousedown', onMouseDown)
  }

  private attachListeners(): void {
    // Listen to input events with debouncing
    this.textarea.addEventListener('input', this.debouncedUpdate)

    // Update position on scroll/resize
    window.addEventListener('scroll', () => this.updatePosition(), true)
    window.addEventListener('resize', () => this.updatePosition())
  }

  private debouncedUpdate = debounce(() => {
    this.update()
  }, 300) // 300ms debounce for token counting

  private async update(): Promise<void> {
    if (!this.shadowRoot) return

    const text = this.getText()
    if (!text.trim()) {
      this.updateDisplay(0, 0, this.model)
      this.updateColor(0)
      return
    }

    try {
      const tokenCounts = await getAllTokenCounts(text)
      const count = this.getTokenCountForModel(tokenCounts, this.model)
      const cost = this.calculateCost(count.tokens, this.model)

      this.currentCount = {
        tokens: count.tokens,
        cost,
        model: this.model,
        provider: count.provider,
      }

      this.updateDisplay(count.tokens, cost, this.model)
      this.updateColor(count.tokens)
    } catch (error) {
      console.error('[TokenCounter] Error updating:', error)
    }
  }

  private getTokenCountForModel(
    tokenCounts: any,
    model: string
  ): { tokens: number; provider: string } {
    // Try to find the model in token counts
    for (const provider of Object.keys(tokenCounts)) {
      const counts = tokenCounts[provider]
      if (Array.isArray(counts)) {
        const match = counts.find((c: any) => c.model === model)
        if (match) {
          return { tokens: match.count, provider }
        }
      }
    }

    // Fallback to first available
    const firstProvider = Object.keys(tokenCounts)[0]
    const firstCount = tokenCounts[firstProvider]?.[0]
    return {
      tokens: firstCount?.count || 0,
      provider: firstProvider || 'openai',
    }
  }

  private calculateCost(tokens: number, model: string): number {
    try {
      // Try to determine provider from model name
      const provider = this.getProviderFromModel(model)
      const pricing = getModelPricing(provider, model) || getAveragePricing()
      
      if (pricing) {
        return calculateCost(tokens, pricing, false)
      }
    } catch (error) {
      console.error('[TokenCounter] Error calculating cost:', error)
    }
    return 0
  }

  private getProviderFromModel(model: string): string {
    // Map common model names to providers
    if (model.includes('gpt-') || model.includes('openai')) {
      return 'openai'
    }
    if (model.includes('claude') || model.includes('anthropic')) {
      return 'anthropic'
    }
    if (model.includes('gemini') || model.includes('google')) {
      return 'gemini'
    }
    if (model.includes('llama') || model.includes('meta')) {
      return 'llama'
    }
    // Default to openai
    return 'openai'
  }

  private updateDisplay(tokens: number, cost: number, model: string): void {
    if (!this.shadowRoot) return

    const countEl = this.shadowRoot.querySelector('.pp-token-count')
    const costEl = this.shadowRoot.querySelector('.pp-token-cost')

    if (countEl) {
      countEl.textContent = tokens.toLocaleString()
    }
    if (costEl) {
      costEl.textContent = `$${cost.toFixed(4)}`
    }
  }

  private updateColor(tokens: number): void {
    if (!this.shadowRoot) return

    const counter = this.shadowRoot.querySelector('.pp-token-counter')
    if (!counter) return

    // Remove existing color classes
    counter.classList.remove('pp-token-low', 'pp-token-medium', 'pp-token-high', 'pp-token-very-high')

    if (tokens < 100) {
      counter.classList.add('pp-token-low')
    } else if (tokens < 500) {
      counter.classList.add('pp-token-medium')
    } else if (tokens < 1000) {
      counter.classList.add('pp-token-high')
    } else {
      counter.classList.add('pp-token-very-high')
    }
  }

  private updatePosition(): void {
    if (!this.container) return

    const rect = this.textarea.getBoundingClientRect()
    const position = this.position.split('-')

    let top = 'auto'
    let bottom = 'auto'
    let left = 'auto'
    let right = 'auto'

    if (position[0] === 'top') {
      top = `${rect.top - 40}px`
    } else {
      bottom = `${window.innerHeight - rect.bottom + 10}px`
    }

    if (position[1] === 'right') {
      right = `${window.innerWidth - rect.right}px`
    } else {
      left = `${rect.left}px`
    }

    this.container.style.top = top
    this.container.style.bottom = bottom
    this.container.style.left = left
    this.container.style.right = right
  }

  private getText(): string {
    if (this.textarea instanceof HTMLTextAreaElement || this.textarea instanceof HTMLInputElement) {
      return this.textarea.value
    }
    return this.textarea.innerText || this.textarea.textContent || ''
  }

  private getStyles(): string {
    return `
      .pp-token-counter {
        pointer-events: auto;
        background: white;
        border-radius: var(--radius-md, 8px);
        padding: var(--space-2, 8px) var(--space-3, 12px);
        box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
        font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
        font-size: var(--text-sm, 14px);
        display: flex;
        align-items: center;
        gap: var(--space-2, 8px);
        transition: all var(--transition-base, 200ms ease-out);
        border: 1px solid var(--color-gray-200, #e5e7eb);
      }

      .pp-token-counter-content {
        display: flex;
        align-items: center;
        gap: var(--space-2, 8px);
      }

      .pp-token-count {
        font-weight: var(--font-semibold, 600);
        color: var(--color-gray-900, #111827);
      }

      .pp-token-label {
        color: var(--color-gray-500, #6b7280);
        font-size: var(--text-xs, 12px);
      }

      .pp-token-cost {
        color: var(--color-gray-600, #4b5563);
        font-size: var(--text-xs, 12px);
      }

      .pp-token-low .pp-token-count {
        color: var(--color-success, #10b981);
      }

      .pp-token-medium .pp-token-count {
        color: var(--color-warning, #f59e0b);
      }

      .pp-token-high .pp-token-count {
        color: var(--color-warning, #f59e0b);
      }

      .pp-token-very-high .pp-token-count {
        color: var(--color-error, #ef4444);
      }

      .pp-token-counter:hover {
        box-shadow: var(--shadow-lg, 0 10px 15px rgba(0, 0, 0, 0.1));
        transform: translateY(-1px);
      }
    `
  }

  public setModel(model: string): void {
    this.model = model
    if (this.onModelChange) {
      this.onModelChange(model)
    }
    this.update()
  }

  public getCurrentCount(): TokenCount | null {
    return this.currentCount
  }

  public destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    if (this.container) {
      this.container.remove()
    }
    this.container = null
    this.shadowRoot = null
  }
}

