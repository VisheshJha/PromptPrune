/**
 * Smart Prompt Optimizer
 * Uses unified multi-task DistilBERT model for intelligent prompt processing
 * Combines ML understanding with template-based generation
 */

import { getUnifiedModelManager } from './unified-model-manager'
import { detectSensitiveContent } from './sensitive-content-detector'
import { type FrameworkType } from './prompt-frameworks'
import { intelligentSpellCheck } from './intelligent-processor'
import { ErrorHandler } from './error-handler'
import nlp from 'compromise'

export interface SmartOptimizationResult {
  improvedPrompt: string
  // Kept for backwards-compat with UI, but Smart Mad-Libs is template-based
  framework: FrameworkType
  template: {
    id: string
    name: string
  }
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
  slots: {
    role?: string
    audience?: string
    action?: string
    topic?: string
    language?: string
    constraints?: string[]
    tone?: string
    format?: string
  }
}

/**
 * Optimize prompt using ML models + templates
 */
export async function optimizePromptSmartly(
  prompt: string
): Promise<SmartOptimizationResult> {
  const unifiedModel = getUnifiedModelManager()

  // PROGRESSIVE ENHANCEMENT: Step 1 - Instant results
  // Step 1: Spell check (instant, no ML needed)
  const spellChecked = intelligentSpellCheck(prompt)
  const cleanedPrompt = spellChecked.corrected

  // Initialize NLP for specialized understanding (POS/entity extraction)
  const doc = nlp(cleanedPrompt)

  // Step 2: Detect sensitive content (regex-based)
  const mlSensitive = detectSensitiveContent(cleanedPrompt)
  let warnings: string[] = mlSensitive.detectedItems.map(item => item.suggestion)
  let isSensitive = mlSensitive.detectedItems.length > 0

  // Step 3: Extract labeled entities (POS Tagging)
  // This answers the user request for "labeled input"
  const entities: Array<{ word: string; entity: string }> = []

  // Extract Verbs (Actions) - supports sequences (e.g., "analyze" AND "visualize")
  const verbs = doc.verbs().out('array')
  verbs.forEach((verb: string) => {
    // Filter out common weak verbs
    if (!['is', 'are', 'was', 'were', 'has', 'have', 'do', 'does'].includes(verb.toLowerCase())) {
      entities.push({ word: verb, entity: 'Action' })
    }
  })

  // Extract Nouns (Topics)
  const nouns = doc.nouns().out('array')
  nouns.forEach((noun: string) => {
    entities.push({ word: noun, entity: 'Topic' })
  })

  // Extract People/Roles
  const people = doc.people().out('array')
  people.forEach((person: string) => {
    entities.push({ word: person, entity: 'Role' })
  })

  // Basic intent classification (enhanced with NLP)
  let intentCategory = 'general'
  const actionList = entities.filter(e => e.entity === 'Action').map(e => e.word.toLowerCase())

  if (actionList.some(a => ['write', 'create', 'draft', 'compose'].includes(a))) {
    intentCategory = 'content creation'
  } else if (actionList.some(a => ['analyze', 'research', 'examine', 'review'].includes(a))) {
    intentCategory = 'data analysis'
  } else if (actionList.some(a => ['code', 'program', 'debug', 'refactor'].includes(a)) ||
    prompt.toLowerCase().includes('python') || prompt.toLowerCase().includes('javascript')) {
    intentCategory = 'code generation'
  }

  let confidence = 0.5 + (entities.length * 0.05) // Boost confidence if we found entities

  // Try to enhance intent classification (best-effort). If models are unavailable, fallback is instant.
  try {
    const intentResult = await unifiedModel.classifyIntent(cleanedPrompt)
    if (intentResult?.intent && intentResult.confidence > confidence) {
      intentCategory = intentResult.intent
      confidence = intentResult.confidence
    }
  } catch (error) {
    console.debug('[SmartOptimizer] ML intent classification failed (non-critical):', error)
  }

  // Step 6: Extract action and topic for intent reporting
  // Use NLP extracted entities for better accuracy
  const role = entities.find(e => e.entity === 'Role')?.word || extractRoleFromText(cleanedPrompt)

  // For action, combine multiple verbs if present to handle sequences (e.g. "analyze and visualize")
  const keyActions = entities.filter(e => e.entity === 'Action').map(e => e.word)
  const action = keyActions.length > 0 ? keyActions.join(' & ') : extractAction(cleanedPrompt, intentCategory)

  const topic = extractTopic(cleanedPrompt, entities)
  const format = extractFormat(cleanedPrompt)
  const tone = extractTone(cleanedPrompt)

  // Step 7: Smart Mad-Libs reconstruction (deterministic templates)
  const slots = extractMadLibSlots(cleanedPrompt, {
    intentCategory,
    entities,
    roleFromIntent: role,
    actionFromIntent: action,
    topicFromIntent: topic,
    formatFromIntent: format,
    toneFromIntent: tone,
    doc,
  })

  const madlibs = buildMadLibsPrompt(cleanedPrompt, slots)
  const improvedPrompt = madlibs.prompt
  const template = madlibs.template

  // Confidence: combine entity extraction + template selection strength
  confidence = Math.max(confidence, madlibs.confidence)

  return {
    improvedPrompt,
    // For UI compatibility; template is what actually matters now
    framework: 'create',
    template,
    confidence,
    warnings,
    intent: {
      category: intentCategory,
      action,
      topic,
      format,
      tone
    },
    entities: entities.slice(0, 15) // Limit to top 15 (increased to allow for sequences)
    ,
    slots
  }
}

