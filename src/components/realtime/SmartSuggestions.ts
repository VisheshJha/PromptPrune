/**
 * Smart Suggestions Component
 * Context-aware floating suggestion chips
 */

import { extractIntent } from '../../lib/intelligent-processor'

export interface SmartSuggestionsOptions {
  textarea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
  onApply?: (suggestion: Suggestion) => void
  maxSuggestions?: number
}

export interface Suggestion {
  id: string
  type: 'add_role' | 'be_specific' | 'add_format' | 'optimize' | 'add_context'
  text: string
  savings?: number // tokens saved
  icon: string
  action: () => void
}

export class SmartSuggestions {
  private textarea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
  private onApply?: (suggestion: Suggestion) => void
  private maxSuggestions: number
  private container: HTMLElement | null = null
  private shadowRoot: ShadowRoot | null = null
  private debounceTimer: number | null = null
  private currentSuggestions: Suggestion[] = []

  constructor(options: SmartSuggestionsOptions) {
    this.textarea = options.textarea
    this.onApply = options.onApply
    this.maxSuggestions = options.maxSuggestions || 3
    this.init()
  }

  private init(): void {
    this.createContainer()
    this.attachListeners()
    this.update()
  }

  private createContainer(): void {
    const shadowHost = document.createElement('div')
    shadowHost.id = `pp-smart-suggestions-${Date.now()}`
    shadowHost.style.cssText = `
      position: fixed;
      z-index: 10003;
      pointer-events: none;
    `

    this.shadowRoot = shadowHost.attachShadow({ mode: 'open' })
    this.container = shadowHost

    const style = document.createElement('style')
    style.textContent = this.getStyles()
    this.shadowRoot.appendChild(style)

    const suggestionsContainer = document.createElement('div')
    suggestionsContainer.className = 'pp-suggestions-container'
    this.shadowRoot.appendChild(suggestionsContainer)

    document.body.appendChild(shadowHost)
  }

  private attachListeners(): void {
    // Only update on blur to prevent typing lag
    // User requested only regex on typing
    this.textarea.addEventListener('blur', () => {
      this.update()
    })


    window.addEventListener('scroll', () => this.updatePosition(), true)
    window.addEventListener('resize', () => this.updatePosition())
  }

  private debouncedUpdate(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = window.setTimeout(() => {
      this.update()
    }, 400)
  }

  private update(): void {
    if (!this.shadowRoot) return

    const text = this.getText()
    if (!text.trim() || text.length < 5) {
      this.clearSuggestions()
      return
    }

    const suggestions = this.generateSuggestions(text)
    this.currentSuggestions = suggestions.slice(0, this.maxSuggestions)
    this.renderSuggestions()
    this.updatePosition()
  }

