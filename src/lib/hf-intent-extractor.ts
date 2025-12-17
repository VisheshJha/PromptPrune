/**
 * Hugging Face-based Intent Extractor
 * Uses semantic understanding similar to GPT models for better intent extraction
 * Optimized for browser extension (lightweight models, lazy loading)
 */

// MUST import transformers config FIRST before importing transformers
import './transformers-config'

import { pipeline, Pipeline, env } from '@xenova/transformers'

export interface EnhancedIntent {
  action: string
  topic: string
  format: string
  audience: string
  tone: string
  intentCategory: string
  confidence: number
  subTasks: string[]
  details: {
    requirements: string[]
    examples: string[]
    formatSpecs: string[]
    constraints: {
      wordCount?: number
      length?: string
      style?: string
    }
  }
  entities: Array<{
    text: string
    label: string
    score: number
  }>
}

class HFIntentExtractor {
  private classifier: Pipeline | null = null
  private embedder: Pipeline | null = null
  private ner: Pipeline | null = null
  private initialized = false
  private initPromise: Promise<void> | null = null

  /**
   * Initialize models (lazy loading - only when needed)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      try {
        console.log('[HFIntentExtractor] 🚀 Starting model initialization...')
        console.log('[HFIntentExtractor] Loading models: Xenova/mobilebert-uncased-mnli, Xenova/all-MiniLM-L6-v2')
        console.log('[HFIntentExtractor] Make sure https://huggingface.co/* is in manifest host_permissions!')
        
        // Use lightweight models optimized for browser
        // Zero-shot classification for intent
        let classifierError: any = null
        try {
          this.classifier = await Promise.race([
            pipeline(
              'zero-shot-classification',
              'Xenova/mobilebert-uncased-mnli', // ~25MB, fast inference
              { quantized: true } // Use quantized model for smaller size
            ),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Model load timeout after 15s")), 15000))
          ]) as Pipeline
          console.log('[HFIntentExtractor] ✅ Classifier model loaded successfully')
        } catch (error: any) {
          classifierError = error
          console.error('[HFIntentExtractor] ❌ Classifier model failed to load:', error.message)
          if (error.message?.includes('<!DOCTYPE') || error.message?.includes('Unexpected token')) {
            console.error('[HFIntentExtractor] This error usually means:')
            console.error('  1. ⚠️  MANIFEST PERMISSION MISSING: https://huggingface.co/* must be in host_permissions!')
            console.error('  2. Model does not exist on HuggingFace')
            console.error('  3. Network/CORS issue - check browser console for CORS errors')
            console.error('[HFIntentExtractor] 🔧 FIX: Add "https://huggingface.co/*" to manifest host_permissions and reload extension')
          }
          throw error // Re-throw to prevent continuing
        }

        // Text embeddings for semantic similarity
        let embedderError: any = null
        try {
          this.embedder = await Promise.race([
            pipeline(
              'feature-extraction',
              'Xenova/all-MiniLM-L6-v2', // ~23MB, optimized for speed
              { quantized: true }
            ),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Model load timeout after 15s")), 15000))
          ]) as Pipeline
          console.log('[HFIntentExtractor] ✅ Embedder model loaded successfully')
        } catch (error: any) {
          embedderError = error
          console.error('[HFIntentExtractor] ❌ Embedder model failed to load:', error.message)
          if (error.message?.includes('<!DOCTYPE') || error.message?.includes('Unexpected token')) {
            console.error('[HFIntentExtractor] This error usually means:')
            console.error('  1. ⚠️  MANIFEST PERMISSION MISSING: https://huggingface.co/* must be in host_permissions!')
            console.error('  2. Model does not exist on HuggingFace')
            console.error('  3. Network/CORS issue - check browser console for CORS errors')
            console.error('[HFIntentExtractor] 🔧 FIX: Add "https://huggingface.co/*" to manifest host_permissions and reload extension')
          }
          // Clean up classifier if embedder fails
          this.classifier = null
          throw error // Re-throw to prevent continuing
        }

        // NER for entity extraction (optional, can be lazy loaded)
        // We'll load this only when needed to save initial load time

        this.initialized = true
        console.log('[HFIntentExtractor] ✅ All models initialized successfully')
      } catch (error) {
        console.error('[HFIntentExtractor] ❌ Model initialization failed!')
        console.error('[HFIntentExtractor] Error details:', error)
        if (error instanceof Error) {
          console.error('[HFIntentExtractor] Error message:', error.message)
          console.error('[HFIntentExtractor] Error stack:', error.stack)
        }
        console.error('[HFIntentExtractor] Possible causes:')
        console.error('  1. ⚠️  MANIFEST PERMISSION MISSING: https://huggingface.co/* must be in host_permissions!')
        console.error('  2. Models do not exist on HuggingFace')
        console.error('  3. Network/CORS issue - check browser console for CORS errors')
        console.error('  4. Browser compatibility issue')
        console.error('[HFIntentExtractor] Extension will use fallback methods (keyword-based)')
        // Fallback: continue without HF models
        this.initialized = false
        this.classifier = null
        this.embedder = null
      }
    })()

    return this.initPromise
  }

  /**
   * Extract intent using HF models with fallback to existing logic
   */
  async extractIntent(
    prompt: string,
    fallbackExtractor: (text: string) => any
  ): Promise<EnhancedIntent> {
    // Ensure models are initialized
    await this.initialize()

    // If initialization failed, use fallback
    if (!this.initialized || !this.classifier || !this.embedder) {
      const fallback = fallbackExtractor(prompt)
      return {
        ...fallback,
        intentCategory: 'unknown',
        confidence: 0.5,
        subTasks: [],
        details: {
          requirements: [],
          examples: [],
          formatSpecs: [],
          constraints: fallback.constraints || {}
        },
        entities: []
      }
    }

    try {
      // Step 1: Classify intent category
      const intentCategories = [
        'content creation',
        'analysis and reporting',
        'reasoning and problem solving',
        'instruction and tutorial',
        'professional communication',
        'creative writing',
        'data processing',
        'code generation'
      ]

      const classification = await this.classifier(prompt, intentCategories)
      const intentCategory = classification.labels[0] || 'content creation'
      const confidence = classification.scores[0] || 0.5

      // Step 2: Extract entities (lazy load NER if needed)
      let entities: Array<{ text: string; label: string; score: number }> = []
      try {
        if (!this.ner) {
          this.ner = await pipeline(
            'token-classification',
            'Xenova/bert-base-NER',
            { quantized: true }
          )
        }
        const nerResults = await this.ner(prompt)
        entities = nerResults.map((e: any) => ({
          text: e.word,
          label: e.entity,
          score: e.score
        }))
      } catch (error) {
        console.warn('[HFIntentExtractor] NER failed, continuing without entities:', error)
      }

      // Step 3: Extract sub-tasks
      const subTasks = this.extractSubTasks(prompt)

      // Step 4: Extract all details
      const details = this.extractAllDetails(prompt, entities)

      // Step 5: Use fallback for basic extraction, then enhance with HF results
      const fallback = fallbackExtractor(prompt)

      return {
        action: this.enhanceAction(fallback.action, prompt, entities),
        topic: this.enhanceTopic(fallback.topic, prompt, entities),
        format: this.enhanceFormat(fallback.format, prompt, details.formatSpecs),
        audience: this.enhanceAudience(fallback.audience, prompt),
        tone: this.enhanceTone(fallback.tone, prompt),
        intentCategory,
        confidence,
        subTasks,
        details: {
          requirements: details.requirements,
          examples: details.examples,
          formatSpecs: details.formatSpecs,
          constraints: fallback.constraints || {}
        },
        entities
      }
    } catch (error) {
      console.error('[HFIntentExtractor] Extraction error:', error)
      // Fallback to existing logic
      const fallback = fallbackExtractor(prompt)
      return {
        ...fallback,
        intentCategory: 'unknown',
        confidence: 0.5,
        subTasks: [],
        details: {
          requirements: [],
          examples: [],
          formatSpecs: [],
          constraints: fallback.constraints || {}
        },
        entities: []
      }
    }
  }

