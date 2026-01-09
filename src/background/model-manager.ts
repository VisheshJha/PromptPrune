/**
 * Shared Model Manager for Background Service Worker
 * Downloads models once and shares across all platforms
 * Uses extension origin IndexedDB (shared storage)
 */

/**
 * Shared Model Manager for Background Service Worker
 * Downloads models once and shares across all platforms
 * Uses extension origin IndexedDB (shared storage)
 * 
 * NOTE: Service workers may not have URL.createObjectURL, so models may fail to load.
 * In that case, the extension will fall back to regex-based methods.
 */

// Import transformers config (handles URL.createObjectURL polyfill)
import '../lib/transformers-config'

// Pipeline will be imported dynamically when needed (to handle service worker limitations)
let pipeline: any = null

const FRAMEWORKS = [
  'cot', 'tot', 'ape', 'race', 'roses', 'guide', 'smart', 'create'
]

const INTENTS = [
  'content creation',
  'data analysis',
  'problem solving',
  'code generation',
  'explanation',
  'creative writing',
  'professional communication',
  'general'
]

interface SmartAnalysisResult {
  spellCheck: {
    corrected: string
    corrections: Array<{ original: string; corrected: string; position: number }>
  }
  sensitive: {
    isSensitive: boolean
    confidence: number
    type?: string
  }
  framework: {
    framework: string
    score: number
    allScores: Array<{ framework: string; score: number }>
  }
  intent: {
    intent: string
    confidence: number
    allIntents: Array<{ intent: string; score: number }>
  }
}

class SharedModelManager {
  private classifier: any = null
  private embedder: any = null
  private fillMask: any = null
  private modelReady = false
  private initPromise: Promise<void> | null = null

  async initialize(): Promise<void> {
    if (this.modelReady && this.classifier && this.embedder) {
      return
    }

    if (this.initPromise) {
      await this.initPromise
      return
    }

    this.initPromise = this._initialize()
    await this.initPromise
  }

  private async _initialize(): Promise<void> {
    try {
      // Verify URL.createObjectURL is available before importing transformers
      const hasCreateObjectURL = typeof URL !== 'undefined' && 
                                 typeof URL.createObjectURL === 'function'
      
      if (!hasCreateObjectURL) {
        console.error('[SharedModelManager] ❌ URL.createObjectURL not available')
        console.error('[SharedModelManager] This is unexpected in Chrome extension service workers')
        throw new Error('Transformers.js not available in service worker. URL.createObjectURL is required but not available in Chrome extension service workers. Extension will use regex fallback.')
      }
      
      // Check if pipeline is available (may not be in service workers due to URL.createObjectURL)
      if (!pipeline) {
        // Try to import it dynamically
        try {
          console.log('[SharedModelManager] ✅ URL.createObjectURL available, importing transformers.js...')
          const transformers = await import('@xenova/transformers')
          pipeline = transformers.pipeline
          console.log('[SharedModelManager] ✅ Transformers.js imported successfully')
        } catch (importErr) {
          const errorMsg = importErr instanceof Error ? importErr.message : String(importErr)
          console.error('[SharedModelManager] ❌ Failed to import transformers.js:', errorMsg)
          throw new Error(`Transformers.js not available in service worker. URL.createObjectURL is required but not available in Chrome extension service workers. Extension will use regex fallback. Import error: ${errorMsg}`)
        }
      }
      
      const startTime = Date.now()
      console.log('[SharedModelManager] 🚀 Starting model download in background service worker...')
      console.log('[SharedModelManager] 📊 Downloading ~53MB models (once for all platforms)')
      
      // Update progress
      chrome.storage.local.set({
        'promptprune-model-download-progress': 10,
        'promptprune-model-download-status': 'downloading'
      })
      
      // Model 1: Zero-shot classifier (~30MB)
      console.log('[SharedModelManager] 📥 Downloading classifier model...')
      this.classifier = await pipeline(
        'zero-shot-classification',
        'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
        { quantized: true }
      )
      
      chrome.storage.local.set({
        'promptprune-model-download-progress': 60
      })

      // Model 2: Embeddings (~23MB)
      console.log('[SharedModelManager] 📥 Downloading embedder model...')
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { quantized: true }
      )

      this.modelReady = true
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1)
      
      // Mark as downloaded in shared storage
      chrome.storage.local.set({
        'promptprune-unified-model-downloaded': true,
        'promptprune-models-ready': true,
        'promptprune-model-download-progress': 100,
        'promptprune-model-download-status': 'ready',
        'promptprune-model-download-time': Date.now()
      })
      
