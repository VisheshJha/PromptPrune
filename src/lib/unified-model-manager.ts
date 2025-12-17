/**
 * Unified Model Manager
 * Uses Transformers.js for all ML tasks (replaces ONNX Runtime)
 * 3 lightweight quantized models: classifier, embedder, fill-mask
 * Total size: ~80MB (down from 250MB+)
 * 
 * Uses Transformers.js for browser inference
 */

import { getTransformersModelManager, smartAnalysis } from './browser-inference-transformers'
import { getModelWorkerManager } from './model-worker-manager'


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
  private transformersManager = getTransformersModelManager()
  private modelReady = false
  private initPromise: Promise<void> | null = null
  private initStartTime: number | null = null // Track when initialization started
  // Using Transformers.js with 3 quantized models
  // Models: distilbert-sst-2 (classifier), all-MiniLM-L6-v2 (embedder), distilbert-base (fill-mask)
  private readonly MODEL_DESCRIPTION = 'Transformers.js (3 models, ~80MB total)'
  private useWorker: boolean = false // Disabled due to CSP/loading issues - use direct inference
  private workerManager = getModelWorkerManager()

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
   * Initialize unified model (lazy loading)
   */
  async initialize(): Promise<void> {
    if (this.modelReady) {
      return
    }

    // If promise exists, check if it's stuck
    if (this.initPromise) {

      // If initStartTime is null, the promise was created but never started executing (stuck)
      // Or if it's been more than 40 seconds, it's definitely stuck
      const now = Date.now()
      const isStuck = this.initStartTime === null ||
        (this.initStartTime && (now - this.initStartTime) > 40000)

      if (isStuck) {
        this.initPromise = null
        this.initStartTime = null
        // Fall through to create new promise
      } else {
        // Promise is still valid, wait for it
        try {
          await this.initPromise
        } catch (error) {
          console.error('[UnifiedModelManager] Error waiting for initialization:', error)
          this.initPromise = null
          this.initStartTime = null
        }

        if (this.modelReady) {
          return
        }

        // If still not ready after waiting, reset and retry
        this.initPromise = null
        this.initStartTime = null
        // Fall through to create new promise
      }
    }


    // Mark when initialization starts
    this.initStartTime = Date.now()

    this.initPromise = (async () => {
      try {

        // Initialize Transformers.js model manager
        await this.transformersManager.initialize()

        this.modelReady = true
        localStorage.setItem('promptprune-unified-model-downloaded', 'true')
      } catch (error) {
        console.error('[UnifiedModelManager] Model initialization failed:', error instanceof Error ? error.message : error)

        this.modelReady = false

        // Clear the promise so it can be retried
        this.initPromise = null
        this.initStartTime = null

        // Clear cache flag since initialization failed
        localStorage.removeItem('promptprune-unified-model-downloaded')

        // Don't throw - allow fallback mechanisms to work
        // The extension will work without the model using regex/keyword-based methods
        return
      } finally {
        // Always clear start time when done (success or failure)
        this.initStartTime = null
      }
    })()

    return this.initPromise
  }

  /**
   * Spell check using unified model
   * Note: For token-level classification, we'll use a workaround with sequence classification
   */
  async spellCheck(text: string): Promise<SpellCheckResult> {
    await this.initialize()

    if (!this.modelReady || !this.transformersManager.isReady()) {
      console.debug('[UnifiedModelManager] Model not available, spell check will use fallback')
      return {
        corrected: text,
        corrections: []
      }
    }

    try {
      const result = await this.transformersManager.smartAnalysis(text)
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
   * Match framework using unified model
   */
  async matchFramework(text: string): Promise<FrameworkMatchResult> {
    await this.initialize()

    if (!this.modelReady || !this.transformersManager.isReady()) {
      console.debug('[UnifiedModelManager] Model not available, using fallback framework matching')
      return this.getFallbackFrameworkMatch(text)
    }

    try {
      const result = await this.transformersManager.smartAnalysis(text)
      return result.framework
    } catch (error) {
      console.error('[UnifiedModelManager] Framework matching failed:', error)
      return this.getFallbackFrameworkMatch(text)
    }
  }

  /**
   * Detect sensitive content using unified model
   * Uses Web Worker if enabled, otherwise direct inference
   */
  async detectSensitive(text: string): Promise<SensitiveDetectionResult> {
    await this.initialize()

    if (!this.modelReady || !this.transformersManager.isReady()) {
      console.warn('[UnifiedModelManager] ⚠️ Model not available, using fallback sensitive detection')
      return {
        isSensitive: false,
        confidence: 0.5
      }
    }

    try {
      const result = await this.transformersManager.smartAnalysis(text)
      return result.sensitive
    } catch (error) {
      console.error('[UnifiedModelManager] ❌ Sensitive detection failed:', error)
      return {
        isSensitive: false,
        confidence: 0.5
      }
    }
  }

  /**
   * Classify intent using unified model
   * Uses Web Worker if enabled, otherwise direct inference
   */
  async classifyIntent(text: string): Promise<IntentClassificationResult> {
    await this.initialize()

    if (!this.modelReady || !this.transformersManager.isReady()) {
      console.debug('[UnifiedModelManager] Model not available, using fallback intent classification')
      return {
        intent: 'general',
        confidence: 0.5,
        allIntents: this.INTENTS.map(i => ({ intent: i, score: 0.125 }))
      }
    }

    try {
      const result = await this.transformersManager.smartAnalysis(text)
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
   * Enable/disable Web Worker usage
   */
  setUseWorker(useWorker: boolean): void {
    this.useWorker = useWorker
  }

  /**
   * Check if Web Worker is enabled
   */
  isWorkerEnabled(): boolean {
    return this.useWorker
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
    const ready = this.modelReady && this.transformersManager.isReady()
    if (!ready) {
      console.log('[UnifiedModelManager] Model status check:', {
        modelReady: this.modelReady,
        transformersReady: this.transformersManager.isReady(),
        initPromiseExists: this.initPromise !== null
      })
    }
    return ready
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
      ready: this.modelReady && this.transformersManager.isReady(),
      modelExists: this.transformersManager.isReady(),
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
    this.initStartTime = null
    this.modelReady = false
    localStorage.removeItem('promptprune-unified-model-downloaded')
    console.log('[UnifiedModelManager] Initialization reset complete')
  }

  /**
   * Force retry initialization (useful for debugging)
   */
  async forceRetryInitialization(): Promise<void> {
    console.warn('[UnifiedModelManager] 🔄 Force retrying initialization...')
    this.resetInitialization()
    console.log('[UnifiedModelManager] Starting forced initialization...')
    await this.initialize()
    console.log('[UnifiedModelManager] Forced initialization complete. Status:', this.getModelStatus())
  }

  /**
   * Check if model is cached
   */
  async isCached(): Promise<boolean> {
    try {
      // First check localStorage flag (fastest)
      const modelsDownloaded = localStorage.getItem('promptprune-unified-model-downloaded')
      if (modelsDownloaded === 'true') {
        console.log('[UnifiedModelManager] Model cache flag found in localStorage')
        return true
      }

      // Check IndexedDB for cached model (transformers.js stores models here)
      const dbName = 'transformers-cache'
      return new Promise((resolve) => {
        try {
          const request = indexedDB.open(dbName)

          request.onsuccess = () => {
            try {
              const db = request.result
              if (!db) {
                console.log('[UnifiedModelManager] IndexedDB not available')
                resolve(false)
                return
              }

              // Check if we have object stores (indicating models were cached)
              const hasStores = db.objectStoreNames.length > 0

              // Also check for our specific model in the stores
              let hasModel = false
              if (hasStores) {
                // Check if model files exist in any store
                const storeNames = Array.from(db.objectStoreNames)
                for (const storeName of storeNames) {
                  const transaction = db.transaction(storeName, 'readonly')
                  const store = transaction.objectStore(storeName)
                  const countRequest = store.count()

                  countRequest.onsuccess = () => {
                    if (countRequest.result > 0) {
                      hasModel = true
                      // Set flag for future checks
                      localStorage.setItem('promptprune-unified-model-downloaded', 'true')
                      console.log('[UnifiedModelManager] Model found in IndexedDB, setting cache flag')
                      db.close()
                      resolve(true)
                    } else {
                      db.close()
                      resolve(false)
                    }
                  }

                  countRequest.onerror = () => {
                    db.close()
                    resolve(hasStores) // Fallback to store existence check
                  }

                  return // Check first store only
                }
              } else {
                db.close()
                resolve(false)
              }

              // If no stores or check failed, close and return
              if (!hasModel && hasStores) {
                db.close()
                resolve(false)
              }
            } catch (e) {
              console.warn('[UnifiedModelManager] Error checking IndexedDB:', e)
              resolve(false)
            }
          }

          request.onerror = () => {
            console.log('[UnifiedModelManager] IndexedDB open failed')
            resolve(false)
          }

          request.onblocked = () => {
            console.log('[UnifiedModelManager] IndexedDB blocked')
            resolve(false)
          }

          request.onupgradeneeded = () => {
            // Database doesn't exist yet or needs upgrade
            console.log('[UnifiedModelManager] IndexedDB needs upgrade, no cache')
            resolve(false)
          }
        } catch (error) {
          console.warn('[UnifiedModelManager] IndexedDB check error:', error)
          resolve(false)
        }
      })
    } catch (error) {
      console.warn('[UnifiedModelManager] Error checking cache:', error)
      return false
    }
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

