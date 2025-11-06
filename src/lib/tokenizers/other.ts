/**
 * Token counting for other providers (Groq, Perplexity, Together AI, Fireworks, Azure, Bedrock)
 * Uses approximation based on character count
 */

import { get_encoding } from "js-tiktoken"

export interface TokenCount {
  count: number
  model: string
}

/**
 * Count tokens for other provider models
 * Uses approximation with cl100k_base encoding
 */
export async function countOtherProviderTokens(
  text: string,
  model: string
): Promise<number> {
  try {
    // Most providers use similar tokenization, approximate with cl100k_base
    const encoding = get_encoding("cl100k_base")
    const tokens = encoding.encode(text)
    return tokens.length
  } catch (error) {
    console.error("Error counting tokens:", error)
    return Math.ceil(text.length / 4)
  }
}

/**
 * Get token counts for Groq models
 */
export async function getGroqTokenCounts(text: string): Promise<TokenCount[]> {
  const models = ["llama-3-70b", "mixtral-8x7b", "gemma-7b"]
  const counts = await Promise.all(
    models.map(async (model) => ({
      count: await countOtherProviderTokens(text, model),
      model,
    }))
  )
  return counts
}

/**
 * Get token counts for Perplexity models
 */
export async function getPerplexityTokenCounts(text: string): Promise<TokenCount[]> {
  const models = ["sonar", "sonar-pro"]
  const counts = await Promise.all(
    models.map(async (model) => ({
      count: await countOtherProviderTokens(text, model),
      model,
    }))
  )
  return counts
}

/**
 * Get token counts for Together AI models
 */
export async function getTogetherTokenCounts(text: string): Promise<TokenCount[]> {
  const models = ["llama-2-70b", "mistral-7b", "mixtral-8x7b"]
  const counts = await Promise.all(
    models.map(async (model) => ({
      count: await countOtherProviderTokens(text, model),
      model,
    }))
  )
  return counts
}

/**
 * Get token counts for Fireworks AI models
 */
export async function getFireworksTokenCounts(text: string): Promise<TokenCount[]> {
  const models = ["llama-3-70b", "mixtral-8x7b"]
  const counts = await Promise.all(
    models.map(async (model) => ({
      count: await countOtherProviderTokens(text, model),
      model,
    }))
  )
  return counts
}

/**
 * Get token counts for Azure OpenAI models (same as OpenAI)
 */
export async function getAzureTokenCounts(text: string): Promise<TokenCount[]> {
  // Azure uses same models as OpenAI, reuse OpenAI tokenizer
  const { getOpenAITokenCounts } = await import("./openai")
  return getOpenAITokenCounts(text)
}

/**
 * Get token counts for AWS Bedrock models
 */
export async function getBedrockTokenCounts(text: string): Promise<TokenCount[]> {
  // Bedrock hosts multiple providers, use appropriate tokenizers
  const models = [
    { name: "claude-3-opus", provider: "anthropic" },
    { name: "claude-3-sonnet", provider: "anthropic" },
    { name: "llama-2-70b", provider: "llama" },
    { name: "mistral-7b", provider: "mistral" },
  ]
  
  const counts = await Promise.all(
    models.map(async ({ name, provider }) => {
      let count: number
      if (provider === "anthropic") {
        const { countAnthropicTokens } = await import("./anthropic")
        count = await countAnthropicTokens(text, name)
      } else if (provider === "llama") {
        const { countLlamaTokens } = await import("./llama")
        count = await countLlamaTokens(text, name)
      } else {
        const { countMistralTokens } = await import("./mistral")
        count = await countMistralTokens(text, name)
      }
      return { count, model: name }
    })
  )
  
  return counts
}

