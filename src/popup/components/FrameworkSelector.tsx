import { useState, useEffect } from "react"
import { applyFramework, getAllFrameworkOutputs, rankFrameworks, FRAMEWORKS, type FrameworkType, type FrameworkOutput } from "~/lib/prompt-frameworks"
import { analyzeFrameworkTokens, getTopModelsForFramework, type FrameworkTokenAnalysis } from "~/lib/framework-token-analyzer"
import { getAllTokenCounts } from "~/lib/tokenizers"

interface FrameworkSelectorProps {
  originalPrompt: string
  onFrameworkSelected?: (output: FrameworkOutput) => void
}

export function FrameworkSelector({ originalPrompt, onFrameworkSelected }: FrameworkSelectorProps) {
  const [selectedFramework, setSelectedFramework] = useState<FrameworkType | null>(null)
  const [frameworkOutputs, setFrameworkOutputs] = useState<FrameworkOutput[]>([])
  const [rankedFrameworks, setRankedFrameworks] = useState<Array<{ framework: FrameworkType; score: number; output: FrameworkOutput }>>([])
  const [tokenAnalyses, setTokenAnalyses] = useState<FrameworkTokenAnalysis[]>([])
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    if (!originalPrompt.trim()) {
      setFrameworkOutputs([])
      setRankedFrameworks([])
      setTokenAnalyses([])
      setSelectedFramework(null)
      return
    }

    setLoading(true)
    setAnalyzing(true)
    
    try {
      // Rank frameworks by how well they fit the prompt
      rankFrameworks(originalPrompt).then(ranked => {
        setRankedFrameworks(ranked)
        
        // Generate all framework outputs (for compatibility)
        return getAllFrameworkOutputs(originalPrompt)
      }).then(outputs => {
        setFrameworkOutputs(outputs)
        setLoading(false)
        
        // Analyze token counts for each framework (with error handling)
        return analyzeFrameworkTokens(originalPrompt)
      }).then((analyses: FrameworkTokenAnalysis[]) => {
        setTokenAnalyses(analyses)
        setAnalyzing(false)
      }).catch((err: unknown) => {
        console.error("Failed to analyze tokens:", err)
        setAnalyzing(false)
        // Continue without token analysis if it fails
        setTokenAnalyses([])
      })
    } catch (error) {
      console.error("Error in FrameworkSelector:", error)
      setLoading(false)
      setAnalyzing(false)
      // Set empty arrays to prevent crashes
      setFrameworkOutputs([])
      setRankedFrameworks([])
      setTokenAnalyses([])
    }
  }, [originalPrompt])

  const handleFrameworkClick = (framework: FrameworkType) => {
    setSelectedFramework(framework)
    const output = frameworkOutputs.find((o) => o.framework === framework)
    if (output && onFrameworkSelected) {
      onFrameworkSelected(output)
    }
  }

  if (!originalPrompt.trim()) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center shadow-sm">
        <div className="text-sm text-gray-500">
          Enter a prompt above to see framework options
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center shadow-sm">
        <div className="text-sm text-gray-500">Generating framework options...</div>
      </div>
    )
  }

  const selectedOutput = selectedFramework
    ? frameworkOutputs.find((o) => o.framework === selectedFramework)
    : null

  return (
    <div className="space-y-4">
      {/* Framework Grid with Token Counts - Ranked */}
      <div className="grid grid-cols-1 gap-3">
        {rankedFrameworks.length > 0 ? (
          rankedFrameworks.map((ranked: { framework: FrameworkType; score: number; output: FrameworkOutput }, index: number) => {
            const key = ranked.framework
            const framework = FRAMEWORKS[key]
            const isSelected = selectedFramework === key
            const output = ranked.output
            const analysis = tokenAnalyses.find((a) => a.framework === key)
            const topModels = analysis ? getTopModelsForFramework(analysis, 3) : []
            const isTopRanked = index === 0
          
          return (
            <button
              key={key}
              onClick={() => handleFrameworkClick(key as FrameworkType)}
              className={`text-left bg-white border rounded-lg p-4 shadow-sm transition-all ${
                isSelected
                  ? "bg-primary-50 border-primary-400 ring-2 ring-primary-300"
                  : isTopRanked
                  ? "bg-green-50 border-green-300 ring-1 ring-green-200"
                  : "border-gray-200 hover:bg-gray-50 hover:shadow-md"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl flex-shrink-0">{framework.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm text-gray-800">
                      {framework.name}
                      {isTopRanked && (
                        <span className="ml-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-medium">BEST FIT</span>
                      )}
                      {key === "create" && !isTopRanked && (
                        <span className="ml-2 text-xs text-primary-600 font-normal">(Default)</span>
                      )}
                      <span className="ml-2 text-xs text-gray-500 font-normal">Score: {ranked.score}</span>
                    </div>
                    {analysis && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          analysis.averageSavings > 0
                            ? "bg-green-100 text-green-700"
                            : analysis.averageSavings < 0
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-700"
                        }`}>
                          {analysis.averageSavings > 0 ? "↓" : analysis.averageSavings < 0 ? "↑" : "="}
                          {Math.abs(Math.round(analysis.averageSavings))} tokens avg
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {framework.description}
                  </div>
                  
                  {/* Token Analysis */}
                  {analyzing && (
                    <div className="text-xs text-gray-400 mt-2 italic">
                      Analyzing tokens...
                    </div>
                  )}
                  {analysis && !analyzing && (
                    <div className="mt-2 space-y-1">
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Token savings:</span>{" "}
                        {topModels.length > 0 ? (
                          topModels.map((m: { model: string; saved: number; savedPercent: number }, idx: number) => (
                            <span key={m.model}>
                              {m.model.split("/")[0]}: {m.saved > 0 ? "-" : "+"}{Math.abs(m.saved)} ({m.savedPercent > 0 ? "-" : "+"}{Math.abs(Math.round(m.savedPercent))}%)
                              {idx < topModels.length - 1 && ", "}
                            </span>
                          ))
                        ) : (
                          <span>No significant savings</span>
                        )}
                      </div>
                      {analysis.averageSavingsPercent !== 0 && (
                        <div className={`text-xs font-medium ${
                          analysis.averageSavingsPercent > 0 ? "text-green-600" : "text-red-600"
                        }`}>
                          Average: {analysis.averageSavingsPercent > 0 ? "-" : "+"}{Math.abs(Math.round(analysis.averageSavingsPercent))}% across all models
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500 mt-1 italic">
                    Best for: {framework.useCase}
                  </div>
                </div>
                {isSelected && (
                  <svg
                    className="w-5 h-5 text-primary-600 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
            </button>
          )
        })) : (
          Object.entries(FRAMEWORKS).map(([key, framework]) => {
            const isSelected = selectedFramework === key
            const output = frameworkOutputs.find((o) => o.framework === key)
            const analysis = tokenAnalyses.find((a) => a.framework === key)
            const topModels = analysis ? getTopModelsForFramework(analysis, 3) : []
            
            return (
              <button
                key={key}
                onClick={() => handleFrameworkClick(key as FrameworkType)}
                className={`text-left bg-white border rounded-lg p-4 shadow-sm transition-all ${
                  isSelected
                    ? "bg-primary-50 border-primary-400 ring-2 ring-primary-300"
                    : "border-gray-200 hover:bg-gray-50 hover:shadow-md"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl flex-shrink-0">{framework.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-sm text-gray-800">
                        {framework.name}
                        {key === "create" && (
                          <span className="ml-2 text-xs text-primary-600 font-normal">(Default)</span>
                        )}
                      </div>
                      {analysis && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            analysis.averageSavings > 0
                              ? "bg-green-100 text-green-700"
                              : analysis.averageSavings < 0
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-700"
                          }`}>
                            {analysis.averageSavings > 0 ? "↓" : analysis.averageSavings < 0 ? "↑" : "="}
                            {Math.abs(Math.round(analysis.averageSavings))} tokens avg
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {framework.description}
                    </div>
                    
                    {/* Token Analysis */}
                    {analyzing && (
                      <div className="text-xs text-gray-400 mt-2 italic">
                        Analyzing tokens...
                      </div>
                    )}
                    {analysis && !analyzing && (
                      <div className="mt-2 space-y-1">
                        <div className="text-xs text-gray-500">
                          <span className="font-medium">Token savings:</span>{" "}
                          {topModels.length > 0 ? (
                            topModels.map((m, idx) => (
                              <span key={m.model}>
                                {m.model.split("/")[0]}: {m.saved > 0 ? "-" : "+"}{Math.abs(m.saved)} ({m.savedPercent > 0 ? "-" : "+"}{Math.abs(Math.round(m.savedPercent))}%)
                                {idx < topModels.length - 1 && ", "}
                              </span>
                            ))
                          ) : (
                            <span>No significant savings</span>
                          )}
                        </div>
                        {analysis.averageSavingsPercent !== 0 && (
                          <div className={`text-xs font-medium ${
                            analysis.averageSavingsPercent > 0 ? "text-green-600" : "text-red-600"
                          }`}>
                            Average: {analysis.averageSavingsPercent > 0 ? "-" : "+"}{Math.abs(Math.round(analysis.averageSavingsPercent))}% across all models
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-500 mt-1 italic">
                      Best for: {framework.useCase}
                    </div>
                  </div>
                  {isSelected && (
                    <svg
                      className="w-5 h-5 text-primary-600 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Selected Framework Output - Material Design */}
      {selectedOutput && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-gray-800">
                {selectedOutput.name} Output
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {selectedOutput.description}
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(selectedOutput.optimized)
              }}
              className="px-3 py-1.5 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors flex items-center gap-1 shadow-sm"
            >
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy
            </button>
          </div>
          <textarea
            readOnly
            value={selectedOutput.optimized}
            className="w-full h-48 p-3 text-sm border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white font-mono"
          />
          <div className="mt-2 text-xs text-gray-500">
            Use case: {selectedOutput.useCase}
          </div>
        </div>
      )}

      {/* Info Box - Material Design */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-sm space-y-3">
        <div className="text-xs text-blue-800">
          <strong>💡 Tip:</strong> Different frameworks structure prompts differently. 
          Choose the one that best fits your use case. You can copy any framework output 
          and use it directly with your AI model.
        </div>
        
        {/* Explanation of Ranking */}
        <details className="cursor-pointer">
          <summary className="text-xs font-semibold text-blue-800 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How are frameworks ranked?
          </summary>
          <div className="mt-2 text-xs text-blue-700 space-y-2">
            <p className="font-medium">Frameworks are scored based on keyword matching in your prompt:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>CoT:</strong> Reasoning, math, step-by-step (+30-65 points)</li>
              <li><strong>ToT:</strong> Planning, strategy, decision-making (+30-50 points)</li>
              <li><strong>APE:</strong> Quick actions, short prompts (+25-40 points)</li>
              <li><strong>RACE:</strong> Analysis, research, investigation (+30-50 points)</li>
              <li><strong>ROSES:</strong> Reports, documents, structured content (+30-50 points)</li>
              <li><strong>GUIDE:</strong> Tutorials, instructions, how-to guides (+30-50 points)</li>
              <li><strong>SMART:</strong> Goals, objectives, measurable outcomes (+30-50 points)</li>
              <li><strong>CREATE:</strong> Creative tasks, content generation (+30-60 points, +10 default)</li>
            </ul>
            <p className="text-blue-600 italic mt-2">
              Higher scores indicate better fit. The top-ranked framework is highlighted with a "BEST FIT" badge.
            </p>
          </div>
        </details>
      </div>
    </div>
  )
}

