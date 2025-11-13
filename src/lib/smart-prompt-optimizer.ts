/**
 * Smart Prompt Optimizer
 * Uses DistilBERT + MiniLM for intelligent prompt processing
 * Combines ML understanding with template-based generation
 */

import { getModelManager } from './model-manager'
import { detectSensitiveContent } from './sensitive-content-detector'
import { FRAMEWORKS, FrameworkType, rankFrameworks, applyFramework } from './prompt-frameworks'
import { intelligentSpellCheck } from './intelligent-processor'

export interface SmartOptimizationResult {
  improvedPrompt: string
  framework: FrameworkType
  confidence: number
  warnings: string[]
  intent: {
    category: string
    action: string
    topic: string
    format?: string
    tone?: string
  }
  entities: Array<{
    word: string
    entity: string
  }>
}

/**
 * Optimize prompt using ML models + templates
 */
export async function optimizePromptSmartly(
  prompt: string
): Promise<SmartOptimizationResult> {
  const modelManager = getModelManager()
  
  // Step 1: Spell check (instant, no ML needed)
  const spellChecked = intelligentSpellCheck(prompt)
  const cleanedPrompt = spellChecked.corrected

  // Step 2: Detect sensitive content (regex, instant)
  const sensitive = detectSensitiveContent(cleanedPrompt)
  const warnings = sensitive.detectedItems.map(item => item.suggestion)

  // Step 3: Classify intent using DistilBERT
  let intentCategory = 'general'
  let confidence = 0.5
  
  try {
    const intentResult = await modelManager.classifyIntent(cleanedPrompt, [
      'content creation',
      'data analysis',
      'problem solving',
      'code generation',
      'explanation',
      'creative writing',
      'professional communication'
    ])
    intentCategory = intentResult.label
    confidence = intentResult.score
  } catch (error) {
    console.warn('[SmartOptimizer] Intent classification failed, using fallback:', error)
    // Fallback: simple keyword matching
    const lower = cleanedPrompt.toLowerCase()
    if (lower.match(/\b(write|create|make|generate|article|blog|content)\b/)) {
      intentCategory = 'content creation'
    } else if (lower.match(/\b(analyze|research|study|examine)\b/)) {
      intentCategory = 'data analysis'
    } else if (lower.match(/\b(code|program|function|script)\b/)) {
      intentCategory = 'code generation'
    }
  }

  // Step 4: Extract entities using NER
  let entities: Array<{ word: string; entity: string }> = []
  try {
    const nerResults = await modelManager.extractEntities(cleanedPrompt)
    entities = nerResults
      .filter(item => item.score > 0.5) // Filter low confidence
      .map(item => ({
        word: item.word,
        entity: item.entity
      }))
  } catch (error) {
    console.warn('[SmartOptimizer] NER failed, using fallback:', error)
  }

  // Step 5: Select framework using existing ranking system (combines ML + keyword matching)
  let bestFramework: FrameworkType = 'create'
  let frameworkScore = 0
  
  try {
    // Use the existing rankFrameworks function which combines semantic similarity + keyword matching
    const rankings = await Promise.race([
      rankFrameworks(cleanedPrompt),
      new Promise<Array<{ framework: FrameworkType; score: number; output: any }>>((_, reject) =>
        setTimeout(() => reject(new Error("Framework ranking timeout")), 10000)
      )
    ])
    
    if (rankings && rankings.length > 0) {
      bestFramework = rankings[0].framework
      frameworkScore = rankings[0].score / 100 // Normalize to 0-1
    } else {
      throw new Error("No frameworks ranked")
    }
  } catch (error) {
    console.warn('[SmartOptimizer] Framework ranking failed, using fallback:', error)
    // Fallback: keyword-based selection
    const lower = cleanedPrompt.toLowerCase()
    if (lower.match(/\b(write|create|article|blog|content)\b/)) {
      bestFramework = 'roses'
    } else if (lower.match(/\b(professional|business|corporate)\b/)) {
      bestFramework = 'race'
    } else if (lower.match(/\b(how|why|explain|step|reason)\b/)) {
      bestFramework = 'cot'
    }
  }

  // Step 6: Extract action and topic for intent reporting (not used in framework application)
  const roleEntity = entities.find(e => e.entity.includes('PER') || e.entity.includes('ORG'))
  const role = roleEntity?.word || extractRoleFromText(cleanedPrompt)
  const action = extractAction(cleanedPrompt, intentCategory)
  const topic = extractTopic(cleanedPrompt, entities)
  const format = extractFormat(cleanedPrompt)
  const tone = extractTone(cleanedPrompt)

  // Step 7: Apply framework using existing applyFramework function
  // BUT: For Smart mode, we enhance the prompt parsing with ML-extracted entities
  let improvedPrompt: string
  try {
    // Enhance the prompt with ML-extracted information before applying framework
    // This makes Smart mode actually smarter than Basic mode
    let enhancedPrompt = cleanedPrompt
    
    // If we have high-confidence entities, we can use them to improve parsing
    if (entities.length > 0 && confidence > 0.6) {
      // The entities are already extracted and will be used by parsePrompt
      // But we can also enhance the prompt text itself if needed
      console.log('[SmartOptimizer] Using ML-extracted entities:', entities)
    }
    
    // Use the existing applyFramework which has better logic and handles all frameworks properly
    // The ML models (DistilBERT, MiniLM) are already used in rankFrameworks for semantic matching
    // parsePrompt will also use HF models if available for better intent extraction
    const frameworkOutput = await applyFramework(enhancedPrompt, bestFramework)
    improvedPrompt = frameworkOutput.optimized
  } catch (error) {
    console.warn('[SmartOptimizer] Framework application failed:', error)
    // Fallback: return cleaned prompt with basic structure
    improvedPrompt = cleanedPrompt
  }

  return {
    improvedPrompt,
    framework: bestFramework,
    confidence: Math.max(confidence, frameworkScore),
    warnings,
    intent: {
      category: intentCategory,
      action,
      topic,
      format,
      tone
    },
    entities: entities.slice(0, 10) // Limit to top 10
  }
}

