/**
 * Prompt Template Generator
 * Creates structured templates for first prompts
 */

/**
 * Generate a basic template for first prompt
 * This template is framework-friendly and helps users structure their prompts
 */
export function generateFirstPromptTemplate(): string {
  return `Role: [expert type]
Task: [action]
Topic: [subject]
Format: [output format]
Tone: [tone]`
}

/**
 * Generate a template for follow-up prompts
 * Context-aware: detects previous topic and suggests continuation
 * For follow-ups, we don't need Role (already established)
 */
export function generateFollowUpTemplate(): string {
  // Import synchronously to avoid async issues in content script
  const { extractConversationContext, generateContextAwareTemplate } = require("./context-detector")
  
  // Extract context from previous messages
  const context = extractConversationContext()
  
  // Generate context-aware template (without Role for follow-ups)
  return generateContextAwareTemplate(context)
}

/**
 * Check if textarea should be pre-filled with template
 * Pre-fills for both first prompts (no previous messages) and follow-ups (has previous messages but empty textarea)
 */
export function shouldPreFillTemplate(textArea: HTMLElement): boolean {
  // Check if textarea is empty
  const text = textArea instanceof HTMLTextAreaElement || textArea instanceof HTMLInputElement
    ? textArea.value.trim()
    : textArea.textContent?.trim() || ""
  
  // Only pre-fill if textarea is completely empty
  return text.length === 0
}

/**
 * Check if there are previous messages in the conversation
 * Improved to avoid false positives from UI elements
 */
function checkForPreviousMessages(): boolean {
  // Look for actual conversation messages, not UI elements
  const messageSelectors = [
    '[class*="user-message"]',
    '[class*="assistant-message"]',
    '[class*="chat-message"]',
    '[data-role="user"]',
    '[data-role="assistant"]',
    '[data-message-type]',
  ]
  
  for (const selector of messageSelectors) {
    const messages = document.querySelectorAll(selector)
    // If we find messages, check if any are actual conversation messages
    for (const msg of Array.from(messages)) {
      // Skip if it's the textarea or input element itself
      if (msg instanceof HTMLTextAreaElement || 
          msg instanceof HTMLInputElement || 
          (msg instanceof HTMLDivElement && msg.isContentEditable)) {
        continue
      }
      
      // Skip UI elements (navigation, buttons, etc.)
      if (msg.tagName === 'BUTTON' || 
          msg.tagName === 'NAV' || 
          msg.closest('nav') ||
          msg.closest('[role="navigation"]') ||
          msg.closest('[role="banner"]') ||
          msg.closest('[role="toolbar"]')) {
        continue
      }
      
      const text = msg.textContent?.trim() || ""
      // Only count as message if it has substantial content (reduced to 15)
      // and doesn't look like UI text
      if (text.length >= 15 && 
          !text.match(/^(home|settings|profile|menu|search|sign|log|help|about|new chat|new conversation)$/i) &&
          !msg.querySelector('button, a[href*="settings"], a[href*="profile"]') &&
          !text.match(/^(type|enter|ask|message|prompt|input)/i)) {
        return true
      }
    }
  }
  
  // Check for conversation containers with actual message content
  const conversationContainers = document.querySelectorAll('[class*="conversation"], [class*="chat-history"], [class*="messages"]')
  for (const container of Array.from(conversationContainers)) {
    // Skip navigation and header elements
    if (container.closest('nav') || 
        container.closest('[role="navigation"]') ||
        container.closest('[role="banner"]')) {
      continue
    }
    
    // Look for actual message elements with content
    const messages = container.querySelectorAll('[class*="user-message"], [class*="assistant-message"], [data-role="user"], [data-role="assistant"]')
    for (const msg of Array.from(messages)) {
      // Skip UI elements
      if (msg.tagName === 'BUTTON' || msg.closest('nav')) {
        continue
      }
      
      const text = msg.textContent?.trim() || ""
      if (text.length >= 15 && 
          !text.match(/^(home|settings|profile|menu|search|sign|log|help|about|new chat|new conversation)$/i) &&
          !text.match(/^(type|enter|ask|message|prompt|input)/i)) {
        return true
      }
    }
  }
  
  return false
}

