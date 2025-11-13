/**
 * Comprehensive Prompt Type Tester
 * Tests various prompt types to ensure proper handling
 */

// Note: parsePrompt is not exported, we'll use applyFramework instead
import { extractIntent } from './intelligent-processor'
import { applyFramework, rankFrameworks } from './prompt-frameworks'
import { optimizePromptSmartly } from './smart-prompt-optimizer'

export interface PromptTestCase {
  name: string
  prompt: string
  type: 'question' | 'imperative' | 'structured' | 'complex' | 'short' | 'long' | 'typo' | 'technical' | 'creative' | 'professional'
  expectedAction?: string
  expectedTopic?: string
  expectedFramework?: string
  shouldContain?: string[]
  shouldNotContain?: string[]
}

export const PROMPT_TEST_CASES: PromptTestCase[] = [
  // ========== QUESTIONS ==========
  {
    name: "Who question - diplomatic",
    prompt: "Who do you think India should refer to resolve issue of tariff with Trump",
    type: 'question',
    expectedAction: 'refer',
    expectedTopic: 'India should refer to resolve issue of tariff with Trump',
    shouldContain: ['India', 'tariff', 'Trump'],
    shouldNotContain: ['do you', 'you think']
  },
  {
    name: "What question - technical",
    prompt: "What is the best way to implement authentication in a React app?",
    type: 'question',
    expectedAction: 'explain',
    expectedTopic: 'best way to implement authentication in a React app',
    shouldContain: ['authentication', 'React']
  },
  {
    name: "How question - tutorial",
    prompt: "How can I optimize my database queries for better performance?",
    type: 'question',
    expectedAction: 'explain',
    expectedTopic: 'optimize my database queries for better performance',
    shouldContain: ['database', 'queries', 'performance']
  },
  {
    name: "Why question - analysis",
    prompt: "Why did the stock market crash in 2008?",
    type: 'question',
    expectedAction: 'explain',
    expectedTopic: 'stock market crash in 2008',
    shouldContain: ['stock market', '2008']
  },
  {
    name: "Where question - location",
    prompt: "Where should I invest my money for long-term growth?",
    type: 'question',
    expectedAction: 'suggest',
    expectedTopic: 'invest my money for long-term growth',
    shouldContain: ['invest', 'money', 'growth']
  },
  {
    name: "When question - timing",
    prompt: "When is the best time to launch a new product?",
    type: 'question',
    expectedAction: 'analyze',
    expectedTopic: 'best time to launch a new product',
    shouldContain: ['launch', 'product']
  },

  // ========== IMPERATIVE STATEMENTS ==========
  {
    name: "Write email - casual",
    prompt: "Write a funny email to my boss about being late becasue i was caught in traffic",
    type: 'imperative',
    expectedAction: 'write',
    expectedTopic: 'funny email to my boss about being late because I was caught in traffic',
    shouldContain: ['email', 'boss', 'late', 'traffic'],
    shouldNotContain: ['becasue'] // Should fix typo
  },
  {
    name: "Create article - content",
    prompt: "Create a comprehensive article about climate change for general readers",
    type: 'imperative',
    expectedAction: 'create',
    expectedTopic: 'comprehensive article about climate change for general readers',
    shouldContain: ['article', 'climate change']
  },
  {
    name: "Generate report - professional",
    prompt: "Generate a quarterly sales report with charts and analysis",
    type: 'imperative',
    expectedAction: 'generate',
    expectedTopic: 'quarterly sales report with charts and analysis',
    shouldContain: ['report', 'sales', 'charts']
  },
  {
    name: "Explain concept - educational",
    prompt: "Explain quantum computing in simple terms for beginners",
    type: 'imperative',
    expectedAction: 'explain',
    expectedTopic: 'quantum computing in simple terms for beginners',
    shouldContain: ['quantum computing', 'beginners']
  },

  // ========== STRUCTURED PROMPTS ==========
  {
    name: "Structured - Role Action Topic",
    prompt: "Role: Marketing Manager\nAction: Write\nTopic: Social media strategy for Q4",
    type: 'structured',
    expectedAction: 'write',
    expectedTopic: 'Social media strategy for Q4',
    shouldContain: ['Marketing Manager', 'Social media', 'Q4']
  },
  {
    name: "Structured - Full format",
    prompt: "Role: Sales Rep\nTask: Write cold Email\nTopic: ML model for ecomm\nFormat: text\nTone: Engaging and Professional",
    type: 'structured',
    expectedAction: 'write',
    expectedTopic: 'ML model for ecomm',
    shouldContain: ['Sales Rep', 'Email', 'ML', 'ecomm']
  },

  // ========== COMPLEX PROMPTS ==========
  {
    name: "Complex - Multiple requirements",
    prompt: "Write a detailed technical blog post about microservices architecture, including best practices, common pitfalls, and real-world examples. Target audience: senior developers. Tone: professional but accessible. Length: 2000 words.",
    type: 'complex',
    expectedAction: 'write',
    expectedTopic: 'detailed technical blog post about microservices architecture',
    shouldContain: ['microservices', 'architecture', 'best practices', 'senior developers', '2000 words']
  },
  {
    name: "Complex - Multi-part question",
    prompt: "Analyze the impact of AI on healthcare, covering: 1) Current applications 2) Future possibilities 3) Ethical concerns 4) Regulatory challenges",
    type: 'complex',
    expectedAction: 'analyze',
    expectedTopic: 'impact of AI on healthcare',
    shouldContain: ['AI', 'healthcare', 'applications', 'ethical', 'regulatory']
  },

  // ========== SHORT PROMPTS ==========
  {
    name: "Short - Minimal",
    prompt: "write about tech future",
    type: 'short',
    expectedAction: 'write',
    expectedTopic: 'tech future',
    shouldContain: ['tech', 'future']
  },
  {
    name: "Short - With typo",
    prompt: "wriet about delhi pollution",
    type: 'short',
    expectedAction: 'write',
    expectedTopic: 'delhi pollution',
    shouldContain: ['Delhi', 'pollution'],
    shouldNotContain: ['wriet'] // Should fix typo
  },

  // ========== LONG PROMPTS ==========
  {
    name: "Long - Detailed request",
    prompt: "I need you to write a comprehensive research paper on the effects of remote work on employee productivity and mental health. The paper should include: an executive summary, introduction with background context, literature review of existing research, methodology section explaining how data was collected, detailed analysis of findings including statistical data and charts, discussion of implications for businesses and employees, recommendations for best practices, and a conclusion summarizing key points. The target audience is HR professionals and business leaders. The tone should be academic but accessible. Please ensure all sources are properly cited and the paper follows APA format. The length should be approximately 5000 words with at least 20 references.",
    type: 'long',
    expectedAction: 'write',
    expectedTopic: 'comprehensive research paper on the effects of remote work',
    shouldContain: ['remote work', 'productivity', 'mental health', 'HR professionals', '5000 words']
  },

  // ========== TYPOS ==========
  {
    name: "Typos - Multiple errors",
    prompt: "plz wrte abt tech future ai robots and stuff make it gud not boring",
    type: 'typo',
    expectedAction: 'write',
    expectedTopic: 'tech future ai robots',
    shouldContain: ['tech', 'future', 'AI', 'robots'],
    shouldNotContain: ['plz', 'wrte', 'abt', 'gud'] // Should fix typos
  },
  {
    name: "Typos - Common misspellings",
    prompt: "I want you to wriet a cold email draft becasue i am a sales rep for an ml company which selss it's product",
    type: 'typo',
    expectedAction: 'write',
    expectedTopic: 'cold email draft',
    shouldContain: ['email', 'sales rep', 'ML', 'company'],
    shouldNotContain: ['wriet', 'becasue', 'selss'] // Should fix typos
  },

  // ========== TECHNICAL PROMPTS ==========
  {
    name: "Technical - Code generation",
    prompt: "Create a Python function that calculates the Fibonacci sequence up to n terms with memoization for optimization",
    type: 'technical',
    expectedAction: 'create',
    expectedTopic: 'Python function that calculates the Fibonacci sequence',
    shouldContain: ['Python', 'Fibonacci', 'memoization']
  },
  {
    name: "Technical - System design",
    prompt: "Design a scalable architecture for a real-time chat application supporting 1 million concurrent users",
    type: 'technical',
    expectedAction: 'design',
    expectedTopic: 'scalable architecture for a real-time chat application',
    shouldContain: ['architecture', 'chat', 'concurrent users']
  },

  // ========== CREATIVE PROMPTS ==========
  {
    name: "Creative - Story writing",
    prompt: "Write a short story about a time traveler who gets stuck in medieval times and must use modern knowledge to survive",
    type: 'creative',
    expectedAction: 'write',
    expectedTopic: 'short story about a time traveler',
    shouldContain: ['story', 'time traveler', 'medieval']
  },
  {
    name: "Creative - Marketing copy",
    prompt: "Create engaging social media posts for a new eco-friendly product launch, targeting millennials and Gen Z",
    type: 'creative',
    expectedAction: 'create',
    expectedTopic: 'engaging social media posts for a new eco-friendly product launch',
    shouldContain: ['social media', 'eco-friendly', 'millennials', 'Gen Z']
  },

  // ========== PROFESSIONAL PROMPTS ==========
  {
    name: "Professional - Business proposal",
    prompt: "Draft a professional business proposal for a software development project, including project scope, timeline, budget, and deliverables",
    type: 'professional',
    expectedAction: 'draft',
    expectedTopic: 'professional business proposal for a software development project',
    shouldContain: ['business proposal', 'software development', 'timeline', 'budget']
  },
  {
    name: "Professional - Executive summary",
    prompt: "Write an executive summary of the quarterly financial results, highlighting key metrics, growth areas, and strategic recommendations",
    type: 'professional',
    expectedAction: 'write',
    expectedTopic: 'executive summary of the quarterly financial results',
    shouldContain: ['executive summary', 'financial results', 'metrics', 'strategic']
  },

  // ========== EDGE CASES ==========
  {
    name: "Empty prompt",
    prompt: "",
    type: 'short',
    expectedAction: 'write',
    expectedTopic: '',
    shouldContain: []
  },
  {
    name: "Null/whitespace prompt",
    prompt: "   \n\t  ",
    type: 'short',
    expectedAction: 'write',
    expectedTopic: '',
    shouldContain: []
  },
  {
    name: "Template only - empty fields",
    prompt: "Role:\nAction:\nTopic:",
    type: 'structured',
    expectedAction: 'write',
    expectedTopic: '',
    shouldContain: []
  },
  {
    name: "Template only - partial empty",
    prompt: "Role: Marketing Manager\nAction:\nTopic:",
    type: 'structured',
    expectedAction: 'write',
    expectedTopic: '',
    shouldContain: ['Marketing Manager']
  },
  {
    name: "Very short - single word",
    prompt: "help",
    type: 'short',
    expectedAction: 'write',
    expectedTopic: 'help',
    shouldContain: ['help']
  },
  {
    name: "Very short - two words",
    prompt: "write article",
    type: 'short',
    expectedAction: 'write',
    expectedTopic: 'article',
    shouldContain: ['write', 'article']
  },
  {
    name: "Very long - 10000+ words",
    prompt: `Write a comprehensive research paper on artificial intelligence and machine learning, covering the history, current state, and future prospects of these technologies. Include detailed analysis of neural networks, deep learning, natural language processing, computer vision, reinforcement learning, and their applications across various industries such as healthcare, finance, transportation, education, and entertainment. Discuss the ethical implications, bias in AI systems, privacy concerns, job displacement, and regulatory frameworks. Examine case studies from leading tech companies, research institutions, and startups. Provide statistical data, charts, and references. The paper should be approximately 10000 words with at least 50 academic references, following APA format. Target audience: researchers, academics, and industry professionals. Tone: academic but accessible. Include an abstract, introduction, literature review, methodology, detailed analysis sections, discussion, recommendations, and conclusion. ${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(200)}`,
    type: 'long',
    expectedAction: 'write',
    expectedTopic: 'comprehensive research paper on artificial intelligence and machine learning',
    shouldContain: ['artificial intelligence', 'machine learning', '10000 words', 'research paper']
  }
]

