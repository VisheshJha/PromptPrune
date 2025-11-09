/**
 * Interactive Prompt Guidance System
 * Helps users create better prompts with all required components
 */

export interface PromptComponent {
  id: string
  label: string
  question: string
  placeholder: string
  required: boolean
  category: "basic" | "advanced"
  examples?: string[]
}

export const PROMPT_COMPONENTS: PromptComponent[] = [
  {
    id: "role",
    label: "Role",
    question: "What role should the AI take? (e.g., expert, teacher, assistant)",
    placeholder: "e.g., You are an expert in...",
    required: true,
    category: "basic",
    examples: ["expert researcher", "professional writer", "technical consultant", "creative designer"]
  },
  {
    id: "action",
    label: "Action",
    question: "What do you want the AI to do?",
    placeholder: "e.g., write, create, analyze, explain...",
    required: true,
    category: "basic",
    examples: ["write an article", "create a summary", "analyze data", "explain concepts"]
  },
  {
    id: "topic",
    label: "Topic/Subject",
    question: "What is the main topic or subject?",
    placeholder: "e.g., artificial intelligence, climate change...",
    required: true,
    category: "basic",
    examples: ["artificial intelligence", "climate change", "web development", "marketing strategies"]
  },
  {
    id: "audience",
    label: "Audience",
    question: "Who is the target audience?",
    placeholder: "e.g., general readers, professionals, beginners...",
    required: false,
    category: "basic",
    examples: ["general readers", "technical professionals", "beginners", "students"]
  },
  {
    id: "format",
    label: "Format",
    question: "What format should the output be?",
    placeholder: "e.g., article, report, list, code...",
    required: false,
    category: "basic",
    examples: ["article", "report", "bullet points", "code snippet", "table"]
  },
  {
    id: "tone",
    label: "Tone",
    question: "What tone should be used?",
    placeholder: "e.g., professional, casual, friendly...",
    required: false,
    category: "basic",
    examples: ["professional", "casual", "friendly", "technical", "persuasive"]
  },
  {
    id: "length",
    label: "Length",
    question: "How long should it be?",
    placeholder: "e.g., 500 words, short, detailed...",
    required: false,
    category: "advanced",
    examples: ["500 words", "short", "detailed", "comprehensive", "concise"]
  },
  {
    id: "constraints",
    label: "Constraints",
    question: "Any specific requirements or constraints?",
    placeholder: "e.g., include examples, use headings, cite sources...",
    required: false,
    category: "advanced",
    examples: ["include examples", "use headings", "cite sources", "avoid jargon"]
  },
  {
    id: "context",
    label: "Context",
    question: "Any additional context or background?",
    placeholder: "e.g., for a blog post, for a presentation...",
    required: false,
    category: "advanced",
    examples: ["for a blog post", "for a presentation", "for internal use"]
  }
]

export interface PromptAnalysis {
  hasRole: boolean
  hasAction: boolean
  hasTopic: boolean
  hasAudience: boolean
  hasFormat: boolean
  hasTone: boolean
  hasLength: boolean
  hasConstraints: boolean
  hasContext: boolean
  missingComponents: string[]
  score: number // 0-100
  suggestions: string[]
}

/**
 * Analyze a prompt to see what components are present
 */
