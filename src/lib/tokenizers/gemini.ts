import { get_encoding } from "js-tiktoken"

export interface TokenCount {
  count: number
  model: string
}

/**
 * Count tokens for Google Gemini models
 * Note: Gemini uses SentencePiece tokenizer, but we approximate with tiktoken
 */
export async function countGeminiTokens(
  text: string,
  model: string = "gemini-pro"
): Promise<number> {
  try {
    // Gemini tokenizer is similar to GPT-3.5, but slightly different
    // This is an approximation
    const encoding = get_encoding("cl100k_base")
    const tokens = encoding.encode(text)
    const count = tokens.length
    
    // Gemini tokens are roughly 0.95x OpenAI tokens
    return Math.ceil(count * 0.95)
  } catch (error) {
    console.error("Error counting Gemini tokens:", error)
    // Fallback: rough estimate
    return Math.ceil(text.length / 4.2)
  }
}

/**
 * Get token counts for multiple Gemini models
 */
export async function getGeminiTokenCounts(text: string): Promise<TokenCount[]> {
  const models = ["gemini-pro", "gemini-pro-vision", "gemini-ultra"]
  const counts = await Promise.all(
    models.map(async (model) => ({
      count: await countGeminiTokens(text, model),
      model,
    }))
  )
  return counts
}

