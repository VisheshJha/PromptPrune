/**
 * Intelligent Prompt Processor
 * Uses advanced algorithms for spell checking, topic extraction, and intent analysis
 */

import nlp from "compromise"

/**
 * Common English words dictionary for spell checking
 */
const COMMON_WORDS = new Set([
  // Action words
  'write', 'create', 'make', 'generate', 'tell', 'explain', 'describe', 'discuss',
  'about', 'on', 'for', 'to', 'with', 'and', 'or', 'the', 'a', 'an',
  // Common nouns
  'article', 'report', 'blog', 'post', 'content', 'summary', 'guide', 'tutorial',
  'topic', 'subject', 'information', 'data', 'analysis', 'research',
  // Common adjectives
  'short', 'long', 'brief', 'detailed', 'comprehensive', 'clear', 'engaging',
  'professional', 'casual', 'friendly', 'technical', 'general',
  // Common verbs
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might',
  // Common prepositions
  'in', 'on', 'at', 'by', 'for', 'from', 'of', 'to', 'with', 'without',
  // Numbers
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'hundred', 'thousand', 'million',
])

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []
  const len1 = str1.length
  const len2 = str2.length

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + 1   // substitution
        )
      }
    }
  }

  return matrix[len1][len2]
}

/**
 * Find the closest word from dictionary using Levenshtein distance
 */
function findClosestWord(word: string, maxDistance: number = 2): string | null {
  const lowerWord = word.toLowerCase()
  
  // If it's already a common word, return it
  if (COMMON_WORDS.has(lowerWord)) {
    return word
  }

  let bestMatch: string | null = null
  let bestDistance = maxDistance + 1

  for (const dictWord of COMMON_WORDS) {
    const distance = levenshteinDistance(lowerWord, dictWord)
    if (distance < bestDistance) {
      bestDistance = distance
      bestMatch = dictWord
    }
  }

  // Also check common misspellings
  const commonMisspellings: Record<string, string> = {
    'wriet': 'write',
    'wrte': 'write',
    'writng': 'writing',
    'writ': 'write',
    'abt': 'about',
    'abut': 'about',
    'gud': 'good',
    'contnt': 'content',
    'contant': 'content',
    'contnet': 'content',
    'tech': 'technology',
    'plz': 'please',
    'pls': 'please',
    'u': 'you',
    'ur': 'your',
    'thru': 'through',
    'thx': 'thanks',
    'ty': 'thank you',
  }

  if (commonMisspellings[lowerWord]) {
    return commonMisspellings[lowerWord]
  }

  return bestDistance <= maxDistance ? bestMatch : null
}

/**
 * Intelligent spell checking with context awareness
 */
