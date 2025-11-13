/**
 * Enhanced NLP using compromise library
 * Provides better intent extraction and text analysis
 */

import nlp from "compromise"

/**
 * Spell check and fix using NLP
 */
export function spellCheckAndFix(text: string): {
  corrected: string
  corrections: Array<{ original: string; corrected: string; position: number }>
} {
  const doc = nlp(text)
  const corrections: Array<{ original: string; corrected: string; position: number }> = []
  let corrected = text
  
  // Common misspellings and text-speak dictionary
  const commonMisspellings: Record<string, string> = {
    // Common typos
    "od": "of",
    "whihc": "which",
    "teh": "the",
    "adn": "and",
    "yuo": "you",
    "recieve": "receive",
    "seperate": "separate",
    "occured": "occurred",
    "definately": "definitely",
    "neccessary": "necessary",
    "accomodate": "accommodate",
    "existance": "existence",
    "occassion": "occasion",
    "thier": "their",
    "wierd": "weird",
    "acheive": "achieve",
    "excersise": "exercise",
    "priviledge": "privilege",
    "maintainance": "maintenance",
    "persistant": "persistent",
    "occurence": "occurrence",
    "existant": "existent",
    "seperation": "separation",
    // Text-speak and abbreviations
    "plz": "please",
    "pls": "please",
    "u": "you",
    "ur": "your",
    "yr": "your",
    "thru": "through",
    "thx": "thanks",
    "ty": "thank you",
    "np": "no problem",
    "lol": "laughing out loud",
    "omg": "oh my god",
    "btw": "by the way",
    "fyi": "for your information",
    "asap": "as soon as possible",
    "imo": "in my opinion",
    "tbh": "to be honest",
    "idk": "I don't know",
    "wrt": "with regard to",
    "w/": "with",
    "w/o": "without",
    // Common misspellings
    "wrte": "write",
    "writng": "writing",
    "writ": "write",
    "abt": "about",
    "abut": "about",
    "gud": "good",
    "contnt": "content",
    "contant": "content",
    "contnet": "content",
    "tech": "technology",
    "ai": "AI",
    "robots": "robotics",
    "robot": "robotics",
    "stuff": "topics",
    "things": "topics",
    "make": "create",
    "not boring": "engaging",
    "boring": "engaging",
  }
  
  // Use compromise to detect potential spelling issues
  const words = doc.terms().out("array")
  const wordsLower = words.map(w => w.toLowerCase())
  
  // Check each word against common misspellings
  wordsLower.forEach((word, index) => {
    if (commonMisspellings[word]) {
      const correctedWord = commonMisspellings[word]
      if (word !== correctedWord) {
        // Find position in original text
        const regex = new RegExp(`\\b${word}\\b`, "gi")
        const match = corrected.match(regex)
        if (match) {
          corrected = corrected.replace(regex, correctedWord)
          corrections.push({
            original: word,
            corrected: correctedWord,
            position: index
          })
        }
      }
    }
  })
  
  // Use compromise's normalize to fix common issues
  const normalized = doc.normalize().out("text")
  if (normalized !== text && normalized.length > 0) {
    corrected = normalized
  }
  
  return { corrected, corrections }
}

/**
 * Extract intent using compromise NLP
 */
export function extractIntentWithNLP(text: string): {
  action: string
  subject: string
  entities: string[]
  topics: string[]
  verbs: string[]
} {
  const doc = nlp(text)
  
  // Extract verbs (actions)
  const verbs = doc.verbs().out("array")
  const action = verbs[0] || "create"
  
  // Extract nouns (subjects/entities)
  const nouns = doc.nouns().out("array")
  const entities = nouns.slice(0, 5) // Top 5 entities
  
  // Extract topics (main subjects)
  const topics = doc.topics().out("array")
  
  // Get main subject (first significant noun)
  const subject = nouns[0] || topics[0] || "content"
  
  return {
    action: action.toLowerCase(),
    subject: subject.toLowerCase(),
    entities: entities.map(e => e.toLowerCase()),
    topics: topics.map(t => t.toLowerCase()),
    verbs: verbs.map(v => v.toLowerCase()),
  }
}

/**
 * Extract key phrases using NLP
 */
