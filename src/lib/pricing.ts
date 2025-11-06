/**
 * AI Model Pricing Configuration
 * 
 * Pricing Information:
 * - All prices are in USD per 1 million tokens
 * - Prices shown are for input tokens unless otherwise specified
 * - Output tokens typically cost 2-5x more than input tokens
 * - Pricing is based on official provider documentation and public APIs
 * - Prices are updated regularly but may change without notice
 * 
 * Important Notes:
 * - Actual costs may vary based on:
 *   • Geographic region (some providers have regional pricing)
 *   • Volume discounts (enterprise customers often get better rates)
 *   • API tier/plan (free tier vs paid tier pricing differs)
 *   • Time of access (prices can change monthly/quarterly)
 *   • Special promotions or beta pricing
 * 
 * - When exact model pricing is unavailable, we use:
 *   • Average pricing for that provider's model family
 *   • Similar model pricing as a reference
 *   • Industry-standard estimates
 * 
 * - These calculations are estimates for comparison purposes only
 * - Always verify current pricing with the provider before making decisions
 * - Some providers offer free tiers or credits that affect actual costs
 * 
 * Last updated: December 2024
 * Data sources: Official provider pricing pages, API documentation, public announcements
 */

export interface ModelPricing {
  input: number // $ per 1M input tokens
  output: number // $ per 1M output tokens
  source?: string // Where pricing comes from
  note?: string // Additional notes
}

export interface ProviderPricing {
  name: string
  models: Record<string, ModelPricing>
  averageInput?: number // Average for models without specific pricing
  averageOutput?: number
}

/**
 * Pricing data for all providers
 */
export const PRICING_DATA: Record<string, ProviderPricing> = {
  openai: {
    name: "OpenAI",
    models: {
      "gpt-4": { 
        input: 30, 
        output: 60, 
        source: "OpenAI Official Pricing (Dec 2024)",
        note: "GPT-4 standard model, premium pricing for highest quality"
      },
      "gpt-4-turbo": { 
        input: 10, 
        output: 30, 
        source: "OpenAI Official Pricing (Dec 2024)",
        note: "GPT-4 Turbo, faster and more cost-effective than GPT-4"
      },
      "gpt-4o": { 
        input: 5, 
        output: 15, 
        source: "OpenAI Official Pricing (Dec 2024)",
        note: "GPT-4o (optimized), latest model with best price/performance"
      },
      "gpt-3.5-turbo": { 
        input: 0.5, 
        output: 1.5, 
        source: "OpenAI Official Pricing (Dec 2024)",
        note: "Most cost-effective option, good for high-volume use"
      },
      "gpt-3.5": { 
        input: 0.5, 
        output: 1.5, 
        source: "OpenAI Official Pricing (Dec 2024)",
        note: "Legacy GPT-3.5 model, same pricing as turbo variant"
      },
    },
    averageInput: 9.1,
    averageOutput: 21.3,
  },
  anthropic: {
    name: "Anthropic",
    models: {
      "claude-3-opus": { 
        input: 15, 
        output: 75, 
        source: "Anthropic Official Pricing (Dec 2024)",
        note: "Most capable Claude model, premium pricing for complex tasks"
      },
      "claude-3-sonnet": { 
        input: 3, 
        output: 15, 
        source: "Anthropic Official Pricing (Dec 2024)",
        note: "Balanced performance and cost, recommended for most use cases"
      },
      "claude-3-haiku": { 
        input: 0.25, 
        output: 1.25, 
        source: "Anthropic Official Pricing (Dec 2024)",
        note: "Fastest and most affordable Claude model, great for simple tasks"
      },
      "claude-3-5-sonnet": { 
        input: 3, 
        output: 15, 
        source: "Anthropic Official Pricing (Dec 2024)",
        note: "Latest Sonnet variant with improved performance, same pricing"
      },
    },
    averageInput: 5.3,
    averageOutput: 26.6,
  },
  gemini: {
    name: "Google",
    models: {
      "gemini-pro": { input: 0.5, output: 1.5, source: "Google Pricing" },
      "gemini-pro-vision": { input: 0.5, output: 1.5, source: "Google Pricing" },
      "gemini-ultra": { input: 1.25, output: 5, source: "Google Pricing" },
      "gemini-1.5-pro": { input: 1.25, output: 5, source: "Google Pricing" },
    },
    averageInput: 0.875,
    averageOutput: 3.25,
  },
  cohere: {
    name: "Cohere",
    models: {
      "command-r": { input: 0.5, output: 1.5, source: "Cohere Pricing" },
      "command-r-plus": { input: 3, output: 15, source: "Cohere Pricing" },
      "command": { input: 1, output: 2, source: "Cohere Pricing" },
    },
    averageInput: 1.5,
    averageOutput: 6.2,
  },
  mistral: {
    name: "Mistral AI",
    models: {
      "mistral-large": { input: 8, output: 24, source: "Mistral Pricing" },
      "mistral-medium": { input: 2.7, output: 8.1, source: "Mistral Pricing" },
      "mixtral-8x7b": { input: 0.24, output: 0.24, source: "Mistral Pricing" },
      "mistral-7b": { input: 0.1, output: 0.1, source: "Mistral Pricing" },
    },
    averageInput: 2.76,
    averageOutput: 8.11,
  },
  llama: {
    name: "Meta Llama",
    models: {
      "llama-3-70b": { input: 0.65, output: 0.65, source: "Meta Pricing" },
      "llama-3-8b": { input: 0.05, output: 0.05, source: "Meta Pricing" },
      "llama-2-70b": { input: 0.65, output: 0.65, source: "Meta Pricing" },
      "codellama-34b": { input: 0.35, output: 0.35, source: "Meta Pricing" },
    },
    averageInput: 0.4,
    averageOutput: 0.4,
  },
  groq: {
    name: "Groq",
    models: {
      "llama-3-70b": { input: 0.59, output: 0.79, source: "Groq Pricing" },
      "mixtral-8x7b": { input: 0.24, output: 0.24, source: "Groq Pricing" },
      "gemma-7b": { input: 0.07, output: 0.07, source: "Groq Pricing" },
    },
    averageInput: 0.3,
    averageOutput: 0.37,
  },
  perplexity: {
    name: "Perplexity AI",
    models: {
      "sonar": { input: 1, output: 1, source: "Perplexity Pricing (estimated)" },
      "sonar-pro": { input: 5, output: 5, source: "Perplexity Pricing (estimated)" },
    },
    averageInput: 3,
    averageOutput: 3,
  },
  together: {
    name: "Together AI",
    models: {
      "llama-2-70b": { input: 0.7, output: 0.9, source: "Together AI Pricing" },
      "mistral-7b": { input: 0.1, output: 0.1, source: "Together AI Pricing" },
      "mixtral-8x7b": { input: 0.6, output: 0.6, source: "Together AI Pricing" },
    },
    averageInput: 0.47,
    averageOutput: 0.53,
  },
  fireworks: {
    name: "Fireworks AI",
    models: {
      "llama-3-70b": { input: 0.59, output: 0.79, source: "Fireworks Pricing" },
      "mixtral-8x7b": { input: 0.27, output: 0.27, source: "Fireworks Pricing" },
    },
    averageInput: 0.43,
    averageOutput: 0.53,
  },
  azure: {
    name: "Azure OpenAI",
    models: {
      "gpt-4": { input: 30, output: 60, source: "Azure Pricing (same as OpenAI)" },
      "gpt-4-turbo": { input: 10, output: 30, source: "Azure Pricing" },
      "gpt-3.5-turbo": { input: 0.5, output: 1.5, source: "Azure Pricing" },
    },
    averageInput: 13.5,
    averageOutput: 30.5,
  },
  bedrock: {
    name: "AWS Bedrock",
    models: {
      "claude-3-opus": { input: 15, output: 75, source: "AWS Bedrock Pricing" },
      "claude-3-sonnet": { input: 3, output: 15, source: "AWS Bedrock Pricing" },
      "llama-2-70b": { input: 1.05, output: 1.4, source: "AWS Bedrock Pricing" },
      "mistral-7b": { input: 0.15, output: 0.2, source: "AWS Bedrock Pricing" },
    },
    averageInput: 4.8,
    averageOutput: 22.9,
  },
}

