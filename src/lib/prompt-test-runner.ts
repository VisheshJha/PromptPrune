/**
 * Browser-based Test Runner for Prompt Processing
 * Can be run in browser console after extension loads
 */

import { compressPrompt } from "./prompt-compressor"
import { rankFrameworks, applyFramework, FRAMEWORKS, FrameworkType } from "./prompt-frameworks"
import { intelligentSpellCheck } from "./intelligent-processor"

// Complex test prompt without template
const COMPLEX_PROMPT = "I want you to write a comprehensive cold email draft for me because I am a sales representative for a machine learning company that sells its innovative AI-powered product to enterprise clients. The email should be engaging, professional, and highlight the key benefits of our solution. Please make sure it's not too long and includes a clear call to action."

export interface TestResults {
  spellCheck: {
    original: string
    corrected: string
    corrections: number
    details: Array<{ original: string; corrected: string }>
  }
  shorten: {
    original: string
    shortened: string
    originalLength: number
    shortenedLength: number
    reductionPercent: number
    makesSense: boolean
  }
  frameworkRanking: {
    top3: Array<{ framework: string; name: string; score: number }>
    success: boolean
    error?: string
  }
  frameworkToFramework: {
    frameworks: Array<{
      framework: string
      name: string
      output: string
      hasDuplication: boolean
      outputLength: number
    }>
    success: boolean
    error?: string
  }
  meaningPreservation: {
    keyConcepts: Array<{
      concept: string
      inOriginal: boolean
      inShortened: boolean
      preserved: boolean
    }>
  }
}

/**
 * Run comprehensive test on a prompt
 */
export async function testComplexPrompt(prompt: string = COMPLEX_PROMPT): Promise<TestResults> {
  console.log("🧪 Starting comprehensive prompt test...")
  console.log("Prompt:", prompt)
  console.log()

  // 1. Spell Check
  console.log("1️⃣ Testing spell check...")
  const spellResult = intelligentSpellCheck(prompt)
  const spellCheck = {
    original: prompt,
    corrected: spellResult.corrected,
    corrections: spellResult.corrections.length,
    details: spellResult.corrections.map(c => ({ original: c.original, corrected: c.corrected }))
  }
  console.log("✅ Spell check complete:", spellCheck.corrections, "corrections")
  console.log()

  // 2. Shorten
  console.log("2️⃣ Testing prompt shortening...")
  const shortened = compressPrompt(prompt, {
    removeRedundancy: true,
    simplifyPhrases: true,
    preserveKeywords: true
  })
  
  // Check if shortened makes sense
  const words = shortened.split(/\s+/)
  const singleLetterWords = words.filter(w => w.length === 1 && /[a-zA-Z]/.test(w)).length
  const suspiciousPattern = /(^|\s)([a-z]\s+){3,}/i.test(shortened)
  const makesSense = !(singleLetterWords > words.length * 0.2 || suspiciousPattern)
  
  const shorten = {
    original: prompt,
    shortened: shortened,
    originalLength: prompt.length,
    shortenedLength: shortened.length,
    reductionPercent: Math.round(((prompt.length - shortened.length) / prompt.length) * 100),
    makesSense: makesSense
  }
  console.log("✅ Shortening complete:", shorten.reductionPercent + "% reduction")
  if (!makesSense) {
    console.warn("⚠️ Shortened version may not make sense!")
  }
  console.log()

  // 3. Framework Ranking
  console.log("3️⃣ Testing framework ranking...")
  let frameworkRanking: TestResults["frameworkRanking"]
  try {
    const rankings = await Promise.race([
      rankFrameworks(prompt),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 15000))
    ])
    
    frameworkRanking = {
      top3: rankings.slice(0, 3).map(rank => ({
        framework: rank.framework,
        name: FRAMEWORKS[rank.framework].name,
        score: Math.round(rank.score * 10) / 10
      })),
      success: true
    }
    console.log("✅ Framework ranking complete")
    console.log("   Top framework:", frameworkRanking.top3[0]?.name)
  } catch (error) {
    frameworkRanking = {
      top3: [],
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
    console.error("❌ Framework ranking failed:", error)
  }
  console.log()

  // 4. Framework-to-Framework Switching
  console.log("4️⃣ Testing framework-to-framework switching...")
  const frameworksToTest: FrameworkType[] = ["race", "roses", "create", "ape"]
  const frameworkToFramework: TestResults["frameworkToFramework"] = {
    frameworks: [],
    success: true
  }
  
  for (const framework of frameworksToTest) {
    try {
      const output = await applyFramework(prompt, framework)
      const optimized = output.optimized
      
      // Check for duplication
      const hasDuplication = /(you are\s+){2,}/i.test(optimized) || 
                           /(action:\s*){2,}/i.test(optimized) ||
                           /(role:\s*){2,}/i.test(optimized) ||
                           /(task:\s*){2,}/i.test(optimized)
      
      frameworkToFramework.frameworks.push({
        framework: framework,
        name: FRAMEWORKS[framework].name,
        output: optimized,
        hasDuplication: hasDuplication,
        outputLength: optimized.length
      })
      
      if (hasDuplication) {
        console.warn(`⚠️ Duplication detected in ${FRAMEWORKS[framework].name}`)
        frameworkToFramework.success = false
      }
    } catch (error) {
      console.error(`❌ Failed to apply ${framework}:`, error)
      frameworkToFramework.success = false
      frameworkToFramework.error = error instanceof Error ? error.message : "Unknown error"
    }
  }
  console.log("✅ Framework-to-framework test complete")
  console.log()

  // 5. Meaning Preservation
  console.log("5️⃣ Testing meaning preservation...")
  const keyConcepts = [
    "cold email",
    "sales representative",
    "machine learning",
    "AI product",
    "enterprise",
    "engaging",
    "professional",
    "call to action"
  ]
  
  const meaningPreservation = {
    keyConcepts: keyConcepts.map(concept => {
      const inOriginal = prompt.toLowerCase().includes(concept.toLowerCase())
      const inShortened = shortened.toLowerCase().includes(concept.toLowerCase())
      return {
        concept,
        inOriginal,
        inShortened,
        preserved: inOriginal && inShortened
      }
    })
  }
  
  const preservedCount = meaningPreservation.keyConcepts.filter(c => c.preserved).length
  console.log(`✅ Meaning preservation: ${preservedCount}/${keyConcepts.length} concepts preserved`)
  console.log()

  const results: TestResults = {
    spellCheck,
    shorten,
    frameworkRanking,
    frameworkToFramework,
    meaningPreservation
  }

  console.log("=".repeat(80))
  console.log("📊 TEST SUMMARY")
  console.log("=".repeat(80))
  console.log("Spell Check:", spellCheck.corrections, "corrections")
  console.log("Shortening:", shorten.reductionPercent + "% reduction", makesSense ? "✅" : "⚠️")
  console.log("Framework Ranking:", frameworkRanking.success ? "✅" : "❌", frameworkRanking.top3[0]?.name || "N/A")
  console.log("Framework-to-Framework:", frameworkToFramework.success ? "✅ No duplication" : "❌ Has duplication")
  console.log("Meaning Preservation:", preservedCount + "/" + keyConcepts.length, "concepts")
  console.log("=".repeat(80))

  return results
}