export interface TestResult {
  testCase: PromptTestCase
  passed: boolean
  errors: string[]
  warnings: string[]
  parsed?: {
    action: string
    topic: string
    task: string
  }
  frameworkOutput?: string
  smartOutput?: string
}

/**
 * Test a single prompt case
 */
export async function testPromptCase(testCase: PromptTestCase): Promise<TestResult> {
  const result: TestResult = {
    testCase,
    passed: true,
    errors: [],
    warnings: []
  }

  try {
    // Handle empty/null prompts - skip some validations
    const isEmpty = !testCase.prompt || typeof testCase.prompt !== 'string' || testCase.prompt.trim().length === 0
    
    // Test 1: Intent extraction
    const intent = extractIntent(testCase.prompt || '')
    result.parsed = {
      action: intent.action,
      topic: intent.topic,
      task: `${intent.action} ${intent.topic}`
    }

    // Check expected action (skip for empty prompts)
    if (!isEmpty && testCase.expectedAction && !intent.action.toLowerCase().includes(testCase.expectedAction.toLowerCase())) {
      result.errors.push(`Expected action to contain "${testCase.expectedAction}", got "${intent.action}"`)
      result.passed = false
    }

    // Check expected topic (partial match, skip for empty prompts)
    if (!isEmpty && testCase.expectedTopic) {
      const topicLower = intent.topic.toLowerCase()
      const expectedLower = testCase.expectedTopic.toLowerCase()
      const topicWords = expectedLower.split(/\s+/).filter(w => w.length > 3)
      if (topicWords.length > 0) {
        const missingWords = topicWords.filter(word => !topicLower.includes(word))
        if (missingWords.length > topicWords.length / 2) {
          result.errors.push(`Expected topic to contain key words from "${testCase.expectedTopic}", got "${intent.topic}"`)
          result.passed = false
        }
      }
    }

    // Test 2: Framework output validation
    // We'll check the framework output instead of parsed prompt

    // Test 2: Framework application
    // For structured prompts, use a framework that includes Role (RACE or ROSES)
    // For other prompts, use CoT
    try {
      const frameworkType = testCase.type === 'structured' ? 'race' : 'cot'
      const frameworkOutput = await applyFramework(testCase.prompt, frameworkType)
      result.frameworkOutput = frameworkOutput.optimized
      
      // Check if output is meaningful (not empty, not just template)
      if (!frameworkOutput.optimized || frameworkOutput.optimized.length < 20) {
        result.warnings.push('Framework output seems too short')
      }
      
      // Check for framework keywords
      if (!frameworkOutput.optimized.match(/(Task|Action|Goal|Objective|Role|Context|Purpose|Expectation):/i)) {
        result.warnings.push('Framework output missing expected structure')
      }
      
      // Check shouldContain (skip for empty prompts or if shouldContain is empty)
      if (!isEmpty && testCase.shouldContain && testCase.shouldContain.length > 0) {
        const outputText = frameworkOutput.optimized.toLowerCase()
        const missing = testCase.shouldContain.filter(term => 
          term && term.trim().length > 0 && !outputText.includes(term.toLowerCase())
        )
        if (missing.length > 0) {
          result.errors.push(`Framework output should contain: ${missing.join(', ')}`)
          result.passed = false
        }
      }

      // Check shouldNotContain
      if (testCase.shouldNotContain) {
        const outputText = frameworkOutput.optimized.toLowerCase()
        const found = testCase.shouldNotContain.filter(term => 
          outputText.includes(term.toLowerCase())
        )
        if (found.length > 0) {
          result.errors.push(`Framework output should NOT contain: ${found.join(', ')}`)
          result.passed = false
        }
      }
    } catch (error) {
      result.errors.push(`Framework application failed: ${error}`)
      result.passed = false
    }

    // Test 4: Smart optimizer (if models available)
    try {
      const smartResult = await Promise.race([
        optimizePromptSmartly(testCase.prompt),
        new Promise<typeof smartResult>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        )
      ])
      result.smartOutput = smartResult.improvedPrompt
    } catch (error) {
      result.warnings.push(`Smart optimizer not available or timed out: ${error}`)
    }

  } catch (error) {
    result.errors.push(`Test failed with error: ${error}`)
    result.passed = false
  }

  return result
}

