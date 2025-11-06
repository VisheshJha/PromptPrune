import { useState, useEffect } from "react"
import { optimizeWithOllama, checkOllamaAvailable, type OllamaOptimizeResponse } from "~/lib/ollama"
import { optimizePrompt, type OptimizationResult } from "~/lib/optimizer"
import { OllamaSetupGuide } from "./OllamaSetupGuide"
import { saveOptimizationRecord } from "~/lib/savings-tracker"
import { getAllTokenCounts, getAverageTokenCount } from "~/lib/tokenizers"
import { OptimizedPromptModal } from "./OptimizedPromptModal"
import { applyFramework, FRAMEWORKS, type FrameworkType } from "~/lib/prompt-frameworks"

interface SmartOptimizerProps {
  originalPrompt: string
  onOptimized: (optimized: string) => void
}

export function SmartOptimizer({ originalPrompt, onOptimized }: SmartOptimizerProps) {
  const [optimized, setOptimized] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usingOllama, setUsingOllama] = useState(false)
  const [ollamaAvailable, setOllamaAvailable] = useState<boolean | null>(null)
  const [showSetupGuide, setShowSetupGuide] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showFrameworks, setShowFrameworks] = useState(false)
  const [selectedFramework, setSelectedFramework] = useState<FrameworkType | null>(null)
  const [frameworkPrompt, setFrameworkPrompt] = useState<string>("")
  const [optimizationStats, setOptimizationStats] = useState<{
    reduction: number
    reductionPercent: number
    techniques?: string[]
  } | null>(null)

  // Disabled for now - WIP
  // useEffect(() => {
  //   // Check Ollama availability on mount and periodically
  //   const checkAvailability = async () => {
  //     const available = await checkOllamaAvailable()
  //     setOllamaAvailable(available)
  //   }
  //   checkAvailability()
  //   const interval = setInterval(checkAvailability, 10000) // Check every 10 seconds
  //   return () => clearInterval(interval)
  // }, [])

  // Apply framework when selected
  useEffect(() => {
    if (selectedFramework && originalPrompt.trim()) {
      const frameworkOutput = applyFramework(originalPrompt, selectedFramework)
      setFrameworkPrompt(frameworkOutput.optimized)
    } else {
      setFrameworkPrompt("")
    }
  }, [selectedFramework, originalPrompt])

  const handleOptimize = async () => {
    // Use framework prompt if available, otherwise use original
    const promptToOptimize = frameworkPrompt || originalPrompt
    
    if (!promptToOptimize.trim()) {
      setError("Please enter a prompt to optimize")
      return
    }

    setLoading(true)
    setError(null)
    setOptimized("")
    setOptimizationStats(null)

    try {
      // Smart ML Optimization disabled for now (WIP)
      // Always use rule-based optimizer
      const result: OptimizationResult = optimizePrompt(promptToOptimize)
      setOptimized(result.optimized)
      setUsingOllama(false)
      setOptimizationStats({
        reduction: result.reduction,
        reductionPercent: Math.round(
          (result.reduction / result.originalLength) * 100
        ),
        techniques: result.techniques,
      })
      onOptimized(result.optimized)
      setShowModal(true)

          // Track savings
          try {
            const [originalCounts, optimizedCounts] = await Promise.all([
              getAllTokenCounts(promptToOptimize),
              getAllTokenCounts(result.optimized),
            ])
        const originalAvg = getAverageTokenCount(originalCounts)
        const optimizedAvg = getAverageTokenCount(optimizedCounts)
            await saveOptimizationRecord(
              promptToOptimize,
              result.optimized,
              originalAvg,
              optimizedAvg,
              "average"
            )
      } catch (err) {
        console.warn("Failed to track savings:", err)
      }
    } catch (err) {
      console.error("Optimization error:", err)
      setError(err instanceof Error ? err.message : "Failed to optimize prompt")
    } finally {
      setLoading(false)
    }
  }

  // Always show the optimize button, even when prompt is empty

  return (
    <div className="space-y-4">
      {/* Framework Selector - Before Optimize */}
      {originalPrompt.trim() && (
        <div className="backdrop-blur-md bg-white/70 border border-white/20 rounded-xl p-4 shadow-lg">
          <button
            onClick={() => setShowFrameworks(!showFrameworks)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <div className="text-sm font-semibold text-gray-800">
                Apply Prompt Framework {selectedFramework && `(${FRAMEWORKS[selectedFramework].name})`}
              </div>
              <div className="text-xs text-gray-600">
                Structure your prompt using proven frameworks
              </div>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${showFrameworks ? "rotate-180" : ""}`}
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

          {showFrameworks && (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(FRAMEWORKS).map(([key, framework]) => {
                  const isSelected = selectedFramework === key
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedFramework(isSelected ? null : (key as FrameworkType))
                      }}
                      className={`text-left p-2 rounded-lg border transition-all text-xs ${
                        isSelected
                          ? "bg-primary-100/80 border-primary-400 ring-1 ring-primary-300"
                          : "bg-white/50 border-white/30 hover:bg-white/70"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{framework.icon}</span>
                        <span className="font-medium text-gray-800">{framework.name.split(" ")[0]}</span>
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5 line-clamp-1">
                        {framework.description}
                      </div>
                    </button>
                  )
                })}
              </div>

              {selectedFramework && frameworkPrompt && (
                <div className="mt-3 p-3 bg-primary-50/50 border border-primary-200/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-gray-800">
                      {FRAMEWORKS[selectedFramework].name} Output
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(frameworkPrompt)
                      }}
                      className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </button>
                  </div>
                  <div className="text-xs text-gray-700 bg-white/60 p-2 rounded border border-white/40 max-h-32 overflow-y-auto font-mono">
                    {frameworkPrompt}
                  </div>
                  <div className="text-xs text-gray-500 mt-2 italic">
                    This structured prompt will be optimized when you click "Optimize Prompt"
                  </div>
                </div>
              )}

              {selectedFramework && (
                <button
                  onClick={() => setSelectedFramework(null)}
                  className="w-full mt-2 text-xs text-gray-600 hover:text-gray-800 underline"
                >
                  Clear framework selection
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Core Feature - Always Available */}
      <div className="backdrop-blur-md bg-white/70 border border-white/20 rounded-xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-gray-800">Rule-Based Optimization</div>
            <div className="text-xs text-gray-600">Always available - no setup required</div>
          </div>
          <span className="text-xs bg-green-500/20 text-green-700 px-2 py-1 rounded-full backdrop-blur-sm">✓ Active</span>
        </div>
        {!originalPrompt.trim() && (
          <div className="text-xs text-gray-500 mb-3 text-center">
            Enter a prompt above to get started
          </div>
        )}
        {selectedFramework && frameworkPrompt && (
          <div className="mb-3 p-2 bg-primary-50/30 border border-primary-200/30 rounded text-xs text-gray-700">
            <span className="font-semibold">{FRAMEWORKS[selectedFramework].name}</span> framework will be applied before optimization
          </div>
        )}
        <button
          onClick={handleOptimize}
          disabled={loading || !originalPrompt.trim()}
          className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 disabled:from-gray-300 disabled:to-gray-400 text-white font-medium py-2.5 px-4 rounded-lg transition-all shadow-md hover:shadow-lg disabled:shadow-none disabled:cursor-not-allowed"
        >
          {loading ? "Optimizing..." : selectedFramework ? `Optimize with ${FRAMEWORKS[selectedFramework].name.split(" ")[0]}` : "Optimize Prompt"}
        </button>
      </div>

      {/* Smart Feature - Optional Ollama - WIP */}
      <div className="backdrop-blur-md bg-gray-50/60 border border-gray-200/30 rounded-xl p-4 shadow-lg opacity-75">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-sm font-semibold text-gray-600 flex items-center gap-2">
              Smart ML Optimization
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full backdrop-blur-sm font-medium">
                WIP
              </span>
            </div>
            <div className="text-xs text-gray-500 italic">
              Coming soon: AI-powered optimization that's smarter than a bag of hammers
            </div>
          </div>
          <span className="text-xs bg-gray-300/40 text-gray-600 px-2 py-1 rounded-full backdrop-blur-sm">
            🚧 Under Construction
          </span>
        </div>
        
        <div className="mt-2 p-2 bg-yellow-50/50 border border-yellow-200/30 rounded text-xs text-gray-600">
          <p className="font-medium text-yellow-800 mb-1">💡 What's cooking?</p>
          <p>
            We're training our AI models to be prompt optimization ninjas. 
            For now, our rule-based optimizer is doing the heavy lifting (and it's pretty good at it!).
            Check back soon for ML-powered magic ✨
          </p>
        </div>
      </div>

      {error && (
        <div className="backdrop-blur-md bg-red-500/10 border border-red-300/30 text-red-700 px-3 py-2 rounded-lg text-sm shadow-md">
          {error}
        </div>
      )}

      {/* Modal for optimized prompt */}
      {showModal && optimized && (
        <OptimizedPromptModal
          optimized={optimized}
          stats={optimizationStats || undefined}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

