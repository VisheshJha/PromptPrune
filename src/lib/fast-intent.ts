/**
 * Fast Intent Extractor
 * Lightweight, regex-only intent extraction for real-time use during typing.
 * NO NLP libraries, NO async operations - purely synchronous and fast (~1ms).
 * 
 * For heavy processing (frameworks, HF models), use the full extractIntent from intelligent-processor.ts
 */

export interface FastIntent {
    action: string
    topic: string
    hasRole: boolean
    hasFormat: boolean
    isVague: boolean
    wordCount: number
}

/**
 * Fast intent extraction using only regex - for real-time keystroke handling
 * Target: <5ms execution time
 */
export function extractIntentFast(text: string): FastIntent {
    // Default result
    const result: FastIntent = {
        action: 'write',
        topic: '',
        hasRole: false,
        hasFormat: false,
        isVague: false,
        wordCount: 0
    }

    // Handle empty/invalid input
    if (!text || typeof text !== 'string') {
        return result
    }

    const trimmed = text.trim()
    if (!trimmed) {
        return result
    }

    const lower = trimmed.toLowerCase()
    const words = trimmed.split(/\s+/).filter(w => w.length > 0)
    result.wordCount = words.length

    // Fast action detection - check start of text only
    const actionMatch = lower.match(/^(write|create|make|generate|explain|describe|analyze|build|design|develop|draft|send|tell|discuss|summarize|review|help|assist)\s/)
    if (actionMatch) {
        result.action = actionMatch[1]
    } else if (lower.match(/\b(want|need|would like|please)\s+(to\s+)?(write|create|make|generate)/)) {
        const verbMatch = lower.match(/\b(want|need|would like|please)\s+(to\s+)?(write|create|make|generate|explain|describe)\b/)
        if (verbMatch && verbMatch[3]) {
            result.action = verbMatch[3]
        }
    }

    // Fast role detection
    result.hasRole = /\b(as a|as an|you are|role:|acting as)\b/i.test(lower)

    // Fast format detection
    result.hasFormat = /\b(email|report|blog|article|summary|guide|tutorial|document|presentation|letter|memo|essay)\b/i.test(lower)

    // Fast vague word detection
    result.isVague = /\b(good|better|nice|stuff|things|maybe|perhaps|kind of|sort of)\b/i.test(lower)

    // Fast topic extraction - just get what comes after action verb
    const topicMatch = lower.match(/\b(?:write|create|make|generate|explain|describe|about|on|regarding)\s+(?:a\s+|an\s+|the\s+)?([^.,!?\n]{3,50})/i)
    if (topicMatch && topicMatch[1]) {
        result.topic = topicMatch[1].trim()
    }

    return result
}

/**
 * Fast quality score calculation - regex only
 * Returns 0-100 score based on prompt quality indicators
 */
export function calculateQualityFast(text: string): number {
    if (!text || typeof text !== 'string') return 0

    const trimmed = text.trim()
    if (!trimmed) return 0

    let score = 50 // Base score

    const lower = trimmed.toLowerCase()
    const words = trimmed.split(/\s+/).filter(w => w.length > 0)
    const wordCount = words.length

    // Length bonuses/penalties
    if (wordCount < 3) score -= 30
    else if (wordCount < 5) score -= 15
    else if (wordCount >= 10 && wordCount <= 50) score += 15
    else if (wordCount > 100) score += 5

    // Has action verb
    if (/^(write|create|make|generate|explain|describe|analyze|build|design|develop)\s/i.test(trimmed)) {
        score += 15
    }

    // Has role
    if (/\b(as a|as an|you are|role:)\b/i.test(lower)) {
        score += 10
    }

    // Has format
    if (/\b(email|report|blog|article|summary|guide|tutorial)\b/i.test(lower)) {
        score += 10
    }

    // Has context/about
    if (/\b(about|regarding|for|to)\b/i.test(lower)) {
        score += 5
    }

    // Vague words penalty
    const vagueMatches = lower.match(/\b(good|better|nice|stuff|things|maybe|perhaps)\b/g)
    if (vagueMatches) {
        score -= vagueMatches.length * 5
    }

    // Has punctuation at end
    if (/[.!?]$/.test(trimmed)) {
        score += 5
    }

    return Math.max(0, Math.min(100, score))
}

/**
 * Fast suggestion generation - regex only
 * Returns suggestion hints based on what's missing in the prompt
 */
export function getSuggestionHints(text: string): string[] {
    const hints: string[] = []

    if (!text || typeof text !== 'string') return hints

    const lower = text.toLowerCase().trim()
    const wordCount = text.trim().split(/\s+/).length

    // Missing role
    if ((lower.includes('write') || lower.includes('create')) &&
        !lower.includes('as a') && !lower.includes('as an') && !lower.includes('role:')) {
        hints.push('add_role')
    }

    // Vague words
    if (/\b(good|better|nice|stuff|things)\b/.test(lower)) {
        hints.push('be_specific')
    }

    // Missing format
    if (lower.includes('write') &&
        !/\b(email|report|blog|article|summary|document|letter)\b/.test(lower)) {
        hints.push('add_format')
    }

    // Short prompt
    if (wordCount < 10 && !lower.includes('about') && !lower.includes('context')) {
        hints.push('add_context')
    }

    return hints
}