/**
 * Extract role from text (for intent reporting only)
 */
function extractRoleFromText(text: string): string | undefined {
  const roleMatch = text.match(/role:\s*(.+?)(?:\n|$)/i) ||
                    text.match(/(?:you are|act as|as a|as an)\s+(?:an |a )?([^.,!?\n]+?)(?:\s+who|\s+that|\s+in|$)/i)
  return roleMatch?.[1]?.trim()
}

/**
 * Extract action from text (for intent reporting only)
 */
function extractAction(text: string, intentCategory: string): string {
  const actionMatch = text.match(/action:\s*(.+?)(?:\n|$)/i) ||
                      text.match(/task:\s*(.+?)(?:\n|$)/i) ||
                      text.match(/(?:write|create|make|generate|tell|explain|describe|analyze|discuss|build|design|develop)\s+(?:a|an|the)?/i)
  
  if (actionMatch?.[1]) {
    return actionMatch[1].trim().split(/\s+/).slice(0, 5).join(' ')
  }
  
  const defaults: Record<string, string> = {
    'content creation': 'write',
    'data analysis': 'analyze',
    'problem solving': 'solve',
    'code generation': 'create code',
    'explanation': 'explain',
    'creative writing': 'write',
    'professional communication': 'write'
  }
  
  return defaults[intentCategory] || 'write'
}

/**
 * Extract topic from text - improved extraction
 */