export function intelligentSpellCheck(text: string): {
  corrected: string
  corrections: Array<{ original: string; corrected: string; position: number }>
} {
  const corrections: Array<{ original: string; corrected: string; position: number }> = []
  let corrected = text

  // Split into words while preserving punctuation
  const words = text.match(/\b\w+\b/g) || []
  const wordPositions = new Map<string, number>()
  
  words.forEach((word, index) => {
    if (!wordPositions.has(word)) {
      wordPositions.set(word, index)
    }
  })

  // Check each word
  words.forEach((word) => {
    const lowerWord = word.toLowerCase()
    
    // Skip if it's a common word
    if (COMMON_WORDS.has(lowerWord)) {
      return
    }

    // Check common misspellings first (more accurate)
    const commonMisspellings: Record<string, string> = {
      'wriet': 'write',
      'wrte': 'write',
      'writng': 'writing',
      'writ': 'write',
      'abt': 'about',
      'abut': 'about',
      'gud': 'good',
      'contnt': 'content',
      'contant': 'content',
      'contnet': 'content',
      'tech': 'technology',
      'plz': 'please',
      'pls': 'please',
      'u': 'you',
      'ur': 'your',
      'thru': 'through',
      'thx': 'thanks',
      'ty': 'thank you',
      'delhi': 'Delhi', // Preserve proper nouns but fix case if needed
    }

    if (commonMisspellings[lowerWord]) {
      const correctedWord = commonMisspellings[lowerWord]
      const regex = new RegExp(`\\b${word}\\b`, 'gi')
      if (corrected.match(regex)) {
        corrected = corrected.replace(regex, (match) => {
          // Preserve capitalization for proper nouns
          if (/^[A-Z]/.test(match) && /^[A-Z]/.test(correctedWord)) {
            return correctedWord
          }
          // Otherwise use lowercase
          return correctedWord.toLowerCase()
        })
        corrections.push({
          original: word,
          corrected: correctedWord,
          position: wordPositions.get(word) || 0
        })
        return
      }
    }

    // Try to find closest match using Levenshtein distance (only for non-proper nouns)
    if (!/^[A-Z]/.test(word)) {
      const closest = findClosestWord(word, 2)
      if (closest && closest !== lowerWord) {
        // Replace word in text (case-insensitive, whole word only)
        const regex = new RegExp(`\\b${word}\\b`, 'gi')
        if (corrected.match(regex)) {
          corrected = corrected.replace(regex, (match) => {
            // Preserve capitalization
            if (/^[A-Z]/.test(match)) {
              return closest.charAt(0).toUpperCase() + closest.slice(1)
            }
            return closest
          })
          corrections.push({
            original: word,
            corrected: closest,
            position: wordPositions.get(word) || 0
          })
        }
      }
    }
  })

  // Use compromise for additional normalization
  try {
    const doc = nlp(corrected)
    const normalized = doc.normalize().out('text')
    if (normalized && normalized.length > 0 && normalized !== corrected) {
      corrected = normalized
    }
  } catch (e) {
    // If compromise fails, use the corrected version
  }

  return { corrected, corrections }
}

/**
 * Extract intent with better NLP analysis
 */
