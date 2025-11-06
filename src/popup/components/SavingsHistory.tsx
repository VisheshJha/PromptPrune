import { useEffect, useState } from "react"
import { getSavingsStats, clearSavingsHistory, type SavingsStats } from "~/lib/savings-tracker"

export function SavingsHistory() {
  const [stats, setStats] = useState<SavingsStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    const data = await getSavingsStats()
    setStats(data)
    setLoading(false)
  }

  const handleClear = async () => {
    if (confirm("Clear all savings history? This cannot be undone.")) {
      await clearSavingsHistory()
      await loadStats()
    }
  }

  if (loading) {
    return (
      <div className="backdrop-blur-md bg-white/60 border border-white/20 rounded-xl p-6 text-center shadow-lg">
        <div className="text-sm text-gray-500">Loading history...</div>
      </div>
    )
  }

  if (!stats || stats.totalOptimizations === 0) {
    return (
      <div className="backdrop-blur-md bg-white/60 border border-white/20 rounded-xl p-8 text-center shadow-lg">
        <div className="text-gray-400 mb-2">
          <svg
            className="w-12 h-12 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <p className="text-sm text-gray-500">No optimization history yet</p>
        <p className="text-xs text-gray-400 mt-1">
          Start optimizing prompts to track your savings
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-primary-500/90 to-primary-600/90 backdrop-blur-md text-white rounded-xl p-3 shadow-lg border border-white/20">
          <div className="text-xs opacity-90">Total Saved</div>
          <div className="text-xl font-bold">${stats.totalCostSaved.toFixed(2)}</div>
        </div>
        <div className="bg-gradient-to-br from-primary-400/90 to-primary-500/90 backdrop-blur-md text-white rounded-xl p-3 shadow-lg border border-white/20">
          <div className="text-xs opacity-90">Tokens Saved</div>
          <div className="text-xl font-bold">{stats.totalTokensSaved.toLocaleString()}</div>
        </div>
        <div className="bg-gradient-to-br from-primary-300/90 to-primary-400/90 backdrop-blur-md text-white rounded-xl p-3 shadow-lg border border-white/20">
          <div className="text-xs opacity-90">Optimizations</div>
          <div className="text-xl font-bold">{stats.totalOptimizations}</div>
        </div>
      </div>

      {/* Average Reduction */}
      <div className="backdrop-blur-md bg-white/70 border border-white/20 rounded-xl p-3 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Average Reduction</span>
          <span className="text-lg font-bold text-primary-600">
            {stats.averageReduction}%
          </span>
        </div>
      </div>

      {/* Recent History */}
      {stats.recentRecords.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800">Recent Optimizations</h3>
            <button
              onClick={handleClear}
              className="text-xs text-red-600 hover:text-red-800"
            >
              Clear All
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {stats.recentRecords.map((record) => (
              <div
                key={record.id}
                className="backdrop-blur-md bg-white/60 border border-white/20 rounded-xl p-2 text-xs shadow-md"
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-600 truncate">
                      {record.originalPrompt.substring(0, 50)}
                      {record.originalPrompt.length > 50 ? "..." : ""}
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <div className="font-semibold text-green-600">
                      -{record.tokensSaved} tokens
                    </div>
                    <div className="text-gray-500">
                      ${record.costSaved.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="text-gray-400 text-xs">
                  {new Date(record.timestamp).toLocaleDateString()}{" "}
                  {new Date(record.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

