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
  processPromptIntelligently
} from "./intelligent-processor"

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
 */
function parsePrompt(prompt: string): ParsedPrompt {
  // Use intelligent processor first
  const processed = processPromptIntelligently(prompt)
  
  // Use the corrected and structured version
  const expanded = processed.structured || processed.corrected
  const cleanedPrompt = processed.corrected
  const lower = cleanedPrompt.toLowerCase()
  
  // Extract role using NLP
  const role = extractRoleNLP(cleanedPrompt) || undefined
  
  // Use intelligent intent extraction
  const intelligentIntent = processed.intent
  const action = intelligentIntent.action
  const topic = intelligentIntent.topic
  
  // Build task from intent
  let task = ''
  if (topic && !topic.toLowerCase().includes('specified topic')) {
    task = `${action} about ${topic}`
  } else {
    // Fallback to NLP extraction
    const intent = extractIntentWithNLP(cleanedPrompt)
    const topicMatch = cleanedPrompt.match(/(?:about|on)\s+([^.,!?\n]+?)(?:\s+for|\s+to|$)/i)
    if (topicMatch && topicMatch[1]) {
      task = `${action} about ${topicMatch[1].trim()}`
    } else {
      task = intent.subject || `${action} about the specified topic`
    }
  }
  
  // Task is already cleaned by intelligent processor, just normalize spacing
  task = cleanText(task)
  
  // Extract context
  const contextMatch = cleanedPrompt.match(/(?:context:|background:|given that|considering)\s+([^.,!?\n]+)/i)
  const context = contextMatch ? contextMatch[1].trim() : undefined
  
  // Extract constraints using NLP
  const nlpConstraints = extractConstraintsNLP(cleanedPrompt)
  const constraints = nlpConstraints.wordCount || nlpConstraints.style || nlpConstraints.format
    ? `Word count: ${nlpConstraints.wordCount || "not specified"}, Style: ${nlpConstraints.style || nlpConstraints.tone || "not specified"}, Format: ${nlpConstraints.format || "not specified"}`
    : undefined
  
  // Extract expected output
  const outputMatch = cleanedPrompt.match(/(?:output:|result:|should be|must be|format:)\s+([^.,!?\n]+)/i)
  const expectedOutput = outputMatch ? outputMatch[1].trim() : undefined
  
  // Extract style using NLP
  const nlpConstraintsForStyle = extractConstraintsNLP(cleanedPrompt)
  const style = nlpConstraintsForStyle.tone || nlpConstraintsForStyle.style || (() => {
    const styleMatch = cleanedPrompt.match(/(?:tone:|style:|tone of|style of)\s+([^.,!?\n]+)/i)
    return styleMatch ? styleMatch[1].trim() : undefined
  })()

  // Extract examples
  const exampleMatch = cleanedPrompt.match(/(?:example:|for example|e\.g\.|such as)\s+([^.,!?\n]+)/i)
  const examples = exampleMatch ? [exampleMatch[1].trim()] : undefined

  return {
    intent: cleanedPrompt, // Use cleaned prompt
    task,
    context,
    constraints,
    expectedOutput,
    role,
    style,
    examples,
  }
}

/**
 * Apply Chain of Thought framework
 */
