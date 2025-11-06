import { useState } from "react"

interface OllamaSetupGuideProps {
  onClose?: () => void
}

export function OllamaSetupGuide({ onClose }: OllamaSetupGuideProps) {
  const [copied, setCopied] = useState(false)

  const copyCommand = (command: string) => {
    navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-blue-900 mb-1">
            Enable Smart ML Optimization (Optional)
          </h3>
          <p className="text-xs text-blue-700">
            For better optimization results, install Ollama locally. The extension works great without it using rule-based optimization.
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-blue-600 hover:text-blue-800 text-lg font-bold"
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <div className="font-semibold text-blue-900 mb-1">Step 1: Install Ollama</div>
          <div className="text-blue-700 space-y-1">
            <p>Visit <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="underline">ollama.ai</a> and download for your OS</p>
            <p className="font-mono bg-blue-100 px-2 py-1 rounded text-xs">
              curl https://ollama.ai/install.sh | sh
            </p>
          </div>
        </div>

        <div>
          <div className="font-semibold text-blue-900 mb-1">Step 2: Pull TinyLlama Model</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono bg-blue-100 px-2 py-1 rounded text-xs">
              ollama pull tinyllama:1.1b
            </code>
            <button
              onClick={() => copyCommand("ollama pull tinyllama:1.1b")}
              className="px-2 py-1 bg-blue-200 hover:bg-blue-300 rounded text-xs"
            >
              {copied ? "✓" : "Copy"}
            </button>
          </div>
        </div>

        <div>
          <div className="font-semibold text-blue-900 mb-1">Step 3: Start Ollama</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono bg-blue-100 px-2 py-1 rounded text-xs">
              ollama serve
            </code>
            <button
              onClick={() => copyCommand("ollama serve")}
              className="px-2 py-1 bg-blue-200 hover:bg-blue-300 rounded text-xs"
            >
              {copied ? "✓" : "Copy"}
            </button>
          </div>
          <p className="text-blue-600 mt-1 text-xs">
            Keep this terminal open. Ollama runs on http://localhost:11434
          </p>
        </div>

        <div className="pt-2 border-t border-blue-200">
          <p className="text-blue-700">
            <strong>Note:</strong> The extension will automatically detect Ollama when it's running. 
            You can use the extension normally without Ollama - it will use rule-based optimization instead.
          </p>
        </div>
      </div>
    </div>
  )
}