  /**
   * Extract sub-tasks from prompt
   */
  private extractSubTasks(text: string): string[] {
    const subTasks: string[] = []

    // Pattern 1: Numbered lists (1. task, 2. task, etc.)
    const numberedMatches = text.matchAll(/\d+\.\s+([^.\n]+?)(?=\d+\.|$)/g)
    for (const match of numberedMatches) {
      const task = match[1].trim()
      if (task.length > 5) {
        subTasks.push(task)
      }
    }

    // Pattern 2: Bullet points (- task, * task)
    const bulletMatches = text.matchAll(/[-*]\s+([^\n]+)/g)
    for (const match of bulletMatches) {
      const task = match[1].trim()
      if (task.length > 5) {
        subTasks.push(task)
      }
    }

    // Pattern 3: "also", "additionally", "and", "plus" clauses
    const alsoPattern = /(?:also|additionally|and|plus|furthermore|moreover)\s+(?:include|add|cover|discuss|explain|analyze|write|create|make)\s+([^.,!?\n]+)/gi
    const alsoMatches = Array.from(text.matchAll(alsoPattern))
    for (const match of alsoMatches) {
      const task = match[1].trim()
      if (task.length > 5 && !subTasks.includes(task)) {
        subTasks.push(task)
      }
    }

    // Pattern 4: Multiple sentences with action verbs
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10)
    sentences.forEach(sentence => {
      if (sentence.match(/\b(write|create|include|add|cover|discuss|explain|analyze|research|study|examine)\b/i)) {
        // Check if it's not already captured
        const isDuplicate = subTasks.some(st => 
          st.toLowerCase().includes(sentence.toLowerCase().substring(0, 20)) ||
          sentence.toLowerCase().includes(st.toLowerCase().substring(0, 20))
        )
        if (!isDuplicate && sentence.length > 10) {
          subTasks.push(sentence)
        }
      }
    })

