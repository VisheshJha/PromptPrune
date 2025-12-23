/**
 * Real-Time Redundancy Detection Component
 * Highlights redundant phrases with yellow squiggles
 */

import nlp from 'compromise'

export interface RedundancyDetectorOptions {
  textarea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
  onFix?: (phrase: string, suggestion: string) => void
}

export interface Redundancy {
  phrase: string
  suggestion: string
  position: number
  length: number
  reason: string
}

export class RedundancyDetector {
  private textarea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
  private onFix?: (phrase: string, suggestion: string) => void
  private container: HTMLElement | null = null
  private overlay: HTMLElement | null = null
  private debounceTimer: number | null = null
  private redundancies: Redundancy[] = []
  private activeTooltip: HTMLElement | null = null

  // Common redundant patterns
  private redundantPatterns = [
    { pattern: /\b(\w+)\s+\1\b/gi, reason: 'Repeated word' },
    { pattern: /\bvery\s+very\b/gi, reason: 'Double "very"' },
    { pattern: /\breally\s+really\b/gi, reason: 'Double "really"' },
    { pattern: /\bwrite\s+.*\s+and\s+write\b/gi, reason: 'Repeated action' },
    { pattern: /\bcreate\s+.*\s+and\s+create\b/gi, reason: 'Repeated action' },
    { pattern: /\bemail\s+.*\s+to\s+send\b/gi, reason: 'Redundant - email implies sending' },
    { pattern: /\bwrite\s+.*\s+email\s+.*\s+message\b/gi, reason: 'Email and message are redundant' },
    { pattern: /\bimportant\s+.*\s+crucial\b/gi, reason: 'Similar meaning' },
    { pattern: /\bquick\s+.*\s+fast\b/gi, reason: 'Similar meaning' },
  ]

  constructor(options: RedundancyDetectorOptions) {
    this.textarea = options.textarea
    this.onFix = options.onFix
    this.init()
  }

  private init(): void {
    this.createOverlay()
    this.attachListeners()
    this.update()
  }

  private createOverlay(): void {
    this.container = document.createElement('div')
    this.container.id = `pp-redundancy-${Date.now()}`
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

    this.overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    this.overlay.setAttribute('class', 'pp-redundancy-svg')
    this.overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    `

    this.container.appendChild(this.overlay)

    const style = document.createElement('style')
    style.textContent = this.getStyles()
    document.head.appendChild(style)

    this.positionOverlay()
  }

  private positionOverlay(): void {
    if (!this.container || !this.textarea.parentElement) return

    if (this.textarea.nextSibling) {
      this.textarea.parentElement.insertBefore(this.container, this.textarea.nextSibling)
    } else {
      this.textarea.parentElement.appendChild(this.container)
    }

    const computedStyle = window.getComputedStyle(this.textarea)
    this.container.style.position = 'absolute'
    this.container.style.top = '0'
    this.container.style.left = '0'
    this.container.style.width = computedStyle.width
    this.container.style.height = computedStyle.height
  }

  private attachListeners(): void {
    // Only update on blur to prevent typing lag
    this.textarea.addEventListener('blur', () => {
      this.update()
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

    this.redundancies = this.detectRedundancies(text)
    this.renderSquiggles()
  }

  private detectRedundancies(text: string): Redundancy[] {
    const redundancies: Redundancy[] = []

    // Check patterns
    this.redundantPatterns.forEach(({ pattern, reason }) => {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        if (match.index !== undefined) {
          const phrase = match[0]
          const suggestion = this.generateSuggestion(phrase, reason)
          redundancies.push({
            phrase,
            suggestion,
            position: match.index,
            length: phrase.length,
            reason,
          })
        }
      }
    })

    // Check for semantic redundancy using NLP
    const doc = nlp(text)
    const sentences = doc.sentences().out('array')

    sentences.forEach((sentence, index) => {
      const words = sentence.toLowerCase().split(/\s+/)

      // Check for repeated concepts
      const uniqueWords = new Set(words)
      if (words.length > uniqueWords.size + 2) {
        // More than 2 duplicates might indicate redundancy
        const duplicates = words.filter((word, i) => words.indexOf(word) !== i)
        if (duplicates.length > 0) {
          const phrase = duplicates[0]
          const position = text.indexOf(sentence)
          if (position !== -1) {
            redundancies.push({
              phrase: sentence,
              suggestion: this.simplifySentence(sentence),
              position,
              length: sentence.length,
              reason: 'Repeated concepts',
            })
          }
        }
      }
    })

    return redundancies
  }

  private generateSuggestion(phrase: string, reason: string): string {
    // Remove redundant parts
    if (phrase.includes('very very')) {
      return phrase.replace(/very\s+very/gi, 'very')
    }
    if (phrase.includes('really really')) {
      return phrase.replace(/really\s+really/gi, 'really')
    }
    if (phrase.match(/\b(\w+)\s+\1\b/)) {
      return phrase.replace(/\b(\w+)\s+\1\b/gi, '$1')
    }
    if (phrase.includes(' to send')) {
      return phrase.replace(/\s+to\s+send/gi, '')
    }
    if (phrase.includes(' email ') && phrase.includes(' message')) {
      return phrase.replace(/\s+message/gi, '')
    }

    return phrase // Default: return as-is
  }

  private simplifySentence(sentence: string): string {
    // Remove duplicate words while preserving meaning
    const words = sentence.split(/\s+/)
    const seen = new Set<string>()
    const result: string[] = []

    words.forEach(word => {
      const lower = word.toLowerCase()
      if (!seen.has(lower) || result.length === 0 || result[result.length - 1] !== word) {
        result.push(word)
        seen.add(lower)
      }
    })

    return result.join(' ')
  }

  private renderSquiggles(): void {
    if (!this.overlay) return

    this.clearSquiggles()

    const textareaRect = this.textarea.getBoundingClientRect()
    const computedStyle = window.getComputedStyle(this.textarea)
    const lineHeight = parseFloat(computedStyle.lineHeight) || 20
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0
    const fontSize = parseFloat(computedStyle.fontSize) || 14

    const measureEl = document.createElement('span')
    measureEl.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre;
      font: ${computedStyle.font};
    `
    document.body.appendChild(measureEl)

    this.redundancies.forEach((redundancy, index) => {
      const text = this.getText()
      const beforeText = text.substring(0, redundancy.position)
      const lines = beforeText.split('\n')
      const lineNumber = lines.length - 1
      const columnInLine = lines[lines.length - 1].length

      measureEl.textContent = beforeText
      const textWidth = measureEl.offsetWidth

      measureEl.textContent = redundancy.phrase
      const phraseWidth = measureEl.offsetWidth

      const x = paddingLeft + textWidth
      const y = paddingTop + (lineNumber * lineHeight) + (lineHeight * 0.8)

      const path = this.createSquigglePath(x, y, phraseWidth, fontSize)
      const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      pathElement.setAttribute('d', path)
      pathElement.setAttribute('class', 'pp-redundancy-squiggle')
      pathElement.setAttribute('data-phrase', redundancy.phrase)
      pathElement.setAttribute('data-suggestion', redundancy.suggestion)
      pathElement.setAttribute('data-reason', redundancy.reason)
      pathElement.setAttribute('data-index', String(index))
      pathElement.style.pointerEvents = 'auto'
      pathElement.style.cursor = 'pointer'

      pathElement.addEventListener('click', (e) => {
        e.stopPropagation()
        this.showSuggestion(redundancy, x, y + 5)
      })

      this.overlay!.appendChild(pathElement)
    })

    document.body.removeChild(measureEl)
  }

