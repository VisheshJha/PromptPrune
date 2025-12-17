/**
 * Test Script for Intent Extraction and Framework Matching
 * Run this in browser console after extension loads
 * 
 * Usage:
 * 1. Load extension in browser
 * 2. Navigate to any page (ChatGPT, Claude, etc.)
 * 3. Open browser console
 * 4. Copy-paste this entire script
 * 5. Call: await testIntentAndFramework()
 */

// Test cases with expected outputs
const TEST_CASES = [
  // Content Creation - Should match ROSES framework
  {
    name: "Content Creation - Blog Post",
    prompt: "Write a blog post about artificial intelligence",
    expectedFramework: "roses",
    expectedIntent: "content creation",
    reason: "Blog post creation should use ROSES framework"
  },
  {
    name: "Content Creation - Article",
    prompt: "Create an article about climate change",
    expectedFramework: "roses",
    expectedIntent: "content creation",
    reason: "Article creation should use ROSES framework"
  },
  
  // Professional Communication - Should match RACE framework
  {
    name: "Professional - Business Email",
    prompt: "Write a professional email to a client about project delays",
    expectedFramework: "race",
    expectedIntent: "professional communication",
    reason: "Professional communication should use RACE framework"
  },
  {
    name: "Professional - Corporate Report",
    prompt: "Create a corporate report analyzing Q4 sales data",
    expectedFramework: "race",
    expectedIntent: "professional communication",
    reason: "Corporate/business content should use RACE framework"
  },
  
  // Reasoning/Explanation - Should match COT framework
  {
    name: "Reasoning - How Question",
    prompt: "How does photosynthesis work? Explain step by step",
    expectedFramework: "cot",
    expectedIntent: "explanation",
    reason: "Step-by-step explanation should use COT framework"
  },
  {
    name: "Reasoning - Problem Solving",
    prompt: "Why is the sky blue? Think through the physics",
    expectedFramework: "cot",
    expectedIntent: "problem solving",
    reason: "Reasoning questions should use COT framework"
  },
  
  // Code Generation
  {
    name: "Code Generation",
    prompt: "Write a Python function to sort a list",
    expectedFramework: "create", // or could be guide
    expectedIntent: "code generation",
    reason: "Code generation should be detected"
  },
  
  // Data Analysis
  {
    name: "Data Analysis",
    prompt: "Analyze this sales data and create a report",
    expectedFramework: "race", // or roses
    expectedIntent: "data analysis",
    reason: "Data analysis should be detected"
  },
  
  // Creative Writing
  {
    name: "Creative Writing",
    prompt: "Write a short story about a robot learning to love",
    expectedFramework: "roses", // or create
    expectedIntent: "creative writing",
    reason: "Creative writing should be detected"
  },
  
  // Tutorial/Guide
  {
    name: "Tutorial/Guide",
    prompt: "Create a step-by-step guide on how to bake a cake",
    expectedFramework: "guide",
    expectedIntent: "explanation",
    reason: "Step-by-step guide should use GUIDE framework"
  },
  
  // Complex/Mixed
  {
    name: "Complex - Multiple Tasks",
    prompt: "Write a professional blog post explaining how machine learning works for business executives",
    expectedFramework: "roses", // Content creation takes priority
    expectedIntent: "content creation",
    reason: "Blog post should prioritize ROSES even with professional context"
  }
]