    return subTasks.slice(0, 5) // Limit to 5 sub-tasks
  }

  /**
   * Extract all details from prompt
   */
  private extractAllDetails(
    text: string,
    entities: Array<{ text: string; label: string; score: number }>
  ): {
    requirements: string[]
    examples: string[]
    formatSpecs: string[]
  } {
    const requirements: string[] = []
    const examples: string[] = []
    const formatSpecs: string[] = []

    // Extract requirements (must, should, need, require)
    const requirementPatterns = [
      /(?:must|should|need|require|include|contain)\s+([^.,!?\n]+)/gi,
      /(?:make sure|ensure|guarantee)\s+([^.,!?\n]+)/gi
    ]
    for (const pattern of requirementPatterns) {
      const matches = Array.from(text.matchAll(pattern))
      for (const match of matches) {
        const req = match[1].trim()
        if (req.length > 5 && !requirements.includes(req)) {
          requirements.push(req)
        }
      }
    }

    // Extract examples (for example, e.g., such as, like)
    const examplePatterns = [
      /(?:for example|e\.g\.|such as|like|including)\s+([^.,!?\n]+)/gi,
      /example:\s*([^.,!?\n]+)/gi
    ]
    for (const pattern of examplePatterns) {
      const matches = Array.from(text.matchAll(pattern))
      for (const match of matches) {
        const ex = match[1].trim()
        if (ex.length > 5 && !examples.includes(ex)) {
          examples.push(ex)
        }
      }
    }

    // Extract format specifications
    const formatPatterns = [
      /(?:format|structure|layout|style|presentation):\s*([^.,!?\n]+)/gi,
      /(?:in|as|with)\s+(?:a|an|the)?\s*([^.,!?\n]*?(?:format|structure|layout|style|presentation)[^.,!?\n]*)/gi
    ]
    for (const pattern of formatPatterns) {
      const matches = Array.from(text.matchAll(pattern))
      for (const match of matches) {
        const spec = match[1].trim()
        if (spec.length > 5 && !formatSpecs.includes(spec)) {
          formatSpecs.push(spec)
        }
      }
    }

    return { requirements, examples, formatSpecs }
  }

  /**
   * Enhance action extraction using entities
   */
  private enhanceAction(
    fallbackAction: string,
    prompt: string,
    entities: Array<{ text: string; label: string; score: number }>
  ): string {
    // Look for action verbs in entities
    const actionEntities = entities.filter(e => 
      e.label === 'VERB' || 
      ['write', 'create', 'make', 'generate', 'analyze', 'explain'].some(verb => 
        e.text.toLowerCase().includes(verb)
      )
    )

    if (actionEntities.length > 0) {
      return actionEntities[0].text
    }

    return fallbackAction
  }

  /**
   * Enhance topic extraction using entities
   */
  private enhanceTopic(
    fallbackTopic: string,
    prompt: string,
    entities: Array<{ text: string; label: string; score: number }>
  ): string {
    // Look for topic entities (ORG, LOC, MISC, or significant nouns)
    const topicEntities = entities
      .filter(e => ['ORG', 'LOC', 'MISC', 'PER'].includes(e.label) || e.score > 0.8)
      .map(e => e.text)
      .filter((text, index, self) => self.indexOf(text) === index) // Unique

    if (topicEntities.length > 0) {
      return topicEntities.join(' ')
    }

    // If fallback topic is generic, try to extract from prompt
    if (fallbackTopic.toLowerCase().includes('specified topic') || 
        fallbackTopic.toLowerCase().includes('[subject]')) {
      // Try to find topic after "about", "on", "regarding"
      const topicMatch = prompt.match(/(?:about|on|regarding|concerning)\s+([^.,!?\n]+?)(?:\s+(?:for|to|with|and|or|,|\.|$)|$)/i)
      if (topicMatch && topicMatch[1]) {
        return topicMatch[1].trim()
      }
    }

    return fallbackTopic
  }

  /**
   * Enhance format extraction
   */
  private enhanceFormat(
    fallbackFormat: string,
    prompt: string,
    formatSpecs: string[]
  ): string {
    if (formatSpecs.length > 0) {
      return formatSpecs[0]
    }

    // Check for format keywords
    const formatKeywords: Record<string, string> = {
      'report': 'report',
      'blog': 'blog post',
      'article': 'article',
      'summary': 'summary',
      'guide': 'guide',
      'tutorial': 'tutorial',
      'email': 'email',
      'letter': 'letter',
      'essay': 'essay',
      'code': 'code',
      'script': 'script'
    }

    const lower = prompt.toLowerCase()
    for (const [keyword, format] of Object.entries(formatKeywords)) {
      if (lower.includes(keyword)) {
        return format
      }
    }

    return fallbackFormat
  }

  /**
   * Enhance audience extraction
   */
  private enhanceAudience(fallbackAudience: string, prompt: string): string {
    const audiencePatterns = [
      { pattern: /(?:for|to|targeting)\s+(?:a\s+)?(general|technical|professional|beginner|expert|student|academic)\s+(?:audience|readers?|users?)/i, extract: (m: RegExpMatchArray) => m[1] },
      { pattern: /(?:for|to)\s+([^.,!?\n]+?)\s+(?:audience|readers?|users?)/i, extract: (m: RegExpMatchArray) => m[1] }
    ]

    for (const { pattern, extract } of audiencePatterns) {
      const match = prompt.match(pattern)
      if (match) {
        const audience = extract(match).trim()
        if (audience.length > 3) {
          return audience
        }
      }
    }

    return fallbackAudience
  }

  /**
   * Enhance tone extraction
   */
  private enhanceTone(fallbackTone: string, prompt: string): string {
    const toneKeywords: Record<string, string> = {
      'engaging': 'clear, engaging',
      'professional': 'professional and clear',
      'casual': 'friendly and accessible',
      'formal': 'formal and professional',
      'friendly': 'friendly and accessible',
      'technical': 'technical and precise',
      'creative': 'creative and engaging'
    }

    const lower = prompt.toLowerCase()
    for (const [keyword, tone] of Object.entries(toneKeywords)) {
      if (lower.includes(keyword)) {
        return tone
      }
    }

    return fallbackTone
  }

  /**
   * Calculate semantic similarity between prompt and framework description
   */
  async calculateSemanticSimilarity(
    prompt: string,
    frameworkDescription: string
  ): Promise<number> {
    if (!this.embedder || !this.initialized) {
      return 0.5 // Default similarity if models not loaded
    }

    try {
      // Get embeddings
      const promptEmbedding = await this.embedder(prompt, {
        pooling: 'mean',
        normalize: true
      })

      const descEmbedding = await this.embedder(frameworkDescription, {
        pooling: 'mean',
        normalize: true
      })

      // Calculate cosine similarity
      const similarity = this.cosineSimilarity(
        Array.from(promptEmbedding.data),
        Array.from(descEmbedding.data)
      )

      return similarity
    } catch (error) {
      console.error('[HFIntentExtractor] Similarity calculation error:', error)
      return 0.5
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i]
      normA += vecA[i] * vecA[i]
      normB += vecB[i] * vecB[i]
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    if (denominator === 0) return 0

    return dotProduct / denominator
  }
}

// Singleton instance
let hfExtractorInstance: HFIntentExtractor | null = null

/**
 * Get or create HF intent extractor instance
 */
export function getHFIntentExtractor(): HFIntentExtractor {
  if (!hfExtractorInstance) {
    hfExtractorInstance = new HFIntentExtractor()
  }
  return hfExtractorInstance
}