type MadLibIntentFamily =
  | 'coding'
  | 'email'
  | 'analysis'
  | 'creative'
  | 'general'

interface MadLibSlots {
  intentFamily: MadLibIntentFamily
  role?: string
  audience?: string
  action?: string
  actions?: string[]
  topic?: string
  language?: string
  constraints: string[]
  tone?: string
  format?: string
}

function extractMadLibSlots(
  text: string,
  input: {
    intentCategory: string
    entities: Array<{ word: string; entity: string }>
    roleFromIntent?: string
    actionFromIntent?: string
    topicFromIntent?: string
    formatFromIntent?: string
    toneFromIntent?: string
    doc: any
  }
): MadLibSlots {
  const lower = text.toLowerCase()

  const language = detectLanguage(lower)
  const constraints = extractConstraints(lower)
  const audience = extractAudience(text)
  const role = extractSelfRole(text) || input.roleFromIntent

  // Prefer infinitive verbs for action(s)
  const rawVerbs: string[] = input.entities
    .filter(e => e.entity === 'Action')
    .map(e => e.word)
    .filter(Boolean)
  const actions = normalizeActions(rawVerbs, lower)
  const action = actions[0] || input.actionFromIntent

  const topic =
    extractTopicPhrase(input.doc, text) ||
    input.topicFromIntent

  const tone = input.toneFromIntent || inferTone(lower)
  const format = input.formatFromIntent || inferFormat(lower)

  const intentFamily: MadLibIntentFamily = (() => {
    if (/\b(email|subject line|outreach|cold email|cold outreach)\b/i.test(text)) return 'email'
    if (language || /\b(code|program|script|function|refactor|debug|react|frontend|backend|api)\b/i.test(text)) return 'coding'
    if (/\b(analyze|analysis|research|compare|evaluate|benchmark|metrics?|data|csv|sql)\b/i.test(text)) return 'analysis'
    if (/\b(story|poem|lyrics|creative|novel|fiction)\b/i.test(text)) return 'creative'
    // Map existing intent labels if present
    if (input.intentCategory.toLowerCase().includes('professional')) return 'email'
    if (input.intentCategory.toLowerCase().includes('code')) return 'coding'
    if (input.intentCategory.toLowerCase().includes('analysis')) return 'analysis'
    if (input.intentCategory.toLowerCase().includes('creative')) return 'creative'
    return 'general'
  })()

  return {
    intentFamily,
    role,
    audience,
    action,
    actions: actions.length > 0 ? actions : undefined,
    topic,
    language,
    constraints,
    tone,
    format,
  }
}

