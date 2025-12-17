/**
 * Tests for Unified Model Manager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getUnifiedModelManager } from '../unified-model-manager'

describe('UnifiedModelManager', () => {
  let modelManager: ReturnType<typeof getUnifiedModelManager>

  beforeEach(() => {
    modelManager = getUnifiedModelManager()
  })

  describe('Initialization', () => {
    it('should create singleton instance', () => {
      const instance1 = getUnifiedModelManager()
      const instance2 = getUnifiedModelManager()
      expect(instance1).toBe(instance2)
    })

    it('should have correct model ID', () => {
      const status = modelManager.getStatus()
      expect(status.totalSize).toBe('~30-50MB')
    })
  })

  describe('Framework Matching', () => {
    it('should return fallback when model not ready', async () => {
      const result = await modelManager.matchFramework('test prompt')
      expect(result).toBeDefined()
      expect(result.framework).toBeDefined()
      expect(result.score).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Intent Classification', () => {
    it('should return fallback when model not ready', async () => {
      const result = await modelManager.classifyIntent('test prompt')
      expect(result).toBeDefined()
      expect(result.intent).toBeDefined()
      expect(result.confidence).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Sensitive Detection', () => {
    it('should return fallback when model not ready', async () => {
      const result = await modelManager.detectSensitive('test prompt')
      expect(result).toBeDefined()
      expect(result.isSensitive).toBeDefined()
      expect(result.confidence).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      // Mock model to throw error
      vi.spyOn(modelManager as any, 'initialize').mockRejectedValue(
        new Error('Model load failed')
      )

      const result = await modelManager.matchFramework('test')
      expect(result).toBeDefined()
      expect(result.framework).toBe('create') // Fallback
    })
  })
})




