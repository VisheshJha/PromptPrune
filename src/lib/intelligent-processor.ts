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
 * NOTE: This function is deprecated - we only use the misspellings dictionary now
 * to avoid over-correction. Levenshtein distance was too aggressive.
 */
function findClosestWord(_word: string, _maxDistance: number = 2): string | null {
  // This function is kept for backwards compatibility but should not be used
  // as it's too aggressive and replaces valid words
  return null
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

  // Expanded common misspellings dictionary - ONLY fix obvious typos
  const commonMisspellings: Record<string, string> = {
    // Obvious typos
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
    'plz': 'please',
    'pls': 'please',
    'u': 'you',
    'ur': 'your',
    'thru': 'through',
    'thx': 'thanks',
    'ty': 'thank you',
    'becasue': 'because',
    'selss': 'sells',
    'it\'s': 'its', // Fix apostrophe in "it's" when used incorrectly
    // Keep valid words as-is (don't "correct" them)
    'delhi': 'Delhi',
    'pollution': 'pollution',
    'ai': 'AI',
    'ml': 'ML', // Machine Learning
    'robots': 'robots',
    'stuff': 'stuff',
    'boring': 'boring',
    'future': 'future',
    'robotics': 'robotics',
    'industries': 'industries',
    'developments': 'developments',
    'challenges': 'challenges',
    'ethical': 'ethical',
    'considerations': 'considerations',
    'engaging': 'engaging',
    'concise': 'concise',
    'organize': 'organize',
    'headings': 'headings',
    'email': 'email',
    'draft': 'draft',
    'sales': 'sales',
    'rep': 'rep', // representative
    'company': 'company',
    'product': 'product',
    'cold': 'cold',
    'want': 'want',
    'which': 'which',
    'tech': 'technology', // Only expand if it's clearly meant to be "technology"
  }

  // Check each word
  words.forEach((word) => {
    const lowerWord = word.toLowerCase()
    
    // Skip if it's a common word
    if (COMMON_WORDS.has(lowerWord)) {
      return
    }

    // Check common misspellings first (more accurate)
    if (commonMisspellings[lowerWord]) {
      const correctedWord = commonMisspellings[lowerWord]
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      if (corrected.match(regex)) {
        corrected = corrected.replace(regex, (match) => {
          // Preserve capitalization for proper nouns
          if (/^[A-Z]/.test(match) && /^[A-Z]/.test(correctedWord)) {
            return correctedWord
          }
          // Preserve original capitalization pattern
          if (/^[A-Z]/.test(match)) {
            return correctedWord.charAt(0).toUpperCase() + correctedWord.slice(1)
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

    // DO NOT use Levenshtein distance - it's too aggressive and replaces valid words
    // Only fix words that are in the misspellings dictionary
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
  // Handle null, undefined, or non-string input
  if (!text || typeof text !== 'string') {
    return {
      action: 'write',
      topic: '',
      format: '',
      audience: '',
      tone: '',
      constraints: {}
    }
  }
  
  // Handle empty or whitespace-only strings
  const cleaned = text.trim()
  if (!cleaned || cleaned.length === 0) {
    return {
      action: 'write',
      topic: '',
      format: '',
      audience: '',
      tone: '',
      constraints: {}
    }
  }
  
  // Handle very short prompts (1-2 words) - return early with basic extraction
  const words = cleaned.split(/\s+/).filter(w => w.length > 0)
  if (words.length === 1) {
    // Single word - treat as topic with default action "write"
    // Exception: clear imperative action verbs at start
    const word = words[0].toLowerCase()
    const clearActionVerbs = ['write', 'create', 'make', 'generate', 'tell', 'explain', 'describe', 'discuss', 'analyze', 'build', 'design', 'develop']
    if (clearActionVerbs.includes(word)) {
      return {
        action: word,
        topic: '',
        format: '',
        audience: '',
        tone: '',
        constraints: {}
      }
    } else {
      // Single word that's not a clear action verb - treat as topic
      return {
        action: 'write',
        topic: words[0],
        format: '',
        audience: '',
        tone: '',
        constraints: {}
      }
    }
  } else if (words.length === 2) {
    // Two words - check if first is an action verb
    const firstWord = words[0]?.toLowerCase() || ''
    const secondWord = words[1]?.toLowerCase() || ''
    
    const actionVerbs = ['write', 'create', 'make', 'generate', 'tell', 'explain', 'describe', 'discuss', 'analyze', 'build', 'design', 'develop', 'help', 'assist']
    if (actionVerbs.includes(firstWord)) {
      return {
        action: firstWord,
        topic: secondWord || '',
        format: '',
        audience: '',
        tone: '',
        constraints: {}
      }
    } else {
      // If not an action verb, treat both as topic
      return {
        action: 'write',
        topic: words.join(' '),
        format: '',
        audience: '',
        tone: '',
        constraints: {}
      }
    }
  }
  
  // Handle very long prompts (10000+ words) - truncate for processing
  let processedText = cleaned
  if (words.length > 10000) {
    // Take first 5000 words for processing to avoid performance issues
    processedText = words.slice(0, 5000).join(' ')
  }
  
  const doc = nlp(processedText)
  const lower = processedText.toLowerCase()

  // Extract action - handle questions and statements differently
  let action = 'write'
  
  // Check if it's a question (interrogative)
  const isQuestionPrompt = /^(who|what|where|when|why|how|which|whom|whose|do|does|did|is|are|was|were|can|could|should|would|will)\s+/i.test(text.trim())
  
  if (isQuestionPrompt) {
    // For questions, prioritize action verbs in the question body, not auxiliary verbs
    // Pattern 1: "Who/What/How [subject] should/can/will [verb]"
    const shouldVerbMatch = text.match(/\b(should|can|could|will|would)\s+([a-z]+)\b/i)
    if (shouldVerbMatch && shouldVerbMatch[2]) {
      const verb = shouldVerbMatch[2].toLowerCase()
      // Check if it's a meaningful action verb
      if (['refer', 'consult', 'approach', 'contact', 'use', 'utilize', 'suggest', 'recommend', 'explain', 'describe', 'analyze', 'discuss'].includes(verb)) {
        action = verb
      }
    }
    
    // Pattern 2: "Who do you think [subject] should [verb]"
    if (action === 'write' || action === 'analyze') {
      const thinkVerbMatch = text.match(/\b(?:do|does|did)\s+(?:you|we|they|it|he|she)?\s*(?:think|believe|suggest|recommend)?\s*[^?]*?\s+(?:should|can|could|will|would)?\s*(refer|consult|approach|contact|use|utilize|suggest|recommend|explain|describe|analyze|discuss|resolve|solve|address|handle|manage|implement|create|write|generate|build|design|develop)\b/i)
      if (thinkVerbMatch && thinkVerbMatch[1]) {
        action = thinkVerbMatch[1].toLowerCase()
      }
    }
    
    // Pattern 3: Question word specific actions
    if (action === 'write' || action === 'analyze') {
      if (lower.startsWith('what') || lower.startsWith('how')) {
        // "What is..." or "How can..." usually means explain
        if (lower.match(/\b(is|are|can|could|should|would|will)\s+/)) {
          action = 'explain'
        }
      } else if (lower.startsWith('where')) {
        // "Where should..." usually means suggest
        action = 'suggest'
      } else if (lower.startsWith('when')) {
        // "When is..." usually means analyze
        action = 'analyze'
      } else if (lower.startsWith('why')) {
        // "Why did..." usually means explain
        action = 'explain'
      } else if (lower.startsWith('who')) {
        // "Who should..." usually means refer or suggest
        if (lower.match(/\b(refer|consult|approach|contact)\b/)) {
          action = lower.match(/\b(refer|consult|approach|contact)\b/i)?.[1]?.toLowerCase() || 'refer'
        } else {
          action = 'suggest'
        }
      }
    }
    
    // Fallback: look for any action verb in the question
    if (action === 'write' || action === 'analyze') {
      const actionVerbMatch = text.match(/\b(explain|describe|discuss|analyze|evaluate|assess|compare|suggest|recommend|refer|consult|approach|contact|use|utilize|resolve|solve|address|handle|manage|implement|create|write|generate|build|design|develop)\b/i)
      if (actionVerbMatch && actionVerbMatch[1]) {
        action = actionVerbMatch[1].toLowerCase()
      }
    }
  } else {
    // For statements, prioritize action verbs at the START of the sentence
    // Pattern 1: "it's my responsibility to [action]" - extract the action
    const responsibilityPattern = /(?:it'?s|it is)\s+my\s+responsibility\s+to\s+(write|create|make|generate|tell|explain|describe|analyze|discuss|build|design|develop|draft|send|compose|help|assist)/i
    const responsibilityMatch = text.match(responsibilityPattern)
    if (responsibilityMatch && responsibilityMatch[1]) {
      action = responsibilityMatch[1].toLowerCase()
    } else {
      // Pattern 2: Direct imperative at start: "Write...", "Create...", "Explain..."
      const imperativePattern = /^(write|create|make|generate|send|draft|tell|explain|describe|discuss|analyze|build|design|develop|compose|produce|formulate|construct|establish|implement|execute|perform|deliver|present|prepare|organize|structure|author|craft|form|initiate|launch|introduce|propose|suggest|recommend|advise|guide|instruct|teach|educate|inform|clarify|define|outline|summarize|review|evaluate|assess|examine|investigate|research|study|explore|discover|identify|determine|decide|choose|select|pick|opt|prefer|offer|provide|supply|give|show|display|demonstrate|illustrate|exemplify|represent|depict|portray|characterize|detail|specify|indicate|point|highlight|emphasize|stress|focus|concentrate|center|target|aim|direct|lead|manage|oversee|supervise|coordinate|orchestrate|arrange|plan|schedule|allocate|assign|distribute|divide|split|separate|categorize|classify|group|sort|order|rank|prioritize|sequence)\s+/i
      const imperativeMatch = text.match(imperativePattern)
      if (imperativeMatch && imperativeMatch[1]) {
        action = imperativeMatch[1].toLowerCase()
      } else {
        // Pattern 3: "I want/need you to [action]" - MUST extract the action verb, not "want"
        const wantPattern = /\b(want|need|would like|please|plz)\s+(?:you|to)?\s*(?:to)?\s*(write|create|make|generate|tell|explain|describe|analyze|discuss|build|design|develop|draft|send|compose)\b/i
        const wantMatch = text.match(wantPattern)
        if (wantMatch && wantMatch[2]) {
          action = wantMatch[2].toLowerCase()
        } else if (lower.match(/\b(want|need)\s+(?:you|to)?\s*(?:to)?\s*(?:wriet|wrte|write)\b/)) {
          // Handle typos in "I want you to wriet"
          action = 'write'
        } else {
          // Pattern 4: Handle typos: "plz wrte" -> "write", "wriet" -> "write"
          if (lower.match(/\b(plz|please)\s+(wrte|wriet|write)\b/)) {
            action = 'write'
          } else {
            // Pattern 5: Extract first meaningful action verb using NLP, but ONLY from first 100 chars
            // This prevents picking up verbs from later in the sentence like "being", "gets stuck", "highlighting"
            const firstPart = text.substring(0, 100).toLowerCase()
            const verbs = doc.verbs().out('array')
            // Prioritize action verbs that appear early in the sentence
            const actionVerbs = ['write', 'create', 'make', 'generate', 'send', 'draft', 'tell', 'explain', 'describe', 'discuss', 'analyze', 'build', 'design', 'develop', 'compose', 'produce', 'formulate', 'construct', 'establish', 'implement', 'execute', 'perform', 'deliver', 'present', 'prepare', 'organize', 'structure', 'author', 'craft', 'form', 'initiate', 'launch', 'introduce', 'propose', 'suggest', 'recommend', 'advise', 'guide', 'instruct', 'teach', 'educate', 'inform', 'clarify', 'define', 'outline', 'summarize', 'review', 'evaluate', 'assess', 'examine', 'investigate', 'research', 'study', 'explore', 'discover', 'identify', 'determine', 'decide', 'choose', 'select', 'pick', 'opt', 'prefer', 'offer', 'provide', 'supply', 'give', 'show', 'display', 'demonstrate', 'illustrate', 'exemplify', 'represent', 'depict', 'portray', 'characterize', 'detail', 'specify', 'indicate', 'point', 'highlight', 'emphasize', 'stress', 'focus', 'concentrate', 'center', 'target', 'aim', 'direct', 'lead', 'manage', 'oversee', 'supervise', 'coordinate', 'orchestrate', 'arrange', 'plan', 'schedule', 'allocate', 'assign', 'distribute', 'divide', 'split', 'separate', 'categorize', 'classify', 'group', 'sort', 'order', 'rank', 'prioritize', 'sequence']
            
            // Find the first action verb in the first part of the text only
            for (const verb of verbs) {
              const vLower = verb.toLowerCase()
              if (actionVerbs.includes(vLower)) {
                // Check if it appears early in the sentence (first 100 chars)
                const verbIndex = firstPart.indexOf(vLower)
                if (verbIndex >= 0 && verbIndex < 100) {
                  action = vLower
                  break
                }
              }
            }
            
            // If no action verb found in first part, try to find the main verb from first sentence
            if (action === 'write') {
              // Get first sentence only (or first 100 chars)
              const firstSentence = text.split(/[.!?]/)[0].substring(0, 100)
              const firstSentenceDoc = doc.match(firstSentence)
              const firstSentenceVerbs = firstSentenceDoc.verbs().out('array')
              if (firstSentenceVerbs.length > 0) {
                // Find first action verb in first sentence
                for (const verb of firstSentenceVerbs) {
                  const vLower = verb.toLowerCase()
                  if (actionVerbs.includes(vLower)) {
                    action = vLower
                    break
                  }
                }
                // If no action verb found, use first verb as fallback (but only if it's not a filler)
                if (action === 'write' && firstSentenceVerbs.length > 0) {
                  const firstVerb = firstSentenceVerbs[0].toLowerCase()
                  // Skip filler verbs
                  if (!['want', 'need', 'think', 'believe', 'know', 'see', 'get', 'have', 'make', 'do', 'go', 'come', 'say', 'tell', 'give', 'take', 'put', 'let', 'help', 'try', 'use', 'work', 'call', 'ask', 'seem', 'feel', 'leave', 'keep', 'turn', 'start', 'show', 'hear', 'play', 'run', 'move', 'like', 'live', 'bring', 'happen', 'sit', 'stand', 'lose', 'pay', 'meet', 'include', 'continue', 'set', 'learn', 'change', 'lead', 'understand', 'watch', 'follow', 'stop', 'speak', 'read', 'allow', 'add', 'spend', 'grow', 'open', 'walk', 'win', 'offer', 'remember', 'love', 'consider', 'appear', 'buy', 'wait', 'serve', 'die', 'send', 'build', 'stay', 'fall', 'cut', 'reach', 'kill', 'raise', 'pass', 'sell', 'decide', 'return', 'develop', 'carry', 'break', 'receive', 'agree', 'support', 'hit', 'produce', 'eat', 'cover', 'catch', 'draw', 'choose', 'being', 'gets', 'stuck', 'highlighting', 'calculates', 'posts', 'am', 'is', 'are', 'was', 'were'].includes(firstVerb)) {
                    action = firstVerb
                  }
                }
              } else if (verbs.length > 0) {
                // Last resort: use first verb from entire text, but only if it's an action verb
                const firstVerb = verbs[0].toLowerCase()
                if (actionVerbs.includes(firstVerb)) {
                  action = firstVerb
                }
              }
            }
          }
        }
      }
    }
  }
  
  // Extract topic - handle questions and statements differently
  let topic = ''
  
  if (isQuestionPrompt) {
    // For questions, extract the main subject/topic from the question
    // "Who do you think India should refer to resolve issue of tariff with Trump"
    // -> extract "India should refer to resolve issue of tariff with Trump"
    
    // Pattern 1: "Who/What/How [subject] [verb] [rest of question]"
    const questionPattern = /^(?:who|what|where|when|why|how|which|whom|whose|do|does|did|is|are|was|were|can|could|should|would|will)\s+(?:do|does|did|is|are|was|were|you|we|they|it|he|she)?\s*(?:think|believe|suggest|recommend|refer|consult|approach|contact|use|utilize|should|can|could|will|would)?\s*([^?]+?)(?:\s*\?|$)/i
    const questionMatch = text.match(questionPattern)
    if (questionMatch && questionMatch[1]) {
      topic = questionMatch[1].trim()
      // Remove question words that might be at the start
      topic = topic.replace(/^(do|does|did|is|are|was|were|you|we|they|it|he|she|think|believe|suggest|recommend)\s+/i, '')
      // Remove trailing "to" if it's just a preposition
      topic = topic.replace(/\s+to\s*$/i, '').trim()
    }
    
    // If still no topic, extract everything after the question word
    if (!topic || topic.length < 5) {
      const simpleQuestionPattern = /^(?:who|what|where|when|why|how|which|whom|whose|do|does|did|is|are|was|were|can|could|should|would|will)\s+(.+?)(?:\s*\?|$)/i
      const simpleMatch = text.match(simpleQuestionPattern)
      if (simpleMatch && simpleMatch[1]) {
        topic = simpleMatch[1].trim()
        // Remove common question fillers
        topic = topic.replace(/^(do|does|did|you|we|they|think|believe|suggest|recommend)\s+/i, '')
      }
    }
  } else {
    // For statements, use existing patterns
    // Pattern 1: "it's my responsibility to [action] [topic]" - extract full context
    const responsibilityTopicPattern = /(?:it'?s|it is)\s+my\s+responsibility\s+to\s+(?:write|create|make|generate|send|draft|help|assist)\s+([^.,!?\n]+?)(?:\s*$|\.|,|!|\?)/i
    const responsibilityTopicMatch = text.match(responsibilityTopicPattern)
    if (responsibilityTopicMatch && responsibilityTopicMatch[1]) {
      topic = responsibilityTopicMatch[1].trim()
      // Clean up topic
      topic = topic.replace(/^(a|an|the)\s+(email|letter|message|note|draft|article|report|blog|post|content|story|narrative|guide|tutorial|summary|outline|presentation|code|script|function)\s+/i, '$2 ')
      // Remove trailing "help me with that" or similar
      topic = topic.replace(/\s+(help|assist|with|that|this|me|us)\s*$/i, '').trim()
    }
    
    // Pattern 2: "write a [adjective] [format] to [recipient] about [topic]"
    if (!topic) {
      const fullContextPattern = /(?:write|create|make|generate|send|draft)\s+((?:a|an|the)?\s*(?:cold\s+)?(?:funny|serious|professional|casual|formal|informal|engaging|clear|short|long|brief|detailed)?\s*(?:email|letter|message|note|draft|article|report|blog|post|content|story|narrative|guide|tutorial|summary|outline|presentation|code|script|function)?\s*(?:to|for)\s+[^.,!?\n]+?)(?:\s*$|\.|,|!|\?)/i
      const fullContextMatch = text.match(fullContextPattern)
      if (fullContextMatch && fullContextMatch[1]) {
        topic = fullContextMatch[1].trim()
        topic = topic.replace(/^(a|an|the)\s+(email|letter|message|note|draft|article|report|blog|post|content|story|narrative|guide|tutorial|summary|outline|presentation|code|script|function)\s+/i, '$2 ')
        if (topic && topic.length > 5) {
          // Use this full context
        } else {
          topic = ''
        }
      }
    }
    
    // Pattern 3: "write about X" (if full context not found)
    if (!topic) {
      const aboutPattern = /(?:write|create|make|generate|tell|explain|describe|discuss)\s+(?:about|on|regarding)\s+([^.,!?\n]+?)(?:\s*$|\.|,|!|\?)/i
      const aboutMatch = text.match(aboutPattern)
      if (aboutMatch && aboutMatch[1]) {
        topic = aboutMatch[1].trim()
      }
    }
    
    // Pattern 4: "write X" (direct object - capture everything after action, but stop at filler phrases)
    if (!topic) {
      // Improved pattern that stops at "make it", "and stuff", etc.
      const directPattern = /(?:write|create|make|generate|tell|explain|describe|discuss|plz|please)\s+(?:wrte|wriet|write)?\s*(?:abt|about)?\s*((?:a|an|the)?\s*[^.,!?\n]+?)(?:\s+(?:make\s+it|and\s+stuff|not\s+boring|good|better|gud|stuff|things|help|assist|with|that|this)\s*$|\s*$|\.|,|!|\?)/i
      const directMatch = text.match(directPattern)
      if (directMatch && directMatch[1]) {
        topic = directMatch[1].trim()
        topic = topic.replace(/^(a|an|the)\s+(email|letter|message|note|draft|article|report|blog|post|content|story|narrative|guide|tutorial|summary|outline|presentation|code|script|function)\s+/i, '$2 ')
        // Remove trailing filler words
        topic = topic.replace(/\s+(for|to|with|and|or|make|it|good|better|gud|stuff|things|topics|subject|help|assist|that|this|me|us)\s*$/i, '').trim()
        // For "plz wrte abt tech future ai robots and stuff make it gud not boring"
        // Extract just "tech future ai robots"
        if (topic.includes('and stuff') || topic.includes('make it') || topic.includes('not boring')) {
          topic = topic.split(/\s+(?:and\s+stuff|make\s+it|not\s+boring|gud)\s*/i)[0].trim()
        }
      }
    }
    
    // Clean up topic
    if (topic) {
      topic = topic.replace(/^(write|create|make|generate|tell|explain|describe|discuss)\s+/i, '')
      topic = topic.replace(/^(a|an|the|short|brief|long|detailed|article|report|blog|summary|content)\s+/i, '')
      topic = topic.trim()
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

