/**
 * Context Detection for Follow-up Prompts
 * Extracts context from previous conversation messages
 */

import { extractIntent } from "./intelligent-processor"

export interface ConversationContext {
  previousTopic?: string
  previousAction?: string
  previousRole?: string
  conversationTheme?: string
  suggestedAction?: string
}

/**
 * Extract context from previous messages in the conversation
 */
export function extractConversationContext(): ConversationContext {
  const context: ConversationContext = {}
  
  // Find all message elements (excluding the current input)
  const messageSelectors = [
    '[class*="message"]',
    '[class*="Message"]',
    '[class*="user-message"]',
    '[class*="assistant-message"]',
    '[class*="chat-message"]',
    '[data-message]',
    '[data-role="user"]',
    '[data-role="assistant"]',
  ]
  
  const messages: Array<{ text: string; isUser: boolean }> = []
  
  for (const selector of messageSelectors) {
    const elements = document.querySelectorAll(selector)
    for (const el of Array.from(elements)) {
      // Skip if it's the textarea or input element itself
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement || 
          (el instanceof HTMLDivElement && el.isContentEditable)) {
        continue
      }
      
      const text = el.textContent?.trim() || ""
      if (text.length > 10) {
        // Try to determine if it's a user or assistant message
        const isUser = el.getAttribute("data-role") === "user" ||
                      el.className.toLowerCase().includes("user") ||
                      !el.className.toLowerCase().includes("assistant")
        
        messages.push({ text, isUser })
      }
    }
  }
  
  // Get the most recent user message (last user message before assistant responses)
  const userMessages = messages.filter(m => m.isUser)
  const lastUserMessage = userMessages[userMessages.length - 1]
  
  if (lastUserMessage && lastUserMessage.text) {
    // Extract intent from the last user message
    try {
      const intent = extractIntent(lastUserMessage.text)
      
      if (intent.topic && !intent.topic.toLowerCase().includes('specified topic')) {
        context.previousTopic = intent.topic
      }
      
      if (intent.action && intent.action !== "write") {
        context.previousAction = intent.action
      }
      
      // Try to extract role from the first message
      if (userMessages.length > 0) {
        const firstMessage = userMessages[0].text
        const roleMatch = firstMessage.match(/(?:you are|act as|role|as a|as an|as the)\s+([^.,!?\n]+)/i)
        if (roleMatch) {
          context.previousRole = roleMatch[1].trim()
        }
      }
      
      // Determine conversation theme
      const lowerText = lastUserMessage.text.toLowerCase()
      if (lowerText.match(/\b(write|create|generate|article|blog|content)\b/)) {
        context.conversationTheme = "content creation"
        context.suggestedAction = "expand"
      } else if (lowerText.match(/\b(explain|analyze|discuss|describe)\b/)) {
        context.conversationTheme = "explanation"
        context.suggestedAction = "elaborate"
      } else if (lowerText.match(/\b(how|why|what|when|where)\b/)) {
        context.conversationTheme = "question"
        context.suggestedAction = "answer"
      } else if (lowerText.match(/\b(continue|more|further|additional)\b/)) {
        context.conversationTheme = "continuation"
        context.suggestedAction = "continue"
      } else {
        context.conversationTheme = "general"
        context.suggestedAction = "continue"
      }
    } catch (e) {
      // If extraction fails, use simple keyword matching
      const text = lastUserMessage.text.toLowerCase()
      
      // Extract topic using simple patterns
      const topicPatterns = [
        /(?:about|on|regarding)\s+([^.,!?\n]+?)(?:\s+for|\s+to|$)/i,
        /(?:write|create|explain|discuss)\s+(?:about|on)?\s*([^.,!?\n]+?)(?:\s+for|\s+to|$)/i,
      ]
      
      for (const pattern of topicPatterns) {
        const match = lastUserMessage.text.match(pattern)
        if (match && match[1]) {
          context.previousTopic = match[1].trim()
          break
        }
      }
      
      // Detect action
      const actionVerbs = ["write", "create", "explain", "analyze", "discuss", "describe", "summarize"]
      for (const verb of actionVerbs) {
        if (text.includes(verb)) {
          context.previousAction = verb
          break
        }
      }
    }
  }
  
  return context
}

/**
 * Generate context-aware follow-up template
 * For follow-ups, only include Task and Context (no Role, Topic, Format, Tone)
 * Task defaults to "Summarize in 100 words"
 */
export function generateContextAwareTemplate(context: ConversationContext): string {
  // For follow-ups, only Task and Context
  // Task defaults to "Summarize in 100 words"
  const defaultTask = "Summarize in 100 words"
  
  // If we have context from previous conversation, use it
  if (context.previousTopic) {
    return `Task: ${defaultTask}
Context: [${context.previousTopic}]`
  }
  
  // Fallback to minimal structure with default task
  // Context should have brackets for placeholder
  return `Task: ${defaultTask}
Context: [context]`
}

