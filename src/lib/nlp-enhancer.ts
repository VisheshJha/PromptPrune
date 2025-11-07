/**
 * Enhanced NLP techniques for prompt optimization
 * Uses advanced text analysis to improve optimization quality
 */

/**
 * Extract semantic meaning from sentences
 */
export function extractSemanticMeaning(text: string): {
  entities: string[]
  actions: string[]
  concepts: string[]
} {
  const lower = text.toLowerCase()
  const entities: string[] = []
  const actions: string[] = []
  const concepts: string[] = []

  // Extract entities (nouns, proper nouns)
  const nounPatterns = [
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g, // Proper nouns
    /\b(the|a|an)\s+([a-z]+(?:\s+[a-z]+)*)\b/gi, // Common nouns with articles
  ]

  nounPatterns.forEach(pattern => {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const entity = match[2] || match[1]
      if (entity && entity.length > 3 && !isCommonWord(entity)) {
        entities.push(entity.toLowerCase())
      }
    }
  })

  // Extract actions (verbs)
  const actionVerbs = [
    'write', 'create', 'generate', 'build', 'make', 'develop',
    'explain', 'describe', 'analyze', 'discuss', 'summarize',
    'design', 'plan', 'outline', 'list', 'show', 'tell',
    'optimize', 'improve', 'enhance', 'refine', 'structure'
  ]

  actionVerbs.forEach(verb => {
    if (lower.includes(verb)) {
      actions.push(verb)
    }
  })

  // Extract concepts (key topics)
  const conceptKeywords = extractKeyConcepts(text)
  concepts.push(...conceptKeywords)

  return { entities, actions, concepts }
}

/**
 * Extract key concepts from text
 */
function extractKeyConcepts(text: string): string[] {
  const lower = text.toLowerCase()
  const concepts: string[] = []

  // Common concept patterns
  const conceptPatterns = [
    /\b(?:about|regarding|concerning|on|of)\s+([a-z]+(?:\s+[a-z]+){0,3})\b/gi,
    /\b([a-z]+(?:\s+[a-z]+){1,2})\s+(?:technology|system|method|approach|strategy|framework)\b/gi,
  ]

  conceptPatterns.forEach(pattern => {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const concept = match[1]?.trim()
      if (concept && concept.length > 3 && !isCommonWord(concept)) {
        concepts.push(concept)
      }
    }
  })

  return [...new Set(concepts)]
}

/**
 * Check if word is a common stop word
 */
function isCommonWord(word: string): boolean {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this',
    'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their'
  ])
  return stopWords.has(word.toLowerCase())
}

/**
 * Calculate semantic similarity between two texts
 */
export function calculateSemanticSimilarity(text1: string, text2: string): number {
  const words1 = extractSignificantWords(text1)
  const words2 = extractSignificantWords(text2)

  if (words1.length === 0 || words2.length === 0) return 0

  const set1 = new Set(words1)
  const set2 = new Set(words2)

  // Jaccard similarity
  const intersection = new Set([...set1].filter(x => set2.has(x)))
  const union = new Set([...set1, ...set2])

  return intersection.size / union.size
}

/**
 * Extract significant words (nouns, verbs, adjectives)
 */
function extractSignificantWords(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !isCommonWord(w))

  return [...new Set(words)]
}

/**
 * Detect redundant sentences using semantic similarity
 */
export function detectRedundantSentences(sentences: string[]): boolean[] {
  const redundant = new Array(sentences.length).fill(false)

  for (let i = 0; i < sentences.length; i++) {
    for (let j = i + 1; j < sentences.length; j++) {
      const similarity = calculateSemanticSimilarity(sentences[i], sentences[j])
      if (similarity > 0.7) {
        // Mark the shorter or later sentence as redundant
        if (sentences[i].length <= sentences[j].length) {
          redundant[i] = true
        } else {
          redundant[j] = true
        }
      }
    }
  }

  return redundant
}

/**
 * Extract core intent using NLP
 */
export function extractCoreIntent(prompt: string): {
  intent: string
  confidence: number
  keyPhrases: string[]
} {
  const sentences = prompt.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10)
  
  if (sentences.length === 0) {
    return { intent: prompt, confidence: 0, keyPhrases: [] }
  }

  // First sentence is usually the main intent
  const mainSentence = sentences[0]
  const semantic = extractSemanticMeaning(mainSentence)

  // Extract key phrases
  const keyPhrases = [
    ...semantic.entities.slice(0, 3),
    ...semantic.concepts.slice(0, 2),
    ...semantic.actions.slice(0, 2)
  ]

  // Calculate confidence based on how clear the intent is
  let confidence = 0.5
  if (semantic.actions.length > 0) confidence += 0.2
  if (semantic.entities.length > 0) confidence += 0.2
  if (semantic.concepts.length > 0) confidence += 0.1

  return {
    intent: mainSentence,
    confidence: Math.min(confidence, 1.0),
    keyPhrases: [...new Set(keyPhrases)]
  }
}

