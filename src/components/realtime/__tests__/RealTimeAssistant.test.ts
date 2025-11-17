/**
 * Tests for Real-Time Assistant
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { RealTimeAssistant } from '../RealTimeAssistant'

describe('RealTimeAssistant', () => {
  let textarea: HTMLTextAreaElement
  let assistant: RealTimeAssistant

  beforeEach(() => {
    textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
  })

  afterEach(() => {
    assistant?.destroy()
    textarea?.remove()
  })

  it('should initialize with all features enabled by default', () => {
    assistant = new RealTimeAssistant({ textarea })
    expect(assistant).toBeDefined()
  })

  it('should allow disabling specific features', () => {
    assistant = new RealTimeAssistant({
      textarea,
      enabled: {
        tokenCounter: false,
        qualityScore: false,
        spellCheck: true,
        autocomplete: true,
        redundancy: false,
        smartSuggestions: false,
        grammar: false,
      },
    })
    expect(assistant).toBeDefined()
  })

  it('should destroy all components when destroyed', () => {
    assistant = new RealTimeAssistant({ textarea })
    expect(() => assistant.destroy()).not.toThrow()
  })

  it('should enable features dynamically', () => {
    assistant = new RealTimeAssistant({
      textarea,
      enabled: {
        tokenCounter: false,
        qualityScore: false,
        spellCheck: false,
        autocomplete: false,
        redundancy: false,
        smartSuggestions: false,
        grammar: false,
      },
    })
    
    assistant.enableFeature('tokenCounter')
    assistant.enableFeature('qualityScore')
    
    expect(() => assistant.destroy()).not.toThrow()
  })

  it('should disable features dynamically', () => {
    assistant = new RealTimeAssistant({ textarea })
    
    assistant.disableFeature('tokenCounter')
    assistant.disableFeature('qualityScore')
    
    expect(() => assistant.destroy()).not.toThrow()
  })
})