function buildMadLibsPrompt(
  original: string,
  slots: MadLibSlots
): { prompt: string; template: { id: string; name: string }; confidence: number } {
  const role = slots.role || defaultRoleForFamily(slots.intentFamily, slots.language)
  const topic = slots.topic || inferFallbackTopic(original)
  const action = slots.action || defaultActionForFamily(slots.intentFamily)
  const constraints = slots.constraints
  const tone = slots.tone || defaultToneForFamily(slots.intentFamily)
  const audience = slots.audience
  const format = slots.format || defaultFormatForFamily(slots.intentFamily)

  // Multi-step: if we have multiple actions, prefer a step list template
  const hasMultiStep = (slots.actions?.length || 0) >= 2 || /\b(then|after that|next|and then|step)\b/i.test(original)

  if (slots.intentFamily === 'coding') {
    const template = { id: hasMultiStep ? 'coding_multistep' : 'coding', name: hasMultiStep ? 'Coding (Multi-step)' : 'Coding (Template)' }
    const reqLines = [
      `Role: ${role}`,
      `Task: ${action}${topic ? ` — ${topic}` : ''}`,
      `Context: You are writing production-quality code. Keep it simple and fast.`,
      `Constraints: ${constraints.length ? constraints.join('; ') : 'Follow best practices. Keep it efficient and readable.'}`,
      `Output format: ${format}`,
      `Include: clear comments, edge cases, and a short explanation.`,
    ]
    if (slots.language) reqLines.splice(2, 0, `Language/Stack: ${slots.language}`)
    const steps = hasMultiStep && slots.actions?.length
      ? `Steps:\n- ${slots.actions.map(a => a.trim()).filter(Boolean).join('\n- ')}`
      : ''
    return {
      prompt: [reqLines.join('\n'), steps].filter(Boolean).join('\n\n'),
      template,
      confidence: 0.82,
    }
  }

  if (slots.intentFamily === 'email') {
    const template = { id: 'email_outreach', name: 'Email (Outreach)' }
    const reqLines = [
      `Role: ${role}`,
      `Task: Write a professional outreach email${audience ? ` to ${audience}` : ''}.`,
      `Goal: Start a conversation and get a reply (short, clear CTA).`,
      `Tone: ${tone}`,
      `Constraints: ${constraints.length ? constraints.join('; ') : 'Concise (80–140 words), no buzzwords, 1 clear CTA, 2 subject lines.'}`,
      `Output format: ${format || 'Return: 2 subject lines + the email body (with greeting and sign-off).'}`
    ]
    return {
      prompt: reqLines.join('\n'),
      template,
      confidence: 0.78,
    }
  }

  if (slots.intentFamily === 'analysis') {
    const template = { id: 'analysis', name: 'Analysis (Template)' }
    const reqLines = [
      `Role: ${role}`,
      `Task: ${action}${topic ? ` — ${topic}` : ''}`,
      `Tone: ${tone}`,
      `Constraints: ${constraints.length ? constraints.join('; ') : 'Be precise. Use bullets and short sections. Cite assumptions.'}`,
      `Output format: ${format || 'Return: Summary + key points + recommended next steps.'}`,
    ]
    return { prompt: reqLines.join('\n'), template, confidence: 0.72 }
  }

  if (slots.intentFamily === 'creative') {
    const template = { id: 'creative', name: 'Creative (Template)' }
    const reqLines = [
      `Role: ${role}`,
      `Task: ${action}${topic ? ` — ${topic}` : ''}`,
      `Tone: ${tone}`,
      `Constraints: ${constraints.length ? constraints.join('; ') : 'Be original. Avoid clichés.'}`,
      `Output format: ${format || 'Return: the final output only.'}`,
    ]
    return { prompt: reqLines.join('\n'), template, confidence: 0.66 }
  }

  const template = { id: 'general', name: 'General (Template)' }
  const reqLines = [
    `Role: ${role}`,
    `Task: ${action}${topic ? ` — ${topic}` : ''}`,
    `Tone: ${tone}`,
    `Constraints: ${constraints.length ? constraints.join('; ') : 'Be clear and complete.'}`,
    `Output format: ${format || 'Return: structured answer with headings and bullet points.'}`,
  ]
  return { prompt: reqLines.join('\n'), template, confidence: 0.6 }
}

function detectLanguage(lower: string): string | undefined {
  const map: Array<{ re: RegExp; label: string }> = [
    { re: /\bpython\b/, label: 'Python' },
    { re: /\btypescript\b/, label: 'TypeScript' },
    { re: /\bjavascript\b/, label: 'JavaScript' },
    { re: /\breact\b/, label: 'React' },
    { re: /\bnode\.?js\b|\bnode\b/, label: 'Node.js' },
    { re: /\bjava\b/, label: 'Java' },
    { re: /\bc\+\+\b/, label: 'C++' },
    { re: /\brust\b/, label: 'Rust' },
    { re: /\bgolang\b|\bgo\b/, label: 'Go' },
    { re: /\bsql\b/, label: 'SQL' },
  ]
  return map.find(m => m.re.test(lower))?.label
}

function extractConstraints(lower: string): string[] {
  const constraints: string[] = []
  const wc = lower.match(/\b(\d{1,5})\s*words?\b/)
  if (wc) constraints.push(`~${wc[1]} words`)

  if (/\bfast|performance|optimized|optimised|efficient|speed\b/.test(lower)) constraints.push('Optimize for performance')
  if (/\bconcise|short|brief\b/.test(lower)) constraints.push('Be concise')
  if (/\bstep[-\s]?by[-\s]?step\b/.test(lower)) constraints.push('Step-by-step')
  if (/\bexamples?\b/.test(lower)) constraints.push('Include examples')
  if (/\b(startups?)\b/.test(lower)) constraints.push('Target startups')
  if (/\bindia|indian\b/.test(lower)) constraints.push('India context')

  return Array.from(new Set(constraints)).slice(0, 8)
}

