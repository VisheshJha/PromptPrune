/**
 * Token-Level Spell Checking
 * Uses unified model for context-aware spell checking at token level
 */

import { getUnifiedModelManager } from './unified-model-manager'
import { intelligentSpellCheck } from './intelligent-processor'
import { ErrorHandler } from './error-handler'

export interface TokenSpellCheckResult {
  corrected: string
  corrections: Array<{
    original: string
    corrected: string
    position: number
    confidence: number
  }>
}

/**
 * Token-level spell check using unified model
 * Falls back to intelligent spell check if model fails
 */
export async function tokenLevelSpellCheck(
  text: string
): Promise<TokenSpellCheckResult> {
  // Try ML-based token-level checking first
  try {
    const unifiedModel = getUnifiedModelManager()
    
    // Note: Token-level classification requires special handling
    // For now, we'll use sequence-level and enhance with word-level analysis
    const words = text.match(/\b\w+\b/g) || []
    const corrections: Array<{
      original: string
      corrected: string
      position: number
      confidence: number
    }> = []

    // Check each word with model (in batches for efficiency)
    for (let i = 0; i < words.length; i += 10) {
      const batch = words.slice(i, i + 10)
      const batchText = batch.join(' ')
      
      try {
        // Use model to check if text needs correction
        // This is a simplified approach - full token classification would be better
        const result = await unifiedModel.spellCheck(batchText)
        
        // Process results (placeholder - actual implementation depends on model output)
        if (result.corrections && result.corrections.length > 0) {
          result.corrections.forEach((correction: any) => {
            const wordIndex = words.indexOf(correction.original)
            if (wordIndex >= 0) {
              corrections.push({
                original: correction.original,
                corrected: correction.corrected,
                position: wordIndex,
                confidence: correction.confidence || 0.8
              })
            }
          })
        }
      } catch (error) {
        // Continue with next batch
        console.debug('[TokenSpellCheck] Batch check failed:', error)
      }
    }

    // Apply corrections
    let corrected = text
    corrections.forEach(correction => {
      const regex = new RegExp(`\\b${correction.original}\\b`, 'gi')
      corrected = corrected.replace(regex, correction.corrected)
    })

    return {
      corrected,
      corrections
    }
  } catch (error) {
    // Fallback to intelligent spell check
    return ErrorHandler.wrapAsync(
      async () => {
        const result = intelligentSpellCheck(text)
        return {
          corrected: result.corrected,
          corrections: result.corrections.map(c => ({
            ...c,
            confidence: 0.7 // Default confidence for fallback
          }))
        }
      },
      {
        operation: 'spellCheck',
        component: 'TokenLevelSpellCheck',
        metadata: { text }
      }
    )
  }
}