/**
 * Get pricing for a specific model
 */
export function getModelPricing(
  provider: string,
  model: string
): ModelPricing | null {
  const providerData = PRICING_DATA[provider]
  if (!providerData) return null

  // Try exact match first
  if (providerData.models[model]) {
    return providerData.models[model]
  }

  // Fallback to average pricing
  if (providerData.averageInput && providerData.averageOutput) {
    return {
      input: providerData.averageInput,
      output: providerData.averageOutput,
      source: `${providerData.name} Average`,
      note: "Using average pricing for this provider",
    }
  }

  return null
}

/**
 * Get all providers
 */
export function getAllProviders(): string[] {
  return Object.keys(PRICING_DATA)
}

/**
 * Get provider info
 */
export function getProviderInfo(provider: string): ProviderPricing | null {
  return PRICING_DATA[provider] || null
}

/**
 * Calculate cost for tokens
 */
export function calculateCost(
  tokens: number,
  pricing: ModelPricing,
  isOutput: boolean = false
): number {
  const price = isOutput ? pricing.output : pricing.input
  return (tokens / 1_000_000) * price
}

/**
 * Get average pricing across all providers (for fallback)
 */
export function getAveragePricing(): ModelPricing {
  const allPrices = Object.values(PRICING_DATA)
    .flatMap((p) => Object.values(p.models))
  
  const avgInput = allPrices.reduce((sum, p) => sum + p.input, 0) / allPrices.length
  const avgOutput = allPrices.reduce((sum, p) => sum + p.output, 0) / allPrices.length

  return {
    input: avgInput,
    output: avgOutput,
    source: "Average across all providers",
    note: "Used when specific model pricing is unavailable",
  }
}

