/**
 * Rule-based prompt optimization heuristics
 * Used as fallback when Ollama is not available
 */

export interface OptimizationResult {
  optimized: string
  originalLength: number
  optimizedLength: number
  reduction: number
  techniques: string[]
}

/**
 * Remove redundant whitespace
 */
function removeRedundantWhitespace(text: string): string {
  return text
    .replace(/\s+/g, " ") // Multiple spaces to single space
    .replace(/\n\s*\n\s*\n/g, "\n\n") // Multiple newlines to double
    .trim()
}

/**
 * Remove filler words and phrases
 */
function removeFillerWords(text: string): string {
  const fillerPatterns = [
    /\b(please\s+)?(kindly\s+)?(do\s+)?(make\s+sure\s+to\s+)?/gi,
    /\b(I\s+would\s+like\s+to\s+)?(I\s+want\s+to\s+)?(I\s+need\s+to\s+)?/gi,
    /\b(in\s+order\s+to\s+)/gi,
    /\b(for\s+the\s+purpose\s+of\s+)/gi,
    /\b(it\s+is\s+important\s+to\s+note\s+that\s+)/gi,
    /\b(it\s+should\s+be\s+noted\s+that\s+)/gi,
    /\b(as\s+you\s+can\s+see\s+)/gi,
    /\b(obviously\s+)/gi,
    /\b(clearly\s+)/gi,
    /\b(needless\s+to\s+say\s+)/gi,
  ]

  let result = text
  fillerPatterns.forEach((pattern) => {
    result = result.replace(pattern, "")
  })

  return result
}

/**
 * Simplify verbose phrases
 */
function simplifyVerbosePhrases(text: string): string {
  const replacements: [RegExp, string][] = [
    [/due\s+to\s+the\s+fact\s+that/gi, "because"],
    [/in\s+the\s+event\s+that/gi, "if"],
    [/prior\s+to/gi, "before"],
    [/subsequent\s+to/gi, "after"],
    [/in\s+accordance\s+with/gi, "per"],
    [/with\s+regard\s+to/gi, "about"],
    [/for\s+the\s+reason\s+that/gi, "because"],
    [/in\s+order\s+that/gi, "so"],
    [/at\s+this\s+point\s+in\s+time/gi, "now"],
    [/in\s+the\s+near\s+future/gi, "soon"],
    [/a\s+large\s+number\s+of/gi, "many"],
    [/a\s+small\s+number\s+of/gi, "few"],
    [/take\s+into\s+consideration/gi, "consider"],
    [/give\s+rise\s+to/gi, "cause"],
    [/put\s+forward/gi, "propose"],
    [/which\s+can\s+be\s+used\s+to/gi, "to"],
    [/that\s+can\s+be\s+used\s+to/gi, "to"],
    [/can\s+be\s+used\s+to/gi, "to"],
    [/is\s+able\s+to/gi, "can"],
    [/is\s+capable\s+of/gi, "can"],
    [/has\s+the\s+ability\s+to/gi, "can"],
    [/has\s+the\s+capacity\s+to/gi, "can"],
    [/in\s+order\s+to/gi, "to"],
    [/for\s+the\s+purpose\s+of/gi, "to"],
  ]

  let result = text
  replacements.forEach(([pattern, replacement]) => {
    result = result.replace(pattern, replacement)
  })

  return result
}

/**
 * Remove redundant qualifiers
 */
function removeRedundantQualifiers(text: string): string {
  const redundantPatterns = [
    /\b(very\s+)?(really\s+)?(quite\s+)?(extremely\s+)?(incredibly\s+)?/gi,
    /\b(completely\s+)?(totally\s+)?(absolutely\s+)?/gi,
  ]

  let result = text
  redundantPatterns.forEach((pattern) => {
    result = result.replace(pattern, "")
  })

  return result
}

/**
 * Remove redundant phrases and repeated concepts
 */