/**
 * Quick test - just shorten and show results
 */
export async function quickTestShorten(prompt: string = COMPLEX_PROMPT) {
  console.log("🔍 Quick Shorten Test")
  console.log("Original:", prompt)
  console.log()
  
  const shortened = compressPrompt(prompt, {
    removeRedundancy: true,
    simplifyPhrases: true,
    preserveKeywords: true
  })
  
  console.log("Shortened:", shortened)
  console.log()
  console.log("Length:", prompt.length, "→", shortened.length, `(${Math.round(((prompt.length - shortened.length) / prompt.length) * 100)}% reduction)`)
  
  return shortened
}

/**
 * Quick test - framework-to-framework
 */
export async function quickTestFrameworkSwitching(prompt: string = COMPLEX_PROMPT) {
  console.log("🔄 Quick Framework Switching Test")
  console.log("Original prompt:", prompt.substring(0, 100) + "...")
  console.log()
  
  const frameworks: FrameworkType[] = ["race", "roses", "create", "ape"]
  
  for (const framework of frameworks) {
    try {
      const output = await applyFramework(prompt, framework)
      const hasDuplication = /(you are\s+){2,}/i.test(output.optimized) || 
                           /(action:\s*){2,}/i.test(output.optimized)
      
      console.log(`${FRAMEWORKS[framework].name}:`)
      console.log(`  Length: ${output.optimized.length} chars`)
      console.log(`  Duplication: ${hasDuplication ? "❌ YES" : "✅ NO"}`)
      console.log(`  Preview: ${output.optimized.substring(0, 120)}...`)
      console.log()
    } catch (error) {
      console.error(`❌ ${framework} failed:`, error)
    }
  }
}

// Make functions available globally in browser
if (typeof window !== "undefined") {
  (window as any).testComplexPrompt = testComplexPrompt
  ;(window as any).quickTestShorten = quickTestShorten
  ;(window as any).quickTestFrameworkSwitching = quickTestFrameworkSwitching
  console.log("🧪 Test functions loaded! Use:")
  console.log("  - testComplexPrompt() - Full comprehensive test")
  console.log("  - quickTestShorten() - Quick shorten test")
  console.log("  - quickTestFrameworkSwitching() - Quick framework switching test")
}

