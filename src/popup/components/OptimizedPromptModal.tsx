import { useState, useEffect } from "react"
import { applyFramework, FRAMEWORKS, type FrameworkType } from "~/lib/prompt-frameworks"

interface OptimizedPromptModalProps {
  optimized: string
  originalPrompt: string
  currentFramework: FrameworkType
  stats?: {
    reduction: number
    reductionPercent: number
    techniques?: string[]
  }
  onClose: () => void
}

export function OptimizedPromptModal({
  optimized,
  originalPrompt,
  currentFramework,
  stats,
  onClose,
}: OptimizedPromptModalProps) {
  const [copied, setCopied] = useState(false)
  const [selectedFramework, setSelectedFramework] = useState<FrameworkType>(currentFramework)
  const [frameworkOptimized, setFrameworkOptimized] = useState<string>(optimized)

  // Update framework output when framework changes
  useEffect(() => {
    if (originalPrompt.trim()) {
      applyFramework(originalPrompt, selectedFramework).then(frameworkOutput => {
        // Use the framework output directly (already processed and corrected)
        setFrameworkOptimized(frameworkOutput.optimized)
      }).catch(err => {
        console.error("Error applying framework:", err)
      })
    }
  }, [selectedFramework, originalPrompt])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(frameworkOptimized)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const handleFrameworkChange = (framework: FrameworkType) => {
    setSelectedFramework(framework)
  }

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="modal-title"
        aria-modal="true"
      >
        {/* Header - Material Design */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex-1">
            {/* Visually hidden but required for accessibility scanners and screen readers */}
            <h2 id="modal-title" className="text-xl font-normal text-gray-900">Analyzed Prompt</h2>
            <div className="flex items-center gap-3 mt-2">
              {stats && (
                <p className="text-xs text-gray-600">
                  Reduced by {stats.reductionPercent}% ({stats.reduction.toLocaleString()} chars)
                </p>
              )}
              <span className="text-xs text-gray-500">•</span>
              <p className="text-xs text-gray-600">
                Using <span className="font-medium">{FRAMEWORKS[selectedFramework].name}</span> framework
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Framework Selector */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-gray-700 whitespace-nowrap">
              Framework:
            </label>
            <select
              value={selectedFramework}
              onChange={(e) => handleFrameworkChange(e.target.value as FrameworkType)}
              className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {Object.entries(FRAMEWORKS).map(([key, framework]) => (
                <option key={key} value={key}>
                  {framework.name} {key === "create" && "(Default)"}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500 hidden sm:inline">
              💡 CREATE is our default framework
            </span>
          </div>
        </div>

        {/* Content - Material Design */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          <textarea
            readOnly
            value={frameworkOptimized}
            className="w-full h-full min-h-[300px] p-4 text-sm border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white font-mono leading-relaxed"
            onClick={(e) => {
              // Select all text on click
              ; (e.target as HTMLTextAreaElement).select()
            }}
          />
        </div>

        {/* Footer with stats and actions - Material Design */}
        <div className="border-t border-gray-200 px-6 py-4 bg-white">
          {stats?.techniques && stats.techniques.length > 0 && (
            <div className="mb-3 text-xs text-gray-600">
              <span className="font-semibold">Techniques used:</span>{" "}
              {stats.techniques.join(", ")}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleCopy}
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-4 rounded-md transition-colors shadow-sm hover:shadow flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <svg
                    className="w-4 h-4"
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
                  Copied!
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
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
                  Copy to Clipboard
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-6 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-md transition-colors shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

