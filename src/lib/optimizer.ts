/**
 * Structured Prompt Optimizer
 * Implements 8-step algorithm for converting raw prompts into concise, structured outputs
 */

import type { OptimizationResult } from "./heuristics"

interface ParsedIntent {
  goal: string
  action: string // "write", "create", "explain", "analyze", etc.
  subject: string
  audience?: string // "finance professionals", "beginners", etc.
}

interface ExtractedTask {
  text: string
  keywords: string[]
  isDuplicate: boolean
}

interface FormatAndTone {
  format?: string // "blog post", "summary", "table", "code", etc.
  tone?: string // "professional", "casual", "persuasive", etc.
}

interface Constraints {
  wordCount?: number
  style?: string
  scope?: string
}

interface StructuredPrompt {
  goal: string
  audience?: string
  sections: string[]
  format?: string
  tone?: string
  constraints?: string
}

/**
 * Step 1: Parse Intent
 * Identify the main goal of the prompt
 */
function parseIntent(prompt: string): ParsedIntent {
  const lowerPrompt = prompt.toLowerCase()
  
  // Common action verbs
  const actions = [
    "write", "create", "generate", "make", "build", "develop",
    "explain", "describe", "analyze", "discuss", "summarize",
    "design", "plan", "outline", "list", "show", "tell"
  ]
  
  // Find action verb
  let action = "create"
  for (const act of actions) {
    if (lowerPrompt.includes(act)) {
      action = act
      break
    }
  }
  
  // Extract audience (if mentioned)
  const audiencePatterns = [
    /(?:for|to|targeting)\s+(?:a\s+)?([^.,!?]+?)\s+(?:audience|readers|users|professionals|beginners)/i,
    /(?:for|to)\s+(?:a\s+)?(general|technical|professional|beginner|expert)\s+(?:audience|readers?|users?)/i,
    /(?:for|to)\s+([^.,!?]+?)(?:\s+(?:about|on|regarding|,|\.|!|\?))/i,
  ]
  
  let audience: string | undefined
  for (const pattern of audiencePatterns) {
    const match = prompt.match(pattern)
    if (match && match[1]) {
      const extracted = match[1].trim()
      // Filter out common false positives
      if (!extracted.match(/^(the|a|an|this|that|it|they)$/i) && extracted.length > 3) {
        // Normalize audience descriptions
        if (extracted === "general") {
          audience = "a general audience"
        } else if (extracted.includes("professional")) {
          audience = extracted.includes("finance") ? "finance professionals" : "professionals"
        } else {
          audience = extracted
        }
        break
      }
    }
  }
  
  // Infer audience if not explicitly stated based on format and tone
  if (!audience) {
    if (lowerPrompt.includes("summarize") || lowerPrompt.includes("blog post") || lowerPrompt.includes("article")) {
      audience = "a general audience"
    } else if (lowerPrompt.includes("report")) {
      // For reports, infer audience based on tone
      if (lowerPrompt.includes("technical") || lowerPrompt.includes("engineering")) {
        audience = "engineering students"
      } else if (lowerPrompt.includes("policy") || lowerPrompt.includes("government")) {
        audience = "policymakers"
      } else if (lowerPrompt.includes("business") || lowerPrompt.includes("market")) {
        audience = "business professionals"
      } else {
        audience = "general readers"
      }
    } else if (lowerPrompt.includes("technical") || lowerPrompt.includes("engineering")) {
      audience = "technical professionals"
    }
  }
  
  // Extract subject (what the prompt is about)
  // Look for patterns like "about X", "on X", "regarding X"
  const aboutPattern = /(?:about|on|regarding|concerning|introducing)\s+([^.,!?]+)/i
  const aboutMatch = prompt.match(aboutPattern)
  const subject = aboutMatch ? aboutMatch[1].trim() : extractSubject(prompt)
  
  // Extract goal (first sentence or main clause)
  const sentences = prompt.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const goal = sentences[0]?.trim() || prompt.substring(0, 100).trim()
  
  return { goal, action, subject, audience }
}

