/**
 * Cohere token counting
 * Uses approximation based on character count (Cohere uses similar tokenization to GPT)
 */

export interface TokenCount {
  count: number
  model: string
}

/**
 * Count tokens for Cohere models
 * Cohere uses similar tokenization to OpenAI, so we use cl100k_base encoding
 */
export async function countCohereTokens(
  text: string,
  model: string = "command-r"
): Promise<number> {
  try {
    // Use dynamic import to handle potential bundling issues
    const tiktoken = await import("js-tiktoken")
    
    // Cohere models use similar tokenization to GPT
    const encoding = tiktoken.get_encoding("cl100k_base")
    const tokens = encoding.encode(text)
    return tokens.length
  } catch (error) {
    console.error("Error counting Cohere tokens:", error)
    // Fallback: rough estimate
    return Math.ceil(text.length / 4)
  }
}

/**
 * Get token counts for multiple Cohere models
 */
export async function getCohereTokenCounts(text: string): Promise<TokenCount[]> {
  const models = ["command-r", "command-r-plus", "command"]
  const counts = await Promise.all(
    models.map(async (model) => ({
      count: await countCohereTokens(text, model),
      model,
    }))
  )
  return counts
}