      console.log(`[SharedModelManager] ✅ Models initialized successfully! (${duration}s)`)
      console.log('[SharedModelManager] ✅ Models are now available for ALL platforms')
      console.log('[SharedModelManager] 📊 Storage: ~53MB (shared, not per-platform)')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[SharedModelManager] ❌ Model initialization failed:', errorMessage)
      
      this.modelReady = false
      this.initPromise = null
      
      chrome.storage.local.set({
        'promptprune-unified-model-downloaded': false,
        'promptprune-models-ready': false,
        'promptprune-model-download-status': 'failed',
        'promptprune-model-download-error': errorMessage
      })
      
      throw error
    }
  }

  async smartAnalysis(text: string): Promise<SmartAnalysisResult> {
    if (!this.modelReady || !this.classifier || !this.embedder) {
      throw new Error('Models not initialized. Call initialize() first.')
    }

    try {
      const [spellCheck, sensitive, framework, intent] = await Promise.all([
        this.processSpellCheck(text),
        this.processSensitiveDetection(text),
        this.processFrameworkMatching(text),
        this.processIntentClassification(text)
      ])

      return { spellCheck, sensitive, framework, intent }
    } catch (error: unknown) {
      console.error('[SharedModelManager] ❌ Analysis error:', error)
      throw error
    }
  }

  private async processSpellCheck(text: string): Promise<SmartAnalysisResult['spellCheck']> {
    // Simple spell check - can be enhanced later
    return {
      corrected: text,
      corrections: []
    }
  }

  private async processSensitiveDetection(text: string): Promise<SmartAnalysisResult['sensitive']> {
    if (!this.classifier) {
      return { isSensitive: false, confidence: 0.5 }
    }

    try {
      const sensitiveLabels = ['sensitive', 'personal', 'private', 'confidential']
      const result = await this.classifier(text, sensitiveLabels)
      
      const maxScore = Math.max(...result.scores)
      const maxIndex = result.scores.indexOf(maxScore)
      
      return {
        isSensitive: maxScore > 0.7 && sensitiveLabels[maxIndex] !== 'sensitive',
        confidence: maxScore,
        type: sensitiveLabels[maxIndex]
      }
    } catch (error) {
      console.warn('[SharedModelManager] Sensitive detection failed:', error)
      return { isSensitive: false, confidence: 0.5 }
    }
  }

  private async processFrameworkMatching(text: string): Promise<SmartAnalysisResult['framework']> {
    if (!this.classifier) {
      return this.getFallbackFramework(text)
    }

    try {
      const result = await this.classifier(text, FRAMEWORKS)
      const maxScore = Math.max(...result.scores)
      const maxIndex = result.scores.indexOf(maxScore)

      return {
        framework: FRAMEWORKS[maxIndex],
        score: maxScore,
        allScores: FRAMEWORKS.map((f, i) => ({ framework: f, score: result.scores[i] }))
      }
    } catch (error) {
      console.warn('[SharedModelManager] Framework matching failed:', error)
      return this.getFallbackFramework(text)
    }
  }

  private async processIntentClassification(text: string): Promise<SmartAnalysisResult['intent']> {
    if (!this.classifier) {
      return {
        intent: 'general',
        confidence: 0.5,
        allIntents: INTENTS.map(i => ({ intent: i, score: 0.125 }))
      }
    }

    try {
      const result = await this.classifier(text, INTENTS)
      const maxScore = Math.max(...result.scores)
      const maxIndex = result.scores.indexOf(maxScore)

      return {
        intent: INTENTS[maxIndex],
        confidence: maxScore,
        allIntents: INTENTS.map((i, idx) => ({ intent: i, score: result.scores[idx] }))
      }
    } catch (error) {
      console.warn('[SharedModelManager] Intent classification failed:', error)
      return {
        intent: 'general',
        confidence: 0.5,
        allIntents: INTENTS.map(i => ({ intent: i, score: 0.125 }))
      }
    }
  }

  private getFallbackFramework(text: string): SmartAnalysisResult['framework'] {
    const lower = text.toLowerCase()
    if (lower.match(/\b(write|create|article|blog)\b/)) {
      return {
        framework: 'roses',
        score: 0.6,
        allScores: FRAMEWORKS.map(f => ({ framework: f, score: f === 'roses' ? 0.6 : 0.1 }))
      }
    }
    return {
      framework: 'create',
      score: 0.5,
      allScores: FRAMEWORKS.map(f => ({ framework: f, score: 0.5 }))
    }
  }

  isReady(): boolean {
    return this.modelReady && this.classifier !== null && this.embedder !== null
  }
}

// Singleton instance
let sharedModelManager: SharedModelManager | null = null

export function getSharedModelManager(): SharedModelManager {
  if (!sharedModelManager) {
    sharedModelManager = new SharedModelManager()
  }
  return sharedModelManager
}
