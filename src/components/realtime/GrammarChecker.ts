/**
 * Grammar & Style Checker Component
 * Blue squiggles for style improvements
 */

import nlp from 'compromise'

export interface GrammarCheckerOptions {
  textarea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
  onFix?: (issue: GrammarIssue, suggestion: string) => void
}

export interface GrammarIssue {
  text: string
  suggestion: string
  position: number
  length: number
  type: 'passive_voice' | 'wordy' | 'weak_verb' | 'missing_article' | 'run_on'
  reason: string
}

export class GrammarChecker {
  private textarea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
  private onFix?: (issue: GrammarIssue, suggestion: string) => void
  private container: HTMLElement | null = null
  private overlay: HTMLElement | null = null
  private debounceTimer: number | null = null
  private issues: GrammarIssue[] = []
  private activeTooltip: HTMLElement | null = null

  // Wordy phrases to simplify
  private wordyPhrases = new Map<string, string>([
    ['in order to', 'to'],
    ['due to the fact that', 'because'],
    ['at this point in time', 'now'],
    ['has the ability to', 'can'],
    ['is able to', 'can'],
    ['in the event that', 'if'],
    ['with regard to', 'about'],
    ['for the purpose of', 'for'],
    ['in the near future', 'soon'],
    ['at the present time', 'now'],
  ])

  // Weak verbs to strengthen
  private weakVerbs = new Map<string, string>([
    ['make', 'create'],
    ['get', 'obtain'],
    ['do', 'perform'],
    ['have', 'possess'],
    ['show', 'demonstrate'],
    ['tell', 'inform'],
    ['use', 'utilize'],
    ['give', 'provide'],
  ])

  constructor(options: GrammarCheckerOptions) {
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
    this.container.id = `pp-grammar-check-${Date.now()}`
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
    this.overlay.setAttribute('class', 'pp-grammar-svg')
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

    this.issues = this.detectIssues(text)
    this.renderSquiggles()
  }

