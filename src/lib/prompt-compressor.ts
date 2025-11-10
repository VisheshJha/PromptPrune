/**
 * Prompt Compression Utilities
 * Helps shorten prompts while maintaining meaning and key information
 */

import { intelligentSpellCheck } from "./intelligent-processor"

export interface CompressionOptions {
  maxLength?: number
  targetLength?: number // Target word count
  preserveKeywords?: boolean
  removeRedundancy?: boolean
  simplifyPhrases?: boolean
  aggressive?: boolean
}

/**
 * Compress a prompt by removing redundancy and simplifying phrases
 */
export function compressPrompt(
  prompt: string,
  options: CompressionOptions = {}
): string {
  const {
    maxLength,
    targetLength,
    preserveKeywords = true,
    removeRedundancy = true,
    simplifyPhrases = true,
    aggressive = false,
  } = options

  let compressed = prompt.trim()

  // First, fix spelling using intelligent processor
  const spellChecked = intelligentSpellCheck(compressed)
  compressed = spellChecked.corrected

  // Remove redundant phrases
  if (removeRedundancy) {
    compressed = removeRedundantPhrases(compressed)
  }

  // Simplify common phrases
  if (simplifyPhrases) {
    compressed = simplifyCommonPhrases(compressed)
  }

  // Remove excessive whitespace
  compressed = compressed.replace(/\s+/g, " ").trim()

  // If targetLength (word count) is specified, calculate maxLength from it
  let effectiveMaxLength = maxLength
  if (targetLength && !maxLength) {
    // Approximate: 5 characters per word on average
    effectiveMaxLength = targetLength * 5
  }

  // If maxLength is specified, truncate intelligently
  if (effectiveMaxLength && compressed.length > effectiveMaxLength) {
    compressed = intelligentTruncate(compressed, effectiveMaxLength, preserveKeywords)
  }
  
  // If aggressive mode, apply additional compression
  if (aggressive && effectiveMaxLength && compressed.length > effectiveMaxLength) {
    // Remove more filler words
    compressed = compressed.replace(/\b(very|really|quite|rather|somewhat|pretty|fairly)\s+/gi, "")
    compressed = compressed.replace(/\b(in order to|so as to|for the purpose of)\b/gi, "to")
    compressed = compressed.replace(/\b(due to the fact that|owing to the fact that|because of the fact that)\b/gi, "because")
    compressed = compressed.replace(/\s+/g, " ").trim()
    
    // Final truncate if still too long
    if (compressed.length > effectiveMaxLength) {
      compressed = intelligentTruncate(compressed, effectiveMaxLength, preserveKeywords)
    }
  }

  return compressed
}

/**
 * Remove redundant phrases and words
 */
function removeRedundantPhrases(text: string): string {
  let cleaned = text

  // Remove redundant conjunctions
  cleaned = cleaned.replace(/\b(and|or|but)\s+(and|or|but)\s+/gi, "$1 ")

  // Remove duplicate words in sequence
  cleaned = cleaned.replace(/\b(\w+)\s+\1\b/gi, "$1")

  // Remove filler phrases
  const fillerPhrases = [
    /\b(you know|I mean|like|um|uh)\b/gi,
    /\b(in other words|that is to say|to put it simply)\b/gi,
    /\b(please note that|it is important to note that)\b/gi,
    /\b(make sure to|be sure to|don't forget to)\b/gi,
  ]

  fillerPhrases.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, "")
  })

  // Remove redundant adjectives
  cleaned = cleaned.replace(/\b(very|really|quite|extremely|incredibly)\s+(very|really|quite|extremely|incredibly)\s+/gi, "very ")

  return cleaned
}

/**
 * Simplify common phrases to shorter equivalents
 */
