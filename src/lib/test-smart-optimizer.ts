/**
 * Test script for smart prompt optimizer
 * Run in browser console: testSmartOptimizer("your prompt here")
 */

import { optimizePromptSmartly } from './smart-prompt-optimizer'
import { getUnifiedModelManager } from './unified-model-manager'

export async function testSmartOptimizer(prompt: string) {
  console.log("🧪 Testing Smart Prompt Optimizer")
  console.log("=".repeat(80))
  console.log("Input prompt:", prompt)
  console.log()
  
  try {
    // Check model status
    const modelManager = getUnifiedModelManager()
    const status = modelManager.getStatus()
    console.log("Model Status:")
    console.log("  Unified Model:", status.model ? "✅ Ready" : "❌ Not loaded")
    console.log("  Total Size:", status.totalSize)
    console.log("  Estimated RAM:", status.estimatedRAM)
    console.log()
    
    // Run optimization
    console.log("Running optimization...")
    const startTime = Date.now()
    const result = await optimizePromptSmartly(prompt)
    const duration = Date.now() - startTime
    
    console.log("✅ Optimization complete!")
    console.log("Duration:", duration, "ms")
    console.log()
    console.log("Results:")
    const { FRAMEWORKS } = await import('./prompt-frameworks')
    console.log("  Framework:", result.framework, `(${FRAMEWORKS[result.framework]?.name || result.framework})`)
    console.log("  Confidence:", Math.round(result.confidence * 100) + "%")
    console.log("  Intent Category:", result.intent.category)
    console.log("  Action:", result.intent.action)
    console.log("  Topic:", result.intent.topic)
    console.log("  Format:", result.intent.format || "N/A")
    console.log("  Tone:", result.intent.tone || "N/A")
    console.log("  Warnings:", result.warnings.length > 0 ? result.warnings.join(", ") : "None")
    console.log("  Entities found:", result.entities.length)
    console.log()
    console.log("Improved Prompt:")
    console.log("-".repeat(80))
    console.log(result.improvedPrompt)
    console.log("-".repeat(80))
    
    return result
  } catch (error) {
    console.error("❌ Test failed:", error)
    throw error
  }
}

// Make available globally in browser
if (typeof window !== "undefined") {
  (window as any).testSmartOptimizer = testSmartOptimizer
  console.log("🧪 Test function loaded! Use: testSmartOptimizer('your prompt here')")
}

