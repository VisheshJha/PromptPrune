/**
 * Smart Autocomplete Engine
 * Provides Gmail-style autocomplete suggestions
 */

export interface AutocompleteSuggestion {
  text: string
  confidence: number
  type: 'pattern' | 'history' | 'token_optimization'
  savings?: number // tokens saved
}

export interface AutocompleteOptions {
  textarea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
  onAccept?: (suggestion: string) => void
  maxSuggestions?: number
}

export class AutocompleteEngine {
  private textarea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
  private onAccept?: (suggestion: string) => void
  private maxSuggestions: number
  private container: HTMLElement | null = null
  private shadowRoot: ShadowRoot | null = null
  private suggestionElement: HTMLElement | null = null
  private currentSuggestion: AutocompleteSuggestion | null = null
  private debounceTimer: number | null = null
  private userHistory: string[] = []

  // Pattern-based suggestions
  private patterns = new Map<string, string[]>([
    ['write', ['an email', 'a report', 'a blog post', 'a summary', 'a document']],
    ['create', ['a presentation', 'a document', 'a plan', 'a strategy']],
    ['explain', ['how', 'why', 'what', 'the concept of']],
    ['analyze', ['the data', 'the results', 'the trends', 'the impact']],
    ['generate', ['content', 'ideas', 'solutions', 'alternatives']],
    ['as a', ['marketing manager', 'sales rep', 'developer', 'CEO', 'product manager']],
    ['write an email', ['as a sales rep', 'as a marketing manager', 'to a client']],
    ['create a', ['presentation', 'report', 'document', 'plan']],
    ['explain the', ['concept', 'process', 'benefits', 'features']],
  ])

  // Token optimization patterns
  private tokenOptimizations = new Map<string, string>([
    ['in order to', 'to'],
    ['due to the fact that', 'because'],
    ['at this point in time', 'now'],
    ['make a decision', 'decide'],
    ['provide assistance', 'help'],
    ['take into consideration', 'consider'],
    ['as a result of', 'because'],
    ['in the event that', 'if'],
    ['with regard to', 'about'],
    ['for the purpose of', 'for'],
    ['in the near future', 'soon'],
    ['at the present time', 'now'],
    ['in a timely manner', 'promptly'],
    ['has the ability to', 'can'],
    ['is able to', 'can'],
  ])

  constructor(options: AutocompleteOptions) {
    this.textarea = options.textarea
    this.onAccept = options.onAccept
    this.maxSuggestions = options.maxSuggestions || 1
    this.loadHistory()
    this.init()
  }

