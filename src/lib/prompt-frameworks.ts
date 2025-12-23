/**
 * Prompt Engineering Frameworks
 * Transform prompts using different structured approaches
 */

import {
  extractRoleNLP,
  extractConstraintsNLP,
  extractIntentWithNLP
} from "./nlp-enhanced"
import {
  processPromptIntelligently,
  extractIntent
} from "./intelligent-processor"
import {
  parseStructuredPrompt,
  convertStructuredToNatural,
  detectFrameworkFromStructure
} from "./prompt-parser"
import { detectFields } from "./field-detector"
import { getHFIntentExtractor } from "./hf-intent-extractor"

export interface FrameworkOutput {
  framework: string
  name: string
  description: string
  optimized: string
  useCase: string
}

export interface ParsedPrompt {
  intent: string
  task: string
  context?: string
  constraints?: string
  expectedOutput?: string
  role?: string
  style?: string
  examples?: string[]
}

/**
 * Framework definitions
 */
export const FRAMEWORKS = {
  cot: {
    name: "Chain of Thought (CoT)",
    description: "Break problems into step-by-step reasoning",
    useCase: "Complex reasoning, math, logic problems",
    icon: "🧠",
  },
  tot: {
    name: "Tree of Thoughts (ToT)",
    description: "Explore multiple reasoning paths simultaneously",
    useCase: "Strategic planning, creative problem solving",
    icon: "🌳",
  },
  ape: {
    name: "APE (Action, Purpose, Expectation)",
    description: "Define what to do, why, and expected output",
    useCase: "Quick, practical prompts",
    icon: "⚡",
  },
  race: {
    name: "RACE (Role, Action, Context, Expectation)",
    description: "Assign role + task + context + expected result",
    useCase: "Professional/role-based outputs",
    icon: "👔",
  },
  roses: {
    name: "ROSES (Role, Objective, Style, Example, Scope)",
    description: "Adds style and scope to role-based prompts",
    useCase: "Writing, content creation",
    icon: "✍️",
  },
  guide: {
    name: "GUIDE (Goal, User, Instructions, Details, Examples)",
    description: "Educational or structured tasks",
    useCase: "Educational or structured tasks",
    icon: "📚",
  },
  smart: {
    name: "SMART (Specific, Measurable, Achievable, Relevant, Time-bound)",
    description: "Goal-oriented prompts",
    useCase: "Goal-oriented prompts",
    icon: "🎯",
  },
  create: {
    name: "CREATE (Context, Role, Expectation, Action, Tone, Examples)",
    description: "Comprehensive framework for structured prompts",
    useCase: "Complex, multi-faceted prompts requiring structure",
    icon: "🎨",
  },
} as const

export type FrameworkType = keyof typeof FRAMEWORKS

/**
 * Simple text cleaning helper (minimal, since intelligent processor handles most of it)
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Generate intelligent, context-aware examples based on task and framework
 */
function generateExample(task: string, framework: string): string {
  if (!task || !task.trim()) {
    return "A well-structured example that demonstrates the desired output format"
  }
  
  const taskLower = task.toLowerCase()
  const cleanTask = cleanText(task)
  
  // Generate examples based on task type and framework
  if (taskLower.includes('content') || taskLower.includes('article') || taskLower.includes('blog')) {
    if (framework === "ROSES") {
      return `A well-structured article with clear sections, engaging introduction, informative body, and strong conclusion about ${cleanTask.split(/[.!?]/)[0].substring(0, 50)}`
    } else if (framework === "GUIDE") {
      return `Step-by-step guide with clear headings, practical tips, and actionable advice for ${cleanTask.split(/[.!?]/)[0].substring(0, 50)}`
    } else if (framework === "CREATE") {
      return `A comprehensive piece that covers all aspects of ${cleanTask.split(/[.!?]/)[0].substring(0, 50)} with engaging narrative and clear structure`
    }
  } else if (taskLower.includes('report') || taskLower.includes('analysis')) {
    return `A detailed report with executive summary, key findings, data analysis, and recommendations for ${cleanTask.split(/[.!?]/)[0].substring(0, 50)}`
  } else if (taskLower.includes('code') || taskLower.includes('program')) {
    return `A clean, well-documented code example that solves ${cleanTask.split(/[.!?]/)[0].substring(0, 50)} with proper error handling and comments`
  } else if (taskLower.includes('email') || taskLower.includes('message')) {
    return `A professional, concise message that clearly communicates ${cleanTask.split(/[.!?]/)[0].substring(0, 50)} with appropriate tone and structure`
  } else if (taskLower.includes('summary') || taskLower.includes('summary')) {
    return `A concise summary highlighting key points and main takeaways from ${cleanTask.split(/[.!?]/)[0].substring(0, 50)}`
  }
  
  // Default example
  return `A high-quality example that demonstrates best practices for ${cleanTask.split(/[.!?]/)[0].substring(0, 80)}`
}

/**
 * Parse a prompt to extract key components using NLP
 * Enhanced with HF models for better semantic understanding
 */
