/**
 * Model Worker
 * Runs model inference in a Web Worker to prevent UI blocking
 */

// MUST import transformers config FIRST before importing transformers
// Note: In workers, we need to use a relative path from the worker location
// The worker is in src/workers/, so we need to go up one level to access src/lib/
import '../lib/transformers-config'

import { pipeline, Pipeline, env } from '@xenova/transformers'

// Worker context
let model: Pipeline | null = null
let modelReady = false
const MODEL_ID = 'Xenova/distilbert-base-uncased-finetuned-sst-2-english'

// Message handler
self.addEventListener('message', async (event: MessageEvent) => {
  const { type, payload } = event.data

  try {
    switch (type) {
      case 'INIT_MODEL':
        await initializeModel()
        self.postMessage({ type: 'MODEL_READY', success: modelReady })
        break

      case 'CLASSIFY_INTENT':
        if (!modelReady) {
          await initializeModel()
        }
        const intentResult = await classifyIntent(payload.text)
        self.postMessage({ type: 'INTENT_RESULT', payload: intentResult })
        break

      case 'MATCH_FRAMEWORK':
        if (!modelReady) {
          await initializeModel()
        }
        const frameworkResult = await matchFramework(payload.text)
        self.postMessage({ type: 'FRAMEWORK_RESULT', payload: frameworkResult })
        break

      case 'DETECT_SENSITIVE':
        if (!modelReady) {
          await initializeModel()
        }
        const sensitiveResult = await detectSensitive(payload.text)
        self.postMessage({ type: 'SENSITIVE_RESULT', payload: sensitiveResult })
        break

      case 'SPELL_CHECK':
        if (!modelReady) {
          await initializeModel()
        }
        const spellResult = await spellCheck(payload.text)
        self.postMessage({ type: 'SPELL_RESULT', payload: spellResult })
        break

      default:
        self.postMessage({ type: 'ERROR', error: `Unknown message type: ${type}` })
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
      originalType: type
    })
  }
})

async function initializeModel(): Promise<void> {
  if (modelReady && model) return

  // Try quantized first, then fallback to non-quantized
  try {
    console.log('[ModelWorker] Attempting to load quantized model...')
    model = await pipeline('text-classification', MODEL_ID, {
      quantized: true,
      device: 'cpu'
    })
    console.log('[ModelWorker] ✅ Quantized model loaded successfully')
    modelReady = true
  } catch (error: any) {
    console.warn('[ModelWorker] ⚠️ Quantized model failed, trying non-quantized...', error.message)
    try {
      console.log('[ModelWorker] Attempting to load non-quantized model (model.onnx)...')
      model = await pipeline('text-classification', MODEL_ID, {
        quantized: false, // Use model.onnx instead
        device: 'cpu'
      })
      console.log('[ModelWorker] ✅ Non-quantized model loaded successfully')
      modelReady = true
    } catch (fallbackError) {
      console.error('[ModelWorker] ❌ Both quantized and non-quantized model loading failed')
      console.error('[ModelWorker] Quantized error:', error)
      console.error('[ModelWorker] Non-quantized error:', fallbackError)
      modelReady = false
      throw fallbackError
    }
  }
}

async function classifyIntent(text: string): Promise<any> {
  if (!model) throw new Error('Model not initialized')

  const result = await model(text, { topk: 8 })
  
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

  let predictions: Array<{ label: string; score: number }> = []
  
  if (Array.isArray(result)) {
    predictions = result
  } else if (result.labels && result.scores) {
    predictions = result.labels.map((label: string, i: number) => ({
      label,
      score: result.scores[i]
    }))
  }

  const allIntents = INTENTS.map((intent, index) => {
    const match = predictions.find(p => 
      p.label.toLowerCase() === intent.toLowerCase() ||
      p.label === intent ||
      p.label === index.toString()
    )
    return {
      intent,
      score: match?.score || (predictions[index]?.score || 0)
    }
  }).sort((a, b) => b.score - a.score)

  return {
    intent: allIntents[0].intent,
    confidence: allIntents[0].score,
    allIntents
  }
}

async function matchFramework(text: string): Promise<any> {
  if (!model) throw new Error('Model not initialized')

  const result = await model(text, { topk: 8 })
  
  const FRAMEWORKS = ['cot', 'tot', 'ape', 'race', 'roses', 'guide', 'smart', 'create']

  let predictions: Array<{ label: string; score: number }> = []
  
  if (Array.isArray(result)) {
    predictions = result
  } else if (result.labels && result.scores) {
    predictions = result.labels.map((label: string, i: number) => ({
      label,
      score: result.scores[i]
    }))
  }

  const allScores = FRAMEWORKS.map((framework, index) => {
    const match = predictions.find(p => 
      p.label.toLowerCase() === framework.toLowerCase() || 
      p.label === framework ||
      p.label === index.toString()
    )
    return {
      framework,
      score: match?.score || (predictions[index]?.score || 0)
    }
  }).sort((a, b) => b.score - a.score)

  return {
    framework: allScores[0].framework,
    score: allScores[0].score,
    allScores
  }
}

async function detectSensitive(text: string): Promise<any> {
  if (!model) throw new Error('Model not initialized')

  const result = await model(text)

  let label = ''
  let scores: number[] = []
  
  if (Array.isArray(result)) {
    label = result[0]?.label || ''
    scores = result.map((r: any) => r.score || 0)
  } else if (result.label && result.score) {
    label = result.label
    scores = [result.score]
  } else if (result.labels && result.scores) {
    label = result.labels[0] || ''
    scores = result.scores
  }

  const isSensitive = 
    label.toLowerCase().includes('sensitive') || 
    label === '1' ||
    (scores.length > 1 && scores[1] > 0.5)

  const confidence = isSensitive 
    ? (scores.length > 1 ? scores[1] : scores[0] || 0.5)
    : (scores[0] || 0.5)

  return {
    isSensitive,
    confidence,
    type: isSensitive ? 'pii' : undefined
  }
}

async function spellCheck(text: string): Promise<any> {
  // Token-level spell checking would go here
  // For now, return placeholder
  return {
    corrected: text,
    corrections: []
  }
}


