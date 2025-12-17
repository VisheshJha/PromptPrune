/**
 * Sensitive Content Detector
 * Detects PII and sensitive information in prompts using regex patterns
 */

export interface SensitiveContentResult {
  hasSensitiveContent: boolean
  detectedItems: Array<{
    type: string
    value: string
    severity: 'low' | 'medium' | 'high'
    position: number
    suggestion: string
  }>
  riskScore: number // 0-100
  shouldBlock: boolean
}

// Detection patterns - comprehensive coverage of sensitive data formats
// IMPORTANT: Order matters - check Aadhaar before phone to avoid conflicts
const DETECTION_PATTERNS = {
  email: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    severity: 'medium' as const,
    suggestion: '⚠️ Email address detected - Consider removing'
  },
  // Check Aadhaar patterns BEFORE phone to avoid 12-digit numbers being detected as phone
  aadhaar: {
    pattern: /\b(?:aadhaar|aadhar|uidai)\s*(?:number|no|#|id)?\s*[:=]?\s*\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 Aadhaar number detected - DO NOT SHARE - Critical identity theft risk (India)'
  },
  aadhaarStandalone: {
    // Standalone Aadhaar pattern - matches 12-digit numbers in Aadhaar format (with or without spaces/dashes)
    // Format: XXXX XXXX XXXX or XXXX-XXXX-XXXX or XXXXXXXXXXXX
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    severity: 'high' as const,
    suggestion: '🚨 Aadhaar number detected - DO NOT SHARE - Critical identity theft risk (India)'
  },
  phone: {
    // Enhanced phone pattern - handles all formats:
    // US: (123) 456-7890, 123-456-7890, 123.456.7890, 1234567890, +1-123-456-7890
    // International: +91-9876543210, +44 20 1234 5678, etc.
    // Made more strict to avoid false positives like "100 words"
    pattern: /\b(?:\+?\d{1,4}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g,
    severity: 'medium' as const,
    suggestion: '⚠️ Phone number detected - Consider removing'
  },
  ssn: {
    // SSN formats: 123-45-6789, 123 45 6789, 123456789
    pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
    severity: 'high' as const,
    suggestion: '🚨 SSN detected - DO NOT SHARE - This is highly sensitive'
  },
  creditCard: {
    // Credit card formats: 4532-1234-5678-9010, 4532 1234 5678 9010, 4532123456789010
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    severity: 'high' as const,
    suggestion: '🚨 Credit card number detected - DO NOT SHARE - Financial data leak risk'
  },
  bankAccount: {
    pattern: /\b(?:\d{8,17}|routing\s*[:=#]?\s*\d{9}|account\s*(?:number|#|num)?\s*[:=#]?\s*\d{8,})\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 Bank account/routing number detected - DO NOT SHARE - Financial data leak risk'
  },
  passport: {
    pattern: /\b(?:passport|passport\s*number|passport\s*#)\s*[:=]?\s*[A-Z0-9]{6,12}\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 Passport number detected - DO NOT SHARE - Identity theft risk'
  },
  driverLicense: {
    pattern: /\b(?:driver'?s?\s*license|dl|license\s*number|license\s*#)\s*[:=]?\s*[A-Z0-9]{6,12}\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 Driver license number detected - DO NOT SHARE - Identity theft risk'
  },
  ipAddress: {
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    severity: 'low' as const,
    suggestion: '⚠️ IP address detected - Consider removing if internal/private'
  },
  apiKey: {
    // Enhanced pattern to catch:
    // - Stripe: sk_test_, sk_live_, pk_test_, pk_live_, rk_test_, rk_live_
    // - OpenAI: sk-
    // - Google: AIza
    // - GitHub: ghp_, gho_, ghu_, ghs_, github_pat_
    // - Slack: xoxb-, xoxa-, xoxp-, xoxe-, xoxs-, xoxr-
    // - Generic: api_key=, apikey=, api-key=, Bearer tokens
    pattern: /\b(?:sk_(?:test|live)_[A-Za-z0-9]{24,}|pk_(?:test|live)_[A-Za-z0-9]{24,}|rk_(?:test|live)_[A-Za-z0-9]{24,}|sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{35,}|ghp_[A-Za-z0-9]{36,}|gho_[A-Za-z0-9]{36,}|ghu_[A-Za-z0-9]{36,}|ghs_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{82,}|xoxb-[A-Za-z0-9-]{50,}|xoxa-[A-Za-z0-9-]{50,}|xoxp-[A-Za-z0-9-]{50,}|xoxe-[A-Za-z0-9-]{50,}|xoxs-[A-Za-z0-9-]{50,}|xoxr-[A-Za-z0-9-]{50,}|Bearer\s+[A-Za-z0-9_-]{20,}|(?:api[_-]?key|apikey|api-key)\s*[:=]\s*['"]?[A-Za-z0-9_-]{20,}['"]?)\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 API key/token detected - NEVER SHARE - Security breach risk'
  },
  password: {
    pattern: /(?:password|pwd|pass|secret[_-]?key|private[_-]?key)\s*[:=]\s*['"]?[^\s'"]{8,}['"]?/gi,
    severity: 'high' as const,
    suggestion: '🚨 Password/secret key detected - DO NOT SHARE - Security breach risk'
  },
  jwt: {
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    severity: 'high' as const,
    suggestion: '🚨 JWT token detected - NEVER SHARE - Authentication token leak risk'
  },
  awsKey: {
    pattern: /\b(?:AKIA[0-9A-Z]{16}|aws[_-]?access[_-]?key|aws[_-]?secret[_-]?key)\s*[:=]\s*['"]?[A-Za-z0-9/+=]{20,}['"]?/gi,
    severity: 'high' as const,
    suggestion: '🚨 AWS credentials detected - NEVER SHARE - Cloud infrastructure breach risk'
  },
  privateKey: {
    pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]{50,}-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi,
    severity: 'high' as const,
    suggestion: '🚨 Private key detected - NEVER SHARE - Critical security breach risk'
  },
  databaseUrl: {
    pattern: /\b(?:postgresql|mysql|mongodb|redis|sqlite):\/\/[^\s]+/gi,
    severity: 'high' as const,
    suggestion: '🚨 Database connection string detected - NEVER SHARE - Data breach risk'
  },
  cryptoKey: {
    pattern: /\b(?:bitcoin|btc|ethereum|eth|wallet|private\s+key)\s*[:=]?\s*[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 Cryptocurrency wallet/private key detected - NEVER SHARE - Financial loss risk'
  },
  medicalRecord: {
    pattern: /\b(?:medical\s+record|patient\s+id|mrn|health\s+record)\s*[:=]?\s*[A-Z0-9]{6,}\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 Medical record/patient ID detected - DO NOT SHARE - HIPAA violation risk'
  },
  windowsKey: {
    pattern: /\b(?:windows\s*(?:activation|product|license|serial)\s*key|activation\s*key|product\s*key|license\s*key|serial\s*key)\s*[:=]?\s*([A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5})\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 Windows activation key detected - DO NOT SHARE - Software license violation risk'
  },
  productKey: {
    pattern: /\b([A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5})\b/g,
    severity: 'high' as const,
    suggestion: '🚨 Product/activation key detected - DO NOT SHARE - Software license violation risk'
  },
  taxId: {
    pattern: /\b(?:tax\s+id|ein|employer\s+identification|tin)\s*[:=]?\s*\d{2}-?\d{7}\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 Tax ID/EIN detected - DO NOT SHARE - Business identity theft risk'
  },
  // India-specific identifiers - CHECK BEFORE PHONE to avoid conflicts
  aadhaar: {
    pattern: /\b(?:aadhaar|aadhar|uidai)\s*(?:number|no|#|id)?\s*[:=]?\s*\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 Aadhaar number detected - DO NOT SHARE - Critical identity theft risk (India)'
  },
  aadhaarStandalone: {
    // Standalone Aadhaar pattern - matches 12-digit numbers in Aadhaar format (with or without spaces/dashes)
    // Format: XXXX XXXX XXXX or XXXX-XXXX-XXXX or XXXXXXXXXXXX
    // IMPORTANT: This must be checked BEFORE phone pattern to avoid 12-digit numbers being detected as phone
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    severity: 'high' as const,
    suggestion: '🚨 Aadhaar number detected - DO NOT SHARE - Critical identity theft risk (India)'
  },
  pan: {
    pattern: /\b(?:pan|permanent\s+account\s+number|pan\s+card|pan\s+number)\s*[:=,\s"']*\s*[A-Z]{5}\d{4}[A-Z]\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 PAN card number detected - DO NOT SHARE - Tax identity theft risk (India)'
  },
  panStandalone: {
    // Standalone PAN pattern - matches PAN format without requiring "PAN" keyword
    // Format: 5 letters (case-insensitive) + 4 digits + 1 letter (case-insensitive)
    pattern: /\b[A-Za-z]{5}\d{4}[A-Za-z]\b/g,
    severity: 'high' as const,
    suggestion: '🚨 PAN card number detected - DO NOT SHARE - Tax identity theft risk (India)'
  },
  voterId: {
    pattern: /\b(?:voter\s+id|epic|electoral\s+photo\s+identity\s+card|voter\s+card)\s*(?:number|no|#)?\s*[:=]?\s*[A-Z]{3}\d{7}\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 Voter ID/EPIC number detected - DO NOT SHARE - Identity theft risk (India)'
  },
  ifsc: {
    // IFSC with keyword
    pattern: /\b(?:ifsc|ifsc\s+code)\s*[:=]?\s*[A-Z]{4}0[A-Z0-9]{6}\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 IFSC code detected - DO NOT SHARE - Bank account exposure risk (India)'
  },
  ifscStandalone: {
    // Standalone IFSC pattern - matches format without keyword
    pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
    severity: 'high' as const,
    suggestion: '🚨 IFSC code detected - DO NOT SHARE - Bank account exposure risk (India)'
  },
  upiId: {
    // UPI ID with keyword
    pattern: /\b(?:upi|upi\s+id|upi\s+handle|vpa|virtual\s+payment\s+address)\s*[:=]?\s*[a-zA-Z0-9._-]+@(?:paytm|ybl|okaxis|axl|ibl|upi|phonepe|gpay|amazonpay)\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 UPI ID detected - DO NOT SHARE - Financial fraud risk (India)'
  },
  upiIdStandalone: {
    // Standalone UPI ID pattern - matches format without keyword
    pattern: /\b[a-zA-Z0-9._-]+@(?:paytm|ybl|okaxis|axl|ibl|upi|phonepe|gpay|amazonpay)\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 UPI ID detected - DO NOT SHARE - Financial fraud risk (India)'
  },
  gstin: {
    pattern: /\b(?:gstin|gst\s+number|gst\s+id)\s*[:=]?\s*\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 GSTIN detected - DO NOT SHARE - Business tax identity exposure (India)'
  },
  indianBankAccount: {
    pattern: /\b(?:account\s+number|account\s+no|acc\s+no|savings\s+account|current\s+account)\s*(?:number|no|#)?\s*[:=]?\s*\d{9,18}\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 Bank account number detected - DO NOT SHARE - Financial fraud risk (India)'
  },
  indianPhone: {
    pattern: /\b(?:\+91[-.\s]?|91[-.\s]?|0)?[6-9]\d{9}\b/g,
    severity: 'medium' as const,
    suggestion: '⚠️ Indian phone number detected - Consider removing for privacy'
  }
}

// Custom sensitive keywords - expanded list
const SENSITIVE_KEYWORDS = [
  { keyword: 'confidential', severity: 'high' as const, suggestion: '🚨 Confidential information detected - Data leak risk' },
  { keyword: 'internal use only', severity: 'high' as const, suggestion: '🚨 Internal-only information detected - Data leak risk' },
  { keyword: 'proprietary', severity: 'high' as const, suggestion: '🚨 Proprietary information detected - Trade secret leak risk' },
  { keyword: 'classified', severity: 'high' as const, suggestion: '🚨 Classified information detected - Security breach risk' },
  { keyword: 'secret', severity: 'high' as const, suggestion: '🚨 Secret information detected - Data leak risk' },
  { keyword: 'nda', severity: 'high' as const, suggestion: '🚨 NDA-related content detected - Legal violation risk' },
  { keyword: 'non-disclosure', severity: 'high' as const, suggestion: '🚨 Non-disclosure content detected - Legal violation risk' },
  { keyword: 'trade secret', severity: 'high' as const, suggestion: '🚨 Trade secret detected - Intellectual property leak risk' },
  { keyword: 'customer data', severity: 'high' as const, suggestion: '🚨 Customer data detected - GDPR/privacy violation risk' },
  { keyword: 'personal information', severity: 'high' as const, suggestion: '🚨 Personal information detected - Privacy violation risk' },
  { keyword: 'pii', severity: 'high' as const, suggestion: '🚨 PII (Personally Identifiable Information) detected - Privacy violation risk' },
  { keyword: 'phi', severity: 'high' as const, suggestion: '🚨 PHI (Protected Health Information) detected - HIPAA violation risk' },
  { keyword: 'source code', severity: 'medium' as const, suggestion: '⚠️ Source code detected - Intellectual property risk' },
  { keyword: 'sourcecode', severity: 'medium' as const, suggestion: '⚠️ Source code detected - Intellectual property risk' },
  { keyword: 'algorithm', severity: 'medium' as const, suggestion: '⚠️ Algorithm details detected - Intellectual property risk' },
  { keyword: 'business plan', severity: 'high' as const, suggestion: '🚨 Business plan detected - Competitive intelligence leak risk' },
  { keyword: 'financial statement', severity: 'high' as const, suggestion: '🚨 Financial statement detected - Financial data leak risk' },
  { keyword: 'revenue', severity: 'medium' as const, suggestion: '⚠️ Financial data detected - Consider removing specific numbers' },
  { keyword: 'salary', severity: 'medium' as const, suggestion: '⚠️ Salary information detected - Privacy risk' },
  { keyword: 'employee id', severity: 'medium' as const, suggestion: '⚠️ Employee ID detected - Privacy risk' },
  { keyword: 'social security', severity: 'high' as const, suggestion: '🚨 Social Security number context detected - Identity theft risk' },
  // India-specific sensitive keywords
  { keyword: 'aadhaar', severity: 'high' as const, suggestion: '🚨 Aadhaar number context detected - Critical identity theft risk (India)' },
  { keyword: 'pan card', severity: 'high' as const, suggestion: '🚨 PAN card context detected - Tax identity theft risk (India)' },
  { keyword: 'voter id', severity: 'high' as const, suggestion: '🚨 Voter ID context detected - Identity theft risk (India)' },
  { keyword: 'ifsc', severity: 'high' as const, suggestion: '🚨 IFSC code context detected - Bank account exposure risk (India)' },
  { keyword: 'upi', severity: 'high' as const, suggestion: '🚨 UPI ID context detected - Financial fraud risk (India)' },
  { keyword: 'gstin', severity: 'high' as const, suggestion: '🚨 GSTIN context detected - Business tax identity exposure (India)' },
  { keyword: 'gst number', severity: 'high' as const, suggestion: '🚨 GST number context detected - Business tax identity exposure (India)' },
  { keyword: 'icici bank', severity: 'medium' as const, suggestion: '⚠️ Bank name with account details detected - Financial data leak risk' },
  { keyword: 'sbi', severity: 'medium' as const, suggestion: '⚠️ Bank name with account details detected - Financial data leak risk' },
  { keyword: 'hdfc', severity: 'medium' as const, suggestion: '⚠️ Bank name with account details detected - Financial data leak risk' },
  { keyword: 'axis bank', severity: 'medium' as const, suggestion: '⚠️ Bank name with account details detected - Financial data leak risk' },
  { keyword: 'reliance retail', severity: 'high' as const, suggestion: '🚨 Company-specific confidential information detected - Competitive intelligence leak risk' },
  { keyword: 'ondc', severity: 'high' as const, suggestion: '🚨 Government/ONDC project context detected - Confidential project leak risk (India)' },
  { keyword: 'npci', severity: 'high' as const, suggestion: '🚨 NPCI context detected - Financial infrastructure leak risk (India)' },
  { keyword: 'rbi', severity: 'high' as const, suggestion: '🚨 RBI context detected - Regulatory/financial leak risk (India)' },
  { keyword: 'smart city', severity: 'high' as const, suggestion: '🚨 Smart City project context detected - Government contract leak risk (India)' },
  { keyword: 'jiomart', severity: 'high' as const, suggestion: '🚨 Internal expansion strategy detected - Competitive intelligence leak risk' },
  { keyword: 'flipkart', severity: 'high' as const, suggestion: '🚨 Competitive strategy context detected - Business intelligence leak risk' },
  { keyword: 'delhivery', severity: 'medium' as const, suggestion: '⚠️ Partner/vendor information detected - Business relationship leak risk' },
  { keyword: 'maharashtra', severity: 'medium' as const, suggestion: '⚠️ Regional business data detected - Geographic business intelligence leak risk' },
  { keyword: 'q3 revenue', severity: 'high' as const, suggestion: '🚨 Unreleased financial data detected - Financial leak risk' },
  { keyword: 'quarterly revenue', severity: 'high' as const, suggestion: '🚨 Unreleased financial data detected - Financial leak risk' },
  { keyword: 'supplier churn', severity: 'high' as const, suggestion: '🚨 Supplier/vendor data detected - Business relationship leak risk' },
  { keyword: 'proprietary algorithm', severity: 'high' as const, suggestion: '🚨 Proprietary algorithm detected - Intellectual property leak risk' },
  { keyword: 'proprietary logistics', severity: 'high' as const, suggestion: '🚨 Proprietary logistics system detected - Trade secret leak risk' },
  { keyword: 'board memo', severity: 'high' as const, suggestion: '🚨 Board memo context detected - Executive/strategic leak risk' },
  { keyword: 'internal memo', severity: 'high' as const, suggestion: '🚨 Internal memo context detected - Confidential communication leak risk' },
  { keyword: 'project horizon', severity: 'high' as const, suggestion: '🚨 Internal project name detected - Confidential project leak risk' },
  { keyword: 'ayushman bharat', severity: 'high' as const, suggestion: '🚨 Ayushman Bharat/medical claim context detected - HIPAA/medical data leak risk (India)' },
  { keyword: 'hospital discharge', severity: 'high' as const, suggestion: '🚨 Hospital discharge summary detected - Medical record leak risk (India)' }
]

export function detectSensitiveContent(text: string): SensitiveContentResult {
  const detectedItems: SensitiveContentResult['detectedItems'] = []
  let riskScore = 0

  console.log('[SensitiveContentDetector] Checking text:', text.substring(0, 100))

  // Check each pattern
  for (const [type, config] of Object.entries(DETECTION_PATTERNS)) {
    // Reset regex lastIndex to avoid issues with global regex
    config.pattern.lastIndex = 0
    const matches = Array.from(text.matchAll(config.pattern))

    if (matches.length > 0 && (type === 'pan' || type.includes('pan'))) {
      console.log(`[SensitiveContentDetector] PAN pattern matched ${matches.length} times:`, matches.map(m => ({ match: m[0], index: m.index })))
    }

    for (const match of matches) {
      const isValid = isValidMatch(type, match[0], text, match.index || 0)
      if (type === 'pan' || type.includes('pan')) {
        console.log(`[SensitiveContentDetector] PAN match validation:`, {
          type,
          match: match[0],
          index: match.index,
          isValid,
          fullText: text.substring(Math.max(0, (match.index || 0) - 20), (match.index || 0) + 50)
        })
      }

      // Validate match (some patterns may have false positives)
      if (isValid) {
        detectedItems.push({
          type,
          value: maskSensitiveValue(type, match[0]),
          severity: config.severity,
          position: match.index || 0,
          suggestion: config.suggestion
        })

        // Calculate risk score
        if (config.severity === 'high') riskScore += 30
        else if (config.severity === 'medium') riskScore += 15
        else riskScore += 5
      }
    }
  }

  // Check for sensitive keywords with context awareness
  const lowerText = text.toLowerCase()
  for (const config of SENSITIVE_KEYWORDS) {
    const keywordLower = config.keyword.toLowerCase()
    const keywordIndex = lowerText.indexOf(keywordLower)
    
    if (keywordIndex >= 0) {
      // Context-aware validation to avoid false positives
      // Extract context around the keyword (50 chars before and after)
      const contextStart = Math.max(0, keywordIndex - 50)
      const contextEnd = Math.min(lowerText.length, keywordIndex + keywordLower.length + 50)
      const context = lowerText.substring(contextStart, contextEnd)
      
      // Skip if keyword appears in common non-sensitive phrases
      const falsePositivePatterns = [
        // Common phrases that contain sensitive keywords but aren't sensitive
        /\b(?:write|create|generate|make|draft|compose)\s+(?:an?\s+)?(?:email|letter|message|note|draft|article|blog|post|content|story|narrative|guide|tutorial|summary|outline|presentation|code|script|function|prompt)\b/i,
        /\b(?:i\s+am|i'm|we\s+are|we're)\s+(?:a\s+)?(?:sales\s+rep|representative|employee|worker|developer|writer|analyst|manager|director)\b/i,
        /\b(?:in\s+)?(?:ml\s+company|machine\s+learning\s+company|ai\s+company|tech\s+company)\b/i,
        /\b(?:targeting|target|focusing\s+on|aiming\s+at)\s+(?:startups|companies|businesses|clients|customers)\b/i,
        /\b(?:in\s+)?(?:india|indian|india's)\b/i,
        /\b(?:write|create|generate|make|draft|compose)\s+(?:a\s+)?(?:perfect|perfext|good|great|excellent|high-quality)\s+(?:prompt|email|letter|message|note|draft|article|blog|post|content|story|narrative|guide|tutorial|summary|outline|presentation|code|script|function)\b/i,
        /\b(?:on\s+)?(?:click|clock|button|action)\s+(?:of|to|for)\s+(?:optimize|optimise|optimization|optimisation)\b/i,
        /\b(?:in\s+)?(?:case\s+of|for|regarding|about)\s+(?:this|the|a|an)\s+(?:extension|plugin|addon|tool|application|app|software|program)\b/i,
        /\b(?:context|role|expectation|action|tone|examples?)\s*[:=]\s*/i,
        /\b(?:standard|normal|common|typical|general)\s+(?:context|example|case|scenario|situation)\b/i,
        /\b(?:you\s+are|you're|acting\s+as|role\s+is)\s+(?:an?\s+)?(?:expert|specialist|professional|developer|writer|analyst|rep|representative|manager|director|assistant|helper|advisor)\b/i,
        /\b(?:high-quality|complete|comprehensive|detailed|thorough)\s+(?:output|result|response|answer|content|work|product|deliverable)\b/i,
      ]
      
      // Check if keyword is in a false positive context
      const isFalsePositive = falsePositivePatterns.some(pattern => pattern.test(context))
      
      // Additional checks for specific keywords
      if (keywordLower === 'secret' && /\b(?:secret\s+(?:key|password|token|code|algorithm|formula|recipe|sauce|sauce|sauce))\b/i.test(context)) {
        // "secret key", "secret password" etc. are sensitive, but just "secret" in other contexts might not be
        // This is already handled by the password pattern, so we can skip standalone "secret" in non-sensitive contexts
        if (!/\b(?:secret\s+(?:key|password|token|code|algorithm|formula))\b/i.test(context)) {
          // Skip if it's just "secret" without sensitive context
          continue
        }
      }
      
      // Skip if it's a false positive
      if (isFalsePositive) {
        continue
      }
      
      // For certain keywords, require additional context to be truly sensitive
      const requiresContext = ['revenue', 'algorithm', 'source code', 'sourcecode']
      if (requiresContext.includes(keywordLower)) {
        // These keywords need to be in a context that suggests actual sensitive data
        const sensitiveContextPatterns = [
          /\b(?:actual|real|specific|exact|current|recent|last|this|our|their|my|your)\s+(?:revenue|algorithm|source\s+code)\b/i,
          /\b(?:revenue|algorithm|source\s+code)\s+(?:is|was|are|were|of|for|from|to|in|at|by|with)\s+(?:\d+|specific|actual|real|exact|current|recent|last|this|our|their|my|your)\b/i,
        ]
        const hasSensitiveContext = sensitiveContextPatterns.some(pattern => pattern.test(context))
        if (!hasSensitiveContext) {
          continue
        }
      }
      
      detectedItems.push({
        type: 'sensitive_keyword',
        value: config.keyword,
        severity: config.severity,
        position: keywordIndex,
        suggestion: config.suggestion
      })
      // Calculate risk score based on severity
      if (config.severity === 'high') riskScore += 25
      else if (config.severity === 'medium') riskScore += 15
      else riskScore += 5
    }
  }

  // Cap risk score at 100
  riskScore = Math.min(100, riskScore)

  return {
    hasSensitiveContent: detectedItems.length > 0,
    detectedItems,
    riskScore,
    shouldBlock: riskScore >= 50 // Block if high risk
  }
}

// Mask sensitive values for display
function maskSensitiveValue(type: string, value: string): string {
  switch (type) {
    case 'email':
      const [local, domain] = value.split('@')
      return `${local[0]}***@${domain}`
    case 'phone':
      return value.replace(/\d/g, '*').replace(/\*{4,}/, '****')
    case 'ssn':
    case 'creditCard':
    case 'bankAccount':
      return '****-****-****'
    case 'apiKey':
    case 'jwt':
    case 'awsKey':
    case 'password':
      return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
    case 'passport':
    case 'driverLicense':
    case 'taxId':
    case 'medicalRecord':
      return value.substring(0, 2) + '***' + value.substring(value.length - 2)
    case 'privateKey':
      return '-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----'
    case 'databaseUrl':
      // Mask credentials in URL
      try {
        const url = new URL(value)
        return `${url.protocol}//***:***@${url.hostname}${url.pathname}`
      } catch {
        return '***://***:***@***'
      }
    case 'cryptoKey':
      return value.substring(0, 4) + '***' + value.substring(value.length - 4)
    case 'aadhaar':
    case 'aadhaarStandalone':
      // Mask Aadhaar: 5678-1234-5678 -> 5678-XXXX-XXXX
      const aadhaarDigits = value.replace(/\D/g, '')
      if (aadhaarDigits.length === 12) {
        return `${aadhaarDigits.substring(0, 4)}-XXXX-XXXX`
      }
      return 'XXXX-XXXX-XXXX'
    case 'pan':
    case 'panStandalone':
      // Mask PAN: ABCDE1234F -> ABCDE****F (case-insensitive)
      const panValue = value.toUpperCase()
      if (panValue.length === 10) {
        return `${panValue.substring(0, 5)}****${panValue.substring(9)}`
      }
      return '*****'
    case 'voterId':
      // Mask Voter ID: ABC1234567 -> ABC****567
      if (value.length === 10) {
        return `${value.substring(0, 3)}****${value.substring(7)}`
      }
      return '***'
    case 'ifsc':
    case 'ifscStandalone':
      // Mask IFSC: HDFC0001234 -> HDFC****34
      if (value.length === 11) {
        return `${value.substring(0, 4)}****${value.substring(9)}`
      }
      return '****'
    case 'upiId':
    case 'upiIdStandalone':
      // Mask UPI: username@paytm -> user***@paytm
      if (value.includes('@')) {
        const [local, domain] = value.split('@')
        return `${local.substring(0, 3)}***@${domain}`
      }
      return '***@***'
    case 'gstin':
      // Mask GSTIN: 27AABCU9603R1ZM -> 27AAB******1ZM
      if (value.length === 15) {
        return `${value.substring(0, 5)}******${value.substring(11)}`
      }
      return '****'
    case 'indianBankAccount':
      // Mask account: 1234567890 -> 1234****90
      const accountDigits = value.replace(/\D/g, '')
      if (accountDigits.length >= 9) {
        return `${accountDigits.substring(0, 4)}****${accountDigits.substring(accountDigits.length - 2)}`
      }
      return '****'
    case 'indianPhone':
      // Mask phone: 9876543210 -> 98765****0
      const phoneDigits = value.replace(/\D/g, '')
      if (phoneDigits.length === 10) {
        return `${phoneDigits.substring(0, 5)}****${phoneDigits.substring(9)}`
      }
      return '****'
    default:
      return value.substring(0, 4) + '***'
  }
}

// Validate matches to reduce false positives
function isValidMatch(type: string, value: string, fullText: string, position: number): boolean {
  switch (type) {
    case 'ssn':
      // SSN must have dashes OR be in context that suggests it's an SSN
      // Pattern matches both "123-45-6789" and "123456789", but we want to prefer dashed format
      if (value.includes('-')) {
        // Has dashes - definitely an SSN
        return true
      }
      // No dashes - check context to see if it's mentioned as SSN
      const ssnContext = fullText.substring(Math.max(0, position - 50), position + 50).toLowerCase()
      return /ssn|social\s*security|social\s*security\s*number|ss#|ss\s*number/.test(ssnContext)
    case 'ipAddress':
      // Check if it's a valid IP (not just 4 numbers)
      const parts = value.split('.')
      return parts.every(p => {
        const num = parseInt(p)
        return num >= 0 && num <= 255
      })
    case 'creditCard':
      // Luhn algorithm check (basic)
      return isValidCreditCard(value.replace(/\D/g, ''))
    case 'bankAccount':
      // Context check - if near "account", "routing", "bank", etc., it's likely a bank account
      const context = fullText.substring(Math.max(0, position - 50), position + 50).toLowerCase()
      // If context mentions account/bank/routing, it's likely a bank account
      if (/account|routing|bank|checking|saving|number|num/.test(context)) {
        return true
      }
      // Also accept standalone 8-17 digit numbers (common bank account length)
      // But be more strict - require it to be near financial keywords
      const valueDigits = value.replace(/\D/g, '')
      if (valueDigits.length >= 8 && valueDigits.length <= 17) {
        // Additional check: if it's near financial keywords, it's likely a bank account
        const extendedContext = fullText.substring(Math.max(0, position - 100), position + 100).toLowerCase()
        return /account|bank|financial|checking|saving|deposit|withdraw|balance|statement/.test(extendedContext)
      }
      return false
    case 'passport':
    case 'driverLicense':
      // Context check - must be near relevant keywords
      const idContext = fullText.substring(Math.max(0, position - 30), position + 30).toLowerCase()
      return /passport|license|driver|dl|id|identification/.test(idContext)
    case 'taxId':
      // Context check - must be near tax/EIN keywords
      const taxContext = fullText.substring(Math.max(0, position - 30), position + 30).toLowerCase()
      return /tax|ein|employer|identification|tin/.test(taxContext)
    case 'medicalRecord':
      // Context check - must be near medical keywords
      const medicalContext = fullText.substring(Math.max(0, position - 30), position + 30).toLowerCase()
      return /medical|patient|health|record|mrn/.test(medicalContext)
    case 'aadhaar':
      // Aadhaar must be in context mentioning aadhaar/uidai
      const aadhaarContext = fullText.substring(Math.max(0, position - 50), position + 50).toLowerCase()
      return /aadhaar|aadhar|uidai|unique\s+id/.test(aadhaarContext)
    case 'aadhaarStandalone':
      // Standalone Aadhaar: Must be exactly 12 digits (with or without separators)
      // Extract digits only
      const aadhaarDigits = value.replace(/\D/g, '')
      if (aadhaarDigits.length !== 12) {
        return false
      }
      // Check if it's in context mentioning aadhaar/uidai (preferred)
      const standaloneAadhaarContext = fullText.substring(Math.max(0, position - 50), position + 50).toLowerCase()
      if (/aadhaar|aadhar|uidai|unique\s+id/.test(standaloneAadhaarContext)) {
        return true
      }
      // Also accept standalone 12-digit numbers as potential Aadhaar (high risk)
      // Aadhaar numbers are always 12 digits, so any 12-digit number could be Aadhaar
      return true
    case 'pan':
      // Extract PAN number from match (might include "PAN number " prefix)
      // Look for the actual PAN format: 5 letters + 4 digits + 1 letter
      const panNumberMatch = value.match(/[A-Z]{5}\d{4}[A-Z]/)
      if (panNumberMatch) {
        const panNumber = panNumberMatch[0]
        // Validate PAN format
        if (/^[A-Z]{5}\d{4}[A-Z]$/.test(panNumber)) {
          return true
        }
      }
      // Or check if full value matches PAN format (standalone PAN)
      const fullPanMatch = value.match(/^[A-Z]{5}\d{4}[A-Z]$/)
      if (fullPanMatch) return true
      // Or in context mentioning PAN
      const panContext = fullText.substring(Math.max(0, position - 50), position + 50).toLowerCase()
      return /pan|permanent\s+account|pan\s+card/.test(panContext)
    case 'voterId':
      // Voter ID must match format: 3 letters + 7 digits
      const voterMatch = value.match(/^[A-Z]{3}\d{7}$/)
      if (voterMatch) return true
      // Or in context mentioning voter ID
      const voterContext = fullText.substring(Math.max(0, position - 50), position + 50).toLowerCase()
      return /voter|epic|electoral/.test(voterContext)
    case 'voterIdStandalone':
      // Standalone Voter ID: Must match format exactly (3 letters + 7 digits)
      return /^[A-Z]{3}\d{7}$/.test(value)
    case 'ifscStandalone':
      // Standalone IFSC: Must match format exactly (4 letters + 0 + 6 alphanumeric)
      return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value)
    case 'upiIdStandalone':
      // Standalone UPI ID: Must have @ symbol and valid domain
      return value.includes('@') && /@(paytm|ybl|okaxis|axl|ibl|upi|phonepe|gpay|amazonpay)/i.test(value)
    case 'ifsc':
    case 'ifscStandalone':
      // IFSC must match format: 4 letters + 0 + 6 alphanumeric
      const ifscMatch = value.match(/^[A-Z]{4}0[A-Z0-9]{6}$/)
      return ifscMatch !== null
    case 'ifscStandalone':
      // Standalone IFSC: Must match format exactly (4 letters + 0 + 6 alphanumeric)
      return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value)
    case 'upiIdStandalone':
      // Standalone UPI ID: Must have @ symbol and valid domain
      return value.includes('@') && /@(paytm|ybl|okaxis|axl|ibl|upi|phonepe|gpay|amazonpay)/i.test(value)
    case 'voterIdStandalone':
      // Standalone Voter ID: Must match format exactly (3 letters + 7 digits)
      return /^[A-Z]{3}\d{7}$/.test(value)
    case 'upiId':
    case 'upiIdStandalone':
      // UPI ID must have @ symbol and valid domain
      return value.includes('@') && /@(paytm|ybl|okaxis|axl|ibl|upi|phonepe|gpay|amazonpay)/i.test(value)
    case 'gstin':
      // GSTIN must match exact format: 2 digits + 5 letters + 4 digits + 1 letter + 1 char + Z + 1 char
      const gstinMatch = value.match(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/)
      return gstinMatch !== null
    case 'indianBankAccount':
      // Bank account must be in context mentioning account/bank
      const bankContext = fullText.substring(Math.max(0, position - 50), position + 50).toLowerCase()
      return /account|bank|savings|current|acc\s+no/.test(bankContext)
    case 'phone':
      // Phone number validation - must have proper format and context
      const phoneDigits = value.replace(/\D/g, '')
      
      // Exclude 12-digit numbers (could be Aadhaar)
      if (phoneDigits.length === 12) {
        return false
      }
      
      // Exclude short numbers like "100" (common in "100 words", "100 pages", etc.)
      if (phoneDigits.length <= 3) {
        // Only accept if it's clearly a phone number with context
        const phoneContext = fullText.substring(Math.max(0, position - 50), position + 50).toLowerCase()
        const hasPhoneKeywords = /phone|mobile|contact|call|whatsapp|ph\s*no|ph\s*number|telephone|tel|dial/.test(phoneContext)
        // Also check if it's followed by common non-phone words
        const afterMatch = fullText.substring(position, position + 20).toLowerCase()
        const hasNonPhoneWords = /\b(words|pages|items|times|percent|%|dollars|\$|years|months|days)\b/.test(afterMatch)
        
        // If it's a short number and has non-phone words after it, it's not a phone
        if (hasNonPhoneWords && !hasPhoneKeywords) {
          return false
        }
        
        // Short numbers need strong phone context
        return hasPhoneKeywords
      }
      
      // For longer numbers, require minimum length and context
      if (phoneDigits.length >= 7) {
        // Check context - if near "phone", "mobile", "contact", etc., it's likely a phone number
        const phoneContext = fullText.substring(Math.max(0, position - 50), position + 50).toLowerCase()
        const hasPhoneKeywords = /phone|mobile|contact|number|call|whatsapp|ph\s*no|ph\s*number|telephone|tel|dial/.test(phoneContext)
        
        // Check if it's followed by common non-phone words
        const afterMatch = fullText.substring(position, position + 20).toLowerCase()
        const hasNonPhoneWords = /\b(words|pages|items|times|percent|%|dollars|\$|years|months|days)\b/.test(afterMatch)
        
        // If it has non-phone words after it and no phone keywords, it's not a phone
        if (hasNonPhoneWords && !hasPhoneKeywords) {
          return false
        }
        
        // If it has phone keywords, it's likely a phone
        if (hasPhoneKeywords) {
          return true
        }
        
        // For numbers 10+ digits without context, accept them (could be international)
        if (phoneDigits.length >= 10) {
          return true
        }
      }
      
      return false
    case 'indianPhone':
      // Indian phone must start with 6-9 and be 10 digits (excluding country code)
      const indianPhoneDigits = value.replace(/\D/g, '')
      
      // CRITICAL: Exclude 12-digit numbers (these are Aadhaar, not phone)
      if (indianPhoneDigits.length === 12) {
        return false
      }
      
      // Remove country code if present (+91, 91, or leading 0)
      let cleanPhone = indianPhoneDigits
      if (indianPhoneDigits.startsWith('91') && indianPhoneDigits.length > 10) {
        cleanPhone = indianPhoneDigits.substring(2) // Remove 91 country code
      } else if (indianPhoneDigits.startsWith('0') && indianPhoneDigits.length > 10) {
        cleanPhone = indianPhoneDigits.substring(1) // Remove leading 0
      }

      // Must be exactly 10 digits and start with 6-9
      if (cleanPhone.length === 10 && /^[6-9]/.test(cleanPhone)) {
        // Check context - if near "phone", "mobile", "contact", "ph", "no", it's likely a phone number
        const phoneContext = fullText.substring(Math.max(0, position - 50), position + 50).toLowerCase()
        return /phone|mobile|contact|number|call|whatsapp|ph\s*no|ph\s*number|telephone|tel/.test(phoneContext)
      }
      return false
    case 'windowsKey':
      // Windows key must be in context mentioning windows/activation/product/license
      const windowsContext = fullText.substring(Math.max(0, position - 100), position + 100).toLowerCase()
      return /windows|activation|product\s*key|license\s*key|serial\s*key|activation\s*key/.test(windowsContext)
    case 'productKey':
      // Product key must be in context mentioning key/activation/license/product
      const productContext = fullText.substring(Math.max(0, position - 100), position + 100).toLowerCase()
      return /key|activation|license|product|serial|windows|office|software/.test(productContext)
    default:
      return true
  }
}

// Basic Luhn algorithm for credit card validation
function isValidCreditCard(number: string): boolean {
  if (number.length < 13 || number.length > 19) return false

  let sum = 0
  let isEven = false
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = parseInt(number[i])
    if (isEven) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    isEven = !isEven
  }
  return sum % 10 === 0
}

