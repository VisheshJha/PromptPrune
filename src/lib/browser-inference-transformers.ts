/**
 * Browser Inference using Transformers.js ONLY
 * Replaces ONNX Runtime with pure Transformers.js for better browser extension compatibility
 * Uses 3 lightweight quantized models for all 5 features
 */

// Import transformers config first to set up URL templates
import './transformers-config'

import { pipeline, Pipeline } from '@xenova/transformers'

// Task labels
const FRAMEWORKS = [
    'cot',      // Chain of Thought
    'tot',      // Tree of Thoughts
    'ape',      // Action, Purpose, Expectation
    'race',     // Role, Action, Context, Expectation
    'roses',    // Role, Objective, Style, Example, Scope
    'guide',    // Goal, User, Instructions, Details, Examples
    'smart',    // Specific, Measurable, Achievable, Relevant, Time-bound
    'create'    // Context, Role, Expectation, Action, Tone, Examples
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

export interface SmartAnalysisResult {
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

class TransformersModelManager {
    private classifier: Pipeline | null = null
    private embedder: Pipeline | null = null
    private fillMask: Pipeline | null = null
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
            console.log('[TransformersModelManager] 🚀 Initializing models...')

            // Model 1: Zero-shot classifier for intent and framework matching
            // ~30MB quantized
            console.log('[TransformersModelManager] Loading classifier...')
            this.classifier = await pipeline(
                'zero-shot-classification',
                'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
                { quantized: true }
            )
            console.log('[TransformersModelManager] ✅ Classifier loaded')

            // Model 2: Embeddings for semantic similarity
            // ~23MB quantized
            console.log('[TransformersModelManager] Loading embedder...')
            this.embedder = await pipeline(
                'feature-extraction',
                'Xenova/all-MiniLM-L6-v2',
                { quantized: true }
            )
            console.log('[TransformersModelManager] ✅ Embedder loaded')

            // Model 3: Fill-mask for spell checking (lazy load when needed)
            // Will be loaded on first spell check request

            this.modelReady = true
            console.log('[TransformersModelManager] ✅ All core models initialized')
            localStorage.setItem('promptprune-transformers-models-ready', 'true')
        } catch (error: any) {
            console.error('[TransformersModelManager] ❌ Initialization failed:', error.message)
            this.modelReady = false
            this.initPromise = null
            throw error
        }
    }

    async smartAnalysis(text: string): Promise<SmartAnalysisResult> {
        if (!this.modelReady || !this.classifier || !this.embedder) {
            throw new Error('Models not initialized. Call initialize() first.')
        }

        try {
            // Run all analyses in parallel for speed
            const [spellCheck, sensitive, framework, intent] = await Promise.all([
                this.processSpellCheck(text),
                this.processSensitiveDetection(text),
                this.processFrameworkMatching(text),
                this.processIntentClassification(text)
            ])

            return {
                spellCheck,
                sensitive,
                framework,
                intent
            }
        } catch (error: any) {
            console.error('[TransformersModelManager] ❌ Analysis error:', error)
            throw error
        }
    }

    private async processSpellCheck(
        text: string
    ): Promise<SmartAnalysisResult['spellCheck']> {
        try {
            // Lazy load fill-mask model
            if (!this.fillMask) {
                console.log('[TransformersModelManager] Loading fill-mask model for spell check...')
                this.fillMask = await pipeline(
                    'fill-mask',
                    'Xenova/distilbert-base-uncased',
                    { quantized: true }
                )
            }

            const words = text.split(/\s+/)
            const corrections: Array<{ original: string; corrected: string; position: number }> = []
            let corrected = text

            // Simple spell check: look for suspicious words (all lowercase, short, etc.)
            // For now, return original text - full spell check can be enhanced later
            // This is a placeholder for ML-based spell checking

            return {
                corrected,
                corrections
            }
        } catch (error) {
            console.warn('[TransformersModelManager] Spell check failed, returning original:', error)
            return {
                corrected: text,
                corrections: []
            }
        }
    }

    private async processSensitiveDetection(
        text: string
    ): Promise<SmartAnalysisResult['sensitive']> {
        try {
            if (!this.classifier) {
                throw new Error('Classifier not initialized')
            }

            // Use zero-shot classification for sensitive content detection
            const sensitiveLabels = [
                'contains personal information',
                'contains no sensitive data'
            ]

            const result = await this.classifier(text, sensitiveLabels, {
                multi_label: false
            })

            const isSensitive = result.labels[0] === 'contains personal information'
            const confidence = result.scores[0]

            return {
                isSensitive,
                confidence,
                type: isSensitive ? 'personal_info' : undefined
            }
        } catch (error) {
            console.warn('[TransformersModelManager] Sensitive detection failed:', error)
            return {
                isSensitive: false,
                confidence: 0.5
            }
        }
    }

    private async processFrameworkMatching(
        text: string
    ): Promise<SmartAnalysisResult['framework']> {
        try {
            if (!this.classifier || !this.embedder) {
                throw new Error('Models not initialized')
            }

            // Approach 1: Zero-shot classification
            const frameworkDescriptions = FRAMEWORKS.map(f => {
                const descriptions: Record<string, string> = {
                    'cot': 'step-by-step reasoning and explanation',
                    'tot': 'exploring multiple solution paths',
                    'ape': 'action with purpose and expected outcome',
                    'race': 'role-based task with context',
                    'roses': 'structured content creation',
                    'guide': 'goal-oriented instructions',
                    'smart': 'specific measurable goals',
                    'create': 'comprehensive creative task'
                }
                return descriptions[f] || f
            })

            const result = await this.classifier(text, frameworkDescriptions, {
                multi_label: false
            })

            // Map back to framework names
            const allScores = FRAMEWORKS.map((framework, idx) => ({
                framework,
                score: result.scores[idx] || 0
            })).sort((a, b) => b.score - a.score)

            const framework = allScores[0].framework
            const score = allScores[0].score

            return {
                framework,
                score,
                allScores
            }
        } catch (error) {
            console.warn('[TransformersModelManager] Framework matching failed:', error)
            return {
                framework: 'create',
                score: 0.5,
                allScores: FRAMEWORKS.map(f => ({ framework: f, score: 0.125 }))
            }
        }
    }

    private async processIntentClassification(
        text: string
    ): Promise<SmartAnalysisResult['intent']> {
        try {
            if (!this.classifier) {
                throw new Error('Classifier not initialized')
            }

            // Use zero-shot classification for intent
            const result = await this.classifier(text, INTENTS, {
                multi_label: false
            })

            const allIntents = INTENTS.map((intent, idx) => ({
                intent,
                score: result.scores[idx] || 0
            })).sort((a, b) => b.score - a.score)

            const intent = allIntents[0].intent
            const confidence = allIntents[0].score

            return {
                intent,
                confidence,
                allIntents
            }
        } catch (error) {
            console.warn('[TransformersModelManager] Intent classification failed:', error)
            return {
                intent: 'general',
                confidence: 0.5,
                allIntents: INTENTS.map(i => ({ intent: i, score: 0.125 }))
            }
        }
    }

    // Helper: Calculate cosine similarity between two texts
    async calculateSimilarity(text1: string, text2: string): Promise<number> {
        if (!this.embedder) {
            return 0.5
        }

        try {
            const [emb1, emb2] = await Promise.all([
                this.embedder(text1, { pooling: 'mean', normalize: true }),
                this.embedder(text2, { pooling: 'mean', normalize: true })
            ])

            const vec1 = Array.from(emb1.data as Float32Array)
            const vec2 = Array.from(emb2.data as Float32Array)

            return this.cosineSimilarity(vec1, vec2)
        } catch (error) {
            console.warn('[TransformersModelManager] Similarity calculation failed:', error)
            return 0.5
        }
    }

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

    isReady(): boolean {
        return this.modelReady
    }

    getStatus(): { ready: boolean; modelsLoaded: string[] } {
        const modelsLoaded: string[] = []
        if (this.classifier) modelsLoaded.push('classifier')
        if (this.embedder) modelsLoaded.push('embedder')
        if (this.fillMask) modelsLoaded.push('fill-mask')

        return {
            ready: this.modelReady,
            modelsLoaded
        }
    }
}

// Singleton instance
let transformersManager: TransformersModelManager | null = null

export function getTransformersModelManager(): TransformersModelManager {
    if (!transformersManager) {
        transformersManager = new TransformersModelManager()
    }
    return transformersManager
}

// Export smartAnalysis function for direct use
export async function smartAnalysis(text: string): Promise<SmartAnalysisResult> {
    const manager = getTransformersModelManager()
    await manager.initialize()
    return manager.smartAnalysis(text)
}