export function analyzePromptComponents(prompt: string, isFollowUp: boolean = false): PromptAnalysis {
  const lowerPrompt = prompt.toLowerCase()
  
  // Check for role (skip for follow-ups)
  const hasRole = isFollowUp ? true : /(you are|act as|role|as a|as an|as the)/i.test(prompt)
  
  // Check for action
  const hasAction = /(write|create|make|generate|tell|explain|describe|analyze|discuss|build|design|develop)/i.test(prompt)
  
  // Check for topic (look for nouns, proper nouns, or "about" phrases)
  const hasTopic = /(about|on|regarding|concerning|topic|subject|theme)/i.test(prompt) || 
                   /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/.test(prompt) // Proper nouns
  
  // Check for audience
  const hasAudience = /(for|to|target|audience|readers|users|professionals|beginners|students)/i.test(prompt)
  
  // Check for format
  const hasFormat = /(article|report|blog|post|summary|list|table|code|essay|letter|email)/i.test(prompt)
  
  // Check for tone
  const hasTone = /(professional|casual|friendly|formal|informal|technical|simple|engaging|persuasive)/i.test(prompt)
  
  // Check for length
  const hasLength = /(\d+\s*(words?|pages?|characters?)|short|long|brief|detailed|comprehensive|concise)/i.test(prompt)
  
  // Check for constraints
  const hasConstraints = /(include|must|should|require|constraint|limit|avoid|don't|do not)/i.test(prompt)
  
  // Check for context
  const hasContext = /(for|context|background|situation|scenario|purpose)/i.test(prompt)
  
  const components = {
    hasRole,
    hasAction,
    hasTopic,
    hasAudience,
    hasFormat,
    hasTone,
    hasLength,
    hasConstraints,
    hasContext
  }
  
  // Calculate missing components (required ones)
  const missingComponents: string[] = []
  if (!hasRole && !isFollowUp) missingComponents.push("role")
  if (!hasAction) missingComponents.push("action")
  if (!hasTopic) missingComponents.push("topic")
  
  // Calculate score (0-100)
  const requiredCount = isFollowUp ? 2 : 3 // action + topic (role optional for follow-ups)
  const optionalCount = 6 // audience, format, tone, length, constraints, context
  const requiredScore = (isFollowUp ? (hasAction ? 1 : 0) + (hasTopic ? 1 : 0) : 
                        (hasRole ? 1 : 0) + (hasAction ? 1 : 0) + (hasTopic ? 1 : 0)) / requiredCount * 50
  const optionalScore = [
    hasAudience, hasFormat, hasTone, hasLength, hasConstraints, hasContext
  ].filter(Boolean).length / optionalCount * 50
  const score = Math.round(requiredScore + optionalScore)
  
  // Generate suggestions
  const suggestions: string[] = []
  if (!hasRole && !isFollowUp) {
    suggestions.push("Add a role: 'You are an expert in...' or 'Act as a...'")
  }
  if (!hasAction) {
    suggestions.push("Specify the action: 'write', 'create', 'analyze', etc.")
  }
  if (!hasTopic) {
    suggestions.push("Clarify the topic: 'about...' or 'on the subject of...'")
  }
  if (!hasAudience) {
    suggestions.push("Define your audience: 'for general readers', 'for professionals', etc.")
  }
  if (!hasFormat) {
    suggestions.push("Specify the format: 'article', 'report', 'list', etc.")
  }
  if (!hasTone) {
    suggestions.push("Set the tone: 'professional', 'casual', 'friendly', etc.")
  }
  if (score < 70) {
    suggestions.push("Consider adding more details for better results")
  }
  
  return {
    ...components,
    missingComponents,
    score,
    suggestions
  }
}

/**
 * Build a complete prompt from components
 */
export function buildPromptFromComponents(components: Record<string, string>): string {
  let prompt = ""
  
  // Role (if provided and not empty)
  if (components.role && components.role.trim()) {
    prompt += `You are ${components.role.trim()}. `
  }
  
  // Action + Topic
  if (components.action && components.topic) {
    prompt += `${components.action.trim()} ${components.topic.trim()}`
  } else if (components.action) {
    prompt += components.action.trim()
  } else if (components.topic) {
    prompt += `Write about ${components.topic.trim()}`
  }
  
  // Audience
  if (components.audience && components.audience.trim()) {
    prompt += ` for ${components.audience.trim()}`
  }
  
  // Format
  if (components.format && components.format.trim()) {
    prompt += ` in the format of ${components.format.trim()}`
  }
  
  // Tone
  if (components.tone && components.tone.trim()) {
    prompt += `. Use a ${components.tone.trim()} tone`
  }
  
  // Length
  if (components.length && components.length.trim()) {
    prompt += `. Keep it ${components.length.trim()}`
  }
  
  // Constraints
  if (components.constraints && components.constraints.trim()) {
    prompt += `. ${components.constraints.trim()}`
  }
  
  // Context
  if (components.context && components.context.trim()) {
    prompt += `. Context: ${components.context.trim()}`
  }
  
  return prompt.trim()
}

/**
 * Check if this is a follow-up message (not the first message in a conversation)
 * Improved to avoid false positives from UI elements (navigation, profile, etc.)
 */
export function isFollowUpMessage(textArea: HTMLElement): boolean {
  // Look for actual conversation messages with substantial content
  // Skip UI elements like navigation, profile info, buttons, etc.
  
  // First, try to find the conversation container closest to the textarea
  const conversationContainer = textArea.closest('[class*="conversation"], [class*="chat"], [class*="message-container"], [class*="chat-container"]')
  
  if (conversationContainer) {
    // Look for actual message elements within this container
    const messageSelectors = [
      '[class*="user-message"]',
      '[class*="assistant-message"]',
      '[class*="chat-message"]',
      '[data-role="user"]',
      '[data-role="assistant"]',
      '[data-message-type]',
    ]
    
    let actualMessageCount = 0
    for (const selector of messageSelectors) {
      const messages = conversationContainer.querySelectorAll(selector)
      for (const msg of Array.from(messages)) {
        // Skip if it's the textarea or input element itself
        if (msg === textArea || msg.contains(textArea) || 
            msg instanceof HTMLTextAreaElement || 
            msg instanceof HTMLInputElement || 
            (msg instanceof HTMLDivElement && msg.isContentEditable)) {
          continue
        }
        
        // Skip UI elements (buttons, navigation, etc.)
        if (msg.tagName === 'BUTTON' || 
            msg.tagName === 'NAV' || 
            msg.closest('nav') ||
            msg.closest('[role="navigation"]') ||
            msg.closest('[role="banner"]') ||
            msg.closest('[role="toolbar"]')) {
          continue
        }
        
        const text = msg.textContent?.trim() || ""
        // Only count as message if it has substantial content (at least 15 chars)
        // and doesn't look like UI text (short labels, buttons, etc.)
        // Reduced threshold to 15 to catch more real messages
        if (text.length >= 15 && 
            !text.match(/^(home|settings|profile|menu|search|sign|log|help|about|new chat|new conversation)$/i) &&
            !msg.querySelector('button, a[href*="settings"], a[href*="profile"]') &&
            // Make sure it's not just a placeholder or empty message
            !text.match(/^(type|enter|ask|message|prompt|input)/i)) {
          actualMessageCount++
        }
      }
    }
    
    // If we found actual messages, it's a follow-up
    if (actualMessageCount > 0) {
      return true
    }
  }
  
  // Fallback: Check for conversation history in the page (more strict)
  const conversationElements = document.querySelectorAll('[class*="conversation"], [class*="chat-history"], [class*="messages"]')
  for (const container of Array.from(conversationElements)) {
    // Skip navigation and header elements
    if (container.closest('nav') || 
        container.closest('[role="navigation"]') ||
        container.closest('[role="banner"]')) {
      continue
    }
    
    // Look for actual message content
    const messages = container.querySelectorAll('[class*="user-message"], [class*="assistant-message"], [data-role="user"], [data-role="assistant"]')
    let hasRealMessages = false
    
    for (const msg of Array.from(messages)) {
      // Skip UI elements
      if (msg.tagName === 'BUTTON' || 
          msg.closest('nav') ||
          msg.closest('[role="navigation"]')) {
        continue
      }
      
      const text = msg.textContent?.trim() || ""
      // Only count as real message if substantial content (reduced to 15)
      if (text.length >= 15 && 
          !text.match(/^(home|settings|profile|menu|search|sign|log|help|about|new chat|new conversation)$/i) &&
          !text.match(/^(type|enter|ask|message|prompt|input)/i)) {
        hasRealMessages = true
        break
      }
    }
    
    if (hasRealMessages) {
      return true
    }
  }
  
  return false
}

