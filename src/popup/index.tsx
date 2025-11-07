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
  const [activeTab, setActiveTab] = useState<"optimize" | "tokens" | "frameworks" | "savings" | "history">("optimize")

  return (
    <div className="w-[520px] min-h-[480px] bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header - Material Design */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-normal text-gray-900">PromptPrune</h1>
        <p className="text-sm text-gray-600 mt-1">
          Optimize AI prompts, reduce costs
        </p>
      </div>

      {/* Tabs - Material Design */}
      <div className="border-b border-gray-200 bg-white flex overflow-x-auto">
        <button
          onClick={() => setActiveTab("optimize")}
          className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "optimize"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Optimize
        </button>
        <button
          onClick={() => setActiveTab("tokens")}
          className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "tokens"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Tokens
        </button>
        <button
          onClick={() => setActiveTab("frameworks")}
          className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "frameworks"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Frameworks
        </button>
        <button
          onClick={() => setActiveTab("savings")}
          className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "savings"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Savings
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "history"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          History
        </button>
      </div>

      {/* Content - Material Design */}
      <div className="p-6 bg-gray-50">
        {/* Prompt Input */}
        <div className="mb-6">
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
            className="w-full h-32 p-3 text-sm border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
          />
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "optimize" && (
            <SmartOptimizer
              originalPrompt={prompt}
              onOptimized={(optimized) => setOptimizedPrompt(optimized)}
            />
          )}
          {activeTab === "tokens" && <TokenDisplay text={prompt} />}
          {activeTab === "frameworks" && (
            <FrameworkSelector
              originalPrompt={prompt}
              onFrameworkSelected={(output) => {
                setOptimizedPrompt(output.optimized)
              }}
            />
          )}
          {activeTab === "savings" && (
            <SavingsCalculator
              originalText={prompt}
              optimizedText={optimizedPrompt}
            />
          )}
          {activeTab === "history" && <SavingsHistory />}
        </div>
      </div>

      {/* Footer - Material Design */}
      <div className="border-t border-gray-200 px-6 py-3 bg-white">
        <div className="text-xs text-gray-500 text-center">
          <span className="font-medium">PromptPrune</span> - Optimized locally
        </div>
      </div>
    </div>
  )
}

export default IndexPopup

