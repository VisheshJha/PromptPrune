/**
 * Simple Prompt Optimizer
 * Fast, rule-based optimization similar to Prompt Perfect
 */

export interface OptimizationResult {
  optimized: string
  originalLength: number
  optimizedLength: number
  reduction: number
  techniques: string[]
}

export function optimizePrompt(prompt: string): OptimizationResult {
  const originalLength = prompt.length
  const techniques: string[] = []
  
  if (!prompt.trim()) {
    return {
      optimized: prompt,
      originalLength: 0,
      optimizedLength: 0,
      reduction: 0,
      techniques: [],
    }
  }

  let optimized = prompt

  // Remove excessive whitespace
  optimized = optimized.replace(/\s+/g, " ").trim()
  techniques.push("Removed extra spaces")

  // Remove common filler phrases
  const fillers = [
    /\bI would like to\b/gi,
    /\bI want to\b/gi,
    /\bI need to\b/gi,
    /\bplease\s+make\s+sure\b/gi,
    /\bkind\s+of\b/gi,
    /\bsort\s+of\b/gi,
    /\bvery\s+much\b/gi,
    /\bquite\s+a\s+bit\b/gi,
    /\bin\s+order\s+to\b/gi,
    /\bfor\s+the\s+purpose\s+of\b/gi,
  ]
  
  fillers.forEach(filler => {
    if (filler.test(optimized)) {
      optimized = optimized.replace(filler, "")
      techniques.push("Removed filler words")
    }
  })

  // Simplify verbose expressions
  const simplifications: [RegExp, string][] = [
    [/due\s+to\s+the\s+fact\s+that/gi, "because"],
    [/in\s+the\s+event\s+that/gi, "if"],
    [/at\s+this\s+point\s+in\s+time/gi, "now"],
    [/prior\s+to/gi, "before"],
    [/subsequent\s+to/gi, "after"],
    [/with\s+regard\s+to/gi, "about"],
    [/in\s+relation\s+to/gi, "about"],
    [/in\s+the\s+case\s+of/gi, "if"],
    [/for\s+the\s+reason\s+that/gi, "because"],
    [/in\s+spite\s+of\s+the\s+fact\s+that/gi, "although"],
  ]

  simplifications.forEach(([pattern, replacement]) => {
    if (pattern.test(optimized)) {
      optimized = optimized.replace(pattern, replacement)
      techniques.push("Simplified expressions")
    }
  })

  // Remove redundant qualifiers
  const redundant = [
    /\bvery\s+important\b/gi,
    /\babsolutely\s+essential\b/gi,
    /\bcompletely\s+necessary\b/gi,
    /\btotally\s+required\b/gi,
  ]

  redundant.forEach(pattern => {
    if (pattern.test(optimized)) {
      optimized = optimized.replace(pattern, "important")
      techniques.push("Removed redundant qualifiers")
    }
  })

  // Clean up again
  optimized = optimized.replace(/\s+/g, " ").trim()
  optimized = optimized.replace(/\s+([,.!?;:])/g, "$1")
  optimized = optimized.replace(/([,.!?;:])\s+/g, "$1 ")

  const optimizedLength = optimized.length
  const reduction = originalLength - optimizedLength

  return {
    optimized,
    originalLength,
    optimizedLength,
    reduction,
    techniques: [...new Set(techniques)], // Remove duplicates
  }
}

