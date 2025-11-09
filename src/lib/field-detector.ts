/**
 * Field Detection for Smart Field Addition
 * Detects which prompt fields are already present in the text
 */

export interface PromptFields {
  role?: string
  task?: string
  topic?: string
  format?: string
  tone?: string
  context?: string
  hasRole: boolean
  hasTask: boolean
  hasTopic: boolean
  hasFormat: boolean
  hasTone: boolean
  hasContext: boolean
}

/**
 * Detect which fields are present in the prompt text
 */
export function detectFields(text: string): PromptFields {
  const lower = text.toLowerCase()
  const result: PromptFields = {
    hasRole: false,
    hasTask: false,
    hasTopic: false,
    hasFormat: false,
    hasTone: false,
    hasContext: false,
  }
  
  // Check for Role
  const rolePatterns = [
    /role:\s*(.+?)(?:\n|$)/i,
    /(?:you are|act as|role|as a|as an|as the)\s+(?:an |a )?([^.,!?\n]+?)(?:\s+who|\s+that|\s+in|$)/i,
  ]
  for (const pattern of rolePatterns) {
    const match = text.match(pattern)
    if (match && match[1] && match[1].trim().length > 2) {
      result.hasRole = true
      result.role = match[1].trim()
      break
    }
  }
  
  // Check for Task/Action (both "Task:" and "Action:" formats)
  const taskPatterns = [
    /(?:task|action):\s*(.+?)(?:\n|$)/i,
    /\b(write|create|make|generate|tell|explain|describe|analyze|discuss|build|design|develop|summarize|list|outline|debug|brainstorm|continue|expand|elaborate)\b/i,
  ]
  for (const pattern of taskPatterns) {
    const match = text.match(pattern)
    if (match) {
      result.hasTask = true
      if (match[1]) {
        result.task = match[1].trim()
      }
      break
    }
  }
  
  // Check for Topic
  const topicPatterns = [
    /topic:\s*(.+?)(?:\n|$)/i,
    /(?:about|on|regarding|concerning|topic|subject|theme)\s+(?:the\s+)?([^.,!?\n]+?)(?:\s+for|\s+to|\s+in|\s+with|$)/i,
  ]
  for (const pattern of topicPatterns) {
    const match = text.match(pattern)
    if (match && match[1] && match[1].trim().length > 2) {
      result.hasTopic = true
      result.topic = match[1].trim()
      break
    }
  }
  
  // Check for Format
  const formatPatterns = [
    /format:\s*(.+?)(?:\n|$)/i,
    /\b(article|report|blog|post|summary|list|table|code|essay|letter|email|outline|guide|bullet points?|paragraphs?)\b/i,
  ]
  for (const pattern of formatPatterns) {
    const match = text.match(pattern)
    if (match) {
      result.hasFormat = true
      if (match[1]) {
        result.format = match[1].trim()
      }
      break
    }
  }
  
  // Check for Tone
  const tonePatterns = [
    /tone:\s*(.+?)(?:\n|$)/i,
    /\b(professional|casual|friendly|formal|informal|technical|simple|engaging|persuasive|academic|conversational)\b/i,
  ]
  for (const pattern of tonePatterns) {
    const match = text.match(pattern)
    if (match) {
      result.hasTone = true
      if (match[1]) {
        result.tone = match[1].trim()
      }
      break
    }
  }
  
  // Check for Context
  const contextPatterns = [
    /context:\s*(.+?)(?:\n|$)/i,
    /(?:context|background|situation):\s*([^.,!?\n]+)/i,
  ]
  for (const pattern of contextPatterns) {
    const match = text.match(pattern)
    if (match && match[1] && match[1].trim().length > 2) {
      result.hasContext = true
      result.context = match[1].trim()
      break
    }
  }
  
  // Also check for Task (in addition to Action)
  if (!result.hasTask) {
    const taskPatterns = [
      /task:\s*(.+?)(?:\n|$)/i,
    ]
    for (const pattern of taskPatterns) {
      const match = text.match(pattern)
      if (match && match[1] && match[1].trim().length > 1) {
        result.hasTask = true
        result.task = match[1].trim()
        break
      }
    }
  }
  
  return result
}

/**
 * Get missing fields that should be added
 */
