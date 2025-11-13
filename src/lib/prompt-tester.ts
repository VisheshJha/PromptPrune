/**
 * Prompt Testing Utilities
 * Tests various prompt processing functions with different inputs
 */

import { intelligentSpellCheck } from "./intelligent-processor"
import { compressPrompt } from "./prompt-compressor"
import { rankFrameworks, applyFramework } from "./prompt-frameworks"

export interface TestResult {
  input: string
  output: string
  success: boolean
  error?: string
  duration: number
}

/**
 * Test spell checking
 */
export async function testSpellCheck(prompt: string): Promise<TestResult> {
  const start = Date.now()
  try {
    const result = intelligentSpellCheck(prompt)
    return {
      input: prompt,
      output: result.corrected,
      success: true,
      duration: Date.now() - start
    }
  } catch (error) {
    return {
      input: prompt,
      output: prompt,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      duration: Date.now() - start
    }
  }
}

/**
 * Test prompt shortening
 */
export async function testShorten(prompt: string): Promise<TestResult> {
  const start = Date.now()
  try {
    const result = compressPrompt(prompt, {
      removeRedundancy: true,
      simplifyPhrases: true,
      preserveKeywords: true
    })
    return {
      input: prompt,
      output: result,
      success: true,
      duration: Date.now() - start
    }
  } catch (error) {
    return {
      input: prompt,
      output: prompt,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      duration: Date.now() - start
    }
  }
}

/**
 * Test framework ranking
 */
export async function testFrameworkRanking(prompt: string): Promise<TestResult> {
  const start = Date.now()
  try {
    const rankings = await Promise.race([
      rankFrameworks(prompt),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000))
    ]) as Awaited<ReturnType<typeof rankFrameworks>>
    
    if (rankings && rankings.length > 0) {
      return {
        input: prompt,
        output: `Best: ${rankings[0].framework} (score: ${rankings[0].score.toFixed(1)})`,
        success: true,
        duration: Date.now() - start
      }
    }
    return {
      input: prompt,
      output: "No frameworks ranked",
      success: false,
      error: "No rankings returned",
      duration: Date.now() - start
    }
  } catch (error) {
    return {
      input: prompt,
      output: prompt,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      duration: Date.now() - start
    }
  }
}

/**
 * Test framework application
 */
export async function testFrameworkApplication(prompt: string, framework: string = "create"): Promise<TestResult> {
  const start = Date.now()
  try {
    const result = await Promise.race([
      applyFramework(prompt, framework as any),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000))
    ]) as Awaited<ReturnType<typeof applyFramework>>
    
    return {
      input: prompt,
      output: result.optimized,
      success: result.optimized.length > 0,
      duration: Date.now() - start
    }
  } catch (error) {
    return {
      input: prompt,
      output: prompt,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      duration: Date.now() - start
    }
  }
}

/**
 * Run comprehensive tests on a prompt
 */
export async function runComprehensiveTest(prompt: string): Promise<{
  spellCheck: TestResult
  shorten: TestResult
  ranking: TestResult
  framework: TestResult
}> {
  const [spellCheck, shorten, ranking, framework] = await Promise.all([
    testSpellCheck(prompt),
    testShorten(prompt),
    testFrameworkRanking(prompt),
    testFrameworkApplication(prompt)
  ])

  return {
    spellCheck,
    shorten,
    ranking,
    framework
  }
}

/**
 * Test suite with various prompt types
 */
export const TEST_PROMPTS = [
  // User's problematic prompt
  "I want you to wriet a cold email draft becasue i am a sales rep for an ml company which selss it's product",
  
  // Other test cases
  "plz wrte abt tech future ai robots and stuff make it gud not boring",
  "wriet about delhi pollution",
  "Role: Sales Rep Task: Write cold Email; Topic: ML model for ecomm Format: text Tone: Engaging and Professional",
  "write a short article about artificial intelligence",
  "create a report on climate change",
  "explain how machine learning works",
  "I need help writing a professional email",
]

/**
 * Run all tests and return results
 */
export async function runAllTests(): Promise<Record<string, Awaited<ReturnType<typeof runComprehensiveTest>>>> {
  const results: Record<string, Awaited<ReturnType<typeof runComprehensiveTest>>> = {}
  
  for (const prompt of TEST_PROMPTS) {
    try {
      results[prompt] = await runComprehensiveTest(prompt)
    } catch (error) {
      console.error(`Test failed for prompt: ${prompt}`, error)
    }
  }
  
  return results
}

