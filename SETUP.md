# PromptPrune Setup Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Development mode:**
   ```bash
   npm run dev
   ```
   This will start the development server and watch for changes.

3. **Load extension in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Navigate to the `build/chrome-mv3-dev` directory in this project

## Optional: Ollama Setup (for ML-based optimization)

For the best optimization results, install Ollama and the TinyLlama model:

1. **Install Ollama:**
   - Visit [ollama.ai](https://ollama.ai) and download for your OS
   - Or use: `curl https://ollama.ai/install.sh | sh`

2. **Pull TinyLlama model:**
   ```bash
   ollama pull tinyllama:1.1b
   ```

3. **Start Ollama:**
   ```bash
   ollama serve
   ```
   Ollama runs on `http://localhost:11434` by default.

4. **Verify it's working:**
   ```bash
   curl http://localhost:11434/api/tags
   ```

The extension will automatically detect if Ollama is available and use ML-based optimization. If Ollama is not available, it will fall back to rule-based heuristics.

## Building for Production

```bash
npm run build
```

This creates a production build in the `build/chrome-mv3-prod` directory, ready for Chrome Web Store submission.

## Project Structure

```
src/
├── popup/              # Main popup interface
│   ├── components/     # React components
│   └── popup.tsx      # Main popup entry point
├── lib/               # Core libraries
│   ├── tokenizers/    # Token counting services
│   ├── ollama.ts      # Ollama client
│   └── heuristics.ts  # Rule-based optimizer
└── background/        # Service worker
    └── service-worker.ts
```

## Troubleshooting

### Token counting not working
- Ensure `tiktoken` is properly installed: `npm install`
- Check browser console for errors

### Ollama optimization not working
- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Check that TinyLlama is installed: `ollama list`
- Ensure no firewall is blocking localhost:11434

### Extension not loading
- Make sure you're loading from `build/chrome-mv3-dev` (dev) or `build/chrome-mv3-prod` (production)
- Check Chrome's extension error page for details
- Verify all dependencies are installed

## Features

- ✅ Real-time token counting (GPT-4, Claude, Gemini)
- ✅ Smart optimization (Ollama + TinyLlama or heuristics)
- ✅ Cost savings calculator
- ✅ One-click copy optimized prompts
- ✅ 100% local processing (no external APIs)

