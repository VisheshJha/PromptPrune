/**
 * Framework Token Analyzer
 * Analyzes token counts for each framework across different AI models
 */

import { getAllTokenCounts, type AllTokenCounts } from "./tokenizers"
import { applyFramework, getAllFrameworkOutputs, type FrameworkType, type FrameworkOutput } from "./prompt-frameworks"
// Removed unused optimizePrompt import for performance

export interface FrameworkTokenAnalysis {
  framework: FrameworkType
  frameworkName: string
  output: string
  optimized: string
  tokenCounts: AllTokenCounts
  optimizedTokenCounts: AllTokenCounts
  savings: {
    [model: string]: {
      original: number
      optimized: number
      saved: number
      savedPercent: number
    }
  }
  averageSavings: number
  averageSavingsPercent: number
}

/**
 * Analyze token counts for all frameworks
 */
export async function analyzeFrameworkTokens(
  originalPrompt: string
): Promise<FrameworkTokenAnalysis[]> {
  const frameworks = await getAllFrameworkOutputs(originalPrompt)
  const analyses: FrameworkTokenAnalysis[] = []
  
  for (const frameworkOutput of frameworks) {
    const framework = frameworkOutput.framework as FrameworkType
    
    // Get framework-structured output
    const frameworkOutputText = frameworkOutput.optimized
    
    // Optimize the framework output
    // Removed optimizePrompt call - use framework output directly for performance
    const optimizedResult = {
      optimized: frameworkOutputText,
      reduction: 0,
      reductionPercent: 0
    }
    const optimizedText = optimizedResult.optimized
    
    // Get token counts for both
    const [frameworkCounts, optimizedCounts] = await Promise.all([
      getAllTokenCounts(frameworkOutputText),
      getAllTokenCounts(optimizedText)
    ])
    
    // Calculate savings per model
    const savings: FrameworkTokenAnalysis["savings"] = {}
    
    // Flatten all token counts from both structures
    const allFrameworkTokens: Array<{ model: string; count: number }> = []
    const allOptimizedTokens: Array<{ model: string; count: number }> = []
    
    Object.values(frameworkCounts).forEach(providerTokens => {
      providerTokens.forEach(token => {
        allFrameworkTokens.push({ model: `${token.provider}/${token.model}`, count: token.count })
      })
    })
    
    Object.values(optimizedCounts).forEach(providerTokens => {
      providerTokens.forEach(token => {
        allOptimizedTokens.push({ model: `${token.provider}/${token.model}`, count: token.count })
      })
    })
    
    // Create a map of all unique models
    const allModels = new Set([
      ...allFrameworkTokens.map(t => t.model),
      ...allOptimizedTokens.map(t => t.model)
    ])
    
    let totalSavings = 0
    let totalSavingsPercent = 0
    let modelCount = 0
    
    for (const model of allModels) {
      const frameworkToken = allFrameworkTokens.find(t => t.model === model)
      const optimizedToken = allOptimizedTokens.find(t => t.model === model)
      
      const original = frameworkToken?.count || 0
      const optimized = optimizedToken?.count || 0
      const saved = original - optimized
      const savedPercent = original > 0 ? (saved / original) * 100 : 0
      
      savings[model] = {
        original,
        optimized,
        saved,
        savedPercent
      }
      
      totalSavings += saved
      totalSavingsPercent += savedPercent
      modelCount++
    }
    
    const averageSavings = modelCount > 0 ? totalSavings / modelCount : 0
    const averageSavingsPercent = modelCount > 0 ? totalSavingsPercent / modelCount : 0
    
    analyses.push({
      framework,
      frameworkName: frameworkOutput.name,
      output: frameworkOutputText,
      optimized: optimizedText,
      tokenCounts: frameworkCounts,
      optimizedTokenCounts: optimizedCounts,
      savings,
      averageSavings,
      averageSavingsPercent
    })
  }
  
  // Sort by average savings (descending)
  return analyses.sort((a, b) => b.averageSavings - a.averageSavings)
}

/**
 * Get top models for a framework (most savings)
 */
export function getTopModelsForFramework(
  analysis: FrameworkTokenAnalysis,
  topN: number = 3
): Array<{ model: string; saved: number; savedPercent: number }> {
  return Object.entries(analysis.savings)
    .map(([model, data]) => ({
      model,
      saved: data.saved,
      savedPercent: data.savedPercent
    }))
    .sort((a, b) => b.saved - a.saved)
    .slice(0, topN)
}