export function extractIntent(text: string): {
  action: string
  topic: string
  format: string
  audience: string
  tone: string
  constraints: {
    wordCount?: number
    length?: string
    style?: string
  }
} {
  const doc = nlp(text)
  const lower = text.toLowerCase()

  // Extract action
  const verbs = doc.verbs().out('array')
  const action = verbs[0]?.toLowerCase() || 'write'
  
  // Extract topic - look for noun phrases after action words
  let topic = ''
  const topicPatterns = [
    // Pattern 1: "write about X"
    /(?:write|create|make|generate|tell|explain|describe|discuss)\s+(?:about|on|regarding)\s+([^.,!?\n]+?)(?:\s+(?:for|to|with|and|or|,|\.|$)|$)/i,
    // Pattern 2: "write a short article about X"
    /(?:write|create|make|generate)\s+(?:a|an|the)?\s*(?:short|brief|long|detailed)?\s*(?:article|report|blog|summary)?\s+(?:about|on|regarding)\s+([^.,!?\n]+?)(?:\s+(?:for|to|with|and|or|,|\.|$)|$)/i,
    // Pattern 3: "write X" (direct object)
    /(?:write|create|make|generate)\s+([^.,!?\n]+?)(?:\s+(?:about|on|for|to|with|and|or|,|\.|$)|$)/i,
  ]

  for (const pattern of topicPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      topic = match[1].trim()
      // Remove action words that might have been captured
      topic = topic.replace(/^(a|an|the|short|brief|long|detailed|article|report|blog|summary|content)\s+/i, '')
      // Remove trailing qualifiers
      topic = topic.replace(/\s+(for|to|with|and|or|make|it|good|better|gud)\s+[^,]+$/, '').trim()
      // Remove common filler words at the end
      topic = topic.replace(/\s+(stuff|things|topics|subject)$/i, '').trim()
      if (topic && topic.length > 2 && !COMMON_WORDS.has(topic.toLowerCase())) {
        break
      }
    }
  }

  // If no topic found, try to extract from nouns
  if (!topic || topic.length < 2) {
    const nouns = doc.nouns().out('array')
    const actionWords = ['write', 'create', 'make', 'generate', 'tell', 'explain', 'article', 'report', 'blog', 'content']
    const topicNouns = nouns.filter(n => 
      !actionWords.includes(n.toLowerCase()) && 
      n.length > 2 &&
      !COMMON_WORDS.has(n.toLowerCase())
    )
    if (topicNouns.length > 0) {
      topic = topicNouns.slice(0, 3).join(' ')
    }
  }

  // Extract format
  let format = 'article'
  if (lower.includes('report')) format = 'report'
  else if (lower.includes('blog')) format = 'blog post'
  else if (lower.includes('summary')) format = 'summary'
  else if (lower.includes('guide') || lower.includes('tutorial')) format = 'guide'
  else if (lower.includes('article')) format = 'article'

  // Extract audience
  let audience = 'general readers'
  if (lower.includes('professional') || lower.includes('business')) audience = 'professional audience'
  else if (lower.includes('student') || lower.includes('academic')) audience = 'students'
  else if (lower.includes('expert') || lower.includes('technical')) audience = 'technical audience'
  else if (lower.includes('general')) audience = 'general readers'

  // Extract tone
  let tone = 'clear, engaging'
  if (lower.includes('engaging') || lower.includes('not boring') || lower.includes('good')) {
    tone = 'clear, engaging'
  } else if (lower.includes('professional')) {
    tone = 'professional and clear'
  } else if (lower.includes('casual') || lower.includes('friendly')) {
    tone = 'friendly and accessible'
  } else if (lower.includes('formal')) {
    tone = 'formal and professional'
  }

  // Extract constraints
  const constraints: { wordCount?: number; length?: string; style?: string } = {}
  
  // Word count
  const wordCountMatch = lower.match(/(\d+)\s*words?/)
  if (wordCountMatch) {
    constraints.wordCount = parseInt(wordCountMatch[1])
  } else if (lower.includes('short') || lower.includes('brief')) {
    constraints.length = 'short (around 600 words)'
  } else if (lower.includes('long') || lower.includes('detailed')) {
    constraints.length = 'long (around 1500 words)'
  }

  // Style
  if (lower.includes('engaging')) constraints.style = 'engaging'
  else if (lower.includes('professional')) constraints.style = 'professional'
  else if (lower.includes('casual')) constraints.style = 'casual'

  return {
    action,
    topic: topic || 'the specified topic',
    format,
    audience,
    tone,
    constraints
  }
}

/**
 * Build a structured prompt from extracted intent
 */
export function buildStructuredPrompt(intent: {
  action: string
  topic: string
  format: string
  audience: string
  tone: string
  constraints: {
    wordCount?: number
    length?: string
    style?: string
  }
}): string {
  const { action, topic, format, audience, tone, constraints } = intent

  let prompt = `Write a ${constraints.length?.includes('short') ? 'short' : constraints.length?.includes('long') ? 'comprehensive' : 'short'} ${format} on ${topic}, for ${audience}.\n\n`

  // Add structure if topic is specific
  if (topic && !topic.toLowerCase().includes('specified topic') && topic.split(' ').length <= 5) {
    // Could add sections here if needed
  }

  // Add tone
  prompt += `Use a ${tone} tone.\n\n`

  // Add length constraint
  if (constraints.wordCount) {
    prompt += `Keep it around ${constraints.wordCount} words`
  } else if (constraints.length) {
    prompt += constraints.length
  } else {
    prompt += 'Keep it concise (around 600 words)'
  }
  
  prompt += ' and organize it with headings.'

  return prompt.trim()
}

/**
 * Main intelligent processing function
 */
export function processPromptIntelligently(prompt: string): {
  original: string
  corrected: string
  structured: string
  intent: ReturnType<typeof extractIntent>
} {
  // Step 1: Spell check
  const spellChecked = intelligentSpellCheck(prompt)
  
  // Step 2: Extract intent
  const intent = extractIntent(spellChecked.corrected)
  
  // Step 3: Build structured prompt
  const structured = buildStructuredPrompt(intent)

  return {
    original: prompt,
    corrected: spellChecked.corrected,
    structured,
    intent
  }
}