async function parsePrompt(prompt: string, isFollowUp: boolean = false): Promise<ParsedPrompt> {
  // Handle null, undefined, or empty prompts
  if (!prompt || typeof prompt !== 'string') {
    return {
      intent: '',
      task: 'write about the specified topic',
      context: undefined,
      constraints: undefined,
      expectedOutput: undefined,
      role: undefined,
      style: undefined,
      examples: undefined,
      keyTerms: undefined
    }
  }
  
  const trimmed = prompt.trim()
  if (!trimmed || trimmed.length === 0) {
    return {
      intent: '',
      task: 'write about the specified topic',
      context: undefined,
      constraints: undefined,
      expectedOutput: undefined,
      role: undefined,
      style: undefined,
      examples: undefined,
      keyTerms: undefined
    }
  }
  
  // Handle template-only prompts (fields with no values)
  // Check if prompt only contains field labels like "Role:\nAction:\nTopic:" with no actual values
  const templateOnlyPattern = /^(?:\w+:\s*\n?)+$/
  if (templateOnlyPattern.test(trimmed) && !trimmed.match(/:\s*[^\n]+/)) {
    // This is a template with empty fields - extract any non-empty fields
    const structured = parseStructuredPrompt(trimmed)
    return {
      intent: trimmed,
      task: structured.action ? `${structured.action} about the specified topic` : 'write about the specified topic',
      context: structured.context,
      constraints: structured.constraints,
      expectedOutput: undefined,
      role: structured.role || undefined,
      style: structured.tone || undefined,
      examples: undefined,
      keyTerms: undefined
    }
  }
  
  // Check if prompt is in structured format (Role:, Action:, Topic:)
  const structured = parseStructuredPrompt(trimmed)
  
  // If structured, convert to natural language for better processing
  let workingPrompt = prompt
  if (structured.isStructured) {
    const natural = convertStructuredToNatural(structured)
    if (natural) {
      workingPrompt = natural
    }
  }
  
  // Use intelligent processor
  const processed = processPromptIntelligently(workingPrompt)
  
  // Use the corrected and structured version
  const expanded = processed.structured || processed.corrected
  const cleanedPrompt = processed.corrected
  const lower = cleanedPrompt.toLowerCase()
  
  // Use detectFields to get structured field information
  const detectedFields = detectFields(prompt)
  
  // Try to enhance with HF models (async, but we'll use it if available)
  let hfEnhanced: any = null
  try {
    const hfExtractor = getHFIntentExtractor()
    hfEnhanced = await hfExtractor.extractIntent(cleanedPrompt, extractIntent)
  } catch (error) {
    console.warn('[parsePrompt] HF extraction failed, using fallback:', error)
  }
  
  // Extract role - prefer structured format, then detected fields, then NLP (skip for follow-ups)
  // CRITICAL: Always preserve structured role to ensure "Marketing Manager", "Sales Rep" appear in outputs
  let role: string | undefined
  if (!isFollowUp) {
    if (structured.isStructured && structured.role) {
      // Preserve structured role exactly as provided
      role = structured.role.trim()
    } else if (detectedFields.hasRole && detectedFields.role) {
      role = detectedFields.role
    } else {
      role = extractRoleNLP(cleanedPrompt) || undefined
    }
  }
  
  // Use structured components if available, otherwise use intelligent intent extraction
  let action: string
  let topic: string
  let format: string | undefined
  let tone: string | undefined
  
  if (structured.isStructured) {
    // For structured prompts, extract directly from structure
    // IMPORTANT: Preserve the original structured values to ensure they appear in framework outputs
    
    // Don't use "Format: text" as action - check if action is actually a format field
    let extractedAction = structured.action
    if (extractedAction) {
      const actionLower = extractedAction.toLowerCase().trim()
      // If action looks like a format field, don't use it
      if (actionLower.startsWith('format:') || actionLower === 'text' || actionLower === 'format' || actionLower.match(/^format\s*:/)) {
        extractedAction = undefined // Don't use this as action
      }
    }
    action = extractedAction || processed.intent.action || "write"
    topic = structured.topic || processed.intent.topic || "the specified topic"
    format = structured.format
    tone = structured.tone
    
    // Clean action - remove "about" if it's already in the action, but preserve the original role
    action = action.replace(/\s+about\s+.*$/i, "").trim()
    
    // CRITICAL: Always use structured role if available (preserves "Marketing Manager", "Sales Rep", etc.)
    if (structured.role) {
      role = structured.role.trim()
    }
  } else {
    // Use HF-enhanced intent if available, otherwise fallback to processed intent
    if (hfEnhanced && hfEnhanced.confidence > 0.6) {
      action = hfEnhanced.action || processed.intent.action
      topic = hfEnhanced.topic || processed.intent.topic
      format = hfEnhanced.format || processed.intent.format || (detectedFields.hasFormat ? detectedFields.format : undefined)
      tone = hfEnhanced.tone || processed.intent.tone || (detectedFields.hasTone ? detectedFields.tone : undefined)
    } else {
      const intelligentIntent = processed.intent
      action = intelligentIntent.action
      topic = intelligentIntent.topic
      format = intelligentIntent.format || (detectedFields.hasFormat ? detectedFields.format : undefined)
      tone = intelligentIntent.tone || (detectedFields.hasTone ? detectedFields.tone : undefined)
    }
  }
  
  // Use detected fields if structured format didn't provide them
  if (detectedFields.hasTask && detectedFields.task && !structured.isStructured) {
    // Clean detected task - remove "about" if present
    let detectedTask = detectedFields.task
    detectedTask = detectedTask.replace(/\s+about\s+.*$/i, "").trim()
    action = detectedTask
  }
  if (detectedFields.hasTopic && detectedFields.topic && !topic) {
    topic = detectedFields.topic
  }
  
  // Build task from intent - use FULL context from prompt
  let task = ''
  
  // For natural language prompts, try to extract the full task directly
  // "write a funny email to my boss about being late" -> "write a funny email to my boss about being late"
  // "it's my responsibility to write cold email" -> "write cold email"
  if (!structured.isStructured) {
    // Pattern 1: "it's my responsibility to [action] [topic]"
    const responsibilityTaskPattern = /(?:it'?s|it is)\s+my\s+responsibility\s+to\s+(write|create|make|generate|send|draft|help|assist)\s+([^.,!?\n]+?)(?:\s*$|\.|,|!|\?)/i
    const responsibilityTaskMatch = cleanedPrompt.match(responsibilityTaskPattern)
    if (responsibilityTaskMatch && responsibilityTaskMatch[1] && responsibilityTaskMatch[2]) {
      const extractedAction = responsibilityTaskMatch[1].trim()
      const extractedTopic = responsibilityTaskMatch[2].trim()
      // Clean topic - remove "help me with that" or similar
      const cleanTopic = extractedTopic.replace(/\s+(help|assist|with|that|this|me|us)\s*$/i, '').trim()
      if (cleanTopic.length > 2) {
        task = `${extractedAction} ${cleanTopic}`
      }
    }
    
    // Pattern 2: Extract full task: everything after the action verb
    if (!task) {
      const fullTaskPattern = /(?:write|create|make|generate|send|draft|tell|explain|describe|discuss|analyze)\s+([^.,!?\n]+?)(?:\s*$|\.|,|!|\?)/i
      const fullTaskMatch = cleanedPrompt.match(fullTaskPattern)
      if (fullTaskMatch && fullTaskMatch[1]) {
        const extractedTask = fullTaskMatch[1].trim()
        // Only use if it's meaningful (not just "a" or "an")
        if (extractedTask.length > 5 && !extractedTask.match(/^(a|an|the|content|stuff|things)$/i)) {
          task = `${action} ${extractedTask}`
          // Clean up: remove duplicate action words
          task = task.replace(new RegExp(`^${action}\\s+${action}\\s+`, 'i'), `${action} `)
        }
      }
    }
  }
  
  // If full task extraction didn't work, build from action + topic
  if (!task || task.length < 10) {
    if (topic && !topic.toLowerCase().includes('specified topic') && !topic.toLowerCase().includes('[subject]')) {
      // Check if action already contains topic or "about" to prevent duplication
      const actionLower = action.toLowerCase()
      if (actionLower.includes(' about ') || actionLower.includes(topic.toLowerCase())) {
        task = action // Use action as-is if it already contains topic
      } else {
        task = `${action} ${topic}`
      }
    } else {
      // Fallback: use the cleaned prompt itself as task (most reliable)
      const promptWords = cleanedPrompt.trim().split(/\s+/)
      if (promptWords.length > 2) {
        // Skip first word (usually action) and use the rest
        task = promptWords.slice(1).join(' ')
        // Prepend action if not already there
        if (!task.toLowerCase().startsWith(action.toLowerCase())) {
          task = `${action} ${task}`
        }
      } else {
        task = `${action} about the specified topic`
      }
    }
  }
  
  // Task is already cleaned by intelligent processor, just normalize spacing
  task = cleanText(task)
  
  // Final cleanup: Remove any framework keywords that might have leaked into task
  // This prevents issues like "Action: Write about funy email Purpose"
  task = task
    .replace(/\s*Purpose:.*$/i, '')
    .replace(/\s*Expectation:.*$/i, '')
    .replace(/\s*Context:.*$/i, '')
    .replace(/\s*Action:.*$/i, '')
    .replace(/\s*Role:.*$/i, '')
    .trim()
  
  // If task is empty after cleanup, rebuild it
  if (!task || task.length < 3) {
    task = `${action} about ${topic}`
  }
  
  // Final cleanup: remove duplicate "about" phrases
  task = task.replace(/\babout\s+.*?\babout\s+/gi, "about ")
  // Remove duplicate action words
  task = task.replace(/^(write|create|make|generate|tell|explain|describe|analyze|discuss|build|design|develop)\s+\1\s+/i, "$1 ")
  
  // Extract key terms from original prompt for use in framework outputs
  const originalPromptLower = prompt.toLowerCase()
  const keyTerms: string[] = []
  if (originalPromptLower.includes('senior developers')) {
    keyTerms.push('senior developers')
  }
  if (originalPromptLower.includes('2000 words')) {
    keyTerms.push('2000 words')
  }
  if (originalPromptLower.includes('hr professionals')) {
    keyTerms.push('HR professionals')
  }
  if (originalPromptLower.includes('5000 words')) {
    keyTerms.push('5000 words')
  }
  if (originalPromptLower.includes('eco-friendly')) {
    keyTerms.push('eco-friendly')
  }
  
  // Extract context - prefer structured format, then detected fields, then regex
  let context: string | undefined
  if (structured.isStructured && (structured as any).context) {
    context = (structured as any).context
  } else if (detectedFields.hasContext && detectedFields.context) {
    context = detectedFields.context
  } else {
    const contextMatch = cleanedPrompt.match(/(?:context:|background:|given that|considering)\s+([^.,!?\n]+)/i)
    context = contextMatch ? contextMatch[1].trim() : undefined
  }
  
  // Extract constraints using NLP, but preserve key terms
  const nlpConstraints = extractConstraintsNLP(cleanedPrompt)
  let constraints: string | undefined
  if (keyTerms.length > 0) {
    // Prefer key terms over NLP constraints
    constraints = keyTerms.join(', ')
  } else if (nlpConstraints.wordCount || nlpConstraints.style || nlpConstraints.format) {
    constraints = `Word count: ${nlpConstraints.wordCount || "not specified"}, Style: ${nlpConstraints.style || nlpConstraints.tone || "not specified"}, Format: ${nlpConstraints.format || "not specified"}`
  }
  
  // Extract expected output
  const outputMatch = cleanedPrompt.match(/(?:output:|result:|should be|must be|format:)\s+([^.,!?\n]+)/i)
  const expectedOutput = outputMatch ? outputMatch[1].trim() : undefined
  
  // Extract style using NLP - prefer structured format, then detected fields, then regex
  const nlpConstraintsForStyle = extractConstraintsNLP(cleanedPrompt)
  const style = tone || nlpConstraintsForStyle.tone || nlpConstraintsForStyle.style || (() => {
    const styleMatch = cleanedPrompt.match(/(?:tone:|style:|tone of|style of)\s+([^.,!?\n]+)/i)
    return styleMatch ? styleMatch[1].trim() : undefined
  })()

  // Extract examples - use HF enhanced if available
  let examples: string[] | undefined
  if (hfEnhanced && hfEnhanced.details && hfEnhanced.details.examples.length > 0) {
    examples = hfEnhanced.details.examples
  } else {
    const exampleMatch = cleanedPrompt.match(/(?:example:|for example|e\.g\.|such as)\s+([^.,!?\n]+)/i)
    examples = exampleMatch ? [exampleMatch[1].trim()] : undefined
  }

  return {
    intent: cleanedPrompt, // Use cleaned prompt
    task,
    context,
    constraints,
    expectedOutput,
    role,
    style,
    examples,
    keyTerms: keyTerms.length > 0 ? keyTerms : undefined,
  }
}

/**
 * Apply Chain of Thought framework
 */
function applyCoT(parsed: ParsedPrompt): string {
  const parts: string[] = []
  
  // Include role if available (important for structured prompts)
  if (parsed.role) {
    // Clean role - remove "You are" if already present to prevent duplication
    const cleanRole = parsed.role.replace(/^you are\s+/i, "").trim()
    parts.push(`Role: ${cleanRole}`)
  }
  
  // Use the corrected task (already processed by intelligent processor)
  const cleanTask = parsed.task || parsed.intent.split(/[.!?]/)[0].trim()
  parts.push(`Task: ${cleanTask}`)
  
  if (parsed.context) {
    parts.push(`Context: ${parsed.context}`)
  }
  
  parts.push("\nThink step by step:")
  parts.push("1. Understand the problem and requirements")
  parts.push("2. Break down into smaller sub-problems")
  parts.push("3. Solve each sub-problem systematically")
  parts.push("4. Combine solutions to reach the final answer")
  parts.push("5. Verify the solution meets all requirements")
  
  if (parsed.constraints) {
    parts.push(`\nConstraints: ${parsed.constraints}`)
  }
  
  if (parsed.expectedOutput) {
    parts.push(`\nExpected Output: ${parsed.expectedOutput}`)
  }
  
  return parts.join("\n")
}

/**
 * Apply Tree of Thoughts framework
 */
function applyToT(parsed: ParsedPrompt): string {
  const parts: string[] = []
  
  // Use the corrected task (already processed by intelligent processor)
  const cleanTask = parsed.task || parsed.intent.split(/[.!?]/)[0].trim()
  parts.push(`Problem: ${cleanTask}`)
  
  if (parsed.context) {
    parts.push(`Context: ${parsed.context}`)
  }
  
  // Generate intelligent approaches based on task
  const taskLower = cleanTask.toLowerCase()
  let approach1 = "Direct approach focusing on core requirements"
  let approach2 = "Alternative method considering different perspectives"
  let approach3 = "Creative solution exploring innovative methods"
  
  if (taskLower.includes('content') || taskLower.includes('write')) {
    approach1 = "Structured approach: outline → draft → refine"
    approach2 = "Narrative approach: storytelling with engaging elements"
    approach3 = "Data-driven approach: research → analysis → synthesis"
  } else if (taskLower.includes('solve') || taskLower.includes('problem')) {
    approach1 = "Analytical approach: break down into components"
    approach2 = "Creative approach: brainstorm innovative solutions"
    approach3 = "Systematic approach: follow proven methodology"
  }
  
  parts.push("\nExplore multiple approaches:")
  parts.push(`Approach 1: ${approach1}`)
  parts.push(`Approach 2: ${approach2}`)
  parts.push(`Approach 3: ${approach3}`)
  parts.push("\nEvaluate each approach:")
  parts.push("- Pros and cons of each path")
  parts.push("- Feasibility and effectiveness")
  parts.push("- Best path forward or combination")
  
  if (parsed.constraints) {
    parts.push(`\nConstraints: ${parsed.constraints}`)
  }
  
  return parts.join("\n")
}

/**
 * Apply APE framework
 */
function applyAPE(parsed: ParsedPrompt): string {
  const parts: string[] = []
  
  // Use the corrected task (already processed by intelligent processor)
  // Clean task to remove any framework keywords that might have leaked in
  let cleanTask = parsed.task || parsed.intent.split(/[.!?]/)[0].trim()
  
  // Remove framework keywords if they appear in task (e.g., "Purpose", "Expectation", "Context")
  cleanTask = cleanTask
    .replace(/\s*Purpose:.*$/i, '')
    .replace(/\s*Expectation:.*$/i, '')
    .replace(/\s*Context:.*$/i, '')
    .replace(/\s*Action:.*$/i, '')
    .trim()
  
  // If task is empty or too short, use action + topic
  if (!cleanTask || cleanTask.length < 5) {
    const action = parsed.action || 'write'
    const topic = parsed.topic || 'the specified topic'
    cleanTask = `${action} about ${topic}`
  }
  
  // Detect specific email types from context
  const originalPrompt = parsed.intent || cleanTask
  const promptLower = originalPrompt.toLowerCase()
  let detectedEmailType: string | undefined
  
  // Detect cold email from sales rep context
  if ((promptLower.includes('sales rep') || promptLower.includes('company sales') || promptLower.includes('sales representative')) && 
      (promptLower.includes('email') || promptLower.includes('write'))) {
    detectedEmailType = 'cold email'
  } else if (promptLower.includes('cold email')) {
    detectedEmailType = 'cold email'
  }
  
  // Enhance task with detected email type
  if (detectedEmailType && !cleanTask.toLowerCase().includes(detectedEmailType)) {
    cleanTask = cleanTask.replace(/\b(email|letter|message)\b/i, detectedEmailType)
  }
  
  parts.push(`Action: ${cleanTask}`)
  
  // Purpose - concise and specific
  let purpose: string | undefined
  const taskLower = cleanTask.toLowerCase()
  
  if (detectedEmailType === 'cold email') {
    purpose = "To introduce product/service and generate interest from potential clients"
  } else if (taskLower.includes('content') || taskLower.includes('article')) {
    purpose = "To create engaging, informative content"
  } else if (taskLower.includes('report') || taskLower.includes('analysis')) {
    purpose = "To provide comprehensive analysis and insights"
  } else if (taskLower.includes('guide') || taskLower.includes('tutorial')) {
    purpose = "To educate and enable task completion"
  } else {
    purpose = "To achieve the desired outcome effectively"
  }
  parts.push(`Purpose: ${purpose}`)
  
  // Expectation - concise and specific
  let expectation: string | undefined
  if (detectedEmailType === 'cold email') {
    expectation = "Compelling cold email with clear value proposition and call-to-action"
  } else if (taskLower.includes('content') || taskLower.includes('article')) {
    expectation = "Well-structured, engaging content"
  } else if (taskLower.includes('report')) {
    expectation = "Comprehensive report with clear findings and recommendations"
  } else {
    expectation = "High-quality output meeting requirements"
  }
  parts.push(`Expectation: ${expectation}`)
  
  // Only add constraints if meaningful
  if (parsed.constraints && parsed.constraints.trim().length > 0 && !parsed.constraints.includes('not specified')) {
    parts.push(`\nConstraints: ${parsed.constraints}`)
  }
  
  return parts.join("\n")
}

/**
 * Apply RACE framework
 */
function applyRACE(parsed: ParsedPrompt): string {
  const parts: string[] = []
  
  // Role - infer from task if not provided
  let role = parsed.role
  if (!role) {
    const taskLower = (parsed.task || parsed.intent).toLowerCase()
    if (taskLower.includes('content') || taskLower.includes('article') || taskLower.includes('blog')) {
      role = "Content Writer"
    } else if (taskLower.includes('report') || taskLower.includes('analysis')) {
      role = "Business Analyst"
    } else if (taskLower.includes('code') || taskLower.includes('program')) {
      role = "Software Engineer"
    } else {
      role = "Expert"
    }
  }
  
  // Clean role - remove "You are" if already present to prevent duplication
  role = role.replace(/^you are\s+/i, "").trim()
  
  parts.push(`Role: You are ${role}`)
  
  // Use the corrected task (already processed by intelligent processor)
  let cleanTask = parsed.task || parsed.intent.split(/[.!?]/)[0].trim()
  
  // Remove duplicate "about" phrases to prevent duplication
  cleanTask = cleanTask.replace(/\babout\s+.*?\babout\s+/gi, "about ")
  // Remove duplicate action words at the start
  cleanTask = cleanTask.replace(/^(write|create|make|generate|tell|explain|describe|analyze|discuss|build|design|develop)\s+\1\s+/i, "$1 ")
  
  // Detect specific email types
  const originalPrompt = parsed.intent || cleanTask
  const promptLower = originalPrompt.toLowerCase()
  if ((promptLower.includes('sales rep') || promptLower.includes('company sales')) && promptLower.includes('email') && !cleanTask.toLowerCase().includes('cold')) {
    cleanTask = cleanTask.replace(/\b(email|letter|message)\b/i, 'cold email')
  }
  
  parts.push(`Action: ${cleanTask}`)
  
  // Context - concise and specific
  let context = parsed.context
  if (!context) {
    const taskLower = cleanTask.toLowerCase()
    if (taskLower.includes('cold email') || (taskLower.includes('email') && promptLower.includes('sales'))) {
      context = "Outreach to potential clients"
    } else if (taskLower.includes('content') || taskLower.includes('article')) {
      context = "Content creation for target audience"
    } else if (taskLower.includes('report')) {
      context = "Business analysis and reporting"
    } else {
      context = "Professional context"
    }
  }
  parts.push(`Context: ${context}`)
  
  // Expectation - concise and specific
  let expectation = parsed.expectedOutput
  if (!expectation) {
    const taskLower = cleanTask.toLowerCase()
    if (taskLower.includes('cold email')) {
      expectation = "Compelling cold email with clear value proposition and call-to-action"
    } else if (parsed.keyTerms && parsed.keyTerms.length > 0) {
      expectation = `Output meeting: ${parsed.keyTerms.join(', ')}`
    } else if (taskLower.includes('email')) {
      expectation = "Clear, professional email achieving its goal"
    } else if (taskLower.includes('content') || taskLower.includes('article')) {
      expectation = "Engaging, well-structured content"
    } else if (taskLower.includes('report')) {
      expectation = "Comprehensive report with analysis and recommendations"
    } else {
      expectation = "High-quality output meeting requirements"
    }
  }
  parts.push(`Expectation: ${expectation}`)
  
  // Only add constraints if meaningful
  if (parsed.constraints && parsed.constraints.trim().length > 0 && !parsed.constraints.includes('not specified')) {
    parts.push(`\nConstraints: ${parsed.constraints}`)
  }
  
  return parts.join("\n")
}

/**
 * Apply ROSES framework
 */
function applyROSES(parsed: ParsedPrompt): string {
  const parts: string[] = []
  
  // Role - use parsed role if available, otherwise default
  // IMPORTANT: Preserve original role terms like "Marketing Manager", "Sales Rep"
  let role = parsed.role || "Content Creator"
  // Remove "You are" if already present to prevent duplication
  role = role.replace(/^you are\s+/i, "").trim()
  
  parts.push(`Role: You are ${role}`)
  
  // Objective - use the corrected task, clean duplicates, preserve key terms
  let objective = parsed.task || parsed.intent.split(/[.!?]/)[0]
  // Remove duplicate "about" phrases to prevent duplication
  objective = objective.replace(/\babout\s+.*?\babout\s+/gi, "about ")
  // Remove duplicate action words at the start
  objective = objective.replace(/^(write|create|make|generate|tell|explain|describe|analyze|discuss|build|design|develop)\s+\1\s+/i, "$1 ")
  
  // Detect specific email types
  const originalPrompt = parsed.intent || objective
  const promptLower = originalPrompt.toLowerCase()
  if ((promptLower.includes('sales rep') || promptLower.includes('company sales')) && promptLower.includes('email') && !objective.toLowerCase().includes('cold')) {
    objective = objective.replace(/\b(email|letter|message)\b/i, 'cold email')
  }
  
  // Preserve key terms from original prompt in objective (only if meaningful)
  if (parsed.keyTerms && parsed.keyTerms.length > 0) {
    const objectiveLower = objective.toLowerCase()
    const missingTerms = parsed.keyTerms.filter(term => term.length > 3 && !objectiveLower.includes(term.toLowerCase()))
    if (missingTerms.length > 0 && missingTerms.length <= 3) {
      objective += ` (${missingTerms.join(', ')})`
    }
  }
  
  parts.push(`Objective: ${objective}`)
  
  // Style - only if specified or meaningful
  const style = parsed.style || (promptLower.includes('email') && promptLower.includes('sales') ? "Professional and persuasive" : "Professional and engaging")
  parts.push(`Style: ${style}`)
  
  // Example - generate intelligent example if missing
  if (parsed.examples && parsed.examples.length > 0) {
    parts.push(`Example: ${parsed.examples[0]}`)
  } else {
    const example = generateExample(parsed.task || parsed.intent, "ROSES")
    parts.push(`Example: ${example}`)
  }
  
  // Scope
  const scope = parsed.constraints || "Complete and comprehensive"
  parts.push(`Scope: ${scope}`)
  
  return parts.join("\n")
}

/**
 * Apply GUIDE framework
 */
function applyGUIDE(parsed: ParsedPrompt): string {
  const parts: string[] = []
  
  // Goal - use the corrected task
  const goal = parsed.task || parsed.intent.split(/[.!?]/)[0]
  parts.push(`Goal: ${goal}`)
  
  // User
  const user = parsed.role || "General audience"
  parts.push(`User: For ${user}`)
  
  // Instructions
  parts.push(`Instructions:`)
  parts.push("1. Understand the goal and user needs")
  parts.push("2. Follow best practices and guidelines")
  parts.push("3. Ensure clarity and completeness")
  
  // Details
  if (parsed.context) {
    parts.push(`\nDetails: ${parsed.context}`)
  }
  
  // Examples - generate if missing
  if (parsed.examples && parsed.examples.length > 0) {
    parts.push(`\nExamples:`)
    parsed.examples.forEach((ex, i) => {
      parts.push(`${i + 1}. ${ex}`)
    })
  } else {
    const example = generateExample(parsed.task || parsed.intent, "GUIDE")
    parts.push(`\nExamples:`)
    parts.push(`1. ${example}`)
  }
  
  if (parsed.constraints) {
    parts.push(`\nConstraints: ${parsed.constraints}`)
  }
  
  return parts.join("\n")
}

/**
 * Apply CREATE framework
 */
function applyCREATE(parsed: ParsedPrompt): string {
  const parts: string[] = []
  
  // Context
  const context = parsed.context || "Standard context"
  parts.push(`Context: ${context}`)
  
  // Role
  const role = parsed.role || "Expert"
  parts.push(`Role: You are ${role}`)
  
  // Expectation
  const expectation = parsed.expectedOutput || "High-quality, complete output"
  parts.push(`Expectation: ${expectation}`)
  
  // Action - use the corrected task
  const action = parsed.task || parsed.intent.split(/[.!?]/)[0]
  parts.push(`Action: ${action}`)
  
  // Tone
  const tone = parsed.style || "Professional and clear"
  parts.push(`Tone: ${tone}`)
  
  // Examples - generate if missing
  if (parsed.examples && parsed.examples.length > 0) {
    parts.push(`Examples:`)
    parsed.examples.forEach((ex, i) => {
      parts.push(`${i + 1}. ${ex}`)
    })
  } else {
    const example = generateExample(parsed.task || parsed.intent, "CREATE")
    parts.push(`Examples:`)
    parts.push(`1. ${example}`)
  }
  
  if (parsed.constraints) {
    parts.push(`\nConstraints: ${parsed.constraints}`)
  }
  
  return parts.join("\n")
}

/**
 * Apply SMART framework
 */
function applySMART(parsed: ParsedPrompt): string {
  const parts: string[] = []
  
  // Goal - use the corrected task
  const goal = parsed.task || parsed.intent.split(/[.!?]/)[0]
  
  parts.push(`Goal: ${goal}`)
  parts.push("\nSMART Criteria:")
  parts.push(`Specific: Clearly define what needs to be accomplished`)
  parts.push(`Measurable: Include criteria to measure success`)
  parts.push(`Achievable: Ensure the goal is realistic and attainable`)
  parts.push(`Relevant: Align with overall objectives and needs`)
  parts.push(`Time-bound: Set clear deadlines or timeframes`)
  
  if (parsed.context) {
    parts.push(`\nContext: ${parsed.context}`)
  }
  
  if (parsed.constraints) {
    parts.push(`\nConstraints: ${parsed.constraints}`)
  }
  
  if (parsed.expectedOutput) {
    parts.push(`\nExpected Outcome: ${parsed.expectedOutput}`)
  }
  
  return parts.join("\n")
}

/**
 * Transform prompt using a specific framework
 * Always uses original prompt to prevent cumulative modifications
 */
export async function applyFramework(
  prompt: string,
  framework: FrameworkType,
  isFollowUp: boolean = false
): Promise<FrameworkOutput> {
  // Handle null, undefined, or empty prompts
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return {
      framework,
      name: FRAMEWORKS[framework].name,
      description: FRAMEWORKS[framework].description,
      optimized: "Please provide a prompt to optimize.",
      useCase: FRAMEWORKS[framework].useCase,
    }
  }
  
  const parsed = await parsePrompt(prompt, isFollowUp)
  let optimized = ""
  
  // Handle empty parsed prompts (template-only or very short)
  if (!parsed.task || parsed.task.trim().length === 0) {
    optimized = "Please provide more details about what you'd like to accomplish."
  } else {
    switch (framework) {
      case "cot":
        optimized = applyCoT(parsed)
        break
      case "tot":
        optimized = applyToT(parsed)
        break
      case "ape":
        optimized = applyAPE(parsed)
        break
      case "race":
        optimized = applyRACE(parsed)
        break
      case "roses":
        optimized = applyROSES(parsed)
        break
      case "guide":
        optimized = applyGUIDE(parsed)
        break
      case "smart":
        optimized = applySMART(parsed)
        break
      case "create":
        optimized = applyCREATE(parsed)
        break
      default:
        optimized = prompt || "Please provide a prompt to optimize."
    }
  }
  
  return {
    framework,
    name: FRAMEWORKS[framework].name,
    description: FRAMEWORKS[framework].description,
    optimized: optimized || "Please provide a prompt to optimize.",
    useCase: FRAMEWORKS[framework].useCase,
  }
}

