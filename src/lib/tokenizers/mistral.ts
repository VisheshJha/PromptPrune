/**
 * Mistral AI token counting
 * Uses approximation based on character count
 */

export interface TokenCount {
  count: number
  model: string
}

/**
 * Count tokens for Mistral models
 * Mistral uses similar tokenization, we approximate with cl100k_base
 */
export async function countMistralTokens(
  text: string,
  model: string = "mistral-large"
): Promise<number> {
  try {
    // Use dynamic import to handle potential bundling issues
    const tiktoken = await import("js-tiktoken").catch(() => {
      throw new Error("js-tiktoken not available")
    })
    
    if (!tiktoken || typeof tiktoken.get_encoding !== 'function') {
      throw new Error("tiktoken methods not available")
    }
    
    // Mistral uses similar tokenization, approximate with cl100k_base
    const encoding = tiktoken.get_encoding("cl100k_base")
    if (!encoding || typeof encoding.encode !== 'function') {
      throw new Error("Encoding not valid")
    }
    
    const tokens = encoding.encode(text)
    return tokens.length
  } catch (error) {
    // Fallback to character-based estimation (silent)
    return Math.ceil(text.length / 4)
  }
}

/**
 * Get token counts for multiple Mistral models
 */
export async function getMistralTokenCounts(text: string): Promise<TokenCount[]> {
  const models = ["mistral-large", "mistral-medium", "mixtral-8x7b", "mistral-7b"]
  const counts = await Promise.all(
    models.map(async (model) => ({
      count: await countMistralTokens(text, model),
      model,
    }))
  )
  return counts
}

