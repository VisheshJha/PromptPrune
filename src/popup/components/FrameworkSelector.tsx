import { useState, useEffect } from "react"
import { applyFramework, getAllFrameworkOutputs, FRAMEWORKS, type FrameworkType, type FrameworkOutput } from "~/lib/prompt-frameworks"

interface FrameworkSelectorProps {
  originalPrompt: string
  onFrameworkSelected?: (output: FrameworkOutput) => void
}

export function FrameworkSelector({ originalPrompt, onFrameworkSelected }: FrameworkSelectorProps) {
  const [selectedFramework, setSelectedFramework] = useState<FrameworkType | null>(null)
  const [frameworkOutputs, setFrameworkOutputs] = useState<FrameworkOutput[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!originalPrompt.trim()) {
      setFrameworkOutputs([])
      setSelectedFramework(null)
      return
    }

    setLoading(true)
    // Generate all framework outputs
    const outputs = getAllFrameworkOutputs(originalPrompt)
    setFrameworkOutputs(outputs)
    setLoading(false)
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
      <div className="backdrop-blur-md bg-white/60 border border-white/20 rounded-xl p-6 text-center shadow-lg">
        <div className="text-sm text-gray-500">
          Enter a prompt above to see framework options
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="backdrop-blur-md bg-white/60 border border-white/20 rounded-xl p-6 text-center shadow-lg">
        <div className="text-sm text-gray-500">Generating framework options...</div>
      </div>
    )
  }

  const selectedOutput = selectedFramework
    ? frameworkOutputs.find((o) => o.framework === selectedFramework)
    : null

  return (
    <div className="space-y-4">
      {/* Framework Grid */}
      <div className="grid grid-cols-1 gap-2">
        {Object.entries(FRAMEWORKS).map(([key, framework]) => {
          const isSelected = selectedFramework === key
          const output = frameworkOutputs.find((o) => o.framework === key)
          
          return (
            <button
              key={key}
              onClick={() => handleFrameworkClick(key as FrameworkType)}
              className={`text-left backdrop-blur-md border rounded-xl p-3 shadow-lg transition-all ${
                isSelected
                  ? "bg-primary-100/80 border-primary-400 ring-2 ring-primary-300"
                  : "bg-white/70 border-white/20 hover:bg-white/90"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{framework.icon}</div>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-gray-800">
                    {framework.name}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {framework.description}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 italic">
                    Best for: {framework.useCase}
                  </div>
                </div>
                {isSelected && (
                  <svg
                    className="w-5 h-5 text-primary-600"
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
        })}
      </div>

      {/* Selected Framework Output */}
      {selectedOutput && (
        <div className="backdrop-blur-md bg-white/70 border border-white/20 rounded-xl p-4 shadow-lg">
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
              className="px-3 py-1.5 text-xs backdrop-blur-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center gap-1"
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
            className="w-full h-48 p-3 text-sm border border-white/30 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/50 bg-white/50 backdrop-blur-sm font-mono"
          />
          <div className="mt-2 text-xs text-gray-500">
            Use case: {selectedOutput.useCase}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="backdrop-blur-md bg-blue-50/80 border border-blue-200/30 rounded-xl p-3 shadow-lg">
        <div className="text-xs text-blue-800">
          <strong>💡 Tip:</strong> Different frameworks structure prompts differently. 
          Choose the one that best fits your use case. You can copy any framework output 
          and use it directly with your AI model.
        </div>
      </div>
    </div>
  )
}

