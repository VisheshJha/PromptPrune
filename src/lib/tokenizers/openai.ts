export interface TokenCount {
  count: number
  model: string
}

/**
 * Count tokens for OpenAI models (GPT-4, GPT-3.5, etc.)
 */
export async function countOpenAITokens(
  text: string,
  model: string = "gpt-4"
): Promise<number> {
  try {
    // Use dynamic import to handle potential bundling issues
    const tiktoken = await import("js-tiktoken")
    
    // Map model names to tiktoken encodings
    const modelMap: Record<string, string> = {
      "gpt-4": "gpt-4",
      "gpt-4-turbo": "gpt-4",
      "gpt-3.5-turbo": "gpt-3.5-turbo",
      "gpt-3.5": "gpt-3.5-turbo",
    }

    const encodingModel = modelMap[model] || "gpt-4"
    let encoding
    try {
      encoding = tiktoken.encoding_for_model(encodingModel as any)
    } catch {
      // Fallback to cl100k_base encoding if model not found
      encoding = tiktoken.get_encoding("cl100k_base")
    }
    
    const tokens = encoding.encode(text)
    const count = tokens.length
    return count
  } catch (error) {
    console.error("Error counting OpenAI tokens:", error)
    // Fallback: rough estimate (1 token ≈ 4 characters)
    return Math.ceil(text.length / 4)
  }
}

/**
 * Get token counts for multiple OpenAI models
 */
export async function getOpenAITokenCounts(text: string): Promise<TokenCount[]> {
  const models = ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"]
  const counts = await Promise.all(
    models.map(async (model) => ({
      count: await countOpenAITokens(text, model),
      model,
    }))
  )
  return counts
}