/**
 * Extract subject from prompt when no explicit "about" phrase
 */
function extractSubject(prompt: string): string {
  // Remove common filler
  let text = prompt
    .replace(/\b(please|kindly|make sure|ensure)\b/gi, "")
    .replace(/\b(write|create|generate|make|build)\s+(me|a|an|the)?\s*/gi, "")
    .trim()
  
  // Get first meaningful phrase (up to 50 chars)
  const words = text.split(/\s+/).slice(0, 8)
  return words.join(" ").replace(/[.,!?;:]$/, "")
}

/**
 * Step 2: Extract Key Tasks
 * Scan for repeated or overlapping instructions
 */
function extractKeyTasks(prompt: string, mainGoal: string): ExtractedTask[] {
  // Split into sentences
  const sentences = prompt
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10) // Filter out very short fragments
  
  const tasks: ExtractedTask[] = []
  const seenKeywords = new Map<string, number>()
  
  // Extract main goal keywords for filtering
  const goalKeywords = extractKeywords(mainGoal.toLowerCase())
  const goalText = mainGoal.toLowerCase()
  
  // Extract keywords from each sentence
  sentences.forEach((sentence, index) => {
    // Skip the first sentence if it's the main goal (usually is)
    if (index === 0) {
      const sentenceLower = sentence.toLowerCase()
      const goalOverlap = calculateOverlap(extractKeywords(sentenceLower), goalKeywords)
      // If first sentence overlaps >70% with goal, skip it
      if (goalOverlap > 0.7 || sentenceLower.includes(goalText.substring(0, 30))) {
        return
      }
    }
    
    // Remove filler words
    const cleaned = sentence
      .replace(/\b(please|kindly|also|make sure|ensure|should|must|the summary should|talk about|discuss)\b/gi, "")
      .trim()
    
    // Skip if this is just restating the goal
    const cleanedLower = cleaned.toLowerCase()
    if (goalKeywords.length > 0) {
      const cleanedKeywords = extractKeywords(cleanedLower)
      const overlap = calculateOverlap(cleanedKeywords, goalKeywords)
      // If >60% overlap with goal, it's redundant
      if (overlap > 0.6 && cleanedKeywords.length <= goalKeywords.length + 2) {
        return
      }
    }
    
    // Extract meaningful keywords (nouns, important verbs)
    const keywords = extractKeywords(cleaned)
    
    // Count keyword frequency
    keywords.forEach(kw => {
      seenKeywords.set(kw, (seenKeywords.get(kw) || 0) + 1)
    })
    
    tasks.push({
      text: cleaned,
      keywords,
      isDuplicate: false
    })
  })
  
  // Mark duplicates (tasks with overlapping keywords)
  tasks.forEach((task, i) => {
    if (task.isDuplicate) return
    
    // Check if this task overlaps significantly with others
    for (let j = i + 1; j < tasks.length; j++) {
      const other = tasks[j]
      if (other.isDuplicate) continue
      
      const overlap = calculateOverlap(task.keywords, other.keywords)
      if (overlap > 0.6) { // 60% keyword overlap = duplicate
        other.isDuplicate = true
      }
    }
  })
  
  // Return unique tasks
  return tasks.filter(t => !t.isDuplicate)
}

/**
 * Extract meaningful keywords from text
 */
function extractKeywords(text: string): string[] {
  // Remove common stop words
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "are", "was", "were", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "should", "could", "may", "might", "must", "can", "this",
    "that", "these", "those", "it", "its", "they", "them", "their"
  ])
  
  // Extract words (3+ chars, not stop words)
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopWords.has(w))
  
  // Return unique keywords, prioritizing longer words
  return [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, 5)
}

/**
 * Calculate overlap between two keyword sets
 */
