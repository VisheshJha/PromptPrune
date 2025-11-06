/**
 * Prompt Engineering Frameworks
 * Transform prompts using different structured approaches
 */

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
} as const

export type FrameworkType = keyof typeof FRAMEWORKS

/**
 * Parse a prompt to extract key components
 */
function parsePrompt(prompt: string): ParsedPrompt {
  const lower = prompt.toLowerCase()
  
  // Extract role
  const roleMatch = prompt.match(/(?:act as|you are|role:|as a)\s+([^.,!?\n]+)/i)
  const role = roleMatch ? roleMatch[1].trim() : undefined
  
  // Extract task/action
  const actionWords = ["write", "create", "generate", "build", "make", "design", "analyze", "explain", "summarize"]
  const action = actionWords.find(word => lower.includes(word))
  const taskMatch = prompt.match(new RegExp(`(${actionWords.join("|")})\\s+([^.,!?\n]+)`, "i"))
  const task = taskMatch ? taskMatch[2].trim() : prompt.split(/[.!?]/)[0].trim()
  
  // Extract context
  const contextMatch = prompt.match(/(?:context:|background:|given that|considering)\s+([^.,!?\n]+)/i)
  const context = contextMatch ? contextMatch[1].trim() : undefined
  
  // Extract constraints
  const constraintWords = ["limit", "must", "should", "require", "constraint", "rule"]
  const hasConstraints = constraintWords.some(word => lower.includes(word))
  const constraints = hasConstraints ? prompt.split(/[.!?]/).filter(s => 
    constraintWords.some(word => s.toLowerCase().includes(word))
  ).join(". ") : undefined
  
  // Extract expected output
  const outputMatch = prompt.match(/(?:output:|result:|should be|must be|format:)\s+([^.,!?\n]+)/i)
  const expectedOutput = outputMatch ? outputMatch[1].trim() : undefined
  
  // Extract style
  const styleMatch = prompt.match(/(?:tone:|style:|tone of|style of)\s+([^.,!?\n]+)/i)
  const style = styleMatch ? styleMatch[1].trim() : undefined
  
  // Extract examples
  const exampleMatch = prompt.match(/(?:example:|for example|e\.g\.|such as)\s+([^.,!?\n]+)/i)
  const examples = exampleMatch ? [exampleMatch[1].trim()] : undefined
  
  return {
    intent: prompt,
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
  
  parts.push(`Task: ${parsed.task || parsed.intent}`)
  
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
  
  parts.push(`Problem: ${parsed.task || parsed.intent}`)
  
  if (parsed.context) {
    parts.push(`Context: ${parsed.context}`)
  }
  
  parts.push("\nExplore multiple approaches:")
  parts.push("Approach 1: [First potential solution path]")
  parts.push("Approach 2: [Alternative solution path]")
  parts.push("Approach 3: [Another creative approach]")
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
  
  // Action
  const action = parsed.task || parsed.intent.split(/[.!?]/)[0]
  parts.push(`Action: ${action}`)
  
  // Purpose
  const purpose = parsed.context || "To achieve the desired outcome"
  parts.push(`Purpose: ${purpose}`)
  
  // Expectation
  const expectation = parsed.expectedOutput || "A clear, complete result"
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
  
  // Role
  const role = parsed.role || "Expert"
  parts.push(`Role: You are ${role}`)
  
  // Action
  const action = parsed.task || parsed.intent.split(/[.!?]/)[0]
  parts.push(`Action: ${action}`)
  
  // Context
  const context = parsed.context || "Standard professional context"
  parts.push(`Context: ${context}`)
  
  // Expectation
  const expectation = parsed.expectedOutput || "High-quality, professional output"
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
  
  // Objective
  const objective = parsed.task || parsed.intent.split(/[.!?]/)[0]
  parts.push(`Objective: ${objective}`)
  
  // Style
  const style = parsed.style || "Professional and engaging"
  parts.push(`Style: ${style}`)
  
  // Example
  if (parsed.examples && parsed.examples.length > 0) {
    parts.push(`Example: ${parsed.examples[0]}`)
  } else {
    parts.push(`Example: [Provide a sample of the desired output]`)
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
  
  // Goal
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
  
  // Examples
  if (parsed.examples && parsed.examples.length > 0) {
    parts.push(`\nExamples:`)
    parsed.examples.forEach((ex, i) => {
      parts.push(`${i + 1}. ${ex}`)
    })
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

