/**
 * Real-Time Assistant
 * Unified manager for all real-time prompt assistance features
 */

import { TokenCounter, type TokenCounterOptions } from './TokenCounter'
import { QualityScore, type QualityScoreOptions } from './QualityScore'
import { SpellCheckOverlay, type SpellCheckOptions } from './SpellCheckOverlay'
import { AutocompleteEngine, type AutocompleteOptions } from './AutocompleteEngine'
import { RedundancyDetector, type RedundancyDetectorOptions } from './RedundancyDetector'
import { SmartSuggestions, type SmartSuggestionsOptions } from './SmartSuggestions'
import { GrammarChecker, type GrammarCheckerOptions } from './GrammarChecker'

export interface RealTimeAssistantOptions {
  textarea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
  enabled?: {
    tokenCounter?: boolean
    qualityScore?: boolean
    spellCheck?: boolean
    autocomplete?: boolean
    redundancy?: boolean
    smartSuggestions?: boolean
    grammar?: boolean
  }
  tokenCounter?: Partial<TokenCounterOptions>
  qualityScore?: Partial<QualityScoreOptions>
  spellCheck?: Partial<SpellCheckOptions>
  autocomplete?: Partial<AutocompleteOptions>
  redundancy?: Partial<RedundancyDetectorOptions>
  smartSuggestions?: Partial<SmartSuggestionsOptions>
  grammar?: Partial<GrammarCheckerOptions>
}

export class RealTimeAssistant {
  private textarea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
  private options: RealTimeAssistantOptions
  private enabled: Required<RealTimeAssistantOptions['enabled']>
  private tokenCounter: TokenCounter | null = null
  private qualityScore: QualityScore | null = null
  private spellCheck: SpellCheckOverlay | null = null
  private autocomplete: AutocompleteEngine | null = null
  private redundancy: RedundancyDetector | null = null
  private smartSuggestions: SmartSuggestions | null = null
  private grammar: GrammarChecker | null = null

  constructor(options: RealTimeAssistantOptions) {
    this.textarea = options.textarea
    this.options = options
    this.enabled = {
      tokenCounter: options.enabled?.tokenCounter ?? true,
      qualityScore: options.enabled?.qualityScore ?? true,
      spellCheck: options.enabled?.spellCheck ?? true,
      autocomplete: options.enabled?.autocomplete ?? true,
      redundancy: options.enabled?.redundancy ?? true,
      smartSuggestions: options.enabled?.smartSuggestions ?? true,
      // Grammar feature removed from user-facing UI/UX (keep internal capability off by default)
      grammar: options.enabled?.grammar ?? false,
    }

    this.init()
  }

  private init(): void {
    // Initialize enabled components
    if (this.enabled.tokenCounter) {
      this.tokenCounter = new TokenCounter({
        textarea: this.textarea,
        position: 'top-right',
        ...this.options?.tokenCounter,
      })
    }

    if (this.enabled.qualityScore) {
      this.qualityScore = new QualityScore({
        textarea: this.textarea,
        position: 'top-right', // Position to the right of token counter
        ...this.options?.qualityScore,
      })
    }

    if (this.enabled.spellCheck) {
      this.spellCheck = new SpellCheckOverlay({
        textarea: this.textarea,
        ...this.options?.spellCheck,
      })
    }

    if (this.enabled.autocomplete) {
      this.autocomplete = new AutocompleteEngine({
        textarea: this.textarea,
        ...this.options?.autocomplete,
      })
    }

    if (this.enabled.redundancy) {
      this.redundancy = new RedundancyDetector({
        textarea: this.textarea,
        ...this.options?.redundancy,
      })
    }

    if (this.enabled.smartSuggestions) {
      this.smartSuggestions = new SmartSuggestions({
        textarea: this.textarea,
        ...this.options?.smartSuggestions,
      })
    }

    if (this.enabled.grammar) {
      this.grammar = new GrammarChecker({
        textarea: this.textarea,
        ...this.options?.grammar,
      })
    }
  }

  public enableFeature(feature: keyof RealTimeAssistantOptions['enabled']): void {
    if (this.enabled[feature]) return

    this.enabled[feature] = true

    switch (feature) {
      case 'tokenCounter':
        this.tokenCounter = new TokenCounter({
          textarea: this.textarea,
          position: 'top-right',
          ...this.options?.tokenCounter,
        })
        break
      case 'qualityScore':
        this.qualityScore = new QualityScore({
          textarea: this.textarea,
          position: 'top-right', // Position to the right of token counter
          ...this.options?.qualityScore,
        })
        break
      case 'spellCheck':
        this.spellCheck = new SpellCheckOverlay({
          textarea: this.textarea,
          ...this.options?.spellCheck,
        })
        break
      case 'autocomplete':
        this.autocomplete = new AutocompleteEngine({
          textarea: this.textarea,
          ...this.options?.autocomplete,
        })
        break
      case 'redundancy':
        this.redundancy = new RedundancyDetector({
          textarea: this.textarea,
          ...this.options?.redundancy,
        })
        break
      case 'smartSuggestions':
        this.smartSuggestions = new SmartSuggestions({
          textarea: this.textarea,
          ...this.options?.smartSuggestions,
        })
        break
      case 'grammar':
        this.grammar = new GrammarChecker({
          textarea: this.textarea,
          ...this.options?.grammar,
        })
        break
    }
  }

  public disableFeature(feature: keyof RealTimeAssistantOptions['enabled']): void {
    if (!this.enabled[feature]) return

    this.enabled[feature] = false

    switch (feature) {
      case 'tokenCounter':
        this.tokenCounter?.destroy()
        this.tokenCounter = null
        break
      case 'qualityScore':
        this.qualityScore?.destroy()
        this.qualityScore = null
        break
      case 'spellCheck':
        this.spellCheck?.destroy()
        this.spellCheck = null
        break
      case 'autocomplete':
        this.autocomplete?.destroy()
        this.autocomplete = null
        break
      case 'redundancy':
        this.redundancy?.destroy()
        this.redundancy = null
        break
      case 'smartSuggestions':
        this.smartSuggestions?.destroy()
        this.smartSuggestions = null
        break
      case 'grammar':
        this.grammar?.destroy()
        this.grammar = null
        break
    }
  }

  public destroy(): void {
    this.tokenCounter?.destroy()
    this.qualityScore?.destroy()
    this.spellCheck?.destroy()
    this.autocomplete?.destroy()
    this.redundancy?.destroy()
    this.smartSuggestions?.destroy()
    this.grammar?.destroy()

    this.tokenCounter = null
    this.qualityScore = null
    this.spellCheck = null
    this.autocomplete = null
    this.redundancy = null
    this.smartSuggestions = null
    this.grammar = null
  }
}