function calculateOverlap(keywords1: string[], keywords2: string[]): number {
  if (keywords1.length === 0 || keywords2.length === 0) return 0
  
  const set1 = new Set(keywords1)
  const set2 = new Set(keywords2)
  
  let matches = 0
  set1.forEach(kw => {
    if (set2.has(kw)) matches++
  })
  
  return matches / Math.max(keywords1.length, keywords2.length)
}

/**
 * Step 3: Remove Redundancy
 * Eliminate repeated keywords and merge duplicate instructions
 */
function removeRedundancy(text: string, subject?: string): string {
  let result = text
  
  // Find repeated phrases (2-4 words)
  const repeatedPhrasePattern = /\b(\w+(?:\s+\w+){1,3})\s+(?:\w+\s+)*\1\b/gi
  result = result.replace(repeatedPhrasePattern, "$1")
  
  // Remove excessive subject word repetition (e.g., "blockchain" appearing 8 times)
  if (subject) {
    const subjectWords = subject.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    subjectWords.forEach(subjectWord => {
      const regex = new RegExp(`\\b${subjectWord}\\b`, "gi")
      const matches = result.match(regex)
      if (matches && matches.length > 4) {
        // Keep first 2-3 mentions, remove excessive ones
        let count = 0
        result = result.replace(regex, (match) => {
          count++
          // Keep first 2 mentions, remove rest
          return count <= 2 ? match : ""
        })
      }
    })
  }
  
  // Remove excessive keyword repetition
  const words = result.toLowerCase().split(/\s+/)
  const wordCounts = new Map<string, number>()
  words.forEach(w => {
    const clean = w.replace(/[^\w]/g, "")
    if (clean.length > 4) { // Only count meaningful words
      wordCounts.set(clean, (wordCounts.get(clean) || 0) + 1)
    }
  })
  
  // If a word appears more than 3 times, it's likely redundant
  wordCounts.forEach((count, word) => {
    if (count > 3) {
      // Keep first 2 occurrences, remove rest
      const regex = new RegExp(`\\b${word}\\b`, "gi")
      let matches = 0
      result = result.replace(regex, (match) => {
        matches++
        return matches <= 2 ? match : ""
      })
    }
  })
  
  // Clean up extra spaces
  result = result.replace(/\s+/g, " ").trim()
  
  return result
}

/**
 * Step 4: Group into Sections
 * Organize tasks into bullet points or numbered lists
 */
