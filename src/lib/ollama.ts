/**
 * Ollama client for local ML-based prompt optimization
 * Uses TinyLlama 1.1B model running locally via Ollama
 */

export interface OllamaOptimizeRequest {
  prompt: string
  model?: string
  maxLength?: number
}

export interface OllamaOptimizeResponse {
  optimized: string
  originalLength: number
  optimizedLength: number
  reduction: number
}

const DEFAULT_OLLAMA_URL = "http://localhost:11434"
const DEFAULT_MODEL = "tinyllama:1.1b"

/**
 * Check if Ollama is available
 */
export async function checkOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${DEFAULT_OLLAMA_URL}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(2000), // 2 second timeout
    })
    return response.ok
  } catch (error) {
    return false
  }
}

/**
 * Ensure TinyLlama model is available
 */
export async function ensureModelAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${DEFAULT_OLLAMA_URL}/api/tags`)
    const data = await response.json()
    const models = data.models || []
    return models.some((m: any) => m.name.startsWith("tinyllama"))
  } catch (error) {
    return false
  }
}

/**
 * Optimize prompt using Ollama + TinyLlama
 */
export async function optimizeWithOllama(
  request: OllamaOptimizeRequest
): Promise<OllamaOptimizeResponse> {
  const { prompt, model = DEFAULT_MODEL, maxLength } = request

  try {
    // Check if Ollama is available
    const isAvailable = await checkOllamaAvailable()
    if (!isAvailable) {
      throw new Error("Ollama is not available. Please start Ollama and ensure TinyLlama is installed.")
    }

    // Create optimization prompt
    const systemPrompt = `You are a prompt optimization assistant. Your task is to rewrite the given prompt to be more concise while preserving all essential information and meaning. Remove redundancy, unnecessary words, and verbose phrasing. Keep the core intent and requirements intact.

Original prompt: "${prompt}"

Optimized prompt:`

    // Call Ollama API
    const response = await fetch(`${DEFAULT_OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: systemPrompt,
        stream: false,
        options: {
          temperature: 0.3, // Lower temperature for more consistent results
          top_p: 0.9,
          num_predict: maxLength || Math.ceil(prompt.length * 0.7), // Target 30% reduction
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`)
    }

    const data = await response.json()
    const optimized = data.response?.trim() || prompt

    const originalLength = prompt.length
    const optimizedLength = optimized.length
    const reduction = originalLength - optimizedLength

    return {
      optimized,
      originalLength,
      optimizedLength,
      reduction,
    }
  } catch (error) {
    console.error("Ollama optimization error:", error)
    throw error
  }
}

/**
 * Get Ollama model info
 */
export async function getOllamaModelInfo(): Promise<{
  available: boolean
  model?: string
  models?: string[]
}> {
  try {
    const isAvailable = await checkOllamaAvailable()
    if (!isAvailable) {
      return { available: false }
    }

    const response = await fetch(`${DEFAULT_OLLAMA_URL}/api/tags`)
    const data = await response.json()
    const models = (data.models || []).map((m: any) => m.name)

    return {
      available: true,
      models,
      model: models.find((m: string) => m.startsWith("tinyllama")) || models[0],
    }
  } catch (error) {
    return { available: false }
  }
}

