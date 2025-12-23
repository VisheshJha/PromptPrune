/**
 * Unified Model Manager
 * Uses shared models in background service worker (downloaded once, shared across all platforms)
 * Routes all ML inference through message passing to background service worker
 */

export interface UnifiedModelStatus {
  model: boolean
  totalSize: string
  estimatedRAM: string
}

export interface SpellCheckResult {
  corrected: string
  corrections: Array<{ original: string; corrected: string; position: number }>
}

export interface FrameworkMatchResult {
  framework: string
  score: number
  allScores: Array<{ framework: string; score: number }>
}

export interface SensitiveDetectionResult {
  isSensitive: boolean
  confidence: number
  type?: string
}

export interface IntentClassificationResult {
  intent: string
  confidence: number
  allIntents: Array<{ intent: string; score: number }>
}

class UnifiedModelManager {
  private modelReady = false
  private initPromise: Promise<void> | null = null
  // Using shared models in background service worker (downloaded once, ~53MB total)
  private readonly MODEL_DESCRIPTION = 'Shared Models (Background Service Worker, ~53MB total)'

  // Framework labels (8 frameworks)
  private readonly FRAMEWORKS = [
    'cot',      // Chain of Thought
    'tot',      // Tree of Thoughts
    'ape',      // Action, Purpose, Expectation
    'race',     // Role, Action, Context, Expectation
    'roses',    // Role, Objective, Style, Example, Scope
    'guide',    // Goal, User, Instructions, Details, Examples
    'smart',    // Specific, Measurable, Achievable, Relevant, Time-bound
    'create'    // Context, Role, Expectation, Action, Tone, Examples
  ]

  // Intent labels (8 intents)
  private readonly INTENTS = [
    'content creation',
    'data analysis',
    'problem solving',
    'code generation',
    'explanation',
    'creative writing',
    'professional communication',
    'general'
  ]

