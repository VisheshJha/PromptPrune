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
    // Use dynamic import to handle potential bundling issues
    const tiktoken = await import("js-tiktoken").catch(() => {
      throw new Error("js-tiktoken not available")
    })
    
    if (!tiktoken || typeof tiktoken.get_encoding !== 'function') {
      throw new Error("tiktoken methods not available")
    }
    
    // Gemini tokenizer is similar to GPT-3.5, but slightly different
    // This is an approximation
    const encoding = tiktoken.get_encoding("cl100k_base")
    if (!encoding || typeof encoding.encode !== 'function') {
      throw new Error("Encoding not valid")
    }
    
    const tokens = encoding.encode(text)
    const count = tokens.length
    
    // Gemini tokens are roughly 0.95x OpenAI tokens
    return Math.ceil(count * 0.95)
  } catch (error) {
    // Fallback to character-based estimation (silent)
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

