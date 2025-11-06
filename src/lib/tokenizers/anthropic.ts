import { get_encoding } from "js-tiktoken"

export interface TokenCount {
  count: number
  model: string
}

/**
 * Count tokens for Anthropic Claude models
 * Note: Anthropic uses a different tokenizer, but we can approximate with tiktoken
 * For more accuracy, you'd need @anthropic-ai/tokenizer, but that's not available in browser
 */
export async function countAnthropicTokens(
  text: string,
  model: string = "claude-3-opus"
): Promise<number> {
  try {
    // Anthropic models use a similar tokenizer to GPT-3.5
    // This is an approximation - for production, consider using Anthropic's tokenizer
    const encoding = get_encoding("cl100k_base")
    const tokens = encoding.encode(text)
    const count = tokens.length
    
    // Anthropic tokens are roughly 1.1x OpenAI tokens based on common benchmarks
    return Math.ceil(count * 1.1)
  } catch (error) {
    console.error("Error counting Anthropic tokens:", error)
    // Fallback: rough estimate
    return Math.ceil(text.length / 3.5)
  }
}

/**
 * Get token counts for multiple Anthropic models
 */
export async function getAnthropicTokenCounts(text: string): Promise<TokenCount[]> {
  const models = ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"]
  const counts = await Promise.all(
    models.map(async (model) => ({
      count: await countAnthropicTokens(text, model),
      model,
    }))
  )
  return counts
}