  private detectIssues(text: string): GrammarIssue[] {
    const issues: GrammarIssue[] = []
    const lowerText = text.toLowerCase()

    // Check for wordy phrases
    for (const [wordy, concise] of this.wordyPhrases.entries()) {
      const regex = new RegExp(wordy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      const matches = text.matchAll(regex)
      for (const match of matches) {
        if (match.index !== undefined) {
          issues.push({
            text: match[0],
            suggestion: concise,
            position: match.index,
            length: match[0].length,
            type: 'wordy',
            reason: `Use "${concise}" instead of "${wordy}"`,
          })
        }
      }
    }

    // Check for weak verbs
    const words = text.split(/\s+/)
    words.forEach((word, index) => {
      const lowerWord = word.toLowerCase().replace(/[.,!?;:]$/, '')
      if (this.weakVerbs.has(lowerWord)) {
        const position = text.indexOf(word, index > 0 ? text.indexOf(words[index - 1]) + words[index - 1].length : 0)
        if (position !== -1) {
          issues.push({
            text: word,
            suggestion: this.weakVerbs.get(lowerWord)!,
            position,
            length: word.length,
            type: 'weak_verb',
            reason: `Use stronger verb: "${this.weakVerbs.get(lowerWord)}"`,
          })
        }
      }
    })

    // Check for passive voice (basic detection)
    const doc = nlp(text)
    const sentences = doc.sentences().out('array')
    sentences.forEach(sentence => {
      if (sentence.match(/\b(is|are|was|were)\s+\w+ed\b/i)) {
        const position = text.indexOf(sentence)
        if (position !== -1) {
          // Try to convert to active voice
          const active = this.convertToActive(sentence)
          if (active !== sentence) {
            issues.push({
              text: sentence,
              suggestion: active,
              position,
              length: sentence.length,
              type: 'passive_voice',
              reason: 'Use active voice for clarity',
            })
          }
        }
      }
    })

    // Check for run-on sentences (very long sentences without punctuation)
    sentences.forEach(sentence => {
      const words = sentence.split(/\s+/)
      if (words.length > 30 && !sentence.match(/[,;:]/)) {
        const position = text.indexOf(sentence)
        if (position !== -1) {
          const simplified = this.simplifySentence(sentence)
          issues.push({
            text: sentence,
            suggestion: simplified,
            position,
            length: sentence.length,
            type: 'run_on',
            reason: 'Break into shorter sentences',
          })
        }
      }
    })

    return issues
  }

  private convertToActive(sentence: string): string {
    // Basic passive to active conversion
    // "The email was written by John" -> "John wrote the email"
    const passiveMatch = sentence.match(/(\w+)\s+(is|are|was|were)\s+(\w+ed)\s+by\s+(\w+)/i)
    if (passiveMatch) {
      const subject = passiveMatch[4]
      const verb = passiveMatch[3].replace(/ed$/, '')
      const object = passiveMatch[1]
      return `${subject} ${verb} ${object}`
    }
    return sentence
  }

  private simplifySentence(sentence: string): string {
    // Break long sentence into two
    const words = sentence.split(/\s+/)
    const midPoint = Math.floor(words.length / 2)
    const first = words.slice(0, midPoint).join(' ')
    const second = words.slice(midPoint).join(' ')
    return `${first}. ${second.charAt(0).toUpperCase()}${second.slice(1)}`
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

    this.issues.forEach((issue, index) => {
      const text = this.getText()
      const beforeText = text.substring(0, issue.position)
      const lines = beforeText.split('\n')
      const lineNumber = lines.length - 1

      measureEl.textContent = beforeText
      const textWidth = measureEl.offsetWidth

      measureEl.textContent = issue.text
      const issueWidth = measureEl.offsetWidth

      const x = paddingLeft + textWidth
      const y = paddingTop + (lineNumber * lineHeight) + (lineHeight * 0.8)

      const path = this.createSquigglePath(x, y, issueWidth, fontSize)
      const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      pathElement.setAttribute('d', path)
      pathElement.setAttribute('class', 'pp-grammar-squiggle')
      pathElement.setAttribute('data-text', issue.text)
      pathElement.setAttribute('data-suggestion', issue.suggestion)
      pathElement.setAttribute('data-reason', issue.reason)
      pathElement.setAttribute('data-index', String(index))
      pathElement.style.pointerEvents = 'auto'
      pathElement.style.cursor = 'pointer'

      pathElement.addEventListener('click', (e) => {
        e.stopPropagation()
        this.showSuggestion(issue, x, y + 5)
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

  private showSuggestion(issue: GrammarIssue, x: number, y: number): void {
    if (this.activeTooltip) {
      this.activeTooltip.remove()
    }

    const tooltip = document.createElement('div')
    tooltip.className = 'pp-grammar-tooltip'
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
    reasonEl.textContent = issue.reason
    reasonEl.style.cssText = `
      color: var(--color-gray-600, #4b5563);
      font-size: var(--text-xs, 12px);
      margin-bottom: var(--space-2, 8px);
    `
    tooltip.appendChild(reasonEl)

    const suggestionBtn = document.createElement('button')
    suggestionBtn.textContent = `Fix: "${issue.suggestion}"`
    suggestionBtn.style.cssText = `
      padding: var(--space-2, 8px) var(--space-3, 12px);
      background: var(--color-info, #3b82f6);
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
      suggestionBtn.style.background = 'var(--color-info-600, #2563eb)'
    })
    suggestionBtn.addEventListener('mouseleave', () => {
      suggestionBtn.style.background = 'var(--color-info, #3b82f6)'
    })
    suggestionBtn.addEventListener('click', () => {
      this.fixIssue(issue)
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

  private fixIssue(issue: GrammarIssue): void {
    const text = this.getText()
    const regex = new RegExp(issue.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const newText = text.replace(regex, issue.suggestion)

    this.setText(newText)
    if (this.onFix) {
      this.onFix(issue, issue.suggestion)
    }
    this.update()
  }

  private updateSquiggles(): void {
    this.renderSquiggles()
  }

  private clearSquiggles(): void {
    if (this.overlay) {
      const paths = this.overlay.querySelectorAll('.pp-grammar-squiggle')
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
      .pp-grammar-squiggle {
        fill: none;
        stroke: var(--color-info, #3b82f6);
        stroke-width: 2;
        pointer-events: auto;
        cursor: pointer;
        transition: stroke-width var(--transition-fast, 150ms);
      }

      .pp-grammar-squiggle:hover {
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