function extractSelfRole(text: string): string | undefined {
  const m =
    text.match(/\b(i am|i'm)\s+(an?\s+)?([^.,\n]+?)(?:\s+(at|from|working|targeting|in)\b|[.,\n]|$)/i) ||
    text.match(/\b(role)\s*[:=]\s*([^.,\n]+)/i)
  const role = (m?.[3] || m?.[2])?.trim()
  if (!role) return undefined
  // Avoid capturing huge trailing chunks
  return role.split(/\s+/).slice(0, 8).join(' ')
}

function extractAudience(text: string): string | undefined {
  const m =
    text.match(/\b(to|for|targeting|targeting\s+the)\s+([^.\n]+?)(?:\s+(in|on)\s+([^.\n]+))?$/i) ||
    text.match(/\baudience\s*[:=]\s*([^.\n]+)/i)
  if (!m) return undefined
  const primary = (m[2] || m[1])?.trim()
  const geo = m[4]?.trim()
  const out = [primary, geo ? `in ${geo}` : ''].filter(Boolean).join(' ')
  return out.length > 2 ? out : undefined
}

function normalizeActions(actions: string[], lower: string): string[] {
  const normalized = actions
    .map(a => a.trim())
    .filter(Boolean)
    .map(a => a.toLowerCase())
    .filter(a => !['is', 'are', 'was', 'were', 'do', 'does', 'have', 'has'].includes(a))

  // If the prompt is very short slang (e.g. "make snake game python fast"), help it
  if (normalized.length === 0 && /\b(make|build|create|write|draft|compose|generate)\b/.test(lower)) {
    const m = lower.match(/\b(make|build|create|write|draft|compose|generate)\b/)
    if (m) normalized.push(m[1])
  }

  return Array.from(new Set(normalized)).slice(0, 5).map(a => a)
}

function extractTopicPhrase(doc: any, text: string): string | undefined {
  try {
    // Prefer noun phrases / topics if available
    const topics = (doc.topics?.() ? doc.topics().out('array') : []) as string[]
    const nounPhrases = (doc.nouns?.() ? doc.nouns().out('array') : []) as string[]
    const candidates = [...topics, ...nounPhrases]
      .map(s => String(s).trim())
      .filter(s => s.length >= 3)
      .filter(s => !/^(i|you|we|they|he|she|it)$/i.test(s))
    // Heuristic: prefer phrases that include "game", "email", "prompt", etc.
    const preferred = candidates.find(c => /\b(game|email|prompt|extension|component|script|api|model)\b/i.test(c))
    return preferred || candidates[0]
  } catch {
    // Fallback: extract after action verbs
    const m = text.match(/\b(?:make|build|create|write|draft|compose|generate|refactor|debug|analyze)\b\s+(.+?)(?:[.!?\n]|$)/i)
    return m?.[1]?.trim()
  }
}

function inferTone(lower: string): string | undefined {
  if (/\b(professional|formal)\b/.test(lower)) return 'Professional'
  if (/\b(casual|friendly)\b/.test(lower)) return 'Friendly'
  if (/\b(clear|engaging)\b/.test(lower)) return 'Clear, engaging'
  return undefined
}

function inferFormat(lower: string): string | undefined {
  if (/\b(bullets|bullet points)\b/.test(lower)) return 'Bullet points'
  if (/\b(table)\b/.test(lower)) return 'Table'
  if (/\b(code)\b/.test(lower)) return 'Code + brief explanation'
  return undefined
}

function defaultRoleForFamily(family: MadLibIntentFamily, language?: string): string {
  if (family === 'coding') return language ? `Expert ${language} developer` : 'Expert software developer'
  if (family === 'email') return 'Sales representative at an ML company'
  if (family === 'analysis') return 'Analyst'
  if (family === 'creative') return 'Creative writer'
  return 'Expert assistant'
}

function defaultActionForFamily(family: MadLibIntentFamily): string {
  if (family === 'coding') return 'Build'
  if (family === 'email') return 'Write'
  if (family === 'analysis') return 'Analyze'
  if (family === 'creative') return 'Write'
  return 'Help with'
}

function defaultToneForFamily(family: MadLibIntentFamily): string {
  if (family === 'email') return 'Professional, friendly, concise'
  if (family === 'analysis') return 'Clear, structured'
  return 'Clear'
}

function defaultFormatForFamily(family: MadLibIntentFamily): string {
  if (family === 'coding') return 'Return complete code + brief explanation'
  if (family === 'email') return '2 subject lines + email body'
  if (family === 'analysis') return 'Summary + key points + next steps'
  return 'Structured answer'
}

function inferFallbackTopic(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length <= 80) return trimmed
  return trimmed.substring(0, 80) + '...'
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


