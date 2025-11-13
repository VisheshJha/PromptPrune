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
const DETECTION_PATTERNS = {
  email: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    severity: 'medium' as const,
    suggestion: '⚠️ Email address detected - Consider removing'
  },
  phone: {
    pattern: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    severity: 'medium' as const,
    suggestion: '⚠️ Phone number detected - Consider removing'
  },
  ssn: {
    pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
    severity: 'high' as const,
    suggestion: '🚨 SSN detected - DO NOT SHARE - This is highly sensitive'
  },
  creditCard: {
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
    pattern: /\b(?:sk-|pk_|sk_live_|pk_live_|AIza|ghp_|gho_|ghu_|ghs_|xoxb-|xoxa-|xoxp-|xoxe-|xoxs-|xoxr-|Bearer\s+[A-Za-z0-9]{20,}|api[_-]?key\s*[:=]\s*['"]?[A-Za-z0-9]{20,}['"]?)\b/gi,
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
  taxId: {
    pattern: /\b(?:tax\s+id|ein|employer\s+identification|tin)\s*[:=]?\s*\d{2}-?\d{7}\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 Tax ID/EIN detected - DO NOT SHARE - Business identity theft risk'
  },
  // India-specific identifiers
  aadhaar: {
    pattern: /\b(?:aadhaar|aadhar|uidai)\s*(?:number|no|#|id)?\s*[:=]?\s*\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 Aadhaar number detected - DO NOT SHARE - Critical identity theft risk (India)'
  },
  pan: {
    pattern: /\b(?:pan|permanent\s+account\s+number|pan\s+card|pan\s+number)\s*[:=]?\s*[A-Z]{5}\d{4}[A-Z]\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 PAN card number detected - DO NOT SHARE - Tax identity theft risk (India)'
  },
  voterId: {
    pattern: /\b(?:voter\s+id|epic|electoral\s+photo\s+identity\s+card|voter\s+card)\s*(?:number|no|#)?\s*[:=]?\s*[A-Z]{3}\d{7}\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 Voter ID/EPIC number detected - DO NOT SHARE - Identity theft risk (India)'
  },
  ifsc: {
    pattern: /\b(?:ifsc|ifsc\s+code)\s*[:=]?\s*[A-Z]{4}0[A-Z0-9]{6}\b/gi,
    severity: 'high' as const,
    suggestion: '🚨 IFSC code detected - DO NOT SHARE - Bank account exposure risk (India)'
  },
  upiId: {
    pattern: /\b(?:upi|upi\s+id|upi\s+handle|vpa|virtual\s+payment\s+address)\s*[:=]?\s*[a-zA-Z0-9._-]+@(?:paytm|ybl|okaxis|axl|ibl|upi|phonepe|gpay|amazonpay)\b/gi,
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
    pattern: /\b(?:\+91|91|0)?[6-9]\d{9}\b/g,
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

  // Check each pattern
  for (const [type, config] of Object.entries(DETECTION_PATTERNS)) {
    // Reset regex lastIndex to avoid issues with global regex
    config.pattern.lastIndex = 0
    const matches = text.matchAll(config.pattern)
    
    for (const match of matches) {
      // Validate match (some patterns may have false positives)
      if (isValidMatch(type, match[0], text, match.index || 0)) {
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

  // Check for sensitive keywords
  const lowerText = text.toLowerCase()
  for (const config of SENSITIVE_KEYWORDS) {
    const keywordLower = config.keyword.toLowerCase()
    if (lowerText.includes(keywordLower)) {
      detectedItems.push({
        type: 'sensitive_keyword',
        value: config.keyword,
        severity: config.severity,
        position: lowerText.indexOf(keywordLower),
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
      // Mask Aadhaar: 5678-1234-5678 -> 5678-XXXX-XXXX
      const aadhaarDigits = value.replace(/\D/g, '')
      if (aadhaarDigits.length === 12) {
        return `${aadhaarDigits.substring(0, 4)}-XXXX-XXXX`
      }
      return 'XXXX-XXXX-XXXX'
    case 'pan':
      // Mask PAN: ABCDE1234F -> ABCDE****F
      if (value.length === 10) {
        return `${value.substring(0, 5)}****${value.substring(9)}`
      }
      return '*****'
    case 'voterId':
      // Mask Voter ID: ABC1234567 -> ABC****567
      if (value.length === 10) {
        return `${value.substring(0, 3)}****${value.substring(7)}`
      }
      return '***'
    case 'ifsc':
      // Mask IFSC: HDFC0001234 -> HDFC****34
      if (value.length === 11) {
        return `${value.substring(0, 4)}****${value.substring(9)}`
      }
      return '****'
    case 'upiId':
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
    case 'pan':
      // PAN must match exact format: 5 letters + 4 digits + 1 letter
      const panMatch = value.match(/^[A-Z]{5}\d{4}[A-Z]$/)
      if (panMatch) return true
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
    case 'ifsc':
      // IFSC must match format: 4 letters + 0 + 6 alphanumeric
      const ifscMatch = value.match(/^[A-Z]{4}0[A-Z0-9]{6}$/)
      return ifscMatch !== null
    case 'upiId':
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
    case 'indianPhone':
      // Indian phone must start with 6-9 and be 10 digits (excluding country code)
      const phoneDigits = value.replace(/\D/g, '')
      // Remove country code if present
      const cleanPhone = phoneDigits.replace(/^(91|0)/, '')
      if (cleanPhone.length === 10 && /^[6-9]/.test(cleanPhone)) {
        // Check context - if near "phone", "mobile", "contact", it's likely a phone number
        const phoneContext = fullText.substring(Math.max(0, position - 30), position + 30).toLowerCase()
        return /phone|mobile|contact|number|call|whatsapp/.test(phoneContext)
      }
      return false
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

