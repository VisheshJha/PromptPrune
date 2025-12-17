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
    const tiktoken = await import("js-tiktoken").catch(() => {
      // If import fails, return fallback
      throw new Error("js-tiktoken not available")
    })
    
    // Check if tiktoken has required methods
    if (!tiktoken || typeof tiktoken.encoding_for_model !== 'function' && typeof tiktoken.get_encoding !== 'function') {
      throw new Error("tiktoken methods not available")
    }
    
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
      if (typeof tiktoken.encoding_for_model === 'function') {
        encoding = tiktoken.encoding_for_model(encodingModel as any)
      } else {
        encoding = tiktoken.get_encoding("cl100k_base")
      }
    } catch {
      // Fallback to cl100k_base encoding if model not found
      if (typeof tiktoken.get_encoding === 'function') {
        encoding = tiktoken.get_encoding("cl100k_base")
      } else {
        throw new Error("No encoding method available")
      }
    }
    
    if (!encoding || typeof encoding.encode !== 'function') {
      throw new Error("Encoding not valid")
    }
    
    const tokens = encoding.encode(text)
    const count = tokens.length
    return count
  } catch (error) {
    // Fallback to character-based estimation (silent)
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

