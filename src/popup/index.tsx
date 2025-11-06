import { useState } from "react"
import { TokenDisplay } from "./components/TokenDisplay"
import { SmartOptimizer } from "./components/SmartOptimizer"
import { SavingsCalculator } from "./components/SavingsCalculator"
import { SavingsHistory } from "./components/SavingsHistory"
import { FrameworkSelector } from "./components/FrameworkSelector"
import "./style.css"

function IndexPopup() {
  const [prompt, setPrompt] = useState("")
  const [optimizedPrompt, setOptimizedPrompt] = useState("")
  const [activeTab, setActiveTab] = useState<"tokens" | "optimize" | "savings" | "history" | "frameworks">("tokens")

  return (
    <div className="w-[520px] min-h-[480px] backdrop-blur-xl bg-gradient-to-br from-white/90 to-white/70 rounded-2xl shadow-2xl overflow-hidden border border-white/20">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600/95 to-primary-700/95 backdrop-blur-md text-white p-4 rounded-t-2xl border-b border-white/10 shadow-lg">
        <h1 className="text-2xl font-bold">PromptPrune</h1>
        <p className="text-sm opacity-90 mt-1">
          Trim your prompts, save the planet. Every token counts.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/20 backdrop-blur-sm bg-white/30 flex overflow-x-auto">
        <button
          onClick={() => setActiveTab("tokens")}
          className={`flex-shrink-0 px-3 py-2.5 text-xs font-medium transition-all ${
            activeTab === "tokens"
              ? "text-primary-600 border-b-2 border-primary-600 bg-white/20"
              : "text-gray-600 hover:text-gray-800 hover:bg-white/10"
          }`}
        >
          Tokens
        </button>
        <button
          onClick={() => setActiveTab("optimize")}
          className={`flex-shrink-0 px-3 py-2.5 text-xs font-medium transition-all ${
            activeTab === "optimize"
              ? "text-primary-600 border-b-2 border-primary-600 bg-white/20"
              : "text-gray-600 hover:text-gray-800 hover:bg-white/10"
          }`}
        >
          Optimize
        </button>
        <button
          onClick={() => setActiveTab("frameworks")}
          className={`flex-shrink-0 px-3 py-2.5 text-xs font-medium transition-all ${
            activeTab === "frameworks"
              ? "text-primary-600 border-b-2 border-primary-600 bg-white/20"
              : "text-gray-600 hover:text-gray-800 hover:bg-white/10"
          }`}
        >
          Frameworks
        </button>
        <button
          onClick={() => setActiveTab("savings")}
          className={`flex-shrink-0 px-3 py-2.5 text-xs font-medium transition-all ${
            activeTab === "savings"
              ? "text-primary-600 border-b-2 border-primary-600 bg-white/20"
              : "text-gray-600 hover:text-gray-800 hover:bg-white/10"
          }`}
        >
          Savings
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-shrink-0 px-3 py-2.5 text-xs font-medium transition-all ${
            activeTab === "history"
              ? "text-primary-600 border-b-2 border-primary-600 bg-white/20"
              : "text-gray-600 hover:text-gray-800 hover:bg-white/10"
          }`}
        >
          History
        </button>
      </div>

      {/* Content */}
      <div className="p-4 bg-gradient-to-b from-transparent to-white/20">
        {/* Prompt Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value)
              if (activeTab === "optimize" && !e.target.value.trim()) {
                setOptimizedPrompt("")
              }
            }}
            placeholder="Enter your AI prompt here..."
            className="w-full h-32 p-3 text-sm border border-white/30 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent backdrop-blur-sm bg-white/60 shadow-inner"
          />
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === "tokens" && <TokenDisplay text={prompt} />}
          {activeTab === "optimize" && (
            <SmartOptimizer
              originalPrompt={prompt}
              onOptimized={(optimized) => setOptimizedPrompt(optimized)}
            />
          )}
          {activeTab === "savings" && (
            <SavingsCalculator
              originalText={prompt}
              optimizedText={optimizedPrompt}
            />
          )}
          {activeTab === "history" && <SavingsHistory />}
          {activeTab === "frameworks" && (
            <FrameworkSelector
              originalPrompt={prompt}
              onFrameworkSelected={(output) => {
                // Optionally update optimized prompt when framework is selected
                setOptimizedPrompt(output.optimized)
              }}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/20 p-3 backdrop-blur-md bg-white/40 rounded-b-2xl">
        <div className="text-xs text-gray-500 text-center">
          <span className="font-semibold">PromptPrune</span> - Your prompts, optimized locally
        </div>
      </div>
    </div>
  )
}

export default IndexPopup