function groupIntoSections(tasks: ExtractedTask[]): string[] {
  if (tasks.length === 0) return []
  
  // If only 1-2 tasks, return as simple list
  if (tasks.length <= 2) {
    return tasks.map(t => simplifyTaskText(t.text))
  }
  
  // Group similar tasks by topic
  const sections: string[] = []
  const processed = new Set<number>()
  
  // Common topic patterns with better matching
  const topicPatterns = [
    { keywords: ["start", "started", "origin", "origins", "begin", "began", "early", "initial", "first"], topic: "origins", desc: "Origins and early development" },
    { keywords: ["evolve", "evolved", "evolution", "develop", "development", "grow", "growth", "progress"], topic: "evolution", desc: "Evolution and development" },
    { keywords: ["milestone", "milestones", "key event", "important", "significant"], topic: "milestones", desc: "Key milestones" },
    { keywords: ["use", "used", "usage", "application", "applications", "today", "current", "modern", "now"], topic: "applications", desc: "Current applications" },
    { keywords: ["work", "works", "function", "principle", "principles", "how"], topic: "how it works", desc: "How it works" },
    { keywords: ["strategy", "strategies", "build", "built", "create", "develop"], topic: "strategies", desc: "Strategies" },
    { keywords: ["platform", "platforms", "tool", "tools", "software"], topic: "platforms", desc: "Platforms and tools" },
    { keywords: ["benefit", "benefits", "advantage", "pros"], topic: "benefits", desc: "Benefits" },
    { keywords: ["risk", "risks", "challenge", "challenges"], topic: "risks", desc: "Risks and challenges" },
    { keywords: ["example", "examples", "case", "use case"], topic: "examples", desc: "Examples" },
  ]
  
  tasks.forEach((task, i) => {
    if (processed.has(i)) return
    
    // Try to match task to a topic pattern
    const taskLower = task.text.toLowerCase()
    let matchedTopic: string | null = null
    
    for (const pattern of topicPatterns) {
      if (pattern.keywords.some(kw => taskLower.includes(kw))) {
        matchedTopic = pattern.topic
        break
      }
    }
    
    // Find similar tasks
    const similar: ExtractedTask[] = [task]
    processed.add(i)
    
    for (let j = i + 1; j < tasks.length; j++) {
      if (processed.has(j)) continue
      
      const otherLower = tasks[j].text.toLowerCase()
      const otherMatched = topicPatterns.find(p => 
        p.keywords.some(kw => otherLower.includes(kw))
      )
      
      // Group if same topic or high keyword overlap
      if ((matchedTopic && otherMatched?.topic === matchedTopic) ||
          calculateOverlap(task.keywords, tasks[j].keywords) > 0.3) {
        similar.push(tasks[j])
        processed.add(j)
      }
    }
    
    // Create section description
    if (matchedTopic) {
      const pattern = topicPatterns.find(p => p.topic === matchedTopic)
      let sectionDesc = pattern?.desc || matchedTopic
      
      // Build natural section description from task content
      const allText = similar.map(t => t.text.toLowerCase()).join(" ")
      
      // For origins/start
      if (matchedTopic === "origins") {
        sectionDesc = "Origins and early development"
      }
      
      // For evolution/milestones
      if (matchedTopic === "evolution" || matchedTopic === "milestones") {
        if (allText.includes("milestone")) {
          sectionDesc = "Key milestones in its evolution"
        } else if (allText.includes("evolve")) {
          sectionDesc = "Evolution and key developments"
        } else {
          sectionDesc = "Key milestones"
        }
      }
      
      // For applications/current use
      if (matchedTopic === "applications") {
        if (allText.includes("finance")) {
          sectionDesc = "Current applications in finance and beyond"
        } else if (allText.includes("today") || allText.includes("current")) {
          sectionDesc = "Current applications"
        } else {
          sectionDesc = "Applications and use cases"
        }
      }
      
      // For strategies
      if (matchedTopic === "strategies") {
        if (allText.includes("build") || allText.includes("built")) {
          sectionDesc = "Common strategies and how they are built"
        } else {
          sectionDesc = "Common strategies"
        }
      }
      
      sections.push(sectionDesc)
    } else if (similar.length === 1) {
      // Single task - create meaningful section from it
      const taskText = similar[0].text.toLowerCase()
      
      // Try to extract a meaningful section name
      if (taskText.includes("source") || taskText.includes("type")) {
        sections.push("Major sources and types")
      } else if (taskText.includes("benefit") || taskText.includes("advantage")) {
        sections.push("Benefits and advantages")
      } else if (taskText.includes("challenge") || taskText.includes("problem")) {
        sections.push("Challenges and solutions")
      } else if (taskText.includes("trend") || taskText.includes("future")) {
        sections.push("Trends and future outlook")
      } else {
        // Use simplified task text but make it more actionable
        const simplified = simplifyTaskText(similar[0].text)
        // If it's just keywords, create a better description
        if (simplified.split(/\s+/).length <= 3) {
          sections.push(`Key aspects of ${simplified}`)
        } else {
          sections.push(simplified)
        }
      }
    } else {
      // Multiple similar tasks - create meaningful merged description
      const allText = similar.map(t => t.text.toLowerCase()).join(" ")
      const mainKeywords = new Set<string>()
      similar.forEach(t => t.keywords.forEach(kw => mainKeywords.add(kw)))
      
      // Create section based on common themes
      if (allText.includes("source") || allText.includes("type") || allText.includes("form")) {
        sections.push("Major sources and types")
      } else if (allText.includes("trend") || allText.includes("adoption") || allText.includes("case study")) {
        sections.push("Adoption trends and case studies")
      } else if (allText.includes("challenge") || allText.includes("problem") || allText.includes("solution")) {
        sections.push("Challenges and emerging solutions")
      } else if (allText.includes("benefit") || allText.includes("advantage")) {
        sections.push("Benefits and applications")
      } else {
        // Fallback: use first 2-3 meaningful keywords
        const keywords = Array.from(mainKeywords).filter(kw => kw.length > 4).slice(0, 2)
        if (keywords.length >= 2) {
          sections.push(`${keywords[0]} and ${keywords[1]}`)
        } else if (keywords.length === 1) {
          sections.push(`Key aspects of ${keywords[0]}`)
        } else {
          sections.push("Key topics")
        }
      }
    }
  })
  
  return sections
}

