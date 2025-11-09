import { getOpenAITokenCounts, countOpenAITokens } from "./openai"
import { getAnthropicTokenCounts, countAnthropicTokens } from "./anthropic"
import { getGeminiTokenCounts, countGeminiTokens } from "./gemini"
import { getCohereTokenCounts } from "./cohere"
import { getMistralTokenCounts } from "./mistral"
import { getLlamaTokenCounts } from "./llama"
import { 
  getGroqTokenCounts, 
  getPerplexityTokenCounts, 
  getTogetherTokenCounts, 
  getFireworksTokenCounts,
  getAzureTokenCounts,
  getBedrockTokenCounts,
  getGrokTokenCounts,
  getDeepseekTokenCounts,
  getCopilotTokenCounts,
  getManusTokenCounts,
  getMidjourneyTokenCounts
} from "./other"

export type Provider = 
  | "openai" 
  | "anthropic" 
  | "gemini" 
  | "cohere" 
  | "mistral" 
  | "llama" 
  | "groq" 
  | "perplexity" 
  | "together" 
  | "fireworks" 
  | "azure" 
  | "bedrock"
  | "grok"
  | "deepseek"
  | "copilot"
  | "manus"
  | "midjourney"

export interface TokenCount {
  count: number
  model: string
  provider: Provider
}

export interface AllTokenCounts {
  openai: TokenCount[]
  anthropic: TokenCount[]
  gemini: TokenCount[]
  cohere: TokenCount[]
  mistral: TokenCount[]
  llama: TokenCount[]
  groq: TokenCount[]
  perplexity: TokenCount[]
  together: TokenCount[]
  fireworks: TokenCount[]
  azure: TokenCount[]
  bedrock: TokenCount[]
  grok?: TokenCount[]
  deepseek?: TokenCount[]
  copilot?: TokenCount[]
  manus?: TokenCount[]
  midjourney?: TokenCount[]
}

/**
 * Get token counts for all providers
 */
export async function getAllTokenCounts(text: string): Promise<AllTokenCounts> {
  const [
    openai,
    anthropic,
    gemini,
    cohere,
    mistral,
    llama,
    groq,
    perplexity,
    together,
    fireworks,
    azure,
    bedrock,
    grok,
    deepseek,
    copilot,
    manus,
    midjourney,
  ] = await Promise.all([
    getOpenAITokenCounts(text).then((counts) =>
      counts.map((c) => ({ ...c, provider: "openai" as const }))
    ),
    getAnthropicTokenCounts(text).then((counts) =>
      counts.map((c) => ({ ...c, provider: "anthropic" as const }))
    ),
    getGeminiTokenCounts(text).then((counts) =>
      counts.map((c) => ({ ...c, provider: "gemini" as const }))
    ),
    getCohereTokenCounts(text).then((counts) =>
      counts.map((c) => ({ ...c, provider: "cohere" as const }))
    ),
    getMistralTokenCounts(text).then((counts) =>
      counts.map((c) => ({ ...c, provider: "mistral" as const }))
    ),
    getLlamaTokenCounts(text).then((counts) =>
      counts.map((c) => ({ ...c, provider: "llama" as const }))
    ),
    getGroqTokenCounts(text).then((counts) =>
      counts.map((c) => ({ ...c, provider: "groq" as const }))
    ),
    getPerplexityTokenCounts(text).then((counts) =>
      counts.map((c) => ({ ...c, provider: "perplexity" as const }))
    ),
    getTogetherTokenCounts(text).then((counts) =>
      counts.map((c) => ({ ...c, provider: "together" as const }))
    ),
    getFireworksTokenCounts(text).then((counts) =>
      counts.map((c) => ({ ...c, provider: "fireworks" as const }))
    ),
    getAzureTokenCounts(text).then((counts) =>
      counts.map((c) => ({ ...c, provider: "azure" as const }))
    ),
    getBedrockTokenCounts(text).then((counts) =>
      counts.map((c) => ({ ...c, provider: "bedrock" as const }))
    ),
    getGrokTokenCounts(text).then((counts) =>
      counts.map((c) => ({ ...c, provider: "grok" as const }))
    ).catch(() => []),
    getDeepseekTokenCounts(text).then((counts) =>
      counts.map((c) => ({ ...c, provider: "deepseek" as const }))
    ).catch(() => []),
    getCopilotTokenCounts(text).then((counts) =>
      counts.map((c) => ({ ...c, provider: "copilot" as const }))
    ).catch(() => []),
    getManusTokenCounts(text).then((counts) =>
      counts.map((c) => ({ ...c, provider: "manus" as const }))
    ).catch(() => []),
    getMidjourneyTokenCounts(text).then((counts) =>
      counts.map((c) => ({ ...c, provider: "midjourney" as const }))
    ).catch(() => []),
  ])

  return {
    openai,
    anthropic,
    gemini,
    cohere,
    mistral,
    llama,
    groq,
    perplexity,
    together,
    fireworks,
    azure,
    bedrock,
    grok,
    deepseek,
    copilot,
    manus,
    midjourney,
  }
}

/**
 * Get average token count across all models
 */
export function getAverageTokenCount(counts: AllTokenCounts): number {
  const allCounts = [
    ...counts.openai,
    ...counts.anthropic,
    ...counts.gemini,
    ...counts.cohere,
    ...counts.mistral,
    ...counts.llama,
    ...counts.groq,
    ...counts.perplexity,
    ...counts.together,
    ...counts.fireworks,
    ...counts.azure,
    ...counts.bedrock,
    ...(counts.grok || []),
    ...(counts.deepseek || []),
    ...(counts.copilot || []),
    ...(counts.manus || []),
    ...(counts.midjourney || []),
  ].map((c) => c.count)

  if (allCounts.length === 0) return 0
  return Math.round(
    allCounts.reduce((sum, count) => sum + count, 0) / allCounts.length
  )
}

export { countOpenAITokens, countAnthropicTokens, countGeminiTokens }