export function getMissingFields(fields: PromptFields, isFollowUp: boolean): Array<{ key: string; label: string; placeholder: string }> {
  const missing: Array<{ key: string; label: string; placeholder: string }> = []
  
  // Role is only required for first prompt
  if (!isFollowUp && !fields.hasRole) {
    missing.push({
      key: "role",
      label: "Role",
      placeholder: "expert type - e.g., marketing writer, python developer"
    })
  }
  
  // Task is always required (for both first and follow-up)
  if (!fields.hasTask) {
    missing.push({
      key: "task",
      label: "Task",
      placeholder: "specific action - write, debug, summarize, brainstorm"
    })
  }
  
  if (!fields.hasTopic) {
    missing.push({
      key: "topic",
      label: "Topic",
      placeholder: "main subject"
    })
  }
  
  if (!fields.hasFormat) {
    missing.push({
      key: "format",
      label: "Format",
      placeholder: "desired output format - blog post, code, bullet points"
    })
  }
  
  if (!fields.hasTone) {
    missing.push({
      key: "tone",
      label: "Tone",
      placeholder: "professional, casual, technical"
    })
  }
  
  // Context is optional but useful
  if (!fields.hasContext) {
    missing.push({
      key: "context",
      label: "Context",
      placeholder: "background information"
    })
  }
  
  return missing
}

/**
 * Generate field addition text for a single field
 */
export function generateSingleField(field: { key: string; label: string; placeholder: string }): string {
  return `${field.label}: [${field.placeholder}]`
}

/**
 * Generate field addition text for missing fields
 */
export function generateFieldAddition(missingFields: Array<{ key: string; label: string; placeholder: string }>): string {
  if (missingFields.length === 0) {
    return ""
  }
  
  const lines: string[] = []
  missingFields.forEach(field => {
    lines.push(`${field.label}: [${field.placeholder}]`)
  })
  
  return lines.join("\n")
}

/**
 * Insert fields into existing text intelligently
 */
export function insertFieldsIntoText(text: string, missingFields: Array<{ key: string; label: string; placeholder: string }>): string {
  if (missingFields.length === 0) {
    return text
  }
  
  const trimmed = text.trim()
  if (!trimmed) {
    // If text is empty, just return the fields
    return generateFieldAddition(missingFields)
  }
  
  // Check if text is already in structured format (has "Field:" pattern)
  const hasStructuredFormat = /^\w+:\s*.+$/m.test(trimmed)
  
  if (hasStructuredFormat) {
    // Append to existing structured format
    const existingLines = trimmed.split("\n").filter(l => l.trim())
    const fieldLines = missingFields.map(f => generateSingleField(f)).filter(l => l.trim())
    
    // Merge intelligently - don't duplicate if field already exists
    const existingFields = new Set<string>()
    existingLines.forEach(line => {
      const match = line.match(/^(\w+):/i)
      if (match) {
        existingFields.add(match[1].toLowerCase())
      }
    })
    
    // Only add fields that don't already exist
    const newFields = fieldLines.filter(line => {
      const match = line.match(/^(\w+):/i)
      if (match) {
        return !existingFields.has(match[1].toLowerCase())
      }
      return true
    })
    
    if (newFields.length > 0) {
      // Insert new fields in a logical order
      const orderedFields: string[] = []
      const fieldOrder = ["role", "task", "topic", "format", "tone", "context"]
      
      fieldOrder.forEach(fieldKey => {
        const field = newFields.find(f => {
          const match = f.match(/^(\w+):/i)
          return match && match[1].toLowerCase() === fieldKey
        })
        if (field) {
          orderedFields.push(field)
        }
      })
      
      // Add any remaining fields
      newFields.forEach(f => {
        if (!orderedFields.includes(f)) {
          orderedFields.push(f)
        }
      })
      
      return [...existingLines, ...orderedFields].join("\n")
    }
    return trimmed
  } else {
    // Convert to structured format and add fields
    const fieldLines = generateFieldAddition(missingFields)
    return `${trimmed}\n\n${fieldLines}`
  }
}

/**
 * Remove a specific field from the prompt text
 */
export function removeField(text: string, fieldKey: string): string {
  const trimmed = text.trim()
  if (!trimmed) {
    return text
  }
  
  // Check if text is in structured format
  const hasStructuredFormat = /^\w+:\s*.+$/m.test(trimmed)
  
  if (hasStructuredFormat) {
    const lines = trimmed.split("\n").filter(l => l.trim())
    const fieldLabel = fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1)
    
    // Remove lines that match the field
    const filtered = lines.filter(line => {
      const match = line.match(/^(\w+):/i)
      if (match && match[1].toLowerCase() === fieldKey.toLowerCase()) {
        return false
      }
      return true
    })
    
    return filtered.join("\n")
  }
  
  // For natural language, try to remove field patterns
  const fieldLabel = fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1)
  const patterns = [
    new RegExp(`^${fieldLabel}:\\s*.+$`, "gmi"),
    new RegExp(`${fieldLabel}:\\s*[^\\n]+`, "gi"),
  ]
  
  let result = text
  patterns.forEach(pattern => {
    result = result.replace(pattern, "").trim()
  })
  
  return result
}

