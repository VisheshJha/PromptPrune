import { useEffect, useState } from "react"
import { getAllTokenCounts, type AllTokenCounts, type Provider } from "~/lib/tokenizers"
import { getModelPricing, getProviderInfo, calculateCost, getAveragePricing, type ProviderPricing } from "~/lib/pricing"

interface SavingsCalculatorProps {
  originalText: string
  optimizedText: string
}

interface Savings {
  model: string
  provider: Provider
  originalTokens: number
  optimizedTokens: number
  tokensSaved: number
  costPer1kRequests: number
  savingsPer1kRequests: number
  pricingSource?: string
  pricingNote?: string
}

const PROVIDER_NAMES: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google",
  cohere: "Cohere",
  mistral: "Mistral AI",
  llama: "Meta Llama",
  groq: "Groq",
  perplexity: "Perplexity AI",
  together: "Together AI",
  fireworks: "Fireworks AI",
  azure: "Azure OpenAI",
  bedrock: "AWS Bedrock",
}

export function SavingsCalculator({
  originalText,
  optimizedText,
}: SavingsCalculatorProps) {
  const [originalCounts, setOriginalCounts] = useState<AllTokenCounts | null>(null)
  const [optimizedCounts, setOptimizedCounts] = useState<AllTokenCounts | null>(null)
  const [loading, setLoading] = useState(false)
  const [requestsPerMonth, setRequestsPerMonth] = useState(1000)
  const [expandedProviders, setExpandedProviders] = useState<Set<Provider>>(new Set(["openai", "anthropic", "gemini"]))
  const [showPricingInfo, setShowPricingInfo] = useState(false)

  useEffect(() => {
    if (!originalText.trim() || !optimizedText.trim()) {
      return
    }

    setLoading(true)
    Promise.all([getAllTokenCounts(originalText), getAllTokenCounts(optimizedText)])
      .then(([original, optimized]) => {
        setOriginalCounts(original)
        setOptimizedCounts(optimized)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Error calculating savings:", err)
        setLoading(false)
      })
  }, [originalText, optimizedText])

  const toggleProvider = (provider: Provider) => {
    setExpandedProviders((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(provider)) {
        newSet.delete(provider)
      } else {
        newSet.add(provider)
      }
      return newSet
    })
  }

  if (!originalText.trim()) {
    return (
      <div className="backdrop-blur-md bg-white/60 border border-white/20 rounded-xl p-6 text-center shadow-lg">
        <div className="text-sm text-gray-500">
          Enter a prompt above to see cost savings
        </div>
      </div>
    )
  }

  if (!optimizedText.trim()) {
    return (
      <div className="backdrop-blur-md bg-white/60 border border-white/20 rounded-xl p-6 text-center shadow-lg">
        <div className="text-sm text-gray-500">
          Optimize your prompt first to see cost savings
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="backdrop-blur-md bg-white/60 border border-white/20 rounded-xl p-6 text-center shadow-lg">
        <div className="text-sm text-gray-500">Calculating savings...</div>
      </div>
    )
  }

  if (!originalCounts || !optimizedCounts) {
    return null
  }

  // Calculate savings for all models
  const allSavings: Savings[] = []
  const avgPricing = getAveragePricing()

  const processCounts = (
    counts: AllTokenCounts,
    type: "original" | "optimized"
  ) => {
    const providers: Provider[] = [
      "openai", "anthropic", "gemini", "cohere", "mistral", "llama",
      "groq", "perplexity", "together", "fireworks", "azure", "bedrock"
    ]

    providers.forEach((provider) => {
      const providerCounts = counts[provider] || []
      providerCounts.forEach((count) => {
        const pricing = getModelPricing(provider, count.model) || avgPricing
        
        const existing = allSavings.find(
          (s) => s.model === count.model && s.provider === provider
        )
        
        if (existing) {
          if (type === "original") {
            existing.originalTokens = count.count
          } else {
            existing.optimizedTokens = count.count
          }
        } else {
          allSavings.push({
            model: count.model,
            provider: provider,
            originalTokens: type === "original" ? count.count : 0,
            optimizedTokens: type === "optimized" ? count.count : 0,
            tokensSaved: 0,
            costPer1kRequests: 0,
            savingsPer1kRequests: 0,
            pricingSource: pricing.source,
            pricingNote: pricing.note,
          })
        }
      })
    })
  }

  processCounts(originalCounts, "original")
  processCounts(optimizedCounts, "optimized")

  // Calculate savings
  allSavings.forEach((saving) => {
    saving.tokensSaved = saving.originalTokens - saving.optimizedTokens
    const pricing = getModelPricing(saving.provider, saving.model) || avgPricing
    
    if (pricing) {
      const originalCost = calculateCost(saving.originalTokens, pricing, false) * requestsPerMonth
      const optimizedCost = calculateCost(saving.optimizedTokens, pricing, false) * requestsPerMonth
      saving.costPer1kRequests = originalCost
      saving.savingsPer1kRequests = originalCost - optimizedCost
    }
  })

  // Group by provider
  const savingsByProvider = new Map<Provider, Savings[]>()
  allSavings.forEach((saving) => {
    if (!savingsByProvider.has(saving.provider)) {
      savingsByProvider.set(saving.provider, [])
    }
    savingsByProvider.get(saving.provider)!.push(saving)
  })

  // Only calculate savings for models that actually saved tokens
  const positiveSavings = allSavings.filter((s) => s.tokensSaved > 0)
  const totalSavings = positiveSavings.reduce(
    (sum, s) => sum + s.savingsPer1kRequests,
    0
  )
  const avgSavings = positiveSavings.length > 0 ? totalSavings / positiveSavings.length : 0

  const renderProvider = (provider: Provider, savings: Savings[]) => {
    if (savings.length === 0) return null

    const isExpanded = expandedProviders.has(provider)
    const providerName = PROVIDER_NAMES[provider]
    const providerSavings = savings.reduce((sum, s) => sum + s.savingsPer1kRequests, 0)
    const providerInfo = getProviderInfo(provider)

    return (
      <div key={provider} className="backdrop-blur-md bg-white/70 border border-white/20 rounded-xl shadow-lg overflow-hidden">
        <button
          onClick={() => toggleProvider(provider)}
          className="w-full flex items-center justify-between p-3 hover:bg-white/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            <span className="text-xs font-semibold text-gray-700">{providerName}</span>
            <span className="text-xs text-gray-500">({savings.length} models)</span>
          </div>
          <div className="text-right">
            <span className={`text-sm font-bold ${
              providerSavings > 0 ? "text-green-600" : providerSavings < 0 ? "text-red-600" : "text-gray-600"
            }`}>
              ${Math.abs(providerSavings).toFixed(2)}
            </span>
            <div className="text-xs text-gray-500">
              {providerSavings > 0 ? "saved" : providerSavings < 0 ? "increase" : "no change"}
            </div>
          </div>
        </button>
        {isExpanded && (
          <div className="px-3 pb-3 space-y-2">
            {savings
              .filter((s) => s.originalTokens > 0 && s.optimizedTokens > 0)
              .sort((a, b) => Math.abs(b.savingsPer1kRequests) - Math.abs(a.savingsPer1kRequests))
              .map((saving) => {
                const pricing = getModelPricing(saving.provider, saving.model) || avgPricing
                return (
                  <div
                    key={`${saving.provider}-${saving.model}`}
                    className="backdrop-blur-sm bg-white/50 border border-white/10 rounded-lg p-2"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <div className="text-sm font-semibold text-gray-800">
                          {saving.model}
                        </div>
                        {saving.pricingSource && (
                          <div className="text-xs text-gray-500">
                            {saving.pricingSource}
                            {saving.pricingNote && ` (${saving.pricingNote})`}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${
                          saving.savingsPer1kRequests > 0 ? "text-green-600" : "text-red-600"
                        }`}>
                          ${Math.abs(saving.savingsPer1kRequests).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {saving.tokensSaved > 0 ? `${saving.tokensSaved} tokens saved` : `${Math.abs(saving.tokensSaved)} tokens added`}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">
                      {saving.originalTokens} → {saving.optimizedTokens} tokens
                    </div>
                    {pricing && (
                      <div className="text-xs text-gray-500 mt-1">
                        ${pricing.input.toFixed(2)}/1M input tokens
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Pricing Transparency Info */}
      <div className="backdrop-blur-md bg-blue-50/80 border border-blue-200/30 rounded-xl p-3 shadow-lg">
        <button
          onClick={() => setShowPricingInfo(!showPricingInfo)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-xs font-semibold text-blue-800">
              How are costs calculated?
            </span>
          </div>
          <svg
            className={`w-4 h-4 text-blue-600 transition-transform ${showPricingInfo ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        {showPricingInfo && (
          <div className="mt-2 text-xs text-blue-700 space-y-1">
            <p>
              • Costs are calculated using <strong>public pricing</strong> from each provider (as of 2024)
            </p>
            <p>
              • Prices shown are <strong>per 1 million tokens</strong> for input tokens
            </p>
            <p>
              • When exact model pricing is unavailable, we use <strong>average pricing</strong> for that provider
            </p>
            <p>
              • Actual costs may vary based on region, volume discounts, and pricing changes
            </p>
            <p className="text-blue-600 font-semibold mt-2">
              💡 All calculations are estimates for comparison purposes
            </p>
          </div>
        )}
      </div>

      {/* Requests per month input */}
      <div className="flex items-center justify-between backdrop-blur-md bg-white/70 border border-white/20 rounded-xl p-3 shadow-lg">
        <label className="text-sm font-medium text-gray-700">
          Requests per month:
        </label>
        <input
          type="number"
          min="1"
          value={requestsPerMonth}
          onChange={(e) => setRequestsPerMonth(Number(e.target.value))}
          className="w-24 px-2 py-1 text-sm border border-white/30 rounded-lg backdrop-blur-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        />
      </div>

      {/* Total savings */}
      <div className={`backdrop-blur-md text-white rounded-xl p-4 shadow-lg border border-white/20 ${
        avgSavings > 0 
          ? "bg-gradient-to-r from-green-500/90 to-green-600/90" 
          : "bg-gradient-to-r from-gray-400/90 to-gray-500/90"
      }`}>
        <div className="text-sm font-medium opacity-90">Estimated Monthly Savings</div>
        <div className="text-3xl font-bold">
          ${Math.abs(avgSavings).toFixed(2)}
        </div>
        <div className="text-xs opacity-90 mt-1">
          {positiveSavings.length > 0 
            ? `Average across ${positiveSavings.length} model${positiveSavings.length !== 1 ? 's' : ''}`
            : "No savings detected - optimized prompt may be longer"
          }
        </div>
        {avgSavings < 0 && (
          <div className="text-xs opacity-90 mt-1 italic">
            Note: Optimized prompt is longer than original
          </div>
        )}
      </div>

      {/* Provider breakdown */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {Array.from(savingsByProvider.entries())
          .sort((a, b) => {
            const aTotal = a[1].reduce((sum, s) => sum + s.savingsPer1kRequests, 0)
            const bTotal = b[1].reduce((sum, s) => sum + s.savingsPer1kRequests, 0)
            return bTotal - aTotal
          })
          .map(([provider, savings]) => renderProvider(provider, savings))}
      </div>
    </div>
  )
}
