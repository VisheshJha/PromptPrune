/**
 * Meta Llama token counting
 * Uses approximation based on character count
 */

export interface TokenCount {
  count: number
  model: string
}

/**
 * Count tokens for Llama models
 * Llama uses SentencePiece tokenization, we approximate
 */
export async function countLlamaTokens(
  text: string,
  model: string = "llama-3-70b"
): Promise<number> {
  try {
    // Use dynamic import to handle potential bundling issues
    const tiktoken = await import("js-tiktoken")
    
    // Llama uses SentencePiece, approximate with cl100k_base (close enough)
    const encoding = tiktoken.get_encoding("cl100k_base")
    const tokens = encoding.encode(text)
    // Llama tokenization is slightly different, adjust by ~5%
    return Math.round(tokens.length * 1.05)
  } catch (error) {
    console.error("Error counting Llama tokens:", error)
    return Math.ceil(text.length / 4)
  }
}

/**
 * Get token counts for multiple Llama models
 */
export async function getLlamaTokenCounts(text: string): Promise<TokenCount[]> {
  const models = ["llama-3-70b", "llama-3-8b", "llama-2-70b", "codellama-34b"]
  const counts = await Promise.all(
    models.map(async (model) => ({
      count: await countLlamaTokens(text, model),
      model,
    }))
  )
  return counts
}

