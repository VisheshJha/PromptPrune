/**
 * Optimized Model Manager
 * Uses DistilBERT + MiniLM hybrid for efficient prompt processing
 * Lazy loading with user consent and progress tracking
 */

import { pipeline, Pipeline } from '@xenova/transformers'

export interface ModelStatus {
  classifier: boolean
  embedder: boolean
  ner: boolean
  totalSize: string
  estimatedRAM: string
}

class OptimizedModelManager {
  private classifier: Pipeline | null = null
  private embedder: Pipeline | null = null
  private ner: Pipeline | null = null
  
  private classifierReady = false
  private embedderReady = false
  private nerReady = false
  
  private initPromises: {
    classifier?: Promise<void>
    embedder?: Promise<void>
    ner?: Promise<void>
  } = {}

  /**
   * Initialize classifier (DistilBERT) for intent classification
   */
  async initializeClassifier(): Promise<void> {
    if (this.classifierReady) return
    if (this.initPromises.classifier) return this.initPromises.classifier

    this.initPromises.classifier = (async () => {
      try {
        this.classifier = await Promise.race([
          pipeline(
            'zero-shot-classification',
            'Xenova/distilbert-base-uncased', // ~70MB, 95% of BERT accuracy
            { quantized: true }
          ),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Classifier load timeout")), 20000)
          )
        ]) as Pipeline
        
        this.classifierReady = true
        console.log('[ModelManager] Classifier (DistilBERT) loaded')
      } catch (error) {
        console.error('[ModelManager] Classifier initialization failed:', error)
        this.classifier = null
        this.classifierReady = false
      }
    })()

    return this.initPromises.classifier
  }

  /**
   * Initialize embedder (MiniLM) for semantic similarity
   */
  async initializeEmbedder(): Promise<void> {
    if (this.embedderReady) return
    if (this.initPromises.embedder) return this.initPromises.embedder

    this.initPromises.embedder = (async () => {
      try {
        this.embedder = await Promise.race([
          pipeline(
            'feature-extraction',
            'Xenova/all-MiniLM-L6-v2', // ~23MB, optimized for speed
            { quantized: true }
          ),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Embedder load timeout")), 20000)
          )
        ]) as Pipeline
        
        this.embedderReady = true
        console.log('[ModelManager] Embedder (MiniLM) loaded')
      } catch (error) {
        console.error('[ModelManager] Embedder initialization failed:', error)
        this.embedder = null
        this.embedderReady = false
      }
    })()

    return this.initPromises.embedder
  }

  /**
   * Initialize NER (DistilBERT) for entity extraction
   */
  async initializeNER(): Promise<void> {
    if (this.nerReady) return
    if (this.initPromises.ner) return this.initPromises.ner

    this.initPromises.ner = (async () => {
      try {
        this.ner = await Promise.race([
          pipeline(
            'ner',
            'Xenova/distilbert-base-uncased-finetuned-conll03-english', // ~70MB
            { quantized: true }
          ),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("NER load timeout")), 20000)
          )
        ]) as Pipeline
        
        this.nerReady = true
        console.log('[ModelManager] NER (DistilBERT) loaded')
      } catch (error) {
        console.error('[ModelManager] NER initialization failed:', error)
        this.ner = null
        this.nerReady = false
      }
    })()

    return this.initPromises.ner
  }

  /**
   * Classify intent using DistilBERT
   */
  async classifyIntent(
    text: string,
    labels: string[]
  ): Promise<{ label: string; score: number }> {
    await this.initializeClassifier()
    
    if (!this.classifier) {
      throw new Error("Classifier not available")
    }

    const result = await this.classifier(text, labels)
    return {
      label: result.labels[0],
      score: result.scores[0]
    }
  }

  /**
   * Calculate semantic similarity using MiniLM
   */
  async calculateSimilarity(text1: string, text2: string): Promise<number> {
    await this.initializeEmbedder()
    
    if (!this.embedder) {
      throw new Error("Embedder not available")
    }

    const [emb1, emb2] = await Promise.all([
      this.embedder(text1, { pooling: 'mean', normalize: true }),
      this.embedder(text2, { pooling: 'mean', normalize: true })
    ])

    // Cosine similarity
    const data1 = emb1.data
    const data2 = emb2.data
    
    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0
    
    for (let i = 0; i < data1.length; i++) {
      dotProduct += data1[i] * data2[i]
      norm1 += data1[i] * data1[i]
      norm2 += data2[i] * data2[i]
    }
    
    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2)
    if (denominator === 0) return 0
    
    return dotProduct / denominator
  }

  /**
   * Extract entities using DistilBERT NER
   */
  async extractEntities(text: string): Promise<Array<{
    word: string
    entity: string
    score: number
  }>> {
    await this.initializeNER()
    
    if (!this.ner) {
      throw new Error("NER not available")
    }

    const result = await this.ner(text)
    
    return result.map((item: any) => ({
      word: item.word,
      entity: item.entity,
      score: item.score
    }))
  }

  /**
   * Get model status
   */
  getStatus(): ModelStatus {
    return {
      classifier: this.classifierReady,
      embedder: this.embedderReady,
      ner: this.nerReady,
      totalSize: '~163MB',
      estimatedRAM: '~400MB'
    }
  }

  /**
   * Check if all models are ready
   */
  areAllModelsReady(): boolean {
    return this.classifierReady && this.embedderReady && this.nerReady
  }

  /**
   * Check if any model is ready (for fallback)
   */
  areAnyModelsReady(): boolean {
    return this.classifierReady || this.embedderReady || this.nerReady
  }

  /**
   * Check if models are cached in IndexedDB (without loading them)
   */
  async areModelsCached(): Promise<boolean> {
    try {
      // Check localStorage first for a flag that models were downloaded
      const modelsDownloaded = localStorage.getItem('promptprune-models-downloaded')
      if (modelsDownloaded === 'true') {
        return true
      }
      
      // Also check IndexedDB for cached models
      // transformers.js stores models in IndexedDB
      const dbName = 'transformers-cache'
      return new Promise((resolve) => {
        const request = indexedDB.open(dbName)
        request.onsuccess = () => {
          const db = request.result
          if (!db) {
            resolve(false)
            return
          }
          
          // Check if we have object stores (indicating models were cached)
          const hasStores = db.objectStoreNames.length > 0
          db.close()
          
          // If models are cached, set flag in localStorage
          if (hasStores) {
            localStorage.setItem('promptprune-models-downloaded', 'true')
          }
          
          resolve(hasStores)
        }
        request.onerror = () => resolve(false)
        request.onblocked = () => resolve(false)
        request.onupgradeneeded = () => {
          // Database doesn't exist yet
          resolve(false)
        }
      })
    } catch (error) {
      console.warn('[ModelManager] Error checking cache:', error)
      return false
    }
  }
}

// Singleton instance
let modelManagerInstance: OptimizedModelManager | null = null

/**
 * Get or create model manager instance
 */
export function getModelManager(): OptimizedModelManager {
  if (!modelManagerInstance) {
    modelManagerInstance = new OptimizedModelManager()
  }
  return modelManagerInstance
}