function applyCoT(parsed: ParsedPrompt): string {
  const parts: string[] = []
  
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
  const cleanTask = parsed.task || parsed.intent.split(/[.!?]/)[0].trim()
  parts.push(`Action: ${cleanTask}`)
  
  // Purpose - make it more specific
  let purpose = parsed.context
  if (!purpose) {
    const taskLower = cleanTask.toLowerCase()
    if (taskLower.includes('content') || taskLower.includes('article')) {
      purpose = "To inform and engage readers with valuable information"
    } else if (taskLower.includes('report') || taskLower.includes('analysis')) {
      purpose = "To provide comprehensive analysis and actionable insights"
    } else if (taskLower.includes('guide') || taskLower.includes('tutorial')) {
      purpose = "To educate and enable readers to accomplish a specific task"
    } else {
      purpose = "To achieve the desired outcome effectively"
    }
  }
  parts.push(`Purpose: ${purpose}`)
  
  // Expectation - make it more specific
  let expectation = parsed.expectedOutput
  if (!expectation) {
    const taskLower = cleanTask.toLowerCase()
    if (taskLower.includes('content') || taskLower.includes('article')) {
      expectation = "A well-structured, engaging piece that meets quality standards"
    } else if (taskLower.includes('report')) {
      expectation = "A comprehensive report with clear findings and recommendations"
    } else {
      expectation = "A clear, complete result that fulfills all requirements"
    }
  }
  parts.push(`Expectation: ${expectation}`)
  
  if (parsed.constraints) {
    parts.push(`\nAdditional Requirements: ${parsed.constraints}`)
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
  parts.push(`Role: You are ${role}`)
  
  // Use the corrected task (already processed by intelligent processor)
  const cleanTask = parsed.task || parsed.intent.split(/[.!?]/)[0].trim()
  parts.push(`Action: ${cleanTask}`)
  
  // Context - make it more specific
  let context = parsed.context
  if (!context) {
    const taskLower = cleanTask.toLowerCase()
    if (taskLower.includes('content') || taskLower.includes('article')) {
      context = "Creating content for a general audience seeking information"
    } else if (taskLower.includes('report')) {
      context = "Professional business context requiring structured analysis"
    } else {
      context = "Standard professional context"
    }
  }
  parts.push(`Context: ${context}`)
  
  // Expectation - make it more specific
  let expectation = parsed.expectedOutput
  if (!expectation) {
    const taskLower = cleanTask.toLowerCase()
    if (taskLower.includes('content') || taskLower.includes('article')) {
      expectation = "High-quality, well-structured content that engages and informs"
    } else if (taskLower.includes('report')) {
      expectation = "Comprehensive report with clear structure, data analysis, and recommendations"
    } else {
      expectation = "High-quality, professional output that meets all requirements"
    }
  }
  parts.push(`Expectation: ${expectation}`)
  
  if (parsed.constraints) {
    parts.push(`\nConstraints: ${parsed.constraints}`)
  }
  
  return parts.join("\n")
}

/**
 * Apply ROSES framework
 */
function applyROSES(parsed: ParsedPrompt): string {
  const parts: string[] = []
  
  // Role
  const role = parsed.role || "Content Creator"
  parts.push(`Role: You are ${role}`)
  
  // Objective - use the corrected task
  const objective = parsed.task || parsed.intent.split(/[.!?]/)[0]
  parts.push(`Objective: ${objective}`)
  
  // Style
  const style = parsed.style || "Professional and engaging"
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
 */
export function applyFramework(
  prompt: string,
  framework: FrameworkType
): FrameworkOutput {
  const parsed = parsePrompt(prompt)
  let optimized = ""
  
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
      optimized = prompt
  }
  
  return {
    framework,
    name: FRAMEWORKS[framework].name,
    description: FRAMEWORKS[framework].description,
    optimized,
    useCase: FRAMEWORKS[framework].useCase,
  }
}

/**
 * Get all framework outputs for a prompt
 */
export function getAllFrameworkOutputs(prompt: string): FrameworkOutput[] {
  return Object.keys(FRAMEWORKS).map((key) =>
    applyFramework(prompt, key as FrameworkType)
  )
}

/**
 * Rank frameworks by how well they fit a prompt
 * Returns frameworks sorted by relevance score (highest first)
 */
export function rankFrameworks(prompt: string): Array<{ framework: FrameworkType; score: number; output: FrameworkOutput }> {
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

  for (const [key, framework] of Object.entries(FRAMEWORKS)) {
    try {
      const output = applyFramework(prompt, key as FrameworkType)
      let score = 0

      // ROSES: Best for content creation, articles, reports, structured content
      if (key === "roses") {
        if (isContentCreation) score += 40 // High priority for content
        if (isReport) score += 35 // Also great for reports
        if (lowerPrompt.match(/\b(report|document|summary|outline|structure|article|blog|content)\b/)) score += 30
        if (lowerPrompt.match(/\b(section|format|organize|presentation)\b/)) score += 20
        // Penalize for reasoning tasks
        if (isReasoning && !isContentCreation) score -= 15
      }

      // RACE: Best for professional, structured outputs, reports
      if (key === "race") {
        if (isProfessional) score += 35 // High for professional contexts
        if (isReport) score += 30 // Great for reports
        if (lowerPrompt.match(/\b(analyze|research|study|examine|investigate|professional|business)\b/)) score += 25
        if (lowerPrompt.match(/\b(evidence|data|findings|research|corporate)\b/)) score += 20
        // Good for content creation too
        if (isContentCreation) score += 15
      }

      // CoT: Good for reasoning, math, step-by-step (but NOT content creation)
      if (key === "cot") {
        if (isReasoning && !isContentCreation) score += 35 // High for reasoning
        if (isMath) score += 30 // Very high for math
        if (lowerPrompt.match(/\b(how|why|explain|step|calculate|solve|reason)\b/)) score += 25
        if (lowerPrompt.match(/\b(math|number|calculate|formula|equation)\b/)) score += 20
        if (lowerPrompt.match(/\b(think|reason|logic|process)\b/)) score += 15
        // Penalize for content creation tasks
        if (isContentCreation && !isReasoning) score -= 20
      }

      // ToT: Good for planning, strategy, multiple options
      if (key === "tot") {
        if (lowerPrompt.match(/\b(plan|strategy|option|alternative|compare|choose|decision)\b/)) score += 30
        if (lowerPrompt.match(/\b(decision|select|best|evaluate|multiple|paths)\b/)) score += 20
        // Penalize for simple content creation
        if (isContentCreation && !lowerPrompt.match(/\b(plan|strategy|option)\b/)) score -= 10
      }

      // APE: Good for quick, practical tasks
      if (key === "ape") {
        if (lowerPrompt.match(/\b(create|write|make|generate|build)\b/)) score += 25
        if (prompt.length < 200) score += 15 // Short prompts
        // Less ideal for complex content
        if (isReport && prompt.length > 300) score -= 10
      }

      // GUIDE: Good for instructions, tutorials
      if (key === "guide") {
        if (isInstruction) score += 35 // High for instructional content
        if (lowerPrompt.match(/\b(guide|tutorial|instructions|how to|steps)\b/)) score += 30
        if (lowerPrompt.match(/\b(teach|explain|show|demonstrate|learn)\b/)) score += 20
        // Less ideal for pure content creation
        if (isContentCreation && !isInstruction) score -= 10
      }

      // SMART: Good for goal-oriented prompts
      if (key === "smart") {
        if (lowerPrompt.match(/\b(goal|objective|target|achieve|accomplish)\b/)) score += 30
        if (lowerPrompt.match(/\b(measure|success|result|outcome|metric)\b/)) score += 20
        // Less ideal for simple content creation
        if (isContentCreation && !lowerPrompt.match(/\b(goal|objective|target)\b/)) score -= 10
      }

      // CREATE: Good for creative tasks (default gets small bonus)
      if (key === "create") {
        if (lowerPrompt.match(/\b(creative|design|imagine|invent|artistic)\b/)) score += 30
        if (isContentCreation) score += 20 // Good for content
        if (lowerPrompt.match(/\b(write|story|poem|content|generate)\b/)) score += 15
        score += 5 // Small default bonus (reduced from 10)
      }

      rankings.push({ framework: key as FrameworkType, score, output })
    } catch (error) {
      console.error(`PromptPrune: Error ranking ${key}:`, error)
    }
  }

  // Sort by score (highest first)
  return rankings.sort((a, b) => b.score - a.score)
}

