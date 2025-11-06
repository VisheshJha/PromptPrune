import { useEffect, useState } from "react"
import { getAllTokenCounts, getAverageTokenCount, type AllTokenCounts, type Provider } from "~/lib/tokenizers"
import { getProviderInfo } from "~/lib/pricing"

interface TokenDisplayProps {
  text: string
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

export function TokenDisplay({ text }: TokenDisplayProps) {
  const [tokenCounts, setTokenCounts] = useState<AllTokenCounts | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedProviders, setExpandedProviders] = useState<Set<Provider>>(new Set(["openai", "anthropic", "gemini"]))

  useEffect(() => {
    if (!text.trim()) {
      setTokenCounts(null)
      return
    }

    setLoading(true)
    setError(null)

    getAllTokenCounts(text)
      .then((counts) => {
        setTokenCounts(counts)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Error counting tokens:", err)
        setError("Failed to count tokens")
        setLoading(false)
      })
  }, [text])

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

  const renderProvider = (provider: Provider, counts: typeof tokenCounts.openai) => {
    if (!counts || counts.length === 0) return null

    const isExpanded = expandedProviders.has(provider)
    const providerName = PROVIDER_NAMES[provider]

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
            <span className="text-xs text-gray-500">({counts.length} models)</span>
          </div>
          <span className="text-xs text-gray-500">
            Avg: {Math.round(counts.reduce((sum, c) => sum + c.count, 0) / counts.length).toLocaleString()}
          </span>
        </button>
        {isExpanded && (
          <div className="px-3 pb-3 space-y-1">
            {counts.map((count) => (
              <div key={count.model} className="flex justify-between text-sm py-1">
                <span className="text-gray-600">{count.model}</span>
                <span className="font-medium text-gray-800">{count.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (!text.trim()) {
    return (
      <div className="backdrop-blur-md bg-white/60 border border-white/20 rounded-xl p-6 text-center shadow-lg">
        <div className="text-sm text-gray-500">
          Enter a prompt above to see token counts
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="backdrop-blur-md bg-white/60 border border-white/20 rounded-xl p-6 text-center shadow-lg">
        <div className="text-sm text-gray-500">Counting tokens...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="backdrop-blur-md bg-red-500/10 border border-red-300/30 text-red-700 px-3 py-2 rounded-lg text-sm shadow-md">
        {error}
      </div>
    )
  }

  if (!tokenCounts) {
    return null
  }

  const average = getAverageTokenCount(tokenCounts)

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-primary-500/90 to-primary-600/90 backdrop-blur-md text-white rounded-xl p-4 shadow-lg border border-white/20">
        <div className="text-sm font-medium opacity-90">Average Tokens</div>
        <div className="text-3xl font-bold">{average.toLocaleString()}</div>
        <div className="text-xs opacity-75 mt-1">Across all {Object.values(tokenCounts).flat().length} models</div>
      </div>

      <div className="space-y-2">
        {renderProvider("openai", tokenCounts.openai)}
        {renderProvider("anthropic", tokenCounts.anthropic)}
        {renderProvider("gemini", tokenCounts.gemini)}
        {renderProvider("cohere", tokenCounts.cohere)}
        {renderProvider("mistral", tokenCounts.mistral)}
        {renderProvider("llama", tokenCounts.llama)}
        {renderProvider("groq", tokenCounts.groq)}
        {renderProvider("perplexity", tokenCounts.perplexity)}
        {renderProvider("together", tokenCounts.together)}
        {renderProvider("fireworks", tokenCounts.fireworks)}
        {renderProvider("azure", tokenCounts.azure)}
        {renderProvider("bedrock", tokenCounts.bedrock)}
      </div>
    </div>
  )
}
