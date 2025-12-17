/**
 * ML-Based Sensitive Content Detector
 * Uses ML model when available, falls back to regex when model is not ready
 */

import { getUnifiedModelManager } from './unified-model-manager'
import { type SensitiveContentResult, detectSensitiveContent } from './sensitive-content-detector'
import { ErrorHandler } from './error-handler'

/**
 * Detect sensitive content using ML model when available, regex fallback when model is not ready
 */
export async function detectSensitiveContentML(
  text: string
): Promise<SensitiveContentResult> {
  try {
    const unifiedModel = getUnifiedModelManager()
    
    // Check if model is actually ready before using it
    const modelReady = unifiedModel.isReady()
    const modelCached = await unifiedModel.isCached()
    
    // If model is not ready and not cached, use regex fallback immediately
    if (!modelReady && !modelCached) {
      console.warn('[MLSensitiveDetector] ⚠️ Model not ready and not cached, using regex fallback')
      return detectSensitiveContent(text)
    }
    
    // Try to use ML model
    const mlResult = await unifiedModel.detectSensitive(text)
    
    // Log ML result for debugging
    console.log('[MLSensitiveDetector] ML model result:', {
      isSensitive: mlResult.isSensitive,
      confidence: mlResult.confidence,
      type: mlResult.type,
      textPreview: text.substring(0, 50) + (text.length > 50 ? '...' : '')
    })
    
    // Check if model actually ran (confidence 0.5 with isSensitive false usually means fallback)
    // If model returned fallback result (confidence exactly 0.5 and not sensitive), use regex
    if (!mlResult.isSensitive && mlResult.confidence === 0.5 && !modelReady) {
      console.warn('[MLSensitiveDetector] ⚠️ Model returned fallback result (not ready), using regex fallback')
      return detectSensitiveContent(text)
    }
    
    // If ML detects sensitive content, use it (any confidence > 0.5)
    if (mlResult.isSensitive && mlResult.confidence > 0.5) {
      console.log('[MLSensitiveDetector] ✅ ML model detected sensitive content:', mlResult)
      
      // Convert ML result to SensitiveContentResult format
      return {
        hasSensitiveContent: true,
        detectedItems: [{
          type: mlResult.type || 'sensitive',
          value: text.substring(0, 20) + '...', // Masked value
          severity: mlResult.confidence > 0.9 ? 'high' : mlResult.confidence > 0.7 ? 'medium' : 'low',
          position: 0,
          suggestion: `🚨 Sensitive content detected (ML confidence: ${Math.round(mlResult.confidence * 100)}%) - Consider removing`
        }],
        riskScore: Math.round(mlResult.confidence * 100),
        shouldBlock: mlResult.confidence > 0.5
      }
    }
    
    // ML says not sensitive and model is ready - trust the model
    if (modelReady) {
      console.log('[MLSensitiveDetector] ML model confirms no sensitive content (confidence:', mlResult.confidence, ')')
      return {
        hasSensitiveContent: false,
        detectedItems: [],
        riskScore: 0,
        shouldBlock: false
      }
    }
    
    // Model not ready but returned result - use regex to be safe
    console.warn('[MLSensitiveDetector] ⚠️ Model not ready, using regex fallback for safety')
    return detectSensitiveContent(text)
  } catch (error) {
    console.error('[MLSensitiveDetector] ❌ ML detection failed, using regex fallback:', error)
    // If model fails, use regex fallback
    return detectSensitiveContent(text)
  }
}

/**
 * Synchronous version - returns promise for ML detection
 * Since ML detection is async, this returns a promise that resolves to the ML result
 * For immediate blocking, callers should await this
 */
export async function detectSensitiveContentSync(text: string): Promise<SensitiveContentResult> {
  // Use ML model only - no regex
  return detectSensitiveContentML(text)
}


