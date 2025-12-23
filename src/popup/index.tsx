import { useState, useEffect } from "react"
import { TokenDisplay } from "./components/TokenDisplay"
import { SmartOptimizer } from "./components/SmartOptimizer"
import { SavingsCalculator } from "./components/SavingsCalculator"
import { SavingsHistory } from "./components/SavingsHistory"
import { FrameworkSelector } from "./components/FrameworkSelector"
import { LoginScreen } from "./components/LoginScreen"
import { authService, type UserProfile } from "~/lib/auth-service"
import "./style.css"

// ... (TestRunner component remains unchanged) ...
function TestRunner() {
  // ... (TestRunner code) ...
  const [testResults, setTestResults] = useState<any>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [testPrompt, setTestPrompt] = useState("")

  const runTests = async () => {
    setIsRunning(true)
    setTestResults(null)

    try {
      // Send message to content script to run tests
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab.id) {
        throw new Error("No active tab")
      }

      // Inject test runner into page
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          return new Promise((resolve, reject) => {
            const requestId = 'test_' + Date.now() + '_' + Math.random()

            window.postMessage({
              type: 'PROMPTPRUNE_TEST',
              action: 'runAllTests',
              requestId: requestId
            }, '*')

            const listener = (event: MessageEvent) => {
              if (event.data && event.data.type === 'PROMPTPRUNE_TEST_RESULT' && event.data.requestId === requestId) {
                window.removeEventListener('message', listener)
                if (event.data.error) {
                  reject(new Error(event.data.error))
                } else {
                  resolve(event.data.result)
                }
              }
            }
            window.addEventListener('message', listener)

            setTimeout(() => {
              window.removeEventListener('message', listener)
              reject(new Error('Test timeout'))
            }, 60000)
          })
        }
      })

      if (results && results[0] && results[0].result) {
        setTestResults(results[0].result)
      } else {
        throw new Error("No results returned")
      }
    } catch (error) {
      setTestResults({
        error: error instanceof Error ? error.message : String(error),
        summary: { total: 0, passed: 0, failed: 0 }
      })
    } finally {
      setIsRunning(false)
    }
  }

  const runQuickTest = async () => {
    if (!testPrompt.trim()) {
      alert("Please enter a test prompt")
      return
    }

    setIsRunning(true)
    setTestResults(null)

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab.id) {
        throw new Error("No active tab")
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (prompt: string) => {
          return new Promise((resolve, reject) => {
            const requestId = 'test_' + Date.now() + '_' + Math.random()

            window.postMessage({
              type: 'PROMPTPRUNE_TEST',
              action: 'quickTest',
              prompt: prompt,
              requestId: requestId
            }, '*')

            const listener = (event: MessageEvent) => {
              if (event.data && event.data.type === 'PROMPTPRUNE_TEST_RESULT' && event.data.requestId === requestId) {
                window.removeEventListener('message', listener)
                if (event.data.error) {
                  reject(new Error(event.data.error))
                } else {
                  resolve(event.data.result)
                }
              }
            }
            window.addEventListener('message', listener)

            setTimeout(() => {
              window.removeEventListener('message', listener)
              reject(new Error('Test timeout'))
            }, 10000)
          })
        },
        args: [testPrompt]
      })

      if (results && results[0] && results[0].result) {
        setTestResults(results[0].result)
      } else {
        throw new Error("No results returned")
      }
    } catch (error) {
      setTestResults({
        error: error instanceof Error ? error.message : String(error),
        summary: { total: 0, passed: 0, failed: 0 }
      })
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-3">🧪 Test Suite</h3>
        <p className="text-sm text-gray-600 mb-4">
          Run comprehensive tests on prompt parsing and framework selection
        </p>

        <button
          onClick={runTests}
          disabled={isRunning}
          className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isRunning ? "Running Tests..." : "Run All Tests"}
        </button>
      </div>

      <div className="border-t pt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Quick Test (Single Prompt)
        </label>
        <textarea
          value={testPrompt}
          onChange={(e) => setTestPrompt(e.target.value)}
          placeholder="Enter a prompt to test..."
          className="w-full h-20 p-2 text-sm border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          onClick={runQuickTest}
          disabled={isRunning || !testPrompt.trim()}
          className="mt-2 w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning ? "Testing..." : "Quick Test"}
        </button>
      </div>

      {testResults && (
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-2">Results:</h4>
          {testResults.error ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
              Error: {testResults.error}
            </div>
          ) : (
            <div className="space-y-2">
              {testResults.summary && (
                <div className="p-3 bg-gray-50 rounded-md text-sm">
                  <div className="font-medium">Summary:</div>
                  <div>Total: {testResults.summary.total}</div>
                  <div className="text-green-600">Passed: {testResults.summary.passed}</div>
                  <div className="text-red-600">Failed: {testResults.summary.failed}</div>
                </div>
              )}
              {testResults.tests && (
                <div className="max-h-60 overflow-y-auto space-y-1 text-xs">
                  {testResults.tests.map((test: any, i: number) => (
                    <div key={i} className={`p-2 rounded ${test.passed ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className="font-medium">{test.name}</div>
                      {!test.passed && test.error && (
                        <div className="text-red-600 mt-1">{test.error}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function IndexPopup() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)

  // Auth check on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await authService.getCurrentUser()
        setCurrentUser(user)
      } catch (error) {
        console.error("Auth check failed:", error)
      } finally {
        setIsLoadingAuth(false)
      }
    }
    checkAuth()
  }, [])

  // Load last prompt from localStorage
  const [prompt, setPrompt] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('promptprune_last_prompt') || ''
    }
    return ''
  })
  const [optimizedPrompt, setOptimizedPrompt] = useState("")
  const [activeTab, setActiveTab] = useState<"analyze" | "tokens" | "frameworks" | "savings" | "history" | "tests">("analyze")

  // Save prompt to localStorage when it changes
  useEffect(() => {
    if (prompt.trim() && typeof window !== 'undefined') {
      localStorage.setItem('promptprune_last_prompt', prompt)
    }
  }, [prompt])

  const handleLogout = async () => {
    await authService.logout()
    setCurrentUser(null)
    
    // Notify all content scripts that logout occurred
    try {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'AUTH_STATE_CHANGED', loggedIn: false }).catch(() => {
              // Ignore errors (tab might not have content script)
            })
          }
        })
      })
    } catch (err) {
      console.warn("Failed to notify content scripts:", err)
    }
  }

  // Show loading spinner while checking auth
  if (isLoadingAuth) {
    return (
      <div className="w-[520px] h-[500px] flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // Show login screen if not authenticated
  if (!currentUser) {
    return (
      <div className="w-[520px] min-h-[500px] bg-white rounded-lg shadow-lg overflow-hidden">
        <LoginScreen onLoginSuccess={async () => {
          setIsLoadingAuth(true)
          const user = await authService.getCurrentUser()
          setCurrentUser(user)
          setIsLoadingAuth(false)
        }} />
      </div>
    )
  }

  return (
    <div className="w-[520px] min-h-[480px] bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header - Material Design */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-normal text-gray-900">PromptPrune</h1>
          <p className="text-sm text-gray-600 mt-1">
            Analyze and optimize AI prompts, reduce costs
          </p>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-xs text-gray-500 mb-1">
            Signed in as {currentUser.email}
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-red-600 hover:text-red-800 underline"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Tabs - Material Design */}
      <div className="border-b border-gray-200 bg-white flex overflow-x-auto">
        <button
          onClick={() => setActiveTab("analyze")}
          className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "analyze"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-gray-600 hover:text-gray-900"
            }`}
        >
          Analyze
        </button>
        <button
          onClick={() => setActiveTab("tokens")}
          className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "tokens"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-gray-600 hover:text-gray-900"
            }`}
        >
          Tokens
        </button>
        <button
          onClick={() => setActiveTab("frameworks")}
          className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "frameworks"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-gray-600 hover:text-gray-900"
            }`}
        >
          Frameworks
        </button>
        <button
          onClick={() => setActiveTab("savings")}
          className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "savings"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-gray-600 hover:text-gray-900"
            }`}
        >
          Savings
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "history"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-gray-600 hover:text-gray-900"
            }`}
        >
          History
        </button>
        <button
          onClick={() => setActiveTab("tests")}
          className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "tests"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-gray-600 hover:text-gray-900"
            }`}
        >
          🧪 Tests
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
              if (activeTab === "analyze" && !e.target.value.trim()) {
                setOptimizedPrompt("")
              }
            }}
            placeholder="Enter your AI prompt here..."
            className="w-full h-32 p-3 text-sm border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
          />
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "analyze" && (
            <SmartOptimizer
              originalPrompt={prompt}
              onOptimized={(optimized) => setOptimizedPrompt(optimized)}
              onFrameworkSelected={(frameworkPrompt) => {
                // Update optimized prompt when framework is selected (for Savings tab)
                setOptimizedPrompt(frameworkPrompt)
              }}
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
          {activeTab === "tests" && <TestRunner />}
        </div>
      </div>

      {/* Footer - Material Design */}
      <div className="border-t border-gray-200 px-6 py-3 bg-white">
        <div className="text-xs text-gray-500 text-center">
          <span className="font-medium">PromptPrune</span> - Analyzed locally
        </div>
      </div>
    </div>
  )
}

export default IndexPopup

