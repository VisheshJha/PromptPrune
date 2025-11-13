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
  { keyword: 'social security', severity: 'high' as const, suggestion: '🚨 Social Security number context detected - Identity theft risk' }
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