export function extractKeyPhrases(text: string): string[] {
  const doc = nlp(text)
  
  // Extract noun phrases
  const nounPhrases = doc.nounPhrases().out("array")
  
  // Extract important terms
  const terms = doc.terms().out("array")
  
  // Combine and deduplicate
  const phrases = [...nounPhrases, ...terms]
    .map(p => p.toLowerCase().trim())
    .filter(p => p.length > 3)
  
  return [...new Set(phrases)].slice(0, 10)
}

/**
 * Detect redundant sentences using NLP
 */
export function detectRedundancyNLP(sentences: string[]): boolean[] {
  const redundant = new Array(sentences.length).fill(false)
  
  for (let i = 0; i < sentences.length; i++) {
    if (redundant[i]) continue
    
    const doc1 = nlp(sentences[i])
    const keywords1 = new Set([
      ...doc1.nouns().out("array"),
      ...doc1.topics().out("array")
    ].map(k => k.toLowerCase()))
    
    for (let j = i + 1; j < sentences.length; j++) {
      if (redundant[j]) continue
      
      const doc2 = nlp(sentences[j])
      const keywords2 = new Set([
        ...doc2.nouns().out("array"),
        ...doc2.topics().out("array")
      ].map(k => k.toLowerCase()))
      
      // Calculate overlap
      const intersection = new Set([...keywords1].filter(k => keywords2.has(k)))
      const union = new Set([...keywords1, ...keywords2])
      const similarity = intersection.size / union.size
      
      if (similarity > 0.6) {
        // Mark shorter sentence as redundant
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
 * Improve sentence clarity using NLP
 */
export function improveClarityNLP(sentence: string): string {
  const doc = nlp(sentence)
  
  // Remove unnecessary qualifiers
  let improved = sentence
    .replace(/\b(very|quite|rather|pretty|somewhat|extremely|incredibly)\s+/gi, '')
    .replace(/\b(in order to|due to the fact that|for the purpose of)\b/gi, 'to')
    .replace(/\b(it is important to note that|it should be noted that)\b/gi, '')
  
  // Simplify with NLP
  const simplified = doc.normalize().out("text")
  
  return simplified.trim() || improved.trim()
}

/**
 * Extract role from prompt using NLP
 * Handles patterns like:
 * - "as a sales rep in an electronic company"
 * - "I am a marketing manager"
 * - "it's my responsibility as a [role]"
 */
export function extractRoleNLP(text: string): string | null {
  const doc = nlp(text)
  
  // Pattern 1: "as a [role] in [a/an] [company/industry]" - capture full context
  const roleInCompanyPattern = /(?:as|being)\s+(?:an?|the)\s+([^.,!?\n]+?)\s+in\s+(?:an?|the)\s+([^.,!?\n]+?)(?:\s+(?:it|it's|my|,|\.|!|\?|$))/i
  const roleInCompanyMatch = text.match(roleInCompanyPattern)
  if (roleInCompanyMatch && roleInCompanyMatch[1] && roleInCompanyMatch[2]) {
    const role = roleInCompanyMatch[1].trim()
    const company = roleInCompanyMatch[2].trim()
    // Stop at common words that indicate end of role phrase
    const roleClean = role.split(/\s+(?:it|it's|my|responsibility|who|that|,|\.|!|\?)/i)[0].trim()
    const companyClean = company.split(/\s+(?:it|it's|my|responsibility|company|industry|who|that|,|\.|!|\?)/i)[0].trim()
    if (roleClean.length > 2 && companyClean.length > 2) {
      return `${roleClean} in ${companyClean}`
    }
  }
  
  // Pattern 2: "it's my responsibility as a [role]"
  const responsibilityPattern = /(?:it'?s|it is)\s+my\s+responsibility\s+(?:as|to be|being)\s+(?:an?|the)?\s+([^.,!?\n]+?)(?:\s+(?:to|in|,|\.|!|\?|$))/i
  const responsibilityMatch = text.match(responsibilityPattern)
  if (responsibilityMatch && responsibilityMatch[1]) {
    const role = responsibilityMatch[1].trim()
    if (role.length > 2 && role.length < 50) {
      return role
    }
  }
  
  // Pattern 3: Standard role patterns
  const rolePatterns = [
    /(?:act as|you are|role:|as a|be a|I am|I'm)\s+([^.,!?\n]+?)(?:\s+(?:in|who|that|,|\.|!|\?|$))/i,
    /(?:as|being)\s+(?:an?|the)\s+([^.,!?\n]+?)(?:\s+(?:in|who|that|,|\.|!|\?|$))/i,
  ]
  
  for (const pattern of rolePatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const role = match[1].trim()
      // Stop at common words that indicate end of role phrase
      const roleClean = role.split(/\s+(?:it|it's|my|responsibility|in|who|that|,|\.|!|\?)/i)[0].trim()
      if (roleClean.length > 2 && roleClean.length < 50) {
        return roleClean
      }
    }
  }
  
  // Try to extract from nouns if no explicit role
  const nouns = doc.nouns().out("array")
  const roleKeywords = ["expert", "specialist", "professional", "developer", "writer", "analyst", "rep", "representative", "manager", "director"]
  
  for (const noun of nouns) {
    if (roleKeywords.some(keyword => noun.toLowerCase().includes(keyword))) {
      return noun
    }
  }
  
  return null
}

/**
 * Extract constraints using NLP
 */
export function extractConstraintsNLP(text: string): {
  wordCount?: number
  style?: string
  format?: string
  tone?: string
} {
  const doc = nlp(text)
  const constraints: any = {}
  
  // Extract word count
  const wordCountMatch = text.match(/(\d+)\s*(?:words?|characters?)/i)
  if (wordCountMatch) {
    constraints.wordCount = parseInt(wordCountMatch[1])
  }
  
  // Extract style/tone
  const stylePatterns = [
    /(?:tone|style):\s*([^.,!?\n]+)/i,
    /(?:in|with)\s+(?:a\s+)?([^.,!?\n]+?)\s+tone/i,
    /(?:be|make it)\s+([^.,!?\n]+?)(?:\s+and\s+[^.,!?\n]+)?(?:\s+tone|style)/i,
  ]
  
  for (const pattern of stylePatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      constraints.tone = match[1].trim()
      break
    }
  }
  
  // Extract format
  const formatKeywords = ["blog post", "article", "report", "summary", "table", "list", "code"]
  for (const keyword of formatKeywords) {
    if (text.toLowerCase().includes(keyword)) {
      constraints.format = keyword
      break
    }
  }
  
  return constraints
}

/**
 * Merge similar sentences using NLP
 */
export function mergeSentencesNLP(sentences: string[]): string[] {
  const merged: string[] = []
  const used = new Set<number>()
  
  for (let i = 0; i < sentences.length; i++) {
    if (used.has(i)) continue
    
    const doc1 = nlp(sentences[i])
    const keywords1 = new Set([
      ...doc1.nouns().out("array"),
      ...doc1.topics().out("array")
    ].map(k => k.toLowerCase()))
    
    let mergedSentence = sentences[i]
    const similarIndices: number[] = []
    
    // Find similar sentences
    for (let j = i + 1; j < sentences.length; j++) {
      if (used.has(j)) continue
      
      const doc2 = nlp(sentences[j])
      const keywords2 = new Set([
        ...doc2.nouns().out("array"),
        ...doc2.topics().out("array")
      ].map(k => k.toLowerCase()))
      
      const intersection = new Set([...keywords1].filter(k => keywords2.has(k)))
      const union = new Set([...keywords1, ...keywords2])
      const similarity = intersection.size / union.size
      
      if (similarity > 0.5) {
        similarIndices.push(j)
        used.add(j)
      }
    }
    
    // Merge if similar sentences found
    if (similarIndices.length > 0) {
      const similarSentences = similarIndices.map(idx => sentences[idx])
      const allSentences = [mergedSentence, ...similarSentences]
      
      // Combine unique information
      const allDocs = allSentences.map(s => nlp(s))
      const allNouns = new Set<string>()
      const allTopics = new Set<string>()
      
      allDocs.forEach(doc => {
        doc.nouns().out("array").forEach(n => allNouns.add(n.toLowerCase()))
        doc.topics().out("array").forEach(t => allTopics.add(t.toLowerCase()))
      })
      
      // Create merged sentence with key information
      mergedSentence = allSentences[0] // Use first as base
      if (allNouns.size > 0 || allTopics.size > 0) {
        const additionalInfo = [...allNouns, ...allTopics].slice(0, 3).join(", ")
        if (additionalInfo) {
          mergedSentence += ` (${additionalInfo})`
        }
      }
    }
    
    merged.push(mergedSentence)
    used.add(i)
  }
  
  return merged
}