function removeRedundancy(text: string): string {
  let result = text

  // Remove "type of" when not needed (e.g., "titanic type of ship" → "titanic ship")
  result = result.replace(/\b(\w+)\s+type\s+of\s+(\w+)\b/gi, (match, adj, noun) => {
    // Keep "type of" only if it adds clarity (e.g., "different type of car", "certain type")
    const keepers = ["different", "certain", "specific", "particular", "same", "similar"]
    if (keepers.includes(adj.toLowerCase())) {
      return match
    }
    return `${adj} ${noun}`
  })

  // Remove trailing redundant phrases like "like X in Y" when X is already mentioned
  // Pattern: "like [word] in [word]" at the end
  const trailingLikePattern = /\s+like\s+(\w+)\s+in\s+\w+\s*$/gi
  result = result.replace(trailingLikePattern, (match) => {
    // Extract the word after "like"
    const wordMatch = match.match(/like\s+(\w+)/i)
    if (wordMatch) {
      const word = wordMatch[1]
      // Check if the word appears earlier in the sentence (before this match)
      const beforeMatch = result.substring(0, result.length - match.length)
      if (beforeMatch.toLowerCase().includes(word.toLowerCase())) {
        return "" // Remove redundant phrase
      }
    }
    return match
  })

  // Remove duplicate consecutive phrases (2-4 words)
  result = result.replace(/\b(\w+(?:\s+\w+){1,3})\s+\1\b/gi, "$1")

  return result
}

/**
 * Fix common typos
 */
function fixCommonTypos(text: string): string {
  const typoCorrections: [RegExp, string][] = [
    // Common word typos
    [/\bod\b/gi, "of"],
    [/\bwhihc\b/gi, "which"],
    [/\bteh\b/gi, "the"],
    [/\badn\b/gi, "and"],
    [/\byuo\b/gi, "you"],
    [/\brecieve\b/gi, "receive"],
    [/\brecieved\b/gi, "received"],
    [/\bseperate\b/gi, "separate"],
    [/\boccured\b/gi, "occurred"],
    [/\bdefinately\b/gi, "definitely"],
    [/\bneccessary\b/gi, "necessary"],
    [/\baccomodate\b/gi, "accommodate"],
    [/\bexistance\b/gi, "existence"],
    [/\boccassion\b/gi, "occasion"],
    [/\bthier\b/gi, "their"],
    [/\bwierd\b/gi, "weird"],
    [/\bacheive\b/gi, "achieve"],
    [/\bacheivement\b/gi, "achievement"],
    [/\bexcersise\b/gi, "exercise"],
    [/\bexcersize\b/gi, "exercise"],
    [/\bpriviledge\b/gi, "privilege"],
    [/\bmaintainance\b/gi, "maintenance"],
    [/\bpersistant\b/gi, "persistent"],
    [/\bpersistance\b/gi, "persistence"],
    [/\boccurence\b/gi, "occurrence"],
    [/\bexistant\b/gi, "existent"],
    [/\bseperation\b/gi, "separation"],
  ]

  let result = text
  typoCorrections.forEach(([pattern, replacement]) => {
    result = result.replace(pattern, replacement)
  })

  return result
}

/**
 * Optimize using heuristics
 */
export function optimizeWithHeuristics(prompt: string): OptimizationResult {
  const originalLength = prompt.length
  const techniques: string[] = []

  let optimized = prompt

  // Fix typos first (improves quality and can reduce length)
  const beforeTypos = optimized.length
  optimized = fixCommonTypos(optimized)
  if (optimized !== prompt) {
    techniques.push("Fixed typos")
  }

  // Apply optimizations
  const beforeWhitespace = optimized.length
  optimized = removeRedundantWhitespace(optimized)
  if (optimized.length < beforeWhitespace) {
    techniques.push("Removed redundant whitespace")
  }

  const beforeFiller = optimized.length
  optimized = removeFillerWords(optimized)
  if (optimized.length < beforeFiller) {
    techniques.push("Removed filler words")
  }

  const beforeVerbose = optimized.length
  optimized = simplifyVerbosePhrases(optimized)
  if (optimized.length < beforeVerbose) {
    techniques.push("Simplified verbose phrases")
  }

  const beforeQualifiers = optimized.length
  optimized = removeRedundantQualifiers(optimized)
  if (optimized.length < beforeQualifiers) {
    techniques.push("Removed redundant qualifiers")
  }

  const beforeRedundancy = optimized.length
  optimized = removeRedundancy(optimized)
  if (optimized.length < beforeRedundancy) {
    techniques.push("Removed redundant phrases")
  }

  // Clean up any double spaces that might have been created
  optimized = optimized.replace(/\s+/g, " ").trim()

  const optimizedLength = optimized.length
  const reduction = originalLength - optimizedLength

  return {
    optimized,
    originalLength,
    optimizedLength,
    reduction,
    techniques: techniques.length > 0 ? techniques : ["No optimizations applied"],
  }
}