/**
 * Simplify task text for section description
 */
function simplifyTaskText(text: string): string {
  // Remove common prefixes
  let simplified = text
    .replace(/^(please|kindly|also|make sure|ensure)\s+/i, "")
    .replace(/^(explain|describe|discuss|talk about|cover)\s+/i, "")
    .trim()
  
  // Limit length
  if (simplified.length > 60) {
    const words = simplified.split(/\s+/)
    simplified = words.slice(0, 10).join(" ")
  }
  
  return simplified
}

/**
 * Extract context from similar tasks
 */
function extractContextFromTasks(tasks: ExtractedTask[]): string | null {
  // Look for common descriptive words
  const contextWords = ["principles", "common", "key", "main", "important", "essential"]
  const allText = tasks.map(t => t.text.toLowerCase()).join(" ")
  
  for (const word of contextWords) {
    if (allText.includes(word)) {
      return word
    }
  }
  
  return null
}

/**
 * Step 5: Define Format & Tone
 * Extract output type and tone requirements
 */
function extractFormatAndTone(prompt: string): FormatAndTone {
  const lower = prompt.toLowerCase()
  const result: FormatAndTone = {}
  
  // Format detection
  const formats = [
    { keywords: ["blog post", "blog", "article"], format: "blog post" },
    { keywords: ["summary", "summarize"], format: "summary" },
    { keywords: ["table", "tabular"], format: "table" },
    { keywords: ["code", "program", "script"], format: "code" },
    { keywords: ["list", "listing"], format: "list" },
    { keywords: ["report", "document"], format: "report" },
    { keywords: ["essay", "paper"], format: "essay" },
  ]
  
  for (const { keywords, format } of formats) {
    if (keywords.some(kw => lower.includes(kw))) {
      result.format = format
      break
    }
  }
  
  // Tone detection
  const tones = [
    { keywords: ["professional", "formal", "business"], tone: "professional" },
    { keywords: ["casual", "informal", "friendly"], tone: "casual" },
    { keywords: ["persuasive", "convincing"], tone: "persuasive" },
    { keywords: ["technical", "detailed"], tone: "technical" },
    { keywords: ["simple", "easy", "accessible"], tone: "accessible" },
  ]
  
  for (const { keywords, tone } of tones) {
    if (keywords.some(kw => lower.includes(kw))) {
      result.tone = tone
      break
    }
  }
  
  return result
}

/**
 * Step 6: Add Constraints
 * Extract word count, style, or scope limits
 */
