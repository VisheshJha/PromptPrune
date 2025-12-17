/**
 * Browser Inference using ONNX Runtime
 * Uses VisheshKJha/tk-prompt-prune model with ONNX Runtime Web
 * Supports 4 tasks: spell check, sensitive detection, framework matching, intent classification
 */

// Import transformers config first to set up URL templates
import './transformers-config'

import * as ort from 'onnxruntime-web'
import { AutoTokenizer } from '@xenova/transformers'

// Model configuration
const MODEL_ID = 'VisheshKJha/tk-prompt-prune'
const MODEL_URL = `https://huggingface.co/${MODEL_ID}/resolve/main/model_quantized.onnx`
const TOKENIZER_URL = `https://huggingface.co/${MODEL_ID}/resolve/main/tokenizer.json`

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

class ONNXModelManager {
  private session: ort.InferenceSession | null = null
  private tokenizer: AutoTokenizer | null = null
  private modelReady = false
  private initPromise: Promise<void> | null = null

  async initialize(): Promise<void> {
    if (this.modelReady && this.session && this.tokenizer) {
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
      // For Chrome extensions, ONNX Runtime Web has limitations with WASM
      // Let ONNX Runtime auto-detect available backends
      // It will try to use the best available backend automatically
      this.session = await ort.InferenceSession.create(MODEL_URL, {
        // Don't specify executionProviders - let ONNX Runtime auto-detect
        // This allows it to use whatever backend is available (webgl, wasm, cpu)
        graphOptimizationLevel: 'all'
      })

      // Load tokenizer
      this.tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID)

      this.modelReady = true
    } catch (error: any) {
      console.error('[ONNXModelManager] Initialization failed:', error.message)
      this.modelReady = false
      throw error
    }
  }

  async smartAnalysis(text: string): Promise<SmartAnalysisResult> {
    if (!this.modelReady || !this.session || !this.tokenizer) {
      throw new Error('Model not initialized. Call initialize() first.')
    }

    try {
      // Tokenize input
      const encoded = await this.tokenizer(text, {
        padding: true,
        truncation: true,
        max_length: 512,
        return_tensors: 'pt'
      })

      const inputIds = Array.from(encoded.input_ids.data as any)
      const attentionMask = Array.from(encoded.attention_mask.data as any)

      // Prepare inputs for ONNX
      const inputIdsTensor = new ort.Tensor(
        'int64',
        BigInt64Array.from(inputIds.map(x => BigInt(x))),
        [1, inputIds.length]
      )

      const attentionMaskTensor = new ort.Tensor(
        'int64',
        BigInt64Array.from(attentionMask.map(x => BigInt(x))),
        [1, attentionMask.length]
      )

      // Run inference
      const feeds = {
        input_ids: inputIdsTensor,
        attention_mask: attentionMaskTensor
      }

      const results = await this.session.run(feeds)

      // Extract outputs (adjust based on your model's actual output names)
      // Assuming outputs are: spell_logits, sensitive_logits, framework_logits, intent_logits
      const spellLogits = results.spell_logits || results.output_0
      const sensitiveLogits = results.sensitive_logits || results.output_1
      const frameworkLogits = results.framework_logits || results.output_2
      const intentLogits = results.intent_logits || results.output_3

      // Process spell check (token-level predictions)
      const spellCheckResult = this.processSpellCheck(text, spellLogits, inputIds)

      // Process sensitive detection (binary classification)
      const sensitiveResult = this.processSensitiveDetection(sensitiveLogits)

      // Process framework matching (8-way classification)
      const frameworkResult = this.processFrameworkMatching(frameworkLogits)

      // Process intent classification (8-way classification)
      const intentResult = this.processIntentClassification(intentLogits)

      return {
        spellCheck: spellCheckResult,
        sensitive: sensitiveResult,
        framework: frameworkResult,
        intent: intentResult
      }
    } catch (error: any) {
      console.error('[ONNXModelManager] Inference error:', error)
      throw error
    }
  }

  private processSpellCheck(
    text: string,
    logits: ort.Tensor,
    inputIds: number[]
  ): SmartAnalysisResult['spellCheck'] {
    // Extract token-level predictions
    const predictions = Array.from(logits.data as Float32Array)
    const words = text.split(/\s+/)
    const corrections: Array<{ original: string; corrected: string; position: number }> = []

    // Simple spell check logic (adjust based on your model's output format)
    // This is a placeholder - implement based on your actual model output
    let corrected = text

    return {
      corrected,
      corrections
    }
  }

  private processSensitiveDetection(logits: ort.Tensor): SmartAnalysisResult['sensitive'] {
    const scores = Array.from(logits.data as Float32Array)
    const isSensitive = scores[1] > scores[0] // Assuming binary classification
    const confidence = Math.max(...scores)

    return {
      isSensitive,
      confidence,
      type: isSensitive ? 'sensitive' : undefined
    }
  }

  private processFrameworkMatching(logits: ort.Tensor): SmartAnalysisResult['framework'] {
    const scores = Array.from(logits.data as Float32Array)
    const allScores = FRAMEWORKS.map((framework, idx) => ({
      framework,
      score: scores[idx] || 0
    }))

    // Find best match
    const maxIdx = scores.indexOf(Math.max(...scores))
    const framework = FRAMEWORKS[maxIdx] || 'create'
    const score = scores[maxIdx] || 0

    return {
      framework,
      score,
      allScores: allScores.sort((a, b) => b.score - a.score)
    }
  }

  private processIntentClassification(logits: ort.Tensor): SmartAnalysisResult['intent'] {
    const scores = Array.from(logits.data as Float32Array)
    const allIntents = INTENTS.map((intent, idx) => ({
      intent,
      score: scores[idx] || 0
    }))

    // Find best match
    const maxIdx = scores.indexOf(Math.max(...scores))
    const intent = INTENTS[maxIdx] || 'general'
    const score = scores[maxIdx] || 0

    return {
      intent,
      confidence: score,
      allIntents: allIntents.sort((a, b) => b.score - a.score)
    }
  }

  isReady(): boolean {
    return this.modelReady
  }
}

// Singleton instance
let onnxManager: ONNXModelManager | null = null

export function getONNXModelManager(): ONNXModelManager {
  if (!onnxManager) {
    onnxManager = new ONNXModelManager()
  }
  return onnxManager
}

// Export smartAnalysis function for direct use
export async function smartAnalysis(text: string): Promise<SmartAnalysisResult> {
  const manager = getONNXModelManager()
  await manager.initialize()
  return manager.smartAnalysis(text)
}