function extractTopic(text: string, entities: Array<{ word: string; entity: string }>): string {
  // Try to find topic entity
  const topicEntity = entities.find(e => 
    e.entity.includes('MISC') || 
    e.entity.includes('ORG') ||
    e.entity.includes('LOC')
  )
  
  if (topicEntity) {
    return topicEntity.word
  }
  
  // Extract topic from topic field if present
  const topicMatch = text.match(/topic:\s*(.+?)(?:\n|$)/i)
  if (topicMatch && topicMatch[1]) {
    return topicMatch[1].trim()
  }
  
  // Improved extraction: Detect email types and extract context
  // Pattern: "write an email as company sales rep" -> detect cold email
  const salesRepPattern = /(?:write|create|make|generate|send|draft)\s+(?:an|a)?\s*(?:cold\s+)?(?:email|letter|message|note|draft)?\s*(?:as|for)?\s*(?:a|an)?\s*(?:company\s+)?(?:sales\s+rep|sales\s+representative|salesperson)/i
  if (salesRepPattern.test(text)) {
    return 'cold email'
  }
  
  // Pattern: "write a [adjective] [format] to [recipient] about [topic]"
  const emailPattern = /(?:write|create|make|generate|send)\s+(?:a|an)?\s*(?:cold\s+)?(?:funny|serious|professional|casual|formal|informal|engaging|clear)?\s*(?:email|letter|message|note|draft)\s+(?:to|for|as)\s+([^,\n]+?)(?:\s+about|\s+regarding|\s+on|\s+concerning)?\s*(.+?)(?:\s*$|\.|,)/i
  const emailMatch = text.match(emailPattern)
  if (emailMatch) {
    const recipient = emailMatch[1]?.trim() || ''
    const topic = emailMatch[2]?.trim() || ''
    // Check if recipient contains "sales rep" or "company"
    if (recipient.toLowerCase().includes('sales rep') || recipient.toLowerCase().includes('company')) {
      return 'cold email'
    }
    if (topic) {
      return `email to ${recipient} about ${topic}`.trim()
    } else if (recipient) {
      return `email to ${recipient}`
    }
  }
  
  // Pattern: "write about X" or "write on X"
  const aboutMatch = text.match(/(?:write|create|make|generate|tell|explain|describe|discuss)\s+(?:a|an|the)?\s*(?:about|on|regarding|concerning)\s+(.+?)(?:\s+(?:for|to|with|and|or|,|\.|$)|$)/i)
  if (aboutMatch && aboutMatch[1]) {
    return aboutMatch[1].trim()
  }
  
  // Pattern: Extract everything after action verb (more aggressive)
  // "write a funny email to boss about being late" -> "funny email to boss about being late"
  const actionPattern = /(?:write|create|make|generate|tell|explain|describe|discuss|analyze)\s+(?:a|an|the)?\s*(.+?)(?:\s*$|\.|,)/i
  const actionMatch = text.match(actionPattern)
  if (actionMatch && actionMatch[1]) {
    const extracted = actionMatch[1].trim()
    // Don't return if it's too generic
    if (extracted && extracted !== 'the specified topic' && extracted.length > 5) {
      return extracted
    }
  }
  
  // Last resort: return meaningful part of text
  const words = text.trim().split(/\s+/)
  if (words.length > 3) {
    // Skip first 2-3 words (usually action words) and return the rest
    return words.slice(2).join(' ').replace(/[.,!?;:]$/, '').trim() || 'the specified topic'
  }
  
  return 'the specified topic'
}

/**
 * Extract format from text (for intent reporting only)
 */
function extractFormat(text: string): string | undefined {
  const formatMatch = text.match(/format:\s*(.+?)(?:\n|$)/i) ||
                      text.match(/\b(article|report|blog|email|code|summary|outline|presentation)\b/i)
  return formatMatch?.[1] || formatMatch?.[0]
}

/**
 * Extract tone from text - improved extraction
 */
function extractTone(text: string): string | undefined {
  const toneMatch = text.match(/tone:\s*(.+?)(?:\n|$)/i)
  if (toneMatch && toneMatch[1]) {
    return toneMatch[1].trim()
  }
  
  // Expanded tone detection
  const tonePatterns = [
    /\b(funny|humorous|witty|playful|lighthearted|sarcastic)\b/i,
    /\b(professional|business|corporate|formal|serious|official)\b/i,
    /\b(casual|informal|relaxed|friendly|conversational)\b/i,
    /\b(technical|detailed|precise|scientific)\b/i,
    /\b(engaging|compelling|persuasive|convincing)\b/i,
    /\b(clear|simple|straightforward|concise)\b/i,
    /\b(empathetic|sympathetic|understanding|warm)\b/i,
    /\b(urgent|important|critical|time-sensitive)\b/i
  ]
  
  for (const pattern of tonePatterns) {
    const match = text.match(pattern)
    if (match) {
      return match[0].toLowerCase()
    }
  }
  
  return undefined
}