  private async loadHistory(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['promptHistory'])
      if (result.promptHistory && Array.isArray(result.promptHistory)) {
        this.userHistory = result.promptHistory.slice(-50) // Last 50 prompts
      }
    } catch (error) {
      console.error('[Autocomplete] Error loading history:', error)
    }
  }

  private init(): void {
    this.createContainer()
    this.attachListeners()
  }

  private createContainer(): void {
    const shadowHost = document.createElement('div')
    shadowHost.id = `pp-autocomplete-${Date.now()}`
    shadowHost.style.cssText = `
      position: absolute;
      z-index: 10002;
      pointer-events: none;
    `

    this.shadowRoot = shadowHost.attachShadow({ mode: 'open' })
    this.container = shadowHost

    // Inject styles
    const style = document.createElement('style')
    style.textContent = this.getStyles()
    this.shadowRoot.appendChild(style)

    // Create suggestion element
    this.suggestionElement = document.createElement('div')
    this.suggestionElement.className = 'pp-autocomplete-suggestion'
    this.suggestionElement.style.display = 'none'
    this.shadowRoot.appendChild(this.suggestionElement)

    document.body.appendChild(shadowHost)
  }

  private attachListeners(): void {
    this.textarea.addEventListener('input', () => {
      this.debouncedUpdate()
    })

    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && this.currentSuggestion) {
        e.preventDefault()
        this.acceptSuggestion()
      } else if (e.key === 'Escape') {
        this.dismissSuggestion()
      } else if (e.key === 'ArrowRight' && this.currentSuggestion) {
        e.preventDefault()
        this.acceptSuggestion()
      }
    })

    // Update position on scroll/resize
    window.addEventListener('scroll', () => this.updatePosition(), true)
    window.addEventListener('resize', () => this.updatePosition())
  }

  private debouncedUpdate(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = window.setTimeout(() => {
      this.update()
    }, 2000) // Significantly increased to 2000ms debounce to prevent typing lag
  }


  private update(): void {
    if (!this.suggestionElement) return

    const text = this.getText()
    const cursorPosition = this.getCursorPosition()

    // Don't suggest if text is empty or too short
    if (!text.trim() || text.trim().length < 3) {
      this.dismissSuggestion()
      return
    }

    // Only suggest at the very end of text (cursor at end)
    if (cursorPosition !== text.length) {
      this.dismissSuggestion()
      return
    }

    // Don't suggest if cursor is in the middle of a word
    const beforeCursor = text.substring(0, cursorPosition)
    const lastCharBeforeCursor = beforeCursor[beforeCursor.length - 1]

    // Only suggest after a space, punctuation, or at start
    // Don't suggest if last character is a word character (we're in middle of word)
    if (lastCharBeforeCursor && lastCharBeforeCursor.match(/\w/)) {
      // Check if we're at the end of a word (next char would be space/punctuation)
      // Actually, if cursor is at end, we can suggest
      // But only if the last complete word is finished (followed by space or nothing)
      const words = beforeCursor.trim().split(/\s+/)
      const lastWord = words[words.length - 1] || ''

      // If last word is incomplete (no space after it), don't suggest
      // We want to suggest complete words/phrases, not mid-word completions
      if (lastWord.length > 0 && beforeCursor[beforeCursor.length - 1]?.match(/\w/)) {
        // We're typing a word - don't suggest until word is complete
        this.dismissSuggestion()
        return
      }
    }

    const suggestions = this.getSuggestions(text, cursorPosition)
    if (suggestions.length > 0) {
      this.showSuggestion(suggestions[0], text, cursorPosition)
    } else {
      this.dismissSuggestion()
    }
  }

  private getSuggestions(text: string, cursorPosition: number): AutocompleteSuggestion[] {
    const suggestions: AutocompleteSuggestion[] = []

    // Get text before cursor
    const beforeCursor = text.substring(0, cursorPosition)
    const words = beforeCursor.trim().split(/\s+/)
    const lastWord = words[words.length - 1]?.toLowerCase() || ''
    const secondLast = words.length > 1 ? words[words.length - 2]?.toLowerCase() : ''
    const twoWord = `${secondLast} ${lastWord}`.trim()

    // Check patterns
    if (this.patterns.has(lastWord)) {
      this.patterns.get(lastWord)!.forEach(suggestion => {
        suggestions.push({
          text: `${beforeCursor} ${suggestion}`,
          confidence: 0.8,
          type: 'pattern',
        })
      })
    }

    // Check two-word patterns
    if (this.patterns.has(twoWord)) {
      this.patterns.get(twoWord)!.forEach(suggestion => {
        suggestions.push({
          text: `${beforeCursor} ${suggestion}`,
          confidence: 0.9,
          type: 'pattern',
        })
      })
    }

    // Check token optimizations
    const currentPhrase = beforeCursor.trim().toLowerCase()
    for (const [long, short] of this.tokenOptimizations.entries()) {
      if (currentPhrase.endsWith(long)) {
        const optimized = beforeCursor.substring(0, beforeCursor.length - long.length) + short
        const savings = this.estimateTokenSavings(long, short)
        suggestions.push({
          text: optimized,
          confidence: 0.85,
          type: 'token_optimization',
          savings,
        })
        break // Only one optimization at a time
      }
    }

    // Check user history
    if (this.userHistory.length > 0) {
      const matchingHistory = this.userHistory
        .filter(prompt => prompt.toLowerCase().startsWith(beforeCursor.toLowerCase()) && prompt.length > beforeCursor.length)
        .slice(0, 1)

      matchingHistory.forEach(prompt => {
        suggestions.push({
          text: prompt,
          confidence: 0.7,
          type: 'history',
        })
      })
    }

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence)

    return suggestions.slice(0, this.maxSuggestions)
  }

  private estimateTokenSavings(long: string, short: string): number {
    // Rough estimate: 1 token per 4 characters
    const longTokens = Math.ceil(long.length / 4)
    const shortTokens = Math.ceil(short.length / 4)
    return Math.max(0, longTokens - shortTokens)
  }

  private showSuggestion(suggestion: AutocompleteSuggestion, currentText: string, cursorPosition: number): void {
    if (!this.suggestionElement || !this.shadowRoot) return

    this.currentSuggestion = suggestion

    // Calculate the suggestion text (only the part to be added)
    const beforeCursor = currentText.substring(0, cursorPosition)
    const suggestionText = suggestion.text
    const toAdd = suggestionText.substring(beforeCursor.length)

    if (toAdd.length === 0) {
      this.dismissSuggestion()
      return
    }

    // Update suggestion element
    this.suggestionElement.textContent = toAdd
    this.suggestionElement.style.display = 'block'

    // Add savings badge if applicable
    if (suggestion.savings && suggestion.savings > 0) {
      const savingsBadge = this.suggestionElement.querySelector('.pp-autocomplete-savings')
      if (!savingsBadge) {
        const badge = document.createElement('span')
        badge.className = 'pp-autocomplete-savings'
        badge.textContent = `-${suggestion.savings} tokens`
        this.suggestionElement.appendChild(badge)
      }
    }

    this.updatePosition()
  }

  private dismissSuggestion(): void {
    if (this.suggestionElement) {
      this.suggestionElement.style.display = 'none'
    }
    this.currentSuggestion = null
  }

  private acceptSuggestion(): void {
    if (!this.currentSuggestion) return

    const currentText = this.getText()
    const cursorPosition = this.getCursorPosition()
    const beforeCursor = currentText.substring(0, cursorPosition)

    // Replace text with suggestion
    const newText = this.currentSuggestion.text + currentText.substring(cursorPosition)
    this.setText(newText)

    // Move cursor to end of suggestion
    this.setCursorPosition(this.currentSuggestion.text.length)

    if (this.onAccept) {
      this.onAccept(this.currentSuggestion.text)
    }

    // Save to history
    this.saveToHistory(this.currentSuggestion.text)

    this.dismissSuggestion()
  }

  private saveToHistory(text: string): void {
    this.userHistory.push(text)
    if (this.userHistory.length > 50) {
      this.userHistory.shift()
    }
    chrome.storage.local.set({ promptHistory: this.userHistory }).catch(console.error)
  }

  private updatePosition(): void {
    if (!this.container || !this.suggestionElement) return

    const textareaRect = this.textarea.getBoundingClientRect()
    const computedStyle = window.getComputedStyle(this.textarea)
    const lineHeight = parseFloat(computedStyle.lineHeight) || 20
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0

    // Get cursor position
    const cursorPosition = this.getCursorPosition()
    const text = this.getText()
    const beforeCursor = text.substring(0, cursorPosition)
    const lines = beforeCursor.split('\n')
    const currentLine = lines.length - 1
    const columnInLine = lines[lines.length - 1].length

    // Measure text width
    const measureEl = document.createElement('span')
    measureEl.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre;
      font: ${computedStyle.font};
    `
    measureEl.textContent = lines[lines.length - 1]
    document.body.appendChild(measureEl)
    const textWidth = measureEl.offsetWidth
    document.body.removeChild(measureEl)

    // Calculate position
    const x = textareaRect.left + paddingLeft + textWidth
    const y = textareaRect.top + paddingTop + (currentLine * lineHeight)

    this.container.style.left = `${x}px`
    this.container.style.top = `${y}px`
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
      // For contenteditable divs
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

  private setCursorPosition(position: number): void {
    if (this.textarea instanceof HTMLTextAreaElement || this.textarea instanceof HTMLInputElement) {
      this.textarea.setSelectionRange(position, position)
    } else {
      // For contenteditable divs
      const range = document.createRange()
      const selection = window.getSelection()
      if (selection) {
        let charCount = 0
        const nodeIterator = document.createNodeIterator(
          this.textarea,
          NodeFilter.SHOW_TEXT,
          null
        )
        let node
        while ((node = nodeIterator.nextNode())) {
          const nodeLength = node.textContent?.length || 0
          if (charCount + nodeLength >= position) {
            range.setStart(node, position - charCount)
            range.setEnd(node, position - charCount)
            break
          }
          charCount += nodeLength
        }
        selection.removeAllRanges()
        selection.addRange(range)
      }
    }
  }

  private getStyles(): string {
    return `
      .pp-autocomplete-suggestion {
        color: var(--color-gray-400, #9ca3af);
        font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
        font-size: inherit;
        pointer-events: none;
        user-select: none;
        white-space: pre;
      }

      .pp-autocomplete-savings {
        margin-left: var(--space-2, 8px);
        padding: 2px 6px;
        background: var(--color-success, #10b981);
        color: white;
        border-radius: var(--radius-sm, 6px);
        font-size: var(--text-xs, 12px);
        font-weight: var(--font-medium, 500);
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
    this.suggestionElement = null
  }
}