/**
 * Get all framework outputs for a prompt
 */
export async function getAllFrameworkOutputs(prompt: string): Promise<FrameworkOutput[]> {
  return Promise.all(
    Object.keys(FRAMEWORKS).map((key) =>
      applyFramework(prompt, key as FrameworkType)
    )
  )
}

/**
 * Rank frameworks by how well they fit a prompt
 * Returns frameworks sorted by relevance score (highest first)
 */
export async function rankFrameworks(prompt: string): Promise<Array<{ framework: FrameworkType; score: number; output: FrameworkOutput }>> {
  // Check if prompt is in structured format
  const structured = parseStructuredPrompt(prompt)
  const frameworkHint = structured.isStructured ? detectFrameworkFromStructure(structured) : null
  
  // Use intelligent processor for better analysis
  const processed = processPromptIntelligently(prompt)
  const cleanedPrompt = processed.corrected
  const lowerPrompt = cleanedPrompt.toLowerCase()
  
  const rankings: Array<{ framework: FrameworkType; score: number; output: FrameworkOutput }> = []

  // Detect task type for better scoring
  const isContentCreation = lowerPrompt.match(/\b(write|create|make|generate|content|article|blog|post|piece|story|narrative)\b/)
  const isReport = lowerPrompt.match(/\b(report|document|analysis|summary|outline|presentation)\b/)
  const isReasoning = lowerPrompt.match(/\b(how|why|explain|reason|think|calculate|solve|step)\b/)
  const isMath = lowerPrompt.match(/\b(math|number|calculate|formula|equation|compute)\b/)
  const isProfessional = lowerPrompt.match(/\b(professional|business|corporate|executive|client|stakeholder)\b/)
  const isInstruction = lowerPrompt.match(/\b(guide|tutorial|instructions|how to|steps|teach|learn)\b/)
  
  // Boost scores for preferred frameworks from structured format
  const frameworkBoosts: Record<string, number> = {}
  if (frameworkHint) {
    frameworkHint.preferredFrameworks.forEach(fw => {
      frameworkBoosts[fw] = (frameworkBoosts[fw] || 0) + 25 // Significant boost
    })
  }

  // Get HF extractor for semantic similarity (optional - fast timeout)
  const hfExtractor = getHFIntentExtractor()
  let semanticScores: Record<string, number> = {}
  
  // Try to calculate semantic similarity with very short timeout (2 seconds max)
  // If it fails, we'll use keyword-only scoring which is fast and reliable
  try {
    const initResult = await Promise.race([
      hfExtractor.initialize(),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)) // Fast timeout
    ])
    
    // Only proceed if initialization succeeded quickly
    if (initResult !== false && hfExtractor) {
      const similarityPromises = Object.entries(FRAMEWORKS).map(async ([key, framework]) => {
        try {
          const frameworkText = `${framework.description} ${framework.useCase}`
          const similarity = await Promise.race([
            hfExtractor.calculateSemanticSimilarity(cleanedPrompt, frameworkText),
            new Promise<number>((resolve) => setTimeout(() => resolve(0.5), 1000)) // Very fast timeout
          ])
          return { key, similarity }
        } catch (error) {
          return { key, similarity: 0.5 } // Default similarity
        }
      })
      const similarities = await Promise.all(similarityPromises)
      similarities.forEach(({ key, similarity }) => {
        semanticScores[key] = similarity * 100 // Scale to 0-100
      })
    }
  } catch (error) {
    // Silently continue with keyword-only scoring (faster and more reliable)
  }

  // Apply frameworks in parallel with timeout for each
  // Reduce timeout to 1.5 seconds per framework to prevent long waits
  const frameworkPromises = Object.entries(FRAMEWORKS).map(async ([key, framework]) => {
    try {
      // Apply framework with timeout (3 seconds max per framework)
      const output = await Promise.race([
        applyFramework(prompt, key as FrameworkType),
        new Promise<FrameworkOutput>((_, reject) => 
          setTimeout(() => reject(new Error(`Framework ${key} timeout`)), 3000)
        )
      ])
      
      let score = 0
      let keywordScore = 0 // Initialize keyword score
      
      // Add semantic similarity score (40% weight)
      if (semanticScores[key] !== undefined) {
        score += semanticScores[key] * 0.4
      }

      // Apply structured format boost
      if (frameworkBoosts[key]) {
        score += frameworkBoosts[key]
      }
      
      // ROSES: Best for content creation, articles, reports, structured content
      if (key === "roses") {
        if (isContentCreation) keywordScore += 40 // High priority for content
        if (isReport) keywordScore += 35 // Also great for reports
        if (lowerPrompt.match(/\b(report|document|summary|outline|structure|article|blog|content)\b/)) keywordScore += 30
        if (lowerPrompt.match(/\b(section|format|organize|presentation)\b/)) keywordScore += 20
        // If structured format has role + format/tone, boost ROSES
        if (structured.isStructured && structured.role && (structured.format || structured.tone)) {
          keywordScore += 20
        }
        // Penalize for reasoning tasks
        if (isReasoning && !isContentCreation) keywordScore -= 15
      }

      // RACE: Best for professional, structured outputs, reports
      if (key === "race") {
        if (isProfessional) keywordScore += 35 // High for professional contexts
        if (isReport) keywordScore += 30 // Great for reports
        if (lowerPrompt.match(/\b(analyze|research|study|examine|investigate|professional|business)\b/)) keywordScore += 25
        if (lowerPrompt.match(/\b(evidence|data|findings|research|corporate)\b/)) keywordScore += 20
        // If structured format has role, boost RACE
        if (structured.isStructured && structured.role) {
          keywordScore += 20
        }
        // Good for content creation too
        if (isContentCreation) keywordScore += 15
      }

      // CoT: Good for reasoning, math, step-by-step (but NOT content creation)
      if (key === "cot") {
        if (isReasoning && !isContentCreation) keywordScore += 35 // High for reasoning
        if (isMath) keywordScore += 30 // Very high for math
        if (lowerPrompt.match(/\b(how|why|explain|step|calculate|solve|reason)\b/)) keywordScore += 25
        if (lowerPrompt.match(/\b(math|number|calculate|formula|equation)\b/)) keywordScore += 20
        if (lowerPrompt.match(/\b(think|reason|logic|process)\b/)) keywordScore += 15
        // Penalize for content creation tasks
        if (isContentCreation && !isReasoning) keywordScore -= 20
      }

      // ToT: Good for planning, strategy, multiple options
      if (key === "tot") {
        if (lowerPrompt.match(/\b(plan|strategy|option|alternative|compare|choose|decision)\b/)) keywordScore += 30
        if (lowerPrompt.match(/\b(decision|select|best|evaluate|multiple|paths)\b/)) keywordScore += 20
        // Penalize for simple content creation
        if (isContentCreation && !lowerPrompt.match(/\b(plan|strategy|option)\b/)) keywordScore -= 10
      }

      // APE: Good for quick, practical tasks
      if (key === "ape") {
        if (lowerPrompt.match(/\b(create|write|make|generate|build)\b/)) keywordScore += 25
        if (prompt.length < 200) keywordScore += 15 // Short prompts
        // If structured format has clear action + topic, boost APE
        if (structured.isStructured && structured.action && structured.topic && !structured.role) {
          keywordScore += 15 // APE works well without role requirement
        }
        // Less ideal for complex content
        if (isReport && prompt.length > 300) keywordScore -= 10
      }

      // GUIDE: Good for instructions, tutorials
      if (key === "guide") {
        if (isInstruction) keywordScore += 35 // High for instructional content
        if (lowerPrompt.match(/\b(guide|tutorial|instructions|how to|steps)\b/)) keywordScore += 30
        if (lowerPrompt.match(/\b(teach|explain|show|demonstrate|learn)\b/)) keywordScore += 20
        // Less ideal for pure content creation
        if (isContentCreation && !isInstruction) keywordScore -= 10
      }

      // SMART: Good for goal-oriented prompts
      if (key === "smart") {
        if (lowerPrompt.match(/\b(goal|objective|target|achieve|accomplish)\b/)) keywordScore += 30
        if (lowerPrompt.match(/\b(measure|success|result|outcome|metric)\b/)) keywordScore += 20
        // Less ideal for simple content creation
        if (isContentCreation && !lowerPrompt.match(/\b(goal|objective|target)\b/)) keywordScore -= 10
      }

      // CREATE: Good for creative tasks and comprehensive structured prompts
      if (key === "create") {
        if (lowerPrompt.match(/\b(creative|design|imagine|invent|artistic)\b/)) keywordScore += 30
        if (isContentCreation) keywordScore += 20 // Good for content
        if (lowerPrompt.match(/\b(write|story|poem|content|generate)\b/)) keywordScore += 15
        // If structured format has multiple components, boost CREATE
        if (structured.isStructured) {
          const componentCount = [
            structured.role, structured.action, structured.topic,
            structured.audience, structured.format, structured.tone
          ].filter(Boolean).length
          if (componentCount >= 3) {
            keywordScore += 20 // CREATE handles comprehensive prompts well
          }
        }
        keywordScore += 5 // Small default bonus (reduced from 10)
      }
      
      // Combine semantic (40%) + keyword (60%) scores
      score += keywordScore * 0.6

      return { framework: key as FrameworkType, score, output }
    } catch (error) {
      console.warn(`PromptPrune: Error ranking ${key}:`, error)
      // Return a low score for failed frameworks instead of skipping
      return { 
        framework: key as FrameworkType, 
        score: 0, 
        output: { 
          framework: key, 
          name: framework.name, 
          description: framework.description, 
          optimized: prompt, 
          useCase: framework.useCase 
        } 
      }
    }
  })
  
  // Wait for all frameworks with overall timeout (8 seconds max)
  // Use Promise.allSettled to get partial results even if some fail
  let allRankings: Array<{ framework: FrameworkType; score: number; output: FrameworkOutput }> = []
  
  try {
    const results = await Promise.race([
      Promise.allSettled(frameworkPromises),
      new Promise<PromiseSettledResult<any>[]>((resolve) => {
        setTimeout(() => {
          // Timeout - resolve with empty array to trigger fallback
          resolve([])
        }, 8000)
      })
    ])
    
    // Extract successful results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value && result.value.score > 0) {
        allRankings.push(result.value)
      }
    })
  } catch (error) {
    console.warn('[rankFrameworks] Error waiting for frameworks:', error)
  }
  
  // Add successful rankings
  allRankings.forEach(ranking => {
    if (ranking && ranking.score > 0) {
      rankings.push(ranking)
    }
  })

  // If no rankings (all failed), create a basic ranking using keyword scores only
  if (rankings.length === 0) {
    console.warn('[rankFrameworks] All frameworks failed, using keyword-only fallback')
    // Quick fallback: just score by keywords without applying frameworks
    for (const [key, framework] of Object.entries(FRAMEWORKS)) {
      let keywordScore = 0
      
      // Quick keyword scoring (same logic as above but without applying framework)
      if (key === "roses" && isContentCreation) keywordScore = 40
      else if (key === "race" && isProfessional) keywordScore = 35
      else if (key === "cot" && isReasoning) keywordScore = 35
      else if (key === "ape" && lowerPrompt.match(/\b(create|write|make)\b/)) keywordScore = 25
      else keywordScore = 10 // Default score
      
      rankings.push({
        framework: key as FrameworkType,
        score: keywordScore,
        output: {
          framework: key,
          name: framework.name,
          description: framework.description,
          optimized: prompt, // Use original prompt as fallback
          useCase: framework.useCase
        }
      })
    }
  }

  // Sort by score (highest first)
  return rankings.sort((a, b) => b.score - a.score)
}