async function testIntentAndFramework() {
  console.log("🧪 Starting Intent & Framework Matching Tests...\n")
  console.log("=" .repeat(80))
  
  // Get the unified model manager from the extension
  // We need to access it from the content script context
  let modelManager = null
  
  try {
    // Try to access via window if exposed
    if (window.__promptPruneModelManager) {
      modelManager = window.__promptPruneModelManager
    } else {
      // Try to import from the extension's content script
      // This might not work directly, so we'll use a different approach
      console.warn("⚠️ Model manager not directly accessible. Testing via textarea interaction...")
      return await testViaTextarea()
    }
  } catch (error) {
    console.warn("⚠️ Could not access model manager directly:", error)
    return await testViaTextarea()
  }
  
  const results = []
  
  for (const testCase of TEST_CASES) {
    console.log(`\n📝 Test: ${testCase.name}`)
    console.log(`   Prompt: "${testCase.prompt}"`)
    
    try {
      // Test Intent Classification
      const intentResult = await modelManager.classifyIntent(testCase.prompt)
      const intentMatch = intentResult.intent.toLowerCase() === testCase.expectedIntent.toLowerCase()
      
      // Test Framework Matching
      const frameworkResult = await modelManager.matchFramework(testCase.prompt)
      const frameworkMatch = frameworkResult.framework.toLowerCase() === testCase.expectedFramework.toLowerCase()
      
      const result = {
        testCase: testCase.name,
        prompt: testCase.prompt,
        intent: {
          expected: testCase.expectedIntent,
          actual: intentResult.intent,
          confidence: intentResult.confidence,
          match: intentMatch,
          allIntents: intentResult.allIntents
        },
        framework: {
          expected: testCase.expectedFramework,
          actual: frameworkResult.framework,
          score: frameworkResult.score,
          match: frameworkMatch,
          allScores: frameworkResult.allScores
        },
        passed: intentMatch && frameworkMatch,
        reason: testCase.reason
      }
      
      results.push(result)
      
      // Log results
      console.log(`   ✅ Intent: ${intentResult.intent} (confidence: ${(intentResult.confidence * 100).toFixed(1)}%)`)
      console.log(`   ${intentMatch ? '✅' : '❌'} Expected: ${testCase.expectedIntent}`)
      console.log(`   ✅ Framework: ${frameworkResult.framework} (score: ${(frameworkResult.score * 100).toFixed(1)}%)`)
      console.log(`   ${frameworkMatch ? '✅' : '❌'} Expected: ${testCase.expectedFramework}`)
      
      if (!intentMatch || !frameworkMatch) {
        console.log(`   ⚠️  Reason: ${testCase.reason}`)
        if (!intentMatch) {
          console.log(`   📊 All Intent Scores:`)
          intentResult.allIntents.slice(0, 3).forEach(i => {
            console.log(`      - ${i.intent}: ${(i.score * 100).toFixed(1)}%`)
          })
        }
        if (!frameworkMatch) {
          console.log(`   📊 Top 3 Framework Scores:`)
          frameworkResult.allScores.slice(0, 3).forEach(f => {
            console.log(`      - ${f.framework}: ${(f.score * 100).toFixed(1)}%`)
          })
        }
      }
      
    } catch (error) {
      console.error(`   ❌ Error testing: ${error.message}`)
      results.push({
        testCase: testCase.name,
        prompt: testCase.prompt,
        error: error.message,
        passed: false
      })
    }
  }
  
  // Summary
  console.log("\n" + "=".repeat(80))
  console.log("📊 TEST SUMMARY")
  console.log("=".repeat(80))
  
  const passed = results.filter(r => r.passed).length
  const total = results.length
  const intentPassed = results.filter(r => r.intent && r.intent.match).length
  const frameworkPassed = results.filter(r => r.framework && r.framework.match).length
  
  console.log(`\n✅ Overall: ${passed}/${total} tests passed (${(passed/total*100).toFixed(1)}%)`)
  console.log(`✅ Intent Classification: ${intentPassed}/${total} correct (${(intentPassed/total*100).toFixed(1)}%)`)
  console.log(`✅ Framework Matching: ${frameworkPassed}/${total} correct (${(frameworkPassed/total*100).toFixed(1)}%)`)
  
  // Detailed breakdown
  console.log("\n📋 Detailed Results:")
  results.forEach((r, idx) => {
    const status = r.passed ? "✅" : "❌"
    console.log(`\n${idx + 1}. ${status} ${r.testCase}`)
    if (r.intent) {
      console.log(`   Intent: ${r.intent.actual} (expected: ${r.intent.expected}) - ${r.intent.match ? '✅' : '❌'}`)
    }
    if (r.framework) {
      console.log(`   Framework: ${r.framework.actual} (expected: ${r.framework.expected}) - ${r.framework.match ? '✅' : '❌'}`)
    }
    if (r.error) {
      console.log(`   Error: ${r.error}`)
    }
  })
  
  return results
}

// Alternative testing method via textarea interaction
async function testViaTextarea() {
  console.log("🧪 Testing via Textarea Interaction...")
  console.log("=".repeat(80))
  console.log("\n⚠️  This method requires manual interaction.")
  console.log("Please type each test prompt in a textarea and check the console logs.")
  console.log("\nTest Cases:")
  TEST_CASES.forEach((tc, idx) => {
    console.log(`\n${idx + 1}. ${tc.name}`)
    console.log(`   Prompt: "${tc.prompt}"`)
    console.log(`   Expected Framework: ${tc.expectedFramework}`)
    console.log(`   Expected Intent: ${tc.expectedIntent}`)
  })
  
  return TEST_CASES
}

// Export for use
if (typeof window !== 'undefined') {
  window.testIntentAndFramework = testIntentAndFramework
  window.TEST_CASES = TEST_CASES
}

console.log("✅ Test script loaded!")
console.log("Call: await testIntentAndFramework() to run tests")
console.log("Or check: window.TEST_CASES for the test cases")


