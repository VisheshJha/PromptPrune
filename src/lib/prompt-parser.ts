/**
 * Advanced Prompt Parser
 * Handles structured prompts (Role:, Action:, Topic:) and converts them intelligently
 */

export interface StructuredPrompt {
  role?: string
  action?: string
  topic?: string
  audience?: string
  format?: string
  tone?: string
  length?: string
  constraints?: string
  context?: string
  isStructured: boolean
}

/**
 * Parse a prompt that might be in structured format (Role:, Action:, Topic:)
 */
export function parseStructuredPrompt(prompt: string): StructuredPrompt {
  const result: StructuredPrompt = {
    isStructured: false
  }
  
  // Check if prompt is in structured format (has "Field:" pattern)
  const structuredPattern = /^(\w+):\s*(.+?)(?:\n|$)/gm
  const matches = Array.from(prompt.matchAll(structuredPattern))
  
  if (matches.length >= 2) {
    // Likely structured format
    result.isStructured = true
    
    matches.forEach(match => {
      const field = match[1].toLowerCase().trim()
      const value = match[2].trim()
      
      switch (field) {
        case "role":
          result.role = value
          break
        case "action":
        case "task":
          result.action = value
          break
        case "topic":
          result.topic = value
          break
        case "audience":
          result.audience = value
          break
        case "format":
          result.format = value
          break
        case "tone":
          result.tone = value
          break
        case "length":
          result.length = value
          break
        case "constraints":
        case "constraint":
          result.constraints = value
          break
        case "context":
          result.context = value
          break
      }
    })
  }
  
  return result
}

/**
 * Convert structured prompt to natural language for framework processing
 */
export function convertStructuredToNatural(structured: StructuredPrompt): string {
  if (!structured.isStructured) {
    return "" // Not structured, return empty to use original
  }
  
  let natural = ""
  
  // Build natural prompt from structured components
  if (structured.role) {
    natural += `You are ${structured.role}. `
  }
  
  if (structured.action && structured.topic) {
    natural += `${structured.action} ${structured.topic}`
  } else if (structured.action) {
    natural += structured.action
  } else if (structured.topic) {
    natural += `Write about ${structured.topic}`
  }
  
  if (structured.audience) {
    natural += ` for ${structured.audience}`
  }
  
  if (structured.format) {
    natural += ` in the format of ${structured.format}`
  }
  
  if (structured.tone) {
    natural += `. Use a ${structured.tone} tone`
  }
  
  if (structured.length) {
    natural += `. Keep it ${structured.length}`
  }
  
  if (structured.constraints) {
    natural += `. ${structured.constraints}`
  }
  
  if (structured.context) {
    natural += `. Context: ${structured.context}`
  }
  
  return natural.trim()
}

/**
 * Detect framework fit based on structured components
 */
export function detectFrameworkFromStructure(structured: StructuredPrompt): {
  preferredFrameworks: string[]
  reasoning: string
} {
  const preferred: string[] = []
  let reasoning = ""
  
  // If role is present, frameworks that use role score higher
  if (structured.role) {
    preferred.push("race", "roses", "create")
    reasoning += "Role specified → RACE, ROSES, CREATE prioritize role"
  }
  
  // If action is clear and specific
  if (structured.action && structured.action !== "write" && structured.action !== "[your topic here]") {
    preferred.push("ape", "race")
    reasoning += " | Clear action → APE, RACE"
  }
  
  // If topic is specific (not placeholder)
  if (structured.topic && !structured.topic.includes("[") && !structured.topic.includes("your topic")) {
    // Content creation indicators
    if (structured.format || structured.tone) {
      preferred.push("roses", "create")
      reasoning += " | Format/tone specified → ROSES, CREATE"
    } else {
      preferred.push("ape", "race")
      reasoning += " | Specific topic → APE, RACE"
    }
  }
  
  // If multiple components are filled, prefer comprehensive frameworks
  const filledCount = [
    structured.role,
    structured.action,
    structured.topic,
    structured.audience,
    structured.format,
    structured.tone
  ].filter(Boolean).length
  
  if (filledCount >= 4) {
    preferred.push("create", "roses")
    reasoning += " | Multiple components → CREATE, ROSES"
  }
  
  return {
    preferredFrameworks: [...new Set(preferred)], // Remove duplicates
    reasoning: reasoning.trim()
  }
}

