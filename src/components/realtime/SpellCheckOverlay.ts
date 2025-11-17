/**
 * Real-Time Spell Check Overlay Component
 * Displays red squiggles for misspelled words with suggestions
 */

import { intelligentSpellCheck } from '../../lib/intelligent-processor'

export interface SpellCheckOptions {
  textarea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
  onFix?: (word: string, correction: string) => void
  onFixAll?: () => void
}

export interface Misspelling {
  word: string
  suggestions: string[]
  position: number
  length: number
}

export class SpellCheckOverlay {
  private textarea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
  private onFix?: (word: string, correction: string) => void
  private onFixAll?: () => void
  private container: HTMLElement | null = null
  private overlay: HTMLElement | null = null
  private debounceTimer: number | null = null
  private misspellings: Misspelling[] = []
  private activeTooltip: HTMLElement | null = null

  constructor(options: SpellCheckOptions) {
    this.textarea = options.textarea
    this.onFix = options.onFix
    this.onFixAll = options.onFixAll
    this.init()
  }

  private init(): void {
    this.createOverlay()
    this.attachListeners()
    this.update()
  }

  private createOverlay(): void {
    // Create overlay container
    this.container = document.createElement('div')
    this.container.id = `pp-spell-check-${Date.now()}`
    this.container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
      overflow: hidden;
    `

    // Create SVG for squiggles
    this.overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    this.overlay.setAttribute('class', 'pp-spell-check-svg')
    this.overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    `

    this.container.appendChild(this.overlay)

    // Inject styles
    const style = document.createElement('style')
    style.textContent = this.getStyles()
    document.head.appendChild(style)

    // Position overlay relative to textarea
    this.positionOverlay()
  }

  private positionOverlay(): void {
    if (!this.container || !this.textarea.parentElement) return

    const textareaRect = this.textarea.getBoundingClientRect()
    const parentRect = this.textarea.parentElement.getBoundingClientRect()

    // Insert overlay right after textarea
    if (this.textarea.nextSibling) {
      this.textarea.parentElement.insertBefore(this.container, this.textarea.nextSibling)
    } else {
      this.textarea.parentElement.appendChild(this.container)
    }

    // Match textarea position
    const computedStyle = window.getComputedStyle(this.textarea)
    this.container.style.position = 'absolute'
    this.container.style.top = '0'
    this.container.style.left = '0'
    this.container.style.width = computedStyle.width
    this.container.style.height = computedStyle.height
  }

  private attachListeners(): void {
    this.textarea.addEventListener('input', () => {
      this.debouncedUpdate()
    })

    this.textarea.addEventListener('scroll', () => {
      this.updateSquiggles()
    })

    window.addEventListener('resize', () => {
      this.positionOverlay()
      this.updateSquiggles()
    })
  }

  private debouncedUpdate(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = window.setTimeout(() => {
      this.update()
    }, 300)
  }

  private update(): void {
    if (!this.overlay) return

    const text = this.getText()
    if (!text.trim()) {
      this.clearSquiggles()
      return
    }

    // Get spell check results
    const spellCheck = intelligentSpellCheck(text)
    this.misspellings = this.extractMisspellings(text, spellCheck.corrections)
    this.renderSquiggles()
  }

  private extractMisspellings(
    text: string,
    corrections: Array<{ original: string; corrected: string; position: number }>
  ): Misspelling[] {
    const misspellings: Misspelling[] = []

    corrections.forEach(correction => {
      const index = text.indexOf(correction.original, correction.position)
      if (index !== -1) {
        misspellings.push({
          word: correction.original,
          suggestions: [correction.corrected],
          position: index,
          length: correction.original.length,
        })
      }
    })

    return misspellings
  }