  private createSquigglePath(x: number, y: number, width: number, fontSize: number): string {
    const amplitude = Math.max(2, fontSize * 0.15)
    const wavelength = Math.max(4, fontSize * 0.3)
    const segments = Math.ceil(width / wavelength)
    let path = `M ${x} ${y}`

    for (let i = 0; i <= segments; i++) {
      const segmentX = x + (i * wavelength)
      const segmentY = y + (Math.sin((i * Math.PI) / 2) * amplitude)
      path += ` L ${segmentX} ${segmentY}`
    }

    return path
  }

  private showSuggestion(redundancy: Redundancy, x: number, y: number): void {
    if (this.activeTooltip) {
      this.activeTooltip.remove()
    }

    const tooltip = document.createElement('div')
    tooltip.className = 'pp-redundancy-tooltip'
    tooltip.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      background: white;
      border: 1px solid var(--color-gray-200, #e5e7eb);
      border-radius: var(--radius-md, 8px);
      box-shadow: var(--shadow-lg, 0 10px 15px rgba(0, 0, 0, 0.1));
      padding: var(--space-3, 12px);
      z-index: 10002;
      font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
      font-size: var(--text-sm, 14px);
      min-width: 200px;
      pointer-events: auto;
    `

    const reasonEl = document.createElement('div')
    reasonEl.textContent = redundancy.reason
    reasonEl.style.cssText = `
      color: var(--color-gray-600, #4b5563);
      font-size: var(--text-xs, 12px);
      margin-bottom: var(--space-2, 8px);
    `
    tooltip.appendChild(reasonEl)

    const suggestionBtn = document.createElement('button')
    suggestionBtn.textContent = `Remove: "${redundancy.suggestion}"`
    suggestionBtn.style.cssText = `
      padding: var(--space-2, 8px) var(--space-3, 12px);
      background: var(--color-warning, #f59e0b);
      color: white;
      border: none;
      border-radius: var(--radius-sm, 6px);
      cursor: pointer;
      width: 100%;
      font-size: var(--text-sm, 14px);
      font-weight: var(--font-medium, 500);
      transition: all var(--transition-fast, 150ms);
    `
    suggestionBtn.addEventListener('mouseenter', () => {
      suggestionBtn.style.background = 'var(--color-warning-600, #d97706)'
    })
    suggestionBtn.addEventListener('mouseleave', () => {
      suggestionBtn.style.background = 'var(--color-warning, #f59e0b)'
    })
    suggestionBtn.addEventListener('click', () => {
      this.fixRedundancy(redundancy)
      tooltip.remove()
      this.activeTooltip = null
    })
    tooltip.appendChild(suggestionBtn)

    document.body.appendChild(tooltip)
    this.activeTooltip = tooltip

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

  private fixRedundancy(redundancy: Redundancy): void {
    const text = this.getText()
    const regex = new RegExp(redundancy.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const newText = text.replace(regex, redundancy.suggestion)

    this.setText(newText)
    if (this.onFix) {
      this.onFix(redundancy.phrase, redundancy.suggestion)
    }
    this.update()
  }

  private updateSquiggles(): void {
    this.renderSquiggles()
  }

  private clearSquiggles(): void {
    if (this.overlay) {
      const paths = this.overlay.querySelectorAll('.pp-redundancy-squiggle')
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
      .pp-redundancy-squiggle {
        fill: none;
        stroke: var(--color-warning, #f59e0b);
        stroke-width: 2;
        pointer-events: auto;
        cursor: pointer;
        transition: stroke-width var(--transition-fast, 150ms);
      }

      .pp-redundancy-squiggle:hover {
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