function extractConstraints(prompt: string): Constraints {
  const result: Constraints = {}
  const lower = prompt.toLowerCase()
  
  // Word count detection - improved patterns
  const wordCountPatterns = [
    /under\s+(\d+)\s*words?/i,
    /below\s+(\d+)\s*words?/i,
    /less\s+than\s+(\d+)\s*words?/i,
    /(\d+)\s*words?\s+or\s+less/i,
    /(\d+)\s*words?\s+maximum/i,
    /limit\s+to\s+(\d+)\s*words?/i,
    /maximum\s+(\d+)\s*words?/i,
    /at\s+most\s+(\d+)\s*words?/i,
    /up\s+to\s+(\d+)\s*words?/i,
    /(\d+)\s*words?/i,
  ]
  
  for (const pattern of wordCountPatterns) {
    const match = prompt.match(pattern)
    if (match) {
      result.wordCount = parseInt(match[1], 10)
      break
    }
  }
  
  // Style constraints
  if (lower.includes("with examples") || lower.includes("include examples")) {
    result.style = "with examples where relevant"
  } else if (lower.includes("concise") || lower.includes("brief")) {
    result.style = "concise"
  } else if (lower.includes("detailed") || lower.includes("thorough") || lower.includes("in detail")) {
    result.style = "detailed"
  } else if (lower.includes("clear") || lower.includes("accessible")) {
    result.style = "clear and accessible"
  }
  
  // Language/style constraints
  if (lower.includes("accessible language") || lower.includes("clear language")) {
    result.style = "clear, accessible language"
  }
  
  // Scope constraints
  if (lower.includes("focus on") || lower.includes("concentrate on")) {
    const focusMatch = prompt.match(/focus\s+on\s+([^.,!?]+)/i)
    if (focusMatch) {
      result.scope = focusMatch[1].trim()
    }
  }
  
  return result
}

/**
 * Step 7: Final Compression
 * Remove filler words and ensure each instruction is unique
 */
function finalCompression(text: string): string {
  let result = text
  
  // Remove filler words
  const fillers = [
    /\b(please|kindly|make sure|ensure|also|additionally|furthermore|moreover)\b/gi,
    /\b(I\s+would\s+like\s+to|I\s+want\s+to|I\s+need\s+to)\s+/gi,
    /\b(it\s+is\s+important\s+to\s+note\s+that|it\s+should\s+be\s+noted\s+that)\s+/gi,
    /\b(as\s+you\s+can\s+see|obviously|clearly|needless\s+to\s+say)\s+/gi,
  ]
  
  fillers.forEach(pattern => {
    result = result.replace(pattern, "")
  })
  
  // Simplify verbose phrases
  const verboseReplacements: [RegExp, string][] = [
    [/make\s+sure\s+to\s+explain\s+in\s+detail/gi, "explain thoroughly"],
    [/explain\s+in\s+detail/gi, "explain"],
    [/talk\s+about/gi, "cover"],
    [/discuss\s+about/gi, "discuss"],
    [/write\s+me\s+a/gi, "write a"],
    [/create\s+me\s+a/gi, "create a"],
  ]
  
  verboseReplacements.forEach(([pattern, replacement]) => {
    result = result.replace(pattern, replacement)
  })
  
  // Clean up
  result = result.replace(/\s+/g, " ").trim()
  result = result.replace(/\s*[.,]\s*/g, ". ").trim()
  
  return result
}

/**
 * Step 8: Output Clean Prompt
 * Follows template: Goal clarity + Audience awareness + Structure + Constraints
 */
