# PromptPrune

A Chrome extension that optimizes AI prompts to reduce token usage and costs using local processing.

## Features

### Core Features (No Setup Required)
- **Real-time token counting** for GPT-4, Claude, Gemini models
- **Rule-based prompt optimization** - works immediately, no dependencies
- **Cost savings calculator** with monthly estimates
- **One-click copy** optimized prompts
- **Completely free** - no servers/APIs required (100% local)

### Optional Smart Features (Requires Ollama)
- **ML-based optimization** via local Ollama + TinyLlama for better results
- Automatically detected when Ollama is running
- Falls back to rule-based optimization if Ollama is unavailable

## Tech Stack

- **Frontend**: Plasmo (React + TypeScript + Tailwind)
- **ML**: Ollama local + TinyLlama 1.1B
- **Tokenizers**: tiktoken
- **Storage**: chrome.storage.local
- **Backend**: None (100% local)

## Installation

### Prerequisites

1. **Node.js** (v18 or higher)
2. **Ollama** (optional, for ML-based optimization)
   - Install from [ollama.ai](https://ollama.ai)
   - Pull TinyLlama model: `ollama pull tinyllama:1.1b`

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd PromptPrune
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `build/chrome-mv3-dev` directory

## Development

Run the development server:
```bash
npm run dev
```

This will watch for changes and rebuild automatically.

## Testing

Run the test suite:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

Run tests with UI:
```bash
npm run test:ui
```

See [TESTING.md](./TESTING.md) for detailed testing documentation.

## Usage

1. Click the PromptPrune icon in your Chrome toolbar
2. Enter your AI prompt in the textarea
3. View token counts across different models
4. Click "Optimize Prompt" to reduce token usage
5. Copy the optimized prompt with one click
6. View cost savings estimates in the Savings tab

## Optimization Methods

### Rule-Based (Default - Always Available)
- **No setup required** - works immediately after installation
- Removes redundant whitespace
- Eliminates filler words and phrases
- Simplifies verbose expressions
- Removes redundant qualifiers
- **This is the core optimization method** - the extension works great with just this!

### ML-Based (Optional - Requires Ollama)
- Uses TinyLlama 1.1B model running locally
- Provides semantic understanding for better optimization
- **Requires manual installation** of Ollama (see setup instructions below)
- Automatically detected when Ollama is running on `http://localhost:11434`
- Falls back to rule-based optimization if Ollama is unavailable
- **Note:** Chrome extensions cannot start local processes - you must run `ollama serve` separately

## Project Structure

```
src/
├── popup/
│   ├── components/
│   │   ├── TokenDisplay.tsx
│   │   ├── SmartOptimizer.tsx
│   │   └── SavingsCalculator.tsx
│   └── popup.tsx
├── lib/
│   ├── tokenizers/
│   │   ├── openai.ts
│   │   ├── anthropic.ts
│   │   ├── gemini.ts
│   │   └── index.ts
│   ├── ollama.ts
│   └── heuristics.ts
└── background/
    └── service-worker.ts
```

## License

See LICENSE file for details.
