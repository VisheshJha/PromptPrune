/**
 * Real-Time Prompt Quality Score Component
 * Displays quality meter (0-100) with breakdown
 */

import { extractIntent } from '../../lib/intelligent-processor'

export interface QualityScoreOptions {
  textarea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  onScoreClick?: () => void
}

export interface QualityBreakdown {
  clarity: number
  specificity: number
  structure: number
  completeness: number
}

export class QualityScore {
  private textarea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
  private position: string
  private onScoreClick?: () => void
  private container: HTMLElement | null = null
  private shadowRoot: ShadowRoot | null = null
  private debounceTimer: number | null = null
  private currentScore: number = 0
  private currentBreakdown: QualityBreakdown | null = null

  constructor(options: QualityScoreOptions) {
    this.textarea = options.textarea
    this.position = options.position || 'top-left'
    this.onScoreClick = options.onScoreClick
    this.init()
  }

  private init(): void {
    this.createContainer()
    this.attachListeners()
    this.update()
  }

  private createContainer(): void {
    const shadowHost = document.createElement('div')
    shadowHost.id = `pp-quality-score-${Date.now()}`
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

    // Create score element
    const scoreContainer = document.createElement('div')
    scoreContainer.className = 'pp-quality-score'
    scoreContainer.innerHTML = `
      <div class="pp-quality-circle">
        <svg class="pp-quality-svg" viewBox="0 0 36 36">
          <circle class="pp-quality-circle-bg" cx="18" cy="18" r="16"></circle>
          <circle class="pp-quality-circle-progress" cx="18" cy="18" r="16"></circle>
        </svg>
        <div class="pp-quality-value">0</div>
      </div>
      <div class="pp-quality-tooltip">Prompt Quality Score (0-100)<br/>Based on clarity, specificity, structure, and completeness</div>
    `
    this.shadowRoot.appendChild(scoreContainer)

    // Add click handler
    if (this.onScoreClick) {
      scoreContainer.style.cursor = 'pointer'
      scoreContainer.addEventListener('click', () => {
        this.onScoreClick?.()
      })
    }
    
    // Add hover tooltip functionality
    const tooltip = this.shadowRoot.querySelector('.pp-quality-tooltip') as HTMLElement
    const circle = this.shadowRoot.querySelector('.pp-quality-circle') as HTMLElement
    
    if (circle && tooltip) {
      circle.addEventListener('mouseenter', () => {
        tooltip.style.opacity = '1'
        tooltip.style.visibility = 'visible'
      })
      circle.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0'
        tooltip.style.visibility = 'hidden'
      })
    }

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
    this.textarea.addEventListener('input', () => {
      this.debouncedUpdate()
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
    }, 300)
  }

  private update(): void {
    if (!this.shadowRoot) return

    const text = this.getText()
    if (!text.trim()) {
      this.updateDisplay(0, null)
      return
    }

    const { score, breakdown } = this.calculateQuality(text)
    this.currentScore = score
    this.currentBreakdown = breakdown
    this.updateDisplay(score, breakdown)
  }

  private calculateQuality(text: string): { score: number; breakdown: QualityBreakdown } {
    // Return 0 for empty or very short text
    if (!text.trim() || text.trim().length < 3) {
      return {
        score: 0,
        breakdown: {
          clarity: 0,
          specificity: 0,
          structure: 0,
          completeness: 0,
        },
      }
    }

    const intent = extractIntent(text)
    const words = text.trim().split(/\s+/)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)

    // Clarity: Has action verb, clear topic, not too vague
    let clarity = 100
    if (!intent.action || intent.action === 'write') {
      clarity -= 20
    }
    if (!intent.topic || intent.topic.length < 3) {
      clarity -= 30
    }
    if (text.match(/\b(good|better|nice|stuff|things)\b/i)) {
      clarity -= 15
    }
    clarity = Math.max(0, clarity)

    // Specificity: Not vague, has details
    let specificity = 100
    const vagueWords = text.match(/\b(good|better|nice|stuff|things|maybe|perhaps|kind of|sort of)\b/gi)
    if (vagueWords) {
      specificity -= vagueWords.length * 10
    }
    if (words.length < 5) {
      specificity -= 20
    }
    specificity = Math.max(0, specificity)

    // Structure: Well-formed sentences, proper punctuation
    let structure = 100
    if (sentences.length === 0) {
      structure = 0
    } else if (sentences.length === 1 && words.length > 50) {
      structure -= 20 // Run-on sentence
    }
    if (!text.match(/[.!?]$/)) {
      structure -= 10 // Missing punctuation
    }
    structure = Math.max(0, structure)

    // Completeness: Has all necessary components
    let completeness = 100
    if (!intent.action) {
      completeness -= 25
    }
    if (!intent.topic) {
      completeness -= 25
    }
    if (words.length < 3) {
      completeness -= 30
    }
    completeness = Math.max(0, completeness)

    const breakdown: QualityBreakdown = {
      clarity: Math.round(clarity),
      specificity: Math.round(specificity),
      structure: Math.round(structure),
      completeness: Math.round(completeness),
    }

    const score = Math.round(
      (breakdown.clarity * 0.3 +
        breakdown.specificity * 0.3 +
        breakdown.structure * 0.2 +
        breakdown.completeness * 0.2)
    )

    return { score, breakdown }
  }

  private updateDisplay(score: number, breakdown: QualityBreakdown | null): void {
    if (!this.shadowRoot) return

    const valueEl = this.shadowRoot.querySelector('.pp-quality-value')
    const progressCircle = this.shadowRoot.querySelector('.pp-quality-circle-progress') as SVGCircleElement
    const container = this.shadowRoot.querySelector('.pp-quality-score')

    if (valueEl) {
      valueEl.textContent = String(score)
    }

    if (progressCircle) {
      const circumference = 2 * Math.PI * 16
      const offset = circumference - (score / 100) * circumference
      progressCircle.style.strokeDasharray = `${circumference} ${circumference}`
      progressCircle.style.strokeDashoffset = String(offset)
    }

    if (container) {
      // Remove existing color classes
      container.classList.remove('pp-quality-excellent', 'pp-quality-good', 'pp-quality-fair', 'pp-quality-poor')

      if (score >= 80) {
        container.classList.add('pp-quality-excellent')
      } else if (score >= 60) {
        container.classList.add('pp-quality-good')
      } else if (score >= 40) {
        container.classList.add('pp-quality-fair')
      } else {
        container.classList.add('pp-quality-poor')
      }
    }
  }

  private updatePosition(): void {
    if (!this.container) return

    const rect = this.textarea.getBoundingClientRect()
    const position = this.position.split('-')

    // If position is 'top-right', check if TokenCounter exists and position to its right
    if (position[0] === 'top' && position[1] === 'right') {
      // Try to find TokenCounter element
      const tokenCounter = document.querySelector('[id^="pp-token-counter-"]') as HTMLElement
      if (tokenCounter) {
        const tokenRect = tokenCounter.getBoundingClientRect()
        // Position QualityScore to the right of TokenCounter with 12px gap
        this.container.style.top = `${tokenRect.top}px`
        this.container.style.left = `${tokenRect.right + 12}px`
        this.container.style.right = 'auto'
        this.container.style.bottom = 'auto'
        return
      }
    }

    // Default positioning logic
    let top = 'auto'
    let bottom = 'auto'
    let left = 'auto'
    let right = 'auto'

    if (position[0] === 'top') {
      top = `${rect.top - 50}px`
    } else {
      bottom = `${window.innerHeight - rect.bottom + 10}px`
    }

    if (position[1] === 'left') {
      left = `${rect.left}px`
    } else {
      right = `${window.innerWidth - rect.right}px`
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
      .pp-quality-score {
        pointer-events: auto;
        width: 48px;
        height: 48px;
      }

      .pp-quality-circle {
        position: relative;
        width: 100%;
        height: 100%;
      }

      .pp-quality-svg {
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
      }

      .pp-quality-circle-bg {
        fill: none;
        stroke: var(--color-gray-200, #e5e7eb);
        stroke-width: 3;
      }

      .pp-quality-circle-progress {
        fill: none;
        stroke-width: 3;
        stroke-linecap: round;
        transition: stroke-dashoffset var(--transition-base, 200ms ease-out);
      }

      .pp-quality-value {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
        font-size: var(--text-sm, 14px);
        font-weight: var(--font-bold, 700);
        color: var(--color-gray-900, #111827);
      }

      .pp-quality-excellent .pp-quality-circle-progress {
        stroke: var(--color-success, #10b981);
      }

      .pp-quality-excellent .pp-quality-value {
        color: var(--color-success, #10b981);
      }

      .pp-quality-good .pp-quality-circle-progress {
        stroke: var(--color-warning, #f59e0b);
      }

      .pp-quality-good .pp-quality-value {
        color: var(--color-warning, #f59e0b);
      }

      .pp-quality-fair .pp-quality-circle-progress {
        stroke: var(--color-warning, #f59e0b);
      }

      .pp-quality-fair .pp-quality-value {
        color: var(--color-warning, #f59e0b);
      }

      .pp-quality-poor .pp-quality-circle-progress {
        stroke: var(--color-error, #ef4444);
      }

      .pp-quality-poor .pp-quality-value {
        color: var(--color-error, #ef4444);
      }

      .pp-quality-score:hover {
        transform: scale(1.1);
        transition: transform var(--transition-base, 200ms ease-out);
      }

      .pp-quality-tooltip {
        position: absolute;
        bottom: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%);
        background: var(--color-gray-900, #111827);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s ease-out, visibility 0.2s ease-out;
        z-index: 10002;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        line-height: 1.4;
        text-align: center;
        max-width: 200px;
        white-space: normal;
      }

      .pp-quality-tooltip::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-top-color: var(--color-gray-900, #111827);
      }
    `
  }

  public getCurrentScore(): number {
    return this.currentScore
  }

  public getBreakdown(): QualityBreakdown | null {
    return this.currentBreakdown
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