/**
 * Merge similar sentences
 */
export function mergeSimilarSentences(sentences: string[]): string[] {
  const merged: string[] = []
  const used = new Set<number>()

  for (let i = 0; i < sentences.length; i++) {
    if (used.has(i)) continue

    let mergedSentence = sentences[i]
    const similarIndices: number[] = []

    // Find similar sentences
    for (let j = i + 1; j < sentences.length; j++) {
      if (used.has(j)) continue

      const similarity = calculateSemanticSimilarity(sentences[i], sentences[j])
      if (similarity > 0.6) {
        similarIndices.push(j)
        used.add(j)
      }
    }

    // Merge similar sentences
    if (similarIndices.length > 0) {
      const similarSentences = similarIndices.map(idx => sentences[idx])
      mergedSentence = mergeSentencesIntelligently([mergedSentence, ...similarSentences])
    }

    merged.push(mergedSentence)
    used.add(i)
  }

  return merged
}

/**
 * Intelligently merge multiple sentences into one
 */
function mergeSentencesIntelligently(sentences: string[]): string {
  if (sentences.length === 1) return sentences[0]

  // Extract unique information from each sentence
  const allWords = new Set<string>()
  const uniquePhrases: string[] = []

  sentences.forEach(sentence => {
    const words = extractSignificantWords(sentence)
    const newWords = words.filter(w => !allWords.has(w))
    
    if (newWords.length > 0) {
      // Extract phrase containing new words
      const phrase = extractPhraseContaining(sentence, newWords)
      if (phrase) uniquePhrases.push(phrase)
      newWords.forEach(w => allWords.add(w))
    }
  })

  // Combine unique phrases
  if (uniquePhrases.length > 0) {
    return uniquePhrases.join(', ')
  }

  // Fallback: return the longest sentence
  return sentences.reduce((a, b) => a.length > b.length ? a : b)
}

/**
 * Extract phrase containing specific words
 */
function extractPhraseContaining(sentence: string, words: string[]): string | null {
  const lower = sentence.toLowerCase()
  for (const word of words) {
    const index = lower.indexOf(word)
    if (index !== -1) {
      // Extract surrounding context
      const start = Math.max(0, index - 20)
      const end = Math.min(sentence.length, index + word.length + 20)
      return sentence.substring(start, end).trim()
    }
  }
  return null
}

/**
 * Improve sentence clarity using NLP
 */
export function improveSentenceClarity(sentence: string): string {
  let improved = sentence

  // Remove unnecessary qualifiers
  improved = improved.replace(/\b(very|quite|rather|pretty|somewhat|extremely|incredibly)\s+/gi, '')

  // Simplify complex phrases
  const simplifications: [RegExp, string][] = [
    [/in order to/gi, 'to'],
    [/due to the fact that/gi, 'because'],
    [/for the purpose of/gi, 'to'],
    [/in the event that/gi, 'if'],
    [/with regard to/gi, 'about'],
    [/in relation to/gi, 'about'],
    [/as a means of/gi, 'to'],
    [/it is important to note that/gi, ''],
    [/it should be noted that/gi, ''],
    [/it is worth mentioning that/gi, ''],
  ]

  simplifications.forEach(([pattern, replacement]) => {
    improved = improved.replace(pattern, replacement)
  })

  // Remove redundant phrases
  improved = improved.replace(/\b(each and every|first and foremost|one and only)\b/gi, (match) => {
    const words = match.split(/\s+and\s+/)
    return words[0] // Keep first word
  })

  return improved.trim()
}

/**
 * Extract and normalize key information
 */
export function extractKeyInformation(prompt: string): {
  mainAction: string
  subject: string
  requirements: string[]
  constraints: string[]
} {
  const semantic = extractSemanticMeaning(prompt)
  const sentences = prompt.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10)

  const mainAction = semantic.actions[0] || 'create'
  const subject = semantic.entities[0] || semantic.concepts[0] || 'content'

  // Extract requirements (sentences with "should", "must", "need")
  const requirements = sentences
    .filter(s => /\b(should|must|need|require|include|contain)\b/i.test(s))
    .map(s => improveSentenceClarity(s))

  // Extract constraints (word count, style, format)
  const constraints = sentences
    .filter(s => /\b(limit|maximum|minimum|at least|at most|under|over|words?|characters?|style|format|tone)\b/i.test(s))
    .map(s => improveSentenceClarity(s))

  return {
    mainAction,
    subject,
    requirements,
    constraints
  }
}

