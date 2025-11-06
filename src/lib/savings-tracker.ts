/**
 * Savings tracking - stores optimization history and calculates total savings
 */

export interface SavingsRecord {
  id: string
  timestamp: number
  originalPrompt: string
  optimizedPrompt: string
  originalTokens: number
  optimizedTokens: number
  tokensSaved: number
  costSaved: number // in dollars
  model: string
}

export interface SavingsStats {
  totalOptimizations: number
  totalTokensSaved: number
  totalCostSaved: number
  averageReduction: number
  recentRecords: SavingsRecord[]
}

const STORAGE_KEY = "promptprune_savings_history"
const MAX_RECORDS = 100 // Keep last 100 optimizations

/**
 * Save an optimization record
 */
export async function saveOptimizationRecord(
  originalPrompt: string,
  optimizedPrompt: string,
  originalTokens: number,
  optimizedTokens: number,
  model: string = "average"
): Promise<void> {
  const tokensSaved = originalTokens - optimizedTokens
  const costSaved = calculateCostSaved(originalTokens, optimizedTokens, model)

  const record: SavingsRecord = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    originalPrompt,
    optimizedPrompt,
    originalTokens,
    optimizedTokens,
    tokensSaved,
    costSaved,
    model,
  }

  const records = await getOptimizationRecords()
  records.unshift(record) // Add to beginning

  // Keep only last MAX_RECORDS
  const trimmed = records.slice(0, MAX_RECORDS)

  await chrome.storage.local.set({ [STORAGE_KEY]: trimmed })
}

/**
 * Get all optimization records
 */
export async function getOptimizationRecords(): Promise<SavingsRecord[]> {
  const result = await chrome.storage.local.get([STORAGE_KEY])
  return result[STORAGE_KEY] || []
}

/**
 * Get savings statistics
 */
export async function getSavingsStats(): Promise<SavingsStats> {
  const records = await getOptimizationRecords()

  if (records.length === 0) {
    return {
      totalOptimizations: 0,
      totalTokensSaved: 0,
      totalCostSaved: 0,
      averageReduction: 0,
      recentRecords: [],
    }
  }

  const totalTokensSaved = records.reduce((sum, r) => sum + r.tokensSaved, 0)
  const totalCostSaved = records.reduce((sum, r) => sum + r.costSaved, 0)
  const averageReduction =
    records.reduce((sum, r) => sum + (r.tokensSaved / r.originalTokens) * 100, 0) /
    records.length

  return {
    totalOptimizations: records.length,
    totalTokensSaved,
    totalCostSaved,
    averageReduction: Math.round(averageReduction * 10) / 10,
    recentRecords: records.slice(0, 10), // Last 10
  }
}

/**
 * Clear all savings history
 */
export async function clearSavingsHistory(): Promise<void> {
  await chrome.storage.local.remove([STORAGE_KEY])
}

/**
 * Calculate cost saved based on model pricing
 */
function calculateCostSaved(
  originalTokens: number,
  optimizedTokens: number,
  model: string
): number {
  // Average pricing across models (per 1M tokens)
  const avgInputPrice = 5 // $5 per 1M tokens average
  const tokensSaved = originalTokens - optimizedTokens

  // Calculate cost saved per 1000 requests (typical usage)
  const costPer1kRequests = (tokensSaved / 1_000_000) * avgInputPrice * 1000
  return Math.max(0, costPer1kRequests)
}

