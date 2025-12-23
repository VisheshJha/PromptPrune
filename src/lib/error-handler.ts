/**
 * Error Handler
 * Provides graceful error handling with automatic fallbacks
 */

export interface ErrorContext {
  operation: string
  component?: string
  userAction?: string
  metadata?: Record<string, any>
}

export class ErrorHandler {
  /**
   * Handle error with automatic fallback
   */
  static handleError(
    error: Error | unknown,
    context: ErrorContext,
    fallback?: () => any
  ): any {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    console.warn(`[ErrorHandler] ${context.operation} failed:`, errorMessage, context)

    // Log error for debugging (in development)
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorHandler] Full error:', error)
    }

    // Try fallback if provided
    if (fallback) {
      try {
        return fallback()
      } catch (fallbackError) {
        console.error('[ErrorHandler] Fallback also failed:', fallbackError)
        return this.getDefaultFallback(context)
      }
    }

    return this.getDefaultFallback(context)
  }

  /**
   * Get default fallback based on context
   */
  private static getDefaultFallback(context: ErrorContext): any {
    switch (context.operation) {
      case 'classifyIntent':
        return {
          intent: 'general',
          confidence: 0.5,
          allIntents: []
        }
      
      case 'matchFramework':
        return {
          framework: 'create',
          score: 0.5,
          allScores: []
        }
      
      case 'detectSensitive':
        return {
          isSensitive: false,
          confidence: 0.5
        }
      
      case 'spellCheck':
        return {
          corrected: context.metadata?.text || '',
          corrections: []
        }
      
      default:
        return null
    }
  }

  /**
   * Wrap async function with error handling
   */
  static wrapAsync<T>(
    fn: () => Promise<T>,
    context: ErrorContext,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    return fn().catch((error) => {
      return Promise.resolve(this.handleError(error, context, fallback))
    })
  }

  /**
   * Check if error is recoverable
   */
  static isRecoverable(error: Error | unknown): boolean {
    if (!(error instanceof Error)) return false

    const recoverableErrors = [
      'Model not available',
      'Worker not initialized',
      'timeout',
      'network',
      'fetch'
    ]

    return recoverableErrors.some(pattern => 
      error.message.toLowerCase().includes(pattern.toLowerCase())
    )
  }
}






