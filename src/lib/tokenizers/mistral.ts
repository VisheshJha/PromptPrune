/**
 * Mistral AI token counting
 * Uses approximation based on character count
 */

import { get_encoding } from "js-tiktoken"

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
    // Mistral uses similar tokenization, approximate with cl100k_base
    const encoding = get_encoding("cl100k_base")
    const tokens = encoding.encode(text)
    return tokens.length
  } catch (error) {
    console.error("Error counting Mistral tokens:", error)
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