  private generateSuggestions(text: string): Suggestion[] {
    const suggestions: Suggestion[] = []
    const intent = extractIntent(text)
    const words = text.trim().split(/\s+/)
    const lowerText = text.toLowerCase()

    // 1. Missing role detection
    if ((lowerText.includes('write') || lowerText.includes('create')) && !lowerText.includes('as a') && !lowerText.includes('as an')) {
      suggestions.push({
        id: 'add-role',
        type: 'add_role',
        text: "Add role: 'as a [marketing manager]'",
        icon: '👔',
        action: () => {
          const cursorPos = this.getCursorPosition()
          const beforeCursor = text.substring(0, cursorPos)
          const afterCursor = text.substring(cursorPos)
          const newText = `${beforeCursor} as a marketing manager${afterCursor}`
          this.setText(newText)
          this.update()
        },
      })
    }

    // 2. Vague prompt detection
    if (lowerText.match(/\b(good|better|nice|stuff|things)\b/)) {
      suggestions.push({
        id: 'be-specific',
        type: 'be_specific',
        text: "Be more specific: 'professional and concise' instead of 'good'",
        icon: '🎯',
        action: () => {
          const newText = text
            .replace(/\bgood\b/gi, 'professional and concise')
            .replace(/\bbetter\b/gi, 'improved')
            .replace(/\bnice\b/gi, 'engaging')
          this.setText(newText)
          this.update()
        },
      })
    }

    // 3. Missing format detection
    if (lowerText.includes('write') && !lowerText.match(/\b(email|report|blog|summary|document|presentation)\b/)) {
      suggestions.push({
        id: 'add-format',
        type: 'add_format',
        text: "Specify format: 'write an email' or 'write a report'",
        icon: '📝',
        action: () => {
          const cursorPos = this.getCursorPosition()
          const beforeCursor = text.substring(0, cursorPos)
          const afterCursor = text.substring(cursorPos)
          const newText = `${beforeCursor} an email${afterCursor}`
          this.setText(newText)
          this.update()
        },
      })
    }

    // 4. Token optimization suggestions
    const tokenOptimizations = [
      { long: 'in order to', short: 'to', savings: 2 },
      { long: 'due to the fact that', short: 'because', savings: 4 },
      { long: 'at this point in time', short: 'now', savings: 3 },
      { long: 'make a decision', short: 'decide', savings: 2 },
      { long: 'provide assistance', short: 'help', savings: 2 },
    ]

    for (const opt of tokenOptimizations) {
      if (lowerText.includes(opt.long)) {
        suggestions.push({
          id: `optimize-${opt.long}`,
          type: 'optimize',
          text: `Shorter: '${opt.short}' instead of '${opt.long}'`,
          savings: opt.savings,
          icon: '💰',
          action: () => {
            const regex = new RegExp(opt.long.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
            const newText = text.replace(regex, opt.short)
            this.setText(newText)
            this.update()
          },
        })
        break // Only show one optimization at a time
      }
    }

    // 5. Missing context
    if (words.length < 10 && !lowerText.includes('context') && !lowerText.includes('about')) {
      suggestions.push({
        id: 'add-context',
        type: 'add_context',
        text: "Add context: 'about [topic]' or 'for [purpose]'",
        icon: '📋',
        action: () => {
          const cursorPos = this.getCursorPosition()
          const beforeCursor = text.substring(0, cursorPos)
          const afterCursor = text.substring(cursorPos)
          const newText = `${beforeCursor} about [topic]${afterCursor}`
          this.setText(newText)
          this.update()
        },
      })
    }

    return suggestions
  }

  private renderSuggestions(): void {
    if (!this.shadowRoot) return

    const container = this.shadowRoot.querySelector('.pp-suggestions-container')
    if (!container) return

    // Clear existing
    container.innerHTML = ''

    if (this.currentSuggestions.length === 0) {
      return
    }

    this.currentSuggestions.forEach(suggestion => {
      const chip = document.createElement('div')
      chip.className = 'pp-suggestion-chip'
      chip.innerHTML = `
        <span class="pp-suggestion-icon">${suggestion.icon}</span>
        <span class="pp-suggestion-text">${suggestion.text}</span>
        ${suggestion.savings ? `<span class="pp-suggestion-savings">-${suggestion.savings} tokens</span>` : ''}
        <button class="pp-suggestion-apply" aria-label="Apply suggestion">Apply</button>
        <button class="pp-suggestion-dismiss" aria-label="Dismiss">×</button>
      `

      const applyBtn = chip.querySelector('.pp-suggestion-apply')
      const dismissBtn = chip.querySelector('.pp-suggestion-dismiss')

      applyBtn?.addEventListener('click', (e) => {
        e.stopPropagation()
        suggestion.action()
        if (this.onApply) {
          this.onApply(suggestion)
        }
        this.update()
      })

      dismissBtn?.addEventListener('click', (e) => {
        e.stopPropagation()
        this.currentSuggestions = this.currentSuggestions.filter(s => s.id !== suggestion.id)
        this.renderSuggestions()
      })

      container.appendChild(chip)
    })
  }

  private clearSuggestions(): void {
    if (this.shadowRoot) {
      const container = this.shadowRoot.querySelector('.pp-suggestions-container')
      if (container) {
        container.innerHTML = ''
      }
    }
    this.currentSuggestions = []
  }

  private updatePosition(): void {
    if (!this.container) return

    const rect = this.textarea.getBoundingClientRect()
    const top = `${rect.bottom + 10}px`
    const left = `${rect.left}px`

    this.container.style.top = top
    this.container.style.left = left
  }

  private getText(): string {
    if (this.textarea instanceof HTMLTextAreaElement || this.textarea instanceof HTMLInputElement) {
      return this.textarea.value
    }
    return this.textarea.innerText || this.textarea.textContent || ''
  }

  private setText(text: string): void {
    if (this.textarea instanceof HTMLTextAreaElement || this.textarea instanceof HTMLInputElement) {
      this.textarea.value = text
      this.textarea.dispatchEvent(new Event('input', { bubbles: true }))
    } else {
      this.textarea.innerText = text
      this.textarea.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  private getCursorPosition(): number {
    if (this.textarea instanceof HTMLTextAreaElement || this.textarea instanceof HTMLInputElement) {
      return this.textarea.selectionStart || this.textarea.value.length
    } else {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const preCaretRange = range.cloneRange()
        preCaretRange.selectNodeContents(this.textarea)
        preCaretRange.setEnd(range.endContainer, range.endOffset)
        return preCaretRange.toString().length
      }
      return this.getText().length
    }
  }

  private getStyles(): string {
    return `
      .pp-suggestions-container {
        display: flex;
        flex-direction: column;
        gap: var(--space-2, 8px);
        pointer-events: auto;
        max-width: 400px;
      }

      .pp-suggestion-chip {
        display: flex;
        align-items: center;
        gap: var(--space-2, 8px);
        background: white;
        border: 1px solid var(--color-gray-200, #e5e7eb);
        border-radius: var(--radius-lg, 12px);
        padding: var(--space-2, 8px) var(--space-3, 12px);
        box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
        font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
        font-size: var(--text-sm, 14px);
        animation: slideUp var(--transition-base, 200ms ease-out);
        transition: all var(--transition-base, 200ms ease-out);
      }

      .pp-suggestion-chip:hover {
        box-shadow: var(--shadow-lg, 0 10px 15px rgba(0, 0, 0, 0.1));
        transform: translateY(-2px);
      }

      .pp-suggestion-icon {
        font-size: var(--text-lg, 18px);
        flex-shrink: 0;
      }

      .pp-suggestion-text {
        flex: 1;
        color: var(--color-gray-900, #111827);
        line-height: var(--line-height-normal, 1.5);
      }

      .pp-suggestion-savings {
        background: var(--color-success, #10b981);
        color: white;
        padding: 2px 6px;
        border-radius: var(--radius-sm, 6px);
        font-size: var(--text-xs, 12px);
        font-weight: var(--font-medium, 500);
        flex-shrink: 0;
      }

      .pp-suggestion-apply {
        background: var(--color-primary-500, #10b981);
        color: white;
        border: none;
        border-radius: var(--radius-sm, 6px);
        padding: var(--space-1, 4px) var(--space-2, 8px);
        font-size: var(--text-xs, 12px);
        font-weight: var(--font-medium, 500);
        cursor: pointer;
        transition: all var(--transition-fast, 150ms);
        flex-shrink: 0;
      }

      .pp-suggestion-apply:hover {
        background: var(--color-primary-600, #059669);
      }

      .pp-suggestion-dismiss {
        background: transparent;
        border: none;
        color: var(--color-gray-400, #9ca3af);
        font-size: var(--text-lg, 18px);
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: color var(--transition-fast, 150ms);
      }

      .pp-suggestion-dismiss:hover {
        color: var(--color-gray-600, #4b5563);
      }
    `
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

