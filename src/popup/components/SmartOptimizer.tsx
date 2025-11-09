import { useState, useEffect } from "react"
import { saveOptimizationRecord } from "~/lib/savings-tracker"
import { getAllTokenCounts, getAverageTokenCount } from "~/lib/tokenizers"
import { OptimizedPromptModal } from "./OptimizedPromptModal"
import { applyFramework, rankFrameworks, FRAMEWORKS, type FrameworkType } from "~/lib/prompt-frameworks"

interface SmartOptimizerProps {
  originalPrompt: string
  onOptimized: (optimized: string) => void
}

export function SmartOptimizer({ originalPrompt, onOptimized }: SmartOptimizerProps) {
  const [analyzed, setAnalyzed] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showFrameworks, setShowFrameworks] = useState(false)
  const [selectedFramework, setSelectedFramework] = useState<FrameworkType | null>(null)
  const [frameworkPrompt, setFrameworkPrompt] = useState<string>("")
  const [bestFitFramework, setBestFitFramework] = useState<FrameworkType | null>(null)
  const [analysisStats, setAnalysisStats] = useState<{
    reduction: number
    reductionPercent: number
  } | null>(null)



  // Rank frameworks and find best fit when prompt changes
  useEffect(() => {
    if (!originalPrompt.trim()) {
      setFrameworkPrompt("")
      setBestFitFramework(null)
      setSelectedFramework(null)
      return
    }

    // Rank frameworks to find the best fit
    const rankings = rankFrameworks(originalPrompt)
    const topRanked = rankings.length > 0 ? rankings[0] : null
    
    if (topRanked) {
      setBestFitFramework(topRanked.framework)
      // Auto-select best fit if no manual selection exists
      setSelectedFramework(prev => prev || topRanked.framework)
    } else {
      // Fallback to CREATE if ranking fails
      setBestFitFramework("create")
      setSelectedFramework(prev => prev || "create")
    }
  }, [originalPrompt])

  // Apply selected framework when it changes
  useEffect(() => {
    if (selectedFramework && originalPrompt.trim()) {
      const frameworkOutput = applyFramework(originalPrompt, selectedFramework)
      setFrameworkPrompt(frameworkOutput.optimized)
    } else if (!originalPrompt.trim()) {
      setFrameworkPrompt("")
    }
  }, [selectedFramework, originalPrompt])

  const handleAnalyze = async () => {
    if (!originalPrompt.trim()) {
      setError("Please enter a prompt to analyze")
      return
    }

    setLoading(true)
    setError(null)
    setAnalyzed("")
    setAnalysisStats(null)

    try {
      // Use the best fit framework output directly (not the optimized template)
      if (selectedFramework && frameworkPrompt) {
        // Use the framework output directly
        setAnalyzed(frameworkPrompt)
        onOptimized(frameworkPrompt)
        setShowModal(true)
        
        // Track savings with framework output
        try {
          const [originalCounts, frameworkCounts] = await Promise.all([
            getAllTokenCounts(originalPrompt),
            getAllTokenCounts(frameworkPrompt),
          ])
          const originalAvg = getAverageTokenCount(originalCounts)
          const frameworkAvg = getAverageTokenCount(frameworkCounts)
          const reduction = originalAvg - frameworkAvg
          
          setAnalysisStats({
            reduction: reduction > 0 ? reduction : 0,
            reductionPercent: originalAvg > 0 ? Math.round((reduction / originalAvg) * 100) : 0,
          })
          
          await saveOptimizationRecord(
            originalPrompt,
            frameworkPrompt,
            originalAvg,
            frameworkAvg,
            "average"
          )
        } catch (err) {
          console.warn("Failed to track savings:", err)
        }
      } else {
        // Fallback: if no framework selected, use best fit
        const rankings = rankFrameworks(originalPrompt)
        const bestFit = rankings.length > 0 ? rankings[0] : null
        
        if (bestFit) {
          setAnalyzed(bestFit.output.optimized)
          onOptimized(bestFit.output.optimized)
          setShowModal(true)
          
          // Track savings
          try {
            const [originalCounts, frameworkCounts] = await Promise.all([
              getAllTokenCounts(originalPrompt),
              getAllTokenCounts(bestFit.output.optimized),
            ])
            const originalAvg = getAverageTokenCount(originalCounts)
            const frameworkAvg = getAverageTokenCount(frameworkCounts)
            const reduction = originalAvg - frameworkAvg
            
            setAnalysisStats({
              reduction: reduction > 0 ? reduction : 0,
              reductionPercent: originalAvg > 0 ? Math.round((reduction / originalAvg) * 100) : 0,
            })
          } catch (err) {
            console.warn("Failed to track savings:", err)
          }
        } else {
          setError("Unable to analyze prompt")
        }
      }
    } catch (err) {
      console.error("Analysis error:", err)
      setError(err instanceof Error ? err.message : "Failed to analyze prompt")
    } finally {
      setLoading(false)
    }
  }

  // Always show the optimize button, even when prompt is empty

  return (
    <div className="space-y-4">
      {/* Framework Selector - Before Optimize - Material Design */}
      {originalPrompt.trim() && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <button
            onClick={() => setShowFrameworks(!showFrameworks)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <div className="text-sm font-semibold text-gray-800">
                Apply Prompt Framework {selectedFramework && `(${FRAMEWORKS[selectedFramework].name})`}
                {bestFitFramework && selectedFramework === bestFitFramework && (
                  <span className="ml-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-medium">BEST FIT</span>
                )}
              </div>
              <div className="text-xs text-gray-600">
                {bestFitFramework 
                  ? `Best fit: ${FRAMEWORKS[bestFitFramework].name} (auto-selected)`
                  : "Structure your prompt using proven frameworks"}
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
                {Object.entries(FRAMEWORKS).map(([key, framework]: [string, typeof FRAMEWORKS[keyof typeof FRAMEWORKS]]) => {
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
                    This structured prompt will be used when you click "Analyze Prompt"
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

              {/* Explanation of Best Fit Selection */}
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <details className="cursor-pointer">
                  <summary className="text-xs font-semibold text-blue-800 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    How is "Best Fit" determined?
                  </summary>
                  <div className="mt-2 text-xs text-blue-700 space-y-2">
                    <p className="font-medium">Our AI analyzes your prompt and scores each framework based on:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li><strong>CoT (Chain of Thought):</strong> +30 for reasoning words (how, why, explain, calculate, solve), +20 for math terms</li>
                      <li><strong>ToT (Tree of Thoughts):</strong> +30 for planning words (plan, strategy, option, compare, choose)</li>
                      <li><strong>APE:</strong> +25 for action words (create, write, make, generate), +15 for short prompts</li>
                      <li><strong>RACE:</strong> +30 for analysis words (analyze, research, study, examine, investigate)</li>
                      <li><strong>ROSES:</strong> +30 for structured output words (report, document, summary, outline, structure)</li>
                      <li><strong>GUIDE:</strong> +30 for instructional words (guide, tutorial, instructions, how to, steps)</li>
                      <li><strong>SMART:</strong> +30 for goal words (goal, objective, target, achieve, accomplish)</li>
                      <li><strong>CREATE:</strong> +30 for creative words (creative, design, imagine, invent), +10 default bonus</li>
                    </ul>
                    <p className="text-blue-600 italic mt-2">
                      The framework with the highest score is automatically selected as "Best Fit". You can always override this by manually selecting a different framework.
                    </p>
                  </div>
                </details>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Core Feature - Always Available - Material Design */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-gray-800">Framework Analysis</div>
            <div className="text-xs text-gray-600">Automatically finds the best framework for your prompt</div>
          </div>
          <span className="text-xs bg-green-500/20 text-green-700 px-2 py-1 rounded-full backdrop-blur-sm">✓ Active</span>
        </div>
        {!originalPrompt.trim() && (
          <div className="text-xs text-gray-500 mb-3 text-center">
            Enter a prompt above to get started
          </div>
        )}
        {selectedFramework && frameworkPrompt && (
          <div className={`mb-3 p-2 border rounded-md text-xs ${
            bestFitFramework && selectedFramework === bestFitFramework
              ? "bg-green-50 border-green-200 text-gray-700"
              : "bg-primary-50 border-primary-200 text-gray-700"
          }`}>
            <span className="font-semibold">{FRAMEWORKS[selectedFramework].name}</span> framework selected
            {bestFitFramework && selectedFramework === bestFitFramework && (
              <span className="text-green-700 ml-1 font-medium">(Best Fit - Auto-selected)</span>
            )}
            {!bestFitFramework || selectedFramework !== bestFitFramework ? (
              <span className="text-gray-600 ml-1">(Manual selection)</span>
            ) : null}
          </div>
        )}
        <button
          onClick={handleAnalyze}
          disabled={loading || !originalPrompt.trim()}
          className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-medium py-2.5 px-4 rounded-md transition-colors shadow-sm hover:shadow disabled:shadow-none disabled:cursor-not-allowed"
        >
          {loading ? "Analyzing..." : selectedFramework ? `Analyze with ${FRAMEWORKS[selectedFramework].name.split(" ")[0]}` : "Analyze Prompt"}
        </button>
      </div>


      {error && (
        <div className="backdrop-blur-md bg-red-500/10 border border-red-300/30 text-red-700 px-3 py-2 rounded-lg text-sm shadow-md">
          {error}
        </div>
      )}

      {/* Modal for analyzed prompt */}
      {showModal && analyzed && (
        <OptimizedPromptModal
          optimized={analyzed}
          originalPrompt={originalPrompt}
          currentFramework={selectedFramework || bestFitFramework || "create"}
          stats={analysisStats || undefined}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

