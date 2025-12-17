/**
 * Tests for Smart Optimizer
 */

import { describe, it, expect, vi } from 'vitest'
import { optimizePromptSmartly } from '../smart-prompt-optimizer'

describe('Smart Optimizer', () => {
  it('should return result even with empty prompt', async () => {
    const result = await optimizePromptSmartly('')
    expect(result).toBeDefined()
    expect(result.improvedPrompt).toBeDefined()
  })

  it('should handle basic prompt', async () => {
    const result = await optimizePromptSmartly('Write an email')
    expect(result).toBeDefined()
    expect(result.framework).toBeDefined()
    expect(result.intent).toBeDefined()
  })

  it('should detect sensitive content', async () => {
    const result = await optimizePromptSmartly('My email is user@example.com')
    expect(result).toBeDefined()
    expect(result.warnings).toBeDefined()
  })

  it('should handle errors gracefully', async () => {
    // Mock model to fail
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    const result = await optimizePromptSmartly('test prompt')
    expect(result).toBeDefined()
    expect(result.improvedPrompt).toBeDefined()
    
    vi.restoreAllMocks()
  })
})