  private renderSquiggles(): void {
    if (!this.overlay) return

    // Clear existing squiggles
    this.clearSquiggles()

    // Get textarea position and styling
    const textareaRect = this.textarea.getBoundingClientRect()
    const computedStyle = window.getComputedStyle(this.textarea)
    const lineHeight = parseFloat(computedStyle.lineHeight) || 20
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0
    const fontSize = parseFloat(computedStyle.fontSize) || 14

    // Create text measurement element
    const measureEl = document.createElement('span')
    measureEl.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre;
      font: ${computedStyle.font};
    `
    document.body.appendChild(measureEl)

    this.misspellings.forEach((misspelling, index) => {
      // Find the position of the word in the textarea
      const text = this.getText()
      const beforeText = text.substring(0, misspelling.position)
      const lines = beforeText.split('\n')
      const lineNumber = lines.length - 1
      const columnInLine = lines[lines.length - 1].length

      // Measure text up to this point
      measureEl.textContent = beforeText
      const textWidth = measureEl.offsetWidth

      // Measure the misspelled word
      measureEl.textContent = misspelling.word
      const wordWidth = measureEl.offsetWidth

      // Calculate position
      const x = paddingLeft + textWidth
      const y = paddingTop + (lineNumber * lineHeight) + (lineHeight * 0.8) // 80% down the line

      // Create squiggle path
      const path = this.createSquigglePath(x, y, wordWidth, fontSize)
      const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      pathElement.setAttribute('d', path)
      pathElement.setAttribute('class', 'pp-spell-squiggle')
      pathElement.setAttribute('data-word', misspelling.word)
      pathElement.setAttribute('data-suggestions', misspelling.suggestions.join(','))
      pathElement.setAttribute('data-index', String(index))
      pathElement.style.pointerEvents = 'auto'
      pathElement.style.cursor = 'pointer'

      // Add click handler for suggestions - position tooltip near the word
      pathElement.addEventListener('click', (e) => {
        e.stopPropagation()
        // Position tooltip below the word, not in corner
        const tooltipY = y + lineHeight + 5 // Below the word
        const tooltipX = x // Same horizontal position as word start
        this.showSuggestions(misspelling, tooltipX, tooltipY)
      })

      this.overlay.appendChild(pathElement)
    })

    document.body.removeChild(measureEl)
  }

  private createSquigglePath(x: number, y: number, width: number, fontSize: number): string {
    const amplitude = Math.max(2, fontSize * 0.15) // Squiggle height
    const wavelength = Math.max(4, fontSize * 0.3) // Squiggle width
    const segments = Math.ceil(width / wavelength)
    let path = `M ${x} ${y}`

    for (let i = 0; i <= segments; i++) {
      const segmentX = x + (i * wavelength)
      const segmentY = y + (Math.sin((i * Math.PI) / 2) * amplitude)
      path += ` L ${segmentX} ${segmentY}`
    }

    return path
  }

  private showSuggestions(misspelling: Misspelling, x: number, y: number): void {
    // Remove existing tooltip
    if (this.activeTooltip) {
      this.activeTooltip.remove()
    }

    // Create tooltip
    const tooltip = document.createElement('div')
    tooltip.className = 'pp-spell-tooltip'
    tooltip.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      background: white;
      border: 1px solid var(--color-gray-200, #e5e7eb);
      border-radius: var(--radius-md, 8px);
      box-shadow: var(--shadow-lg, 0 10px 15px rgba(0, 0, 0, 0.1));
      padding: var(--space-2, 8px);
      z-index: 10002;
      font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
      font-size: var(--text-sm, 14px);
      min-width: 150px;
      pointer-events: auto;
    `

    // Add suggestions
    const suggestionsList = document.createElement('div')
    suggestionsList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: var(--space-1, 4px);
    `

    misspelling.suggestions.forEach((suggestion, index) => {
      const suggestionBtn = document.createElement('button')
      suggestionBtn.textContent = suggestion
      suggestionBtn.style.cssText = `
        padding: var(--space-2, 8px) var(--space-3, 12px);
        background: ${index === 0 ? 'var(--color-primary-500, #10b981)' : 'var(--color-gray-100, #f3f4f6)'};
        color: ${index === 0 ? 'white' : 'var(--color-gray-900, #111827)'};
        border: none;
        border-radius: var(--radius-sm, 6px);
        cursor: pointer;
        text-align: left;
        font-size: var(--text-sm, 14px);
        transition: all var(--transition-fast, 150ms);
      `
      suggestionBtn.addEventListener('mouseenter', () => {
        suggestionBtn.style.background = index === 0 
          ? 'var(--color-primary-600, #059669)' 
          : 'var(--color-gray-200, #e5e7eb)'
      })
      suggestionBtn.addEventListener('mouseleave', () => {
        suggestionBtn.style.background = index === 0 
          ? 'var(--color-primary-500, #10b981)' 
          : 'var(--color-gray-100, #f3f4f6)'
      })
      suggestionBtn.addEventListener('click', () => {
        this.fixWord(misspelling.word, suggestion)
        tooltip.remove()
        this.activeTooltip = null
      })
      suggestionsList.appendChild(suggestionBtn)
    })

    // Add "Fix All" button if multiple misspellings
    if (this.misspellings.length > 1) {
      const fixAllBtn = document.createElement('button')
      fixAllBtn.textContent = `Fix All (${this.misspellings.length})`
      fixAllBtn.style.cssText = `
        margin-top: var(--space-2, 8px);
        padding: var(--space-2, 8px) var(--space-3, 12px);
        background: var(--color-info-500, #3b82f6);
        color: white;
        border: none;
        border-radius: var(--radius-sm, 6px);
        cursor: pointer;
        width: 100%;
        font-size: var(--text-sm, 14px);
        font-weight: var(--font-medium, 500);
      `
      fixAllBtn.addEventListener('click', () => {
        this.fixAll()
        tooltip.remove()
        this.activeTooltip = null
      })
      suggestionsList.appendChild(fixAllBtn)
    }

    tooltip.appendChild(suggestionsList)
    document.body.appendChild(tooltip)
    this.activeTooltip = tooltip

    // Close on outside click
    const closeHandler = (e: MouseEvent) => {
      if (!tooltip.contains(e.target as Node)) {
        tooltip.remove()
        this.activeTooltip = null
        document.removeEventListener('click', closeHandler)
      }
    }
    setTimeout(() => {
      document.addEventListener('click', closeHandler)
    }, 0)
  }

  private fixWord(word: string, correction: string): void {
    const text = this.getText()
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    const newText = text.replace(regex, correction)

    this.setText(newText)
    if (this.onFix) {
      this.onFix(word, correction)
    }
    this.update()
  }

  private fixAll(): void {
    const text = this.getText()
    let newText = text

    this.misspellings.forEach(misspelling => {
      if (misspelling.suggestions.length > 0) {
        const regex = new RegExp(`\\b${misspelling.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
        newText = newText.replace(regex, misspelling.suggestions[0])
      }
    })

    this.setText(newText)
    if (this.onFixAll) {
      this.onFixAll()
    }
    this.update()
  }

  private updateSquiggles(): void {
    // Re-render squiggles when textarea scrolls or resizes
    this.renderSquiggles()
  }

  private clearSquiggles(): void {
    if (this.overlay) {
      const paths = this.overlay.querySelectorAll('.pp-spell-squiggle')
      paths.forEach(path => path.remove())
    }
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

  private getStyles(): string {
    return `
      .pp-spell-squiggle {
        fill: none;
        stroke: var(--color-error, #ef4444);
        stroke-width: 2;
        pointer-events: auto;
        cursor: pointer;
        transition: stroke-width var(--transition-fast, 150ms);
      }

      .pp-spell-squiggle:hover {
        stroke-width: 3;
      }
    `
  }

  public destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    if (this.activeTooltip) {
      this.activeTooltip.remove()
    }
    if (this.container) {
      this.container.remove()
    }
    this.container = null
    this.overlay = null
  }
}

