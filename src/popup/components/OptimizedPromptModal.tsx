import { useState, useEffect } from "react"

interface OptimizedPromptModalProps {
  optimized: string
  stats?: {
    reduction: number
    reductionPercent: number
    techniques?: string[]
  }
  onClose: () => void
}

export function OptimizedPromptModal({
  optimized,
  stats,
  onClose,
}: OptimizedPromptModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(optimized)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
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
        className="backdrop-blur-xl bg-gradient-to-br from-white/95 to-white/90 rounded-2xl shadow-2xl border border-white/30 w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in animate-zoom-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600/95 to-primary-700/95 backdrop-blur-md text-white p-4 rounded-t-2xl border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Optimized Prompt</h2>
            {stats && (
              <p className="text-xs opacity-90 mt-1">
                Reduced by {stats.reductionPercent}% ({stats.reduction.toLocaleString()} chars)
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <textarea
            readOnly
            value={optimized}
            className="w-full h-full min-h-[300px] p-4 text-sm border border-white/30 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/50 bg-white/60 backdrop-blur-sm font-mono leading-relaxed"
            onClick={(e) => {
              // Select all text on click
              ;(e.target as HTMLTextAreaElement).select()
            }}
          />
        </div>

        {/* Footer with stats and actions */}
        <div className="border-t border-white/20 p-4 bg-white/40 backdrop-blur-sm rounded-b-2xl">
          {stats?.techniques && stats.techniques.length > 0 && (
            <div className="mb-3 text-xs text-gray-600">
              <span className="font-semibold">Techniques used:</span>{" "}
              {stats.techniques.join(", ")}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleCopy}
              className="flex-1 backdrop-blur-md bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-medium py-2.5 px-4 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
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
              className="px-6 backdrop-blur-md bg-white/70 hover:bg-white/90 border border-white/30 text-gray-700 font-medium py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