function assembleCleanPrompt(
  intent: ParsedIntent,
  sections: string[],
  formatAndTone: FormatAndTone,
  constraints: Constraints
): string {
  const parts: string[] = []
  
  // 1. GOAL CLARITY: Define the type of output
  let goal = ""
  const format = formatAndTone.format || "content"
  
  // Build goal with format and subject
  if (format === "summary" && intent.subject) {
    goal = `${intent.action.charAt(0).toUpperCase() + intent.action.slice(1)} ${intent.subject}`
  } else if (format && intent.subject) {
    goal = `${intent.action.charAt(0).toUpperCase() + intent.action.slice(1)} a ${format} ${intent.subject.includes("about") ? "" : "about "}${intent.subject}`
  } else if (intent.subject) {
    goal = `${intent.action.charAt(0).toUpperCase() + intent.action.slice(1)} ${intent.subject}`
  } else {
    goal = intent.goal.length > 100 
      ? `${intent.action.charAt(0).toUpperCase() + intent.action.slice(1)} ${format}`
      : intent.goal
  }
  parts.push(goal)
  
  // 2. AUDIENCE AWARENESS: Tailor tone and depth
  if (intent.audience) {
    parts.push(`Target audience: ${intent.audience}`)
  } else {
    // Always include audience - infer if not specified
    let inferredAudience = "general readers"
    if (format === "report") {
      // For reports, infer based on tone
      if (formatAndTone.tone === "technical" || formatAndTone.tone?.includes("technical")) {
        inferredAudience = "engineering students"
      } else {
        inferredAudience = "general readers"
      }
    } else if (format === "summary" || format === "blog post" || format === "article") {
      inferredAudience = "general readers"
    }
    parts.push(`Target audience: ${inferredAudience}`)
  }
  
  // Add tone if specified
  if (formatAndTone.tone) {
    parts.push(`Tone: ${formatAndTone.tone} yet accessible`)
  } else if (!formatAndTone.tone && (format === "summary" || format === "blog post")) {
    parts.push(`Tone: professional yet accessible`)
  }
  
  // 3. STRUCTURE: Sections prevent ambiguity
  if (sections.length > 0) {
    // Filter out vague sections (just keywords without context)
    const validSections = sections.filter(s => {
      // Reject sections that are just keyword lists
      const words = s.split(/\s+/)
      if (words.length <= 3 && !s.includes("(") && !s.match(/\d/)) {
        // Check if it's just keywords (like "renewable and sources and report")
        const hasArticles = s.includes("and") && words.length <= 4
        return !hasArticles
      }
      return true
    })
    
    if (validSections.length === 0) {
      // If all sections were filtered out, create default structure based on format
      if (format === "report" && intent.subject) {
        // Default report structure
        const subjectLower = intent.subject.toLowerCase()
        if (subjectLower.includes("energy") || subjectLower.includes("renewable")) {
          parts.push(`Structure: Cover three areas:\n1. Major sources and types\n2. Adoption trends and case studies\n3. Challenges and emerging solutions`)
        } else {
          parts.push(`Structure: Cover three areas:\n1. Key concepts and fundamentals\n2. Current trends and applications\n3. Future outlook and challenges`)
        }
      } else {
        parts.push(`Structure: Organize into logical sections with clear headings`)
      }
    } else if (validSections.length === 1) {
      parts.push(`Structure: ${validSections[0]}`)
    } else {
      const numbered = validSections.map((s, i) => `${i + 1}. ${s}`).join("\n")
      const sectionWord = validSections.length === 2 ? "two" : validSections.length === 3 ? "three" : "multiple"
      parts.push(`Structure: Cover ${sectionWord} areas:\n${numbered}`)
    }
  } else {
    // If no sections extracted, provide default structure based on format
    if (format === "report" && intent.subject) {
      const subjectLower = intent.subject.toLowerCase()
      if (subjectLower.includes("energy") || subjectLower.includes("renewable")) {
        parts.push(`Structure: Cover three areas:\n1. Major renewable energy sources (solar, wind, hydro, storage)\n2. Adoption trends and global case studies\n3. Technical challenges and emerging solutions`)
      } else {
        parts.push(`Structure: Cover three areas:\n1. Key concepts and fundamentals\n2. Current trends and applications\n3. Future outlook and challenges`)
      }
    } else {
      parts.push(`Structure: Organize into logical sections with clear headings`)
    }
  }
  
  // 4. CONSTRAINTS: Word limits and format keep it economical
  const constraintParts: string[] = []
  
  if (constraints.wordCount) {
    constraintParts.push(`Word limit: ${constraints.wordCount} words`)
  }
  
  if (constraints.style) {
    if (constraints.style.includes("concise")) {
      constraintParts.push(`Style: concise`)
    } else if (constraints.style.includes("clear")) {
      constraintParts.push(`Style: ${constraints.style}`)
    } else {
      constraintParts.push(`Style: ${constraints.style}`)
    }
  } else if (!constraints.style && format === "summary") {
    // Default style for summaries
    constraintParts.push(`Style: clear and accessible`)
  }
  
  if (constraints.scope) {
    constraintParts.push(`Scope: ${constraints.scope}`)
  }
  
  if (constraintParts.length > 0) {
    // Format constraints clearly
    if (constraintParts.length === 1) {
      parts.push(`Constraints: ${constraintParts[0].replace(/^(Word limit|Style|Scope):\s*/, "")}`)
    } else {
      // Multiple constraints - format nicely
      const formatted = constraintParts.map(c => {
        // Remove "Word limit:", "Style:", "Scope:" prefixes for cleaner output
        return c.replace(/^(Word limit|Style|Scope):\s*/, "")
      })
      
      // Special formatting for word count + style
      const wordCount = formatted.find(f => f.includes("words"))
      const style = formatted.find(f => !f.includes("words") && !f.includes("Scope"))
      const scope = formatted.find(f => f.includes("Scope"))
      
      if (wordCount && style) {
        // Format: "Limit to 1,000 words and organize with clear headings"
        const wordNum = wordCount.match(/(\d+)/)?.[1]
        const styleText = style.replace(/^Style:\s*/, "")
        parts.push(`Constraints: Limit to ${wordNum} words${styleText ? ` and ${styleText}` : ""}${scope ? `, ${scope.replace(/^Scope:\s*/, "")}` : ""}`)
      } else {
        parts.push(`Constraints: ${formatted.join(", ")}`)
      }
    }
  } else {
    // Always include constraints - provide defaults based on format
    if (format === "report") {
      parts.push(`Constraints: Organize with clear headings and maintain technical accuracy`)
    } else if (format === "summary") {
      parts.push(`Constraints: Keep concise and use clear language`)
    } else {
      parts.push(`Constraints: Maintain clarity and focus`)
    }
  }
  
  // Join all parts with line breaks for clarity
  let result = parts.join(".\n\n")
  
  // Ensure it ends with a period
  if (!result.endsWith(".")) {
    result += "."
  }
  
  // Clean up any double periods or excessive whitespace
  result = result.replace(/\.\s*\./g, ".")
  result = result.replace(/\n\n\n+/g, "\n\n")
  
  return result
}