function simplifyCommonPhrases(text: string): string {
  const simplifications: Array<[RegExp, string]> = [
    [/\bin order to\b/gi, "to"],
    [/\bfor the purpose of\b/gi, "for"],
    [/\bwith regard to\b/gi, "about"],
    [/\bwith respect to\b/gi, "about"],
    [/\bin the event that\b/gi, "if"],
    [/\bprior to\b/gi, "before"],
    [/\bsubsequent to\b/gi, "after"],
    [/\bdue to the fact that\b/gi, "because"],
    [/\bin the case that\b/gi, "if"],
    [/\bfor the reason that\b/gi, "because"],
    [/\bit is necessary to\b/gi, "must"],
    [/\bit is important to\b/gi, "should"],
    [/\bmake an attempt to\b/gi, "try to"],
    [/\bcarry out\b/gi, "do"],
    [/\bput forward\b/gi, "suggest"],
    [/\btake into consideration\b/gi, "consider"],
    [/\bcome to a conclusion\b/gi, "conclude"],
    [/\bprovide assistance\b/gi, "help"],
    [/\bconduct an analysis\b/gi, "analyze"],
    [/\bperform a review\b/gi, "review"],
  ]

  let simplified = text
  simplifications.forEach(([pattern, replacement]) => {
    simplified = simplified.replace(pattern, replacement)
  })

  return simplified
}

/**
 * Intelligently truncate text while preserving keywords
 */
function intelligentTruncate(
  text: string,
  maxLength: number,
  preserveKeywords: boolean
): string {
  if (text.length <= maxLength) return text

  // Extract potential keywords (nouns, verbs, adjectives)
  const keywords = preserveKeywords ? extractKeywords(text) : []

  // Try to truncate at sentence boundaries first
  const sentences = text.split(/([.!?]+\s*)/)
  let truncated = ""
  let currentLength = 0

  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i] + (sentences[i + 1] || "")
    if (currentLength + sentence.length <= maxLength - 20) {
      truncated += sentence
      currentLength += sentence.length
    } else {
      break
    }
  }

  // If still too long, truncate at word boundaries
  if (truncated.length === 0 || truncated.length > maxLength) {
    truncated = text.substring(0, maxLength)
    const lastSpace = truncated.lastIndexOf(" ")
    if (lastSpace > maxLength * 0.8) {
      truncated = truncated.substring(0, lastSpace) + "..."
    } else {
      truncated = truncated + "..."
    }
  }

  // Ensure keywords are preserved if possible
  if (preserveKeywords && keywords.length > 0) {
    const truncatedLower = truncated.toLowerCase()
    const missingKeywords = keywords.filter(
      (kw) => !truncatedLower.includes(kw.toLowerCase())
    )

    if (missingKeywords.length > 0 && truncated.length < maxLength) {
      const spaceLeft = maxLength - truncated.length
      const keywordsToAdd = missingKeywords
        .slice(0, 2)
        .join(", ")
        .substring(0, spaceLeft - 10)
      if (keywordsToAdd) {
        truncated += ` (${keywordsToAdd})`
      }
    }
  }

  return truncated
}

/**
 * Extract potential keywords from text
 */
function extractKeywords(text: string): string[] {
  // Simple keyword extraction - look for capitalized words, important nouns
  const words = text.split(/\s+/)
  const keywords: string[] = []

  // Capitalized words (likely proper nouns or important terms)
  words.forEach((word) => {
    const cleaned = word.replace(/[.,!?;:]/g, "")
    if (
      cleaned.length > 3 &&
      /^[A-Z]/.test(cleaned) &&
      !keywords.includes(cleaned.toLowerCase())
    ) {
      keywords.push(cleaned)
    }
  })

  // Important action words
  const actionWords = [
    "create",
    "generate",
    "write",
    "analyze",
    "design",
    "develop",
    "implement",
    "optimize",
    "improve",
    "build",
  ]

  words.forEach((word) => {
    const cleaned = word.toLowerCase().replace(/[.,!?;:]/g, "")
    if (actionWords.includes(cleaned) && !keywords.includes(cleaned)) {
      keywords.push(cleaned)
    }
  })

  return keywords.slice(0, 5) // Limit to top 5 keywords
}

/**
 * Calculate compression ratio
 */
export function getCompressionRatio(original: string, compressed: string): number {
  if (original.length === 0) return 0
  return ((original.length - compressed.length) / original.length) * 100
}