  /**
   * Initialize unified model (checks shared models in background service worker)
   */
  async initialize(): Promise<void> {
    if (this.modelReady) {
      return
    }

    if (this.initPromise) {
      await this.initPromise
      return
    }

    this.initPromise = (async () => {
      try {
        // Check if shared models are ready in background service worker
        const ready = await new Promise<boolean>((resolve) => {
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ type: 'CHECK_MODELS_READY' }, (response) => {
              if (chrome.runtime.lastError) {
                resolve(false)
              } else {
                resolve(response?.ready === true)
              }
            })
          } else {
            resolve(false)
          }
        })

        if (!ready) {
          // Request model initialization in background
          await new Promise<void>((resolve, reject) => {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
              chrome.runtime.sendMessage({ type: 'INIT_MODELS' }, (response) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message))
                } else if (response?.success) {
                  resolve()
                } else {
                  reject(new Error(response?.error || 'Model initialization failed'))
                }
              })
            } else {
              reject(new Error('Chrome runtime not available'))
            }
          })
        }

        this.modelReady = true
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[UnifiedModelManager] Shared model check failed:', errorMessage)
        this.modelReady = false
        this.initPromise = null
      }
    })()

    return this.initPromise
  }

  /**
   * Spell check using shared models
   */
  async spellCheck(text: string): Promise<SpellCheckResult> {
    await this.initialize()

    if (!this.modelReady) {
      return {
        corrected: text,
        corrections: []
      }
    }

    try {
      const result = await this.requestSmartAnalysis(text)
      return result.spellCheck
    } catch (error) {
      console.error('[UnifiedModelManager] Spell check failed:', error)
      return {
        corrected: text,
        corrections: []
      }
    }
  }

  /**
   * Match framework using shared models
   */
  async matchFramework(text: string): Promise<FrameworkMatchResult> {
    await this.initialize()

    if (!this.modelReady) {
      return this.getFallbackFrameworkMatch(text)
    }

    try {
      const result = await this.requestSmartAnalysis(text)
      return result.framework
    } catch (error) {
      console.error('[UnifiedModelManager] Framework matching failed:', error)
      return this.getFallbackFrameworkMatch(text)
    }
  }

  /**
   * Detect sensitive content using shared models
   */
  async detectSensitive(text: string): Promise<SensitiveDetectionResult> {
    await this.initialize()

    if (!this.modelReady) {
      return {
        isSensitive: false,
        confidence: 0.5
      }
    }

    try {
      const result = await this.requestSmartAnalysis(text)
      return result.sensitive
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[UnifiedModelManager] ❌ Sensitive detection runtime error:', errorMessage)
      return {
        isSensitive: false,
        confidence: 0.5
      }
    }
  }

  /**
   * Classify intent using shared models
   */
  async classifyIntent(text: string): Promise<IntentClassificationResult> {
    await this.initialize()

    if (!this.modelReady) {
      return {
        intent: 'general',
        confidence: 0.5,
        allIntents: this.INTENTS.map(i => ({ intent: i, score: 0.125 }))
      }
    }

    try {
      const result = await this.requestSmartAnalysis(text)
      return result.intent
    } catch (error) {
      console.error('[UnifiedModelManager] Intent classification failed:', error)
      return {
        intent: 'general',
        confidence: 0.5,
        allIntents: this.INTENTS.map(i => ({ intent: i, score: 0.125 }))
      }
    }
  }

  /**
   * Request smart analysis from background service worker (shared models)
   * With timeout to prevent UI freezing
   */
  private async requestSmartAnalysis(text: string): Promise<{
    spellCheck: SpellCheckResult
    sensitive: SensitiveDetectionResult
    framework: FrameworkMatchResult
    intent: IntentClassificationResult
  }> {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        reject(new Error('Chrome runtime not available'))
        return
      }

      // Add timeout to prevent hanging (3 seconds max for inference)
      const timeout = setTimeout(() => {
        reject(new Error('Inference timeout - using fallback'))
      }, 3000)

      chrome.runtime.sendMessage(
        { type: 'SMART_ANALYSIS', text },
        (response) => {
          clearTimeout(timeout)
          
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else if (response?.success) {
            resolve(response.result)
          } else {
            reject(new Error(response?.error || 'Analysis failed'))
          }
        }
      )
    })
  }

  /**
   * Get model status
   */
  getStatus(): UnifiedModelStatus {
    return {
      model: this.modelReady,
      totalSize: '~30-50MB',
      estimatedRAM: '~200MB'
    }
  }

  /**
   * Fallback framework matching when model is not available
   */
  private getFallbackFrameworkMatch(text: string): FrameworkMatchResult {
    const lower = text.toLowerCase()

    // Simple keyword-based framework selection
    if (lower.match(/\b(write|create|article|blog|content|draft)\b/)) {
      return {
        framework: 'roses',
        score: 0.6,
        allScores: this.FRAMEWORKS.map(f => ({ framework: f, score: f === 'roses' ? 0.6 : 0.1 }))
      }
    } else if (lower.match(/\b(professional|business|corporate|formal)\b/)) {
      return {
        framework: 'race',
        score: 0.6,
        allScores: this.FRAMEWORKS.map(f => ({ framework: f, score: f === 'race' ? 0.6 : 0.1 }))
      }
    } else if (lower.match(/\b(how|why|explain|step|reason|think|process)\b/)) {
      return {
        framework: 'cot',
        score: 0.6,
        allScores: this.FRAMEWORKS.map(f => ({ framework: f, score: f === 'cot' ? 0.6 : 0.1 }))
      }
    } else if (lower.match(/\b(goal|objective|target|achieve|plan)\b/)) {
      return {
        framework: 'smart',
        score: 0.6,
        allScores: this.FRAMEWORKS.map(f => ({ framework: f, score: f === 'smart' ? 0.6 : 0.1 }))
      }
    }

    // Default to CREATE framework
    return {
      framework: 'create',
      score: 0.5,
      allScores: this.FRAMEWORKS.map(f => ({ framework: f, score: f === 'create' ? 0.5 : 0.1 }))
    }
  }

  /**
   * Check if model is ready
   */
  isReady(): boolean {
    return this.modelReady
  }

  /**
   * Get detailed model status for debugging
   */
  getModelStatus(): {
    ready: boolean
    modelExists: boolean
    initPromiseExists: boolean
    modelId: string
  } {
    return {
      ready: this.modelReady,
      modelExists: this.modelReady,
      initPromiseExists: this.initPromise !== null,
      modelId: this.MODEL_DESCRIPTION
    }
  }

  /**
   * Force reset initialization (useful if promise is stuck)
   */
  resetInitialization(): void {
    console.warn('[UnifiedModelManager] 🔄 Force resetting initialization...')
    this.initPromise = null
    this.modelReady = false
  }

  /**
   * Force retry initialization (useful for debugging)
   */
  async forceRetryInitialization(): Promise<void> {
    console.warn('[UnifiedModelManager] 🔄 Force retrying initialization...')
    this.resetInitialization()
    await this.initialize()
  }

  /**
   * Check if shared models are cached (in background service worker)
   */
  async isCached(): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['promptprune-models-ready'], (result) => {
          resolve(result['promptprune-models-ready'] === true)
        })
      } else {
        resolve(false)
      }
    })
  }
}

// Singleton instance
let unifiedModelManagerInstance: UnifiedModelManager | null = null

/**
 * Get or create unified model manager instance
 */
export function getUnifiedModelManager(): UnifiedModelManager {
  if (!unifiedModelManagerInstance) {
    unifiedModelManagerInstance = new UnifiedModelManager()
  }
  return unifiedModelManagerInstance
}