/**
 * Main optimization function
 * Implements the 8-step algorithm
 */
export function optimizePrompt(prompt: string): OptimizationResult {
  const originalLength = prompt.length
  const techniques: string[] = []
  
  if (!prompt.trim()) {
    return {
      optimized: prompt,
      originalLength: 0,
      optimizedLength: 0,
      reduction: 0,
      techniques: ["No input provided"],
    }
  }
  
  // Step 1: Parse Intent
  const intent = parseIntent(prompt)
  techniques.push("Parsed intent")
  
  // Step 2: Extract Key Tasks (pass main goal to filter it out)
  const mainGoal = intent.goal
  const tasks = extractKeyTasks(prompt, mainGoal)
  techniques.push(`Extracted ${tasks.length} unique tasks`)
  
  // Step 3: Remove Redundancy (also remove excessive subject mentions)
  let cleanedPrompt = removeRedundancy(prompt, intent.subject)
  techniques.push("Removed redundancy")
  
  // Step 4: Group into Sections
  const sections = groupIntoSections(tasks)
  if (sections.length > 1) {
    techniques.push(`Organized into ${sections.length} sections`)
  }
  
  // Step 5: Define Format & Tone
  const formatAndTone = extractFormatAndTone(prompt)
  if (formatAndTone.format || formatAndTone.tone) {
    techniques.push("Detected format and tone")
  }
  
  // Step 6: Add Constraints
  const constraints = extractConstraints(prompt)
  if (constraints.wordCount || constraints.style || constraints.scope) {
    techniques.push("Extracted constraints")
  }
  
  // Step 7: Final Compression
  cleanedPrompt = finalCompression(cleanedPrompt)
  techniques.push("Final compression")
  
  // Step 8: Output Clean Prompt
  const optimized = assembleCleanPrompt(intent, sections, formatAndTone, constraints)
  
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

/**
 * Export the interface
 */
export type { OptimizationResult }