/**
 * Run all test cases
 */
export async function runAllTests(): Promise<{
  total: number
  passed: number
  failed: number
  results: TestResult[]
}> {
  const results: TestResult[] = []
  let passed = 0
  let failed = 0

  console.log(`\n🧪 Running ${PROMPT_TEST_CASES.length} prompt type tests...\n`)

  for (const testCase of PROMPT_TEST_CASES) {
    console.log(`Testing: ${testCase.name}...`)
    const result = await testPromptCase(testCase)
    results.push(result)
    
    if (result.passed) {
      passed++
      console.log(`  ✅ PASSED`)
    } else {
      failed++
      console.log(`  ❌ FAILED`)
      result.errors.forEach(err => console.log(`    Error: ${err}`))
    }
    if (result.warnings.length > 0) {
      result.warnings.forEach(warn => console.log(`    Warning: ${warn}`))
    }
  }

  console.log(`\n📊 Test Summary:`)
  console.log(`   Total: ${PROMPT_TEST_CASES.length}`)
  console.log(`   Passed: ${passed}`)
  console.log(`   Failed: ${failed}`)
  console.log(`   Success Rate: ${((passed / PROMPT_TEST_CASES.length) * 100).toFixed(1)}%\n`)

  return {
    total: PROMPT_TEST_CASES.length,
    passed,
    failed,
    results
  }
}

/**
 * Quick test for a specific prompt type
 */
export async function quickTest(prompt: string): Promise<{
  intent: ReturnType<typeof extractIntent>
  frameworkOutput?: Awaited<ReturnType<typeof applyFramework>>
  rankings?: Awaited<ReturnType<typeof rankFrameworks>>
}> {
  const intent = extractIntent(prompt)
  
  let frameworkOutput
  try {
    frameworkOutput = await applyFramework(prompt, 'cot')
  } catch (error) {
    console.warn('Framework application failed:', error)
  }
  
  let rankings
  try {
    rankings = await rankFrameworks(prompt)
  } catch (error) {
    console.warn('Framework ranking failed:', error)
  }

  return {
    intent,
    frameworkOutput,
    rankings
  }
}

