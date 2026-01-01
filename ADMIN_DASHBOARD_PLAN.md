# Admin Dashboard - Extension Changes & Portal Roadmap

## Overview

Enterprise-grade admin dashboard system for monitoring sensitive data warnings with JSON-based policy enforcement (AWS IAM-style). System uses **MongoDB** for both sensitive prompts and audit logs (using time-series collections). Extension enforces policies based on user roles, while admins/managers manage everything via web portal.

## Architecture Decisions

### Database: MongoDB Only
- **Sensitive Prompts**: Regular MongoDB collection
- **Audit Logs**: MongoDB time-series collection (5.0+ feature)
- **Metadata**: All in MongoDB (companies, users, teams, policies)
- **Why**: Single database, simpler architecture, MongoDB time-series collections handle time-ordered data efficiently
- **Cost**: $0-9/month (free tier or $9/month for 2GB)

### Policy Engine: JSON-Based (AWS IAM-Style)
- Simple JSON structure (industry standard)
- No OPA/Casbin dependency
- Easy to understand and implement
- Condition matching like AWS IAM

### Policy Sync: On-Trigger + 4-Hour Fallback
- On policy change: Portal triggers sync
- Fallback: Extension polls every 4 hours
- On login: Always sync policies

### Customer Onboarding: Invitation System
- Super admin invites new companies
- Invitation email with token
- Company accepts → creates company + admin account

---

# PART 1: Extension Changes

## Overview

Extension modifications to log sensitive prompts, enforce governance policies (JSON-based), and sync via webhooks. Users authenticate via extension SSO only.

## Architecture Flow

```javascript
User proceeds despite warning
  ↓
Log sensitive prompt (local storage)
  ↓
Check governance policies (based on user role)
  ↓
Trigger webhook to company server
  ↓
Store in MongoDB (sensitive_prompts collection)
  ↓
Store in MongoDB time-series (audit_logs collection)
```

## Files to Create/Modify

### 1. New File: `src/lib/audit-logger.ts`

**Purpose**: Log sensitive prompts when user proceeds despite warning

**Interface**:
```typescript
interface SensitivePrompt {
  id: string // UUID
  timestamp: string // ISO 8601
  userEmail: string // From SSO
  userId: string // User ID from company system
  teamId?: string // Team ID if user belongs to team
  role?: string // User role (from company system)
  platform: string // ChatGPT, Copilot, etc.
  prompt: string // Full prompt text
  detectedItems: Array<{
    type: string
    severity: 'low' | 'medium' | 'high'
    originalValue: string
    position: number
  }>
  riskScore: number // 0-100
  action: 'proceeded_despite_warning'
  metadata: {
    url: string
    userAgent: string
    extensionVersion: string
  }
  webhookUrl?: string // Per-user webhook URL
  synced: boolean
  syncedAt?: string
}
```

**Functions**:
```typescript
// Log when user proceeds despite warning
export async function logSensitivePrompt(
  prompt: string,
  detectedItems: Array<{...}>,
  riskScore: number,
  platform: string
): Promise<SensitivePrompt>

// Trigger webhook to company server
export async function triggerWebhook(
  sensitivePrompt: SensitivePrompt
): Promise<boolean>

// Get pending prompts (for retry)
export async function getSensitivePrompts(
  limit?: number
): Promise<SensitivePrompt[]>

// Retry failed webhooks
export async function retryFailedWebhooks(): Promise<void>

// Cleanup old prompts based on retention
export async function cleanupOldPrompts(
  retentionDays: number
): Promise<void>
```

**Implementation Details**:
- Store in `chrome.storage.local` under key `promptprune-sensitive-prompts`
- Generate UUID for each prompt using `crypto.randomUUID()`
- Get user context from `authService.getCurrentUser()` and company API
- Get user role and team from company API (cached in `chrome.storage.local`)
- Get webhook URL from user account config
- Trigger webhook immediately (non-blocking, use `fetch` with `AbortController`)
- Retry failed webhooks with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- HMAC signature for webhook security (use webhook secret from config)

**Webhook Payload**:
```typescript
interface WebhookPayload {
  id: string
  timestamp: string
  userEmail: string
  userId: string
  teamId?: string
  role?: string
  platform: string
  prompt: string
  detectedItems: Array<{...}>
  riskScore: number
  action: string
  metadata: {...}
}

// Add HMAC signature header
headers: {
  'Content-Type': 'application/json',
  'X-Webhook-Signature': hmacSha256(payload, webhookSecret)
}
```

### 2. Modify: `src/content.ts`

**File**: `src/content.ts`
**Function**: `showSensitiveContentWarning()`

**Changes**:
```typescript
// Import
import { logSensitivePrompt, triggerWebhook } from "~/lib/audit-logger"

// In showSensitiveContentWarning(), when user clicks "Proceed Anyway"
proceedBtn.onclick = async (e) => {
  e.stopPropagation()
  e.stopImmediatePropagation()

  // Remove modal key handler first
  document.removeEventListener('keydown', modalKeyHandler, { capture: true })

  // Set bypass flag to allow submission for this textarea
  const bypassFlag = getBypassFlagForTextarea(textArea)
  bypassFlag.bypass = true

  // Log sensitive prompt
  try {
    const sensitivePrompt = await logSensitivePrompt(
      textTrimmed,
      sensitiveCheck.detectedItems,
      sensitiveCheck.riskScore,
      detectPlatformAndModel().platform
    )
    
    // Trigger webhook (non-blocking)
    triggerWebhook(sensitivePrompt).catch(error => {
      console.warn('[PromptPrune] Webhook failed, will retry:', error)
    })
  } catch (error) {
    console.error('[PromptPrune] Failed to log sensitive prompt:', error)
    // Don't block user if logging fails
  }

  // Remove modal first
  overlay.remove()

  // Clear bypass after delay (enough for submission to go through)
  if (bypassFlag.timeout) clearTimeout(bypassFlag.timeout)
  bypassFlag.timeout = window.setTimeout(() => {
    bypassFlag.bypass = false
  }, 5000)

  // Allow the original submission to proceed
  setTimeout(() => {
    const submitBtn = findSubmitButton(textArea)
    if (submitBtn) {
      submitBtn.click()
    }
  }, 100)
}
```

### 3. New File: `src/lib/governance-enforcer.ts`

**Purpose**: Enforce governance policies (JSON-based, AWS IAM-style) before allowing prompt submission

**Policy Structure**:
```typescript
interface GovernancePolicy {
  id: string
  companyId: string
  name: string
  enabled: boolean
  statement: {
    effect: 'allow' | 'deny'
    action: 'block_topic' | 'block_keyword' | 'block_domain' | 'require_approval' | 'rate_limit'
    resource: string[] // Topics, keywords, domains, etc.
    condition: {
      team?: string[]
      role?: string[]
      user?: string[]
    }
  }
  metadata?: {
    message?: string
    createdBy?: string
    createdAt?: string
  }
}

interface PolicyCheckResult {
  allowed: boolean
  blocked: boolean
  requiresApproval: boolean
  message?: string
  policy?: GovernancePolicy
}
```

**Functions**:
```typescript
// Check all policies against prompt and user context
export async function checkGovernancePolicies(
  prompt: string,
  platform: string,
  userContext: {
    email: string
    userId: string
    teamId?: string
    role?: string
  }
): Promise<PolicyCheckResult>

// Load policies from server (with caching)
export async function loadPoliciesFromServer(): Promise<GovernancePolicy[]>

// Get cached policies from local storage
export async function getCachedPolicies(): Promise<GovernancePolicy[]>

// Trigger policy sync (called when policy changes in portal)
export async function triggerPolicySync(): Promise<void>
```

**Policy Matching Logic** (AWS IAM-style):
```typescript
function matchesPolicy(
  policy: GovernancePolicy,
  userContext: {
    userId: string
    teamId?: string
    role?: string
  }
): boolean {
  const condition = policy.statement.condition
  
  // Match teams (if condition has teams, user must be in one of them)
  if (condition.team && condition.team.length > 0) {
    if (!userContext.teamId || !condition.team.includes(userContext.teamId)) {
      return false
    }
  }
  
  // Match roles (if condition has roles, user must have one of them)
  if (condition.role && condition.role.length > 0) {
    if (!userContext.role || !condition.role.includes(userContext.role)) {
      return false
    }
  }
  
  // Match users (if condition has users, user must be in the list)
  if (condition.user && condition.user.length > 0) {
    if (!condition.user.includes(userContext.userId)) {
      return false
    }
  }
  
  // If no conditions, policy applies to all users
  return true
}
```

**Policy Enforcement**:
```typescript
async function enforcePolicy(
  policy: GovernancePolicy,
  prompt: string,
  platform: string,
  userContext: UserContext
): Promise<PolicyCheckResult> {
  // Allow policies are pass-through (don't block)
  if (policy.statement.effect === 'allow') {
    return { allowed: true, blocked: false }
  }
  
  // Deny policies block
  switch (policy.statement.action) {
    case 'block_topic':
      // Extract topic from prompt (use existing intent extraction)
      const topic = await extractTopicFromPrompt(prompt)
      if (policy.statement.resource.includes(topic)) {
        return {
          allowed: false,
          blocked: true,
          message: policy.metadata?.message || `Topic "${topic}" is blocked for your team`,
          policy
        }
      }
      break
      
    case 'block_keyword':
      const lowerPrompt = prompt.toLowerCase()
      for (const keyword of policy.statement.resource) {
        if (lowerPrompt.includes(keyword.toLowerCase())) {
          return {
            allowed: false,
            blocked: true,
            message: policy.metadata?.message || `Keyword "${keyword}" is blocked`,
            policy
          }
        }
      }
      break
      
    case 'block_domain':
      if (policy.statement.resource.includes(platform)) {
        return {
          allowed: false,
          blocked: true,
          message: policy.metadata?.message || `Platform "${platform}" is blocked for your team`,
          policy
        }
      }
      break
      
    case 'require_approval':
      return {
        allowed: false,
        requiresApproval: true,
        message: policy.metadata?.message || 'This action requires admin approval',
        policy
      }
      
    case 'rate_limit':
      // Check rate limit (store in chrome.storage.local)
      const rateLimitKey = `rate_limit_${policy.id}_${userContext.userId}`
      const rateLimit = await checkRateLimit(rateLimitKey, policy.statement.resource)
      if (!rateLimit.allowed) {
        return {
          allowed: false,
          blocked: true,
          message: rateLimit.message || 'Rate limit exceeded',
          policy
        }
      }
      break
  }
  
  return { allowed: true, blocked: false }
}

// Helper: Extract topic from prompt (reuse existing intent extraction)
async function extractTopicFromPrompt(prompt: string): Promise<string> {
  // Use existing extractIntent or classifyIntent
  const unifiedModel = getUnifiedModelManager()
  if (unifiedModel.isReady()) {
    try {
      const intent = await unifiedModel.classifyIntent(prompt)
      return intent.category || 'general'
    } catch (error) {
      // Fallback to keyword matching
      return extractTopicFromKeywords(prompt)
    }
  }
  return extractTopicFromKeywords(prompt)
}

function extractTopicFromKeywords(prompt: string): string {
  const lower = prompt.toLowerCase()
  if (lower.includes('sports') || lower.includes('football') || lower.includes('basketball')) {
    return 'sports'
  }
  if (lower.includes('code') || lower.includes('programming') || lower.includes('function')) {
    return 'code generation'
  }
  // ... more keyword matching
  return 'general'
}
```

### 4. Modify: `src/content.ts` - Add Policy Check

**Location**: In `checkAndBlockSubmission()` or keydown listener

**Changes**:
```typescript
// Import
import { checkGovernancePolicies } from "~/lib/governance-enforcer"
import { getUserContext } from "~/lib/user-context"

// Before allowing prompt submission
const userContext = await getUserContext() // From authService + company API

// Check governance policies
const policyCheck = await checkGovernancePolicies(
  textTrimmed,
  detectPlatformAndModel().platform,
  userContext
)

if (policyCheck.blocked) {
  e.preventDefault()
  e.stopPropagation()
  e.stopImmediatePropagation()
  
  // Show policy violation warning
  showPolicyViolationWarning(textArea, policyCheck.message || 'This action is blocked by company policy')
  return true // Blocked
}

if (policyCheck.requiresApproval) {
  e.preventDefault()
  e.stopPropagation()
  e.stopImmediatePropagation()
  
  // Show approval required modal
  showApprovalRequiredModal(textArea, policyCheck.message || 'This action requires admin approval')
  return true // Blocked
}

// If policies allow, continue with sensitive data check...
```

**New Helper Functions** (add to `src/content.ts`):
```typescript
function showPolicyViolationWarning(
  textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement,
  message: string
) {
  // Similar to showSensitiveContentWarning but for policy violations
  // Show modal with policy violation message
  // User cannot proceed (no "Proceed Anyway" button)
}

function showApprovalRequiredModal(
  textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement,
  message: string
) {
  // Show modal requesting admin approval
  // User can request approval or cancel
}
```

### 5. New File: `src/background/audit-sync.ts`

**Purpose**: Background sync for failed webhooks and policy updates

**Functions**:
```typescript
// Retry failed webhooks with exponential backoff
export async function retryFailedWebhooks(): Promise<void>

// Sync policies from server (called on trigger or 4h fallback)
export async function syncPoliciesFromServer(): Promise<void>

// Trigger immediate policy sync (called when policy changes in portal)
export async function triggerPolicySync(): Promise<void>

// Sync user context from server
export async function syncUserContextFromServer(): Promise<void>
```

**Implementation**:
```typescript
// Run on extension startup
chrome.runtime.onStartup.addListener(() => {
  retryFailedWebhooks()
  syncPoliciesFromServer()
  syncUserContextFromServer()
})

// Periodic policy sync (4 hours)
chrome.alarms.create('syncPolicies', { periodInMinutes: 240 })

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncPolicies') {
    syncPoliciesFromServer()
  }
})

// Retry failed webhooks every 15 minutes
chrome.alarms.create('retryWebhooks', { periodInMinutes: 15 })

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'retryWebhooks') {
    retryFailedWebhooks()
  }
})
```

**Webhook Retry Logic**:
```typescript
async function retryFailedWebhooks(): Promise<void> {
  const prompts = await getSensitivePrompts()
  const failedPrompts = prompts.filter(p => !p.synced)
  
  for (const prompt of failedPrompts) {
    const retryCount = prompt.metadata?.retryCount || 0
    if (retryCount >= 5) {
      // Max retries reached, log error
      console.error('[PromptPrune] Max retries reached for prompt:', prompt.id)
      continue
    }
    
    const success = await triggerWebhook(prompt)
    if (success) {
      // Mark as synced
      await markPromptAsSynced(prompt.id)
    } else {
      // Increment retry count
      await incrementRetryCount(prompt.id)
    }
    
    // Exponential backoff delay
    await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000))
  }
}
```

### 6. Modify: `src/lib/auth-service.ts`

**Add functions**:
```typescript
// Get user context (role, team, webhook URL) from company API
export async function getUserContext(): Promise<{
  userId: string
  userEmail: string
  teamId?: string
  role?: string
  webhookUrl?: string
}>

// Sync user context from server
export async function syncUserContext(): Promise<void>
```

**Implementation**:
```typescript
export async function getUserContext(): Promise<UserContext> {
  // First check cache
  const cached = await chrome.storage.local.get('promptprune-user-context')
  if (cached['promptprune-user-context']) {
    const context = cached['promptprune-user-context']
    // Check if cache is fresh (less than 1 hour old)
    const cacheAge = Date.now() - new Date(context.syncedAt).getTime()
    if (cacheAge < 3600000) { // 1 hour
      return context
    }
  }
  
  // Cache expired or missing, fetch from server
  return await syncUserContext()
}

export async function syncUserContext(): Promise<UserContext> {
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User not authenticated')
  }
  
  // Call company API
  const response = await fetch(`${getCompanyApiUrl()}/api/v1/users/me`, {
    headers: {
      'Authorization': `Bearer ${await getAuthToken()}`,
      'Content-Type': 'application/json'
    }
  })
  
  if (!response.ok) {
    throw new Error('Failed to fetch user context')
  }
  
  const userContext = await response.json()
  
  // Cache in chrome.storage.local
  await chrome.storage.local.set({
    'promptprune-user-context': {
      ...userContext,
      syncedAt: new Date().toISOString()
    }
  })
  
  return userContext
}
```

### 7. New File: `src/lib/user-context.ts`

**Purpose**: Manage user context (role, team, webhook URL)

**Storage Keys**:
- `promptprune-user-context` - User context (role, team, webhook URL)
- `promptprune-governance-policies` - Cached policies from server
- `promptprune-policy-sync-time` - Last policy sync timestamp
- `promptprune-policy-sync-trigger` - Flag to force sync on next check

**Functions**:
```typescript
export interface UserContext {
  userId: string
  userEmail: string
  teamId?: string
  role?: string
  webhookUrl?: string
  syncedAt?: string
}

export async function getUserContext(): Promise<UserContext>

export async function syncUserContextFromServer(): Promise<void>

export async function getWebhookUrl(): Promise<string | null>

export async function triggerPolicySync(): Promise<void> // Set flag for immediate sync

export async function getCachedPolicies(): Promise<GovernancePolicy[]>

export async function syncPoliciesFromServer(): Promise<void>
```

**Implementation**:
```typescript
export async function triggerPolicySync(): Promise<void> {
  await chrome.storage.local.set({
    'promptprune-policy-sync-trigger': true
  })
  
  // Also trigger immediate sync
  await syncPoliciesFromServer()
}

export async function syncPoliciesFromServer(): Promise<void> {
  const userContext = await getUserContext()
  if (!userContext.userId) {
    return
  }
  
  try {
    const response = await fetch(`${getCompanyApiUrl()}/api/v1/governance/policies`, {
      headers: {
        'Authorization': `Bearer ${await getAuthToken()}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch policies')
    }
    
    const policies = await response.json()
    
    // Cache policies
    await chrome.storage.local.set({
      'promptprune-governance-policies': policies,
      'promptprune-policy-sync-time': new Date().toISOString(),
      'promptprune-policy-sync-trigger': false
    })
  } catch (error) {
    console.error('[PromptPrune] Failed to sync policies:', error)
  }
}

export async function getCachedPolicies(): Promise<GovernancePolicy[]> {
  const cached = await chrome.storage.local.get([
    'promptprune-governance-policies',
    'promptprune-policy-sync-trigger'
  ])
  
  const policies = cached['promptprune-governance-policies'] || []
  const trigger = cached['promptprune-policy-sync-trigger'] || false
  
  // If trigger is set, sync immediately
  if (trigger) {
    await syncPoliciesFromServer()
    // Return updated policies
    const updated = await chrome.storage.local.get('promptprune-governance-policies')
    return updated['promptprune-governance-policies'] || []
  }
  
  return policies
}
```

## Extension Storage Structure

```typescript
// chrome.storage.local keys
{
  // Sensitive prompts (pending sync)
  'promptprune-sensitive-prompts': SensitivePrompt[]
  
  // User context
  'promptprune-user-context': {
    userId: string
    userEmail: string
    teamId?: string
    role?: string
    webhookUrl?: string
    syncedAt: string
  }
  
  // Governance policies (cached)
  'promptprune-governance-policies': GovernancePolicy[]
  'promptprune-policy-sync-time': string
  'promptprune-policy-sync-trigger': boolean // Set to true to force sync
  
  // Config
  'promptprune-audit-config': {
    companyApiUrl: string
    retentionDays: number
    webhookRetryInterval: number // 15 minutes
    policySyncInterval: number // 4 hours in milliseconds
  }
}
```

## Extension Flow

### 1. User Login (Extension SSO)
```javascript
User clicks "Sign in with Google" in extension
  ↓
OAuth flow completes (existing authService.login())
  ↓
Extension calls company API: GET /api/v1/users/me
  ↓
Company API returns: userId, teamId, role, webhookUrl
  ↓
Extension stores in chrome.storage.local
  ↓
Extension syncs policies: GET /api/v1/governance/policies
  ↓
Policies cached locally
```

### 2. User Types Prompt
```javascript
User types prompt
  ↓
Extension checks sensitive data (existing logic)
  ↓
If sensitive data detected → Show warning
  ↓
User clicks "Proceed Anyway"
  ↓
Extension checks governance policies
  ↓
If policy violation → Block submission, show message
  ↓
If allowed → Log sensitive prompt
  ↓
Trigger webhook to company server
  ↓
Allow submission
```

### 3. Policy Enforcement
```javascript
Before prompt submission
  ↓
Get user context (role, team)
  ↓
Load cached policies
  ↓
Match policies to user (AWS IAM-style condition matching)
  ↓
Check each policy:
    - block_topic: Extract topic, check if blocked
    - block_keyword: Check if keyword in prompt
    - block_domain: Check if platform blocked
    - require_approval: Show approval modal
    - rate_limit: Check request count
  ↓
If violation → Block and show message
  ↓
If allowed → Proceed
```

### 4. Policy Sync Strategy
```javascript
Policy changes in portal
  ↓
Portal sends webhook to extension (or sets trigger flag)
  ↓
Extension receives trigger
  ↓
Extension syncs policies: GET /api/v1/governance/policies
  ↓
Policies updated in cache
  ↓
Fallback: Extension polls every 4 hours if no trigger
```

---

# PART 2: Portal Roadmap

## Overview

Web portal for admins and managers to manage users, teams, policies, and view sensitive prompts. Users never login to portal (only extension SSO). Companies onboarded via invitation system.

## Tech Stack

### Backend (Go)

**Framework**: Gin (lightweight, fast)
- **Why**: Simple, well-documented, good performance
- **Alternative**: Fiber (similar, slightly faster)

**Database**: MongoDB Atlas
- **Free Tier**: M0 cluster (512MB storage, free forever)
- **Paid Tier**: $9/month for 2GB (if needed)
- **Connection**: Official MongoDB Go driver

**Authentication**: JWT tokens
- **Library**: `github.com/golang-jwt/jwt/v5`
- **SSO**: OAuth2 for Google, Microsoft, Okta

**Deployment**: GCP Cloud Run
- **Free Tier**: 2 million requests/month
- **Cost**: $0-20/month for small-medium usage
- **Why**: Serverless, auto-scaling, easy deployment

**Project Structure**:
```
backend/
├── main.go                 # Server entry point
├── go.mod
├── go.sum
├── config/
│   ├── config.go          # Configuration management
│   └── database.go        # MongoDB connection
├── models/
│   ├── company.go
│   ├── user.go
│   ├── team.go
│   ├── policy.go
│   ├── sensitive_prompt.go
│   └── audit_log.go
├── routes/
│   ├── auth.go            # SSO authentication
│   ├── webhook.go         # Webhook endpoint
│   ├── users.go           # User management
│   ├── teams.go           # Team management
│   ├── policies.go        # Governance policies
│   ├── sensitive_prompts.go
│   └── audit_logs.go
├── middleware/
│   ├── auth.go            # JWT authentication
│   ├── webhook.go         # Webhook signature validation
│   └── cors.go            # CORS handling
├── services/
│   ├── auth.go            # Authentication service
│   ├── webhook.go         # Webhook processing
│   ├── policy.go          # Policy management
│   └── audit.go           # Audit log service
└── utils/
    ├── jwt.go             # JWT utilities
    ├── hmac.go            # HMAC signature
    └── encryption.go      # Data encryption
```

### Frontend (React)

**Framework**: React 18 + TypeScript
- **Why**: Type safety, modern React features

**Styling**: Tailwind CSS
- **Why**: Matches extension style, utility-first

**State Management**: React Query (TanStack Query)
- **Why**: Server state management, caching, auto-refetch

**Routing**: React Router v6
- **Why**: Standard, well-supported

**HTTP Client**: Axios
- **Why**: Interceptors, request/response handling

**Charts**: Recharts
- **Why**: Simple, React-native, good documentation

**Forms**: React Hook Form
- **Why**: Performance, validation, easy to use

**Deployment**: Vercel
- **Free Tier**: Unlimited projects, automatic deployments
- **Why**: Zero config, fast CDN, free SSL

**Project Structure**:
```
portal/
├── package.json
├── tsconfig.json
├── vite.config.ts         # Or create-react-app
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes.tsx
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Onboarding.tsx
│   │   ├── Dashboard.tsx
│   │   ├── SensitivePrompts.tsx
│   │   ├── Users.tsx
│   │   ├── Teams.tsx
│   │   ├── Policies.tsx
│   │   ├── AuditLogs.tsx
│   │   ├── Settings.tsx
│   │   └── Analytics.tsx
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Layout.tsx
│   │   ├── PromptsTable.tsx
│   │   ├── PolicyEditor.tsx
│   │   ├── Charts/
│   │   │   ├── RiskScoreChart.tsx
│   │   │   ├── PlatformChart.tsx
│   │   │   └── TimelineChart.tsx
│   │   └── Forms/
│   │       ├── UserForm.tsx
│   │       ├── TeamForm.tsx
│   │       └── PolicyForm.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── usePolicies.ts
│   │   ├── useSensitivePrompts.ts
│   │   └── useAuditLogs.ts
│   ├── services/
│   │   ├── api.ts          # Axios instance
│   │   ├── auth.ts         # Auth API calls
│   │   ├── users.ts        # User API calls
│   │   ├── policies.ts     # Policy API calls
│   │   └── prompts.ts      # Prompt API calls
│   ├── store/
│   │   ├── authStore.ts    # Auth state (Zustand)
│   │   └── uiStore.ts      # UI state
│   ├── types/
│   │   ├── user.ts
│   │   ├── policy.ts
│   │   ├── prompt.ts
│   │   └── audit.ts
│   └── utils/
│       ├── format.ts
│       ├── validation.ts
│       └── constants.ts
└── public/
    └── index.html
```

## Database Schema (MongoDB)

### 1. sensitive_prompts (Regular Collection)

**Purpose**: Store sensitive prompts for admin review

**Schema**:
```javascript
{
  _id: ObjectId("..."),
  companyId: ObjectId("..."), // Reference to companies
  userId: "user-123", // Company's user ID
  userEmail: "user@example.com",
  teamId: ObjectId("..."), // Reference to teams, or null
  role: "developer", // User role
  timestamp: ISODate("2024-01-01T00:00:00Z"),
  platform: "ChatGPT", // ChatGPT, Copilot, Gemini, etc.
  prompt: "Full prompt text here...", // Full prompt text
  detectedItems: [
    {
      type: "email",
      severity: "medium",
      originalValue: "user@example.com",
      position: 45
    },
    {
      type: "api_key",
      severity: "high",
      originalValue: "sk-...",
      position: 120
    }
  ],
  riskScore: 75, // 0-100
  action: "proceeded_despite_warning",
  metadata: {
    url: "https://chat.openai.com/chat",
    userAgent: "Mozilla/5.0...",
    extensionVersion: "1.0.0",
    browser: "Chrome",
    os: "macOS"
  },
  isFalsePositive: false,
  markedFalsePositiveBy: ObjectId("..."), // Reference to portal_users
  markedFalsePositiveAt: ISODate("..."),
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

**Indexes**:
```javascript
// Primary query: Get prompts for company, filtered by date, false positives
db.sensitive_prompts.createIndex({ 
  companyId: 1, 
  isFalsePositive: 1, 
  timestamp: -1 
})

// Query by user
db.sensitive_prompts.createIndex({ 
  companyId: 1, 
  userEmail: 1, 
  timestamp: -1 
})

// Query by team
db.sensitive_prompts.createIndex({ 
  companyId: 1, 
  teamId: 1, 
  timestamp: -1 
})

// Query by platform
db.sensitive_prompts.createIndex({ 
  companyId: 1, 
  platform: 1, 
  timestamp: -1 
})

// Query by risk score
db.sensitive_prompts.createIndex({ 
  companyId: 1, 
  riskScore: -1, 
  timestamp: -1 
})
```

### 2. audit_logs (Time-Series Collection)

**Purpose**: Complete immutable history of all events

**Collection Creation**:
```javascript
db.createCollection("audit_logs", {
  timeseries: {
    timeField: "timestamp",
    metaField: "companyId", // For efficient filtering by company
    granularity: "hours" // or "minutes" for high volume
  }
})
```

**Schema**:
```javascript
{
  _id: ObjectId("..."),
  timestamp: ISODate("2024-01-01T00:00:00Z"), // Time field for time-series
  companyId: ObjectId("..."), // Meta field for filtering
  eventType: "sensitive_prompt", // Enum: sensitive_prompt, policy_violation, admin_action, system_event
  userId: "user-123",
  userEmail: "user@example.com",
  teamId: ObjectId("..."), // or null
  role: "developer",
  eventData: {
    // Varies by eventType
    // For sensitive_prompt:
    prompt: "Full prompt text...",
    detectedItems: [...],
    riskScore: 75,
    platform: "ChatGPT"
    // For policy_violation:
    // policyId: "...",
    // policyName: "...",
    // prompt: "...",
    // platform: "..."
    // For admin_action:
    // action: "marked_false_positive",
    // resourceType: "sensitive_prompt",
    // resourceId: "..."
  },
  metadata: {
    url: "...",
    userAgent: "...",
    extensionVersion: "..."
  }
}
```

**Indexes** (time-series collections auto-index timestamp):
```javascript
// Query by company and event type
db.audit_logs.createIndex({ 
  companyId: 1, 
  eventType: 1, 
  timestamp: -1 
})

// Query by user
db.audit_logs.createIndex({ 
  companyId: 1, 
  userId: 1, 
  timestamp: -1 
})

// Query by team
db.audit_logs.createIndex({ 
  companyId: 1, 
  teamId: 1, 
  timestamp: -1 
})
```

### 3. companies (Regular Collection)

**Purpose**: Company/organization information

**Schema**:
```javascript
{
  _id: ObjectId("..."),
  name: "Acme Corp",
  webhookSecret: "encrypted-secret", // For HMAC validation (encrypted at rest)
  retentionDays: 90, // Default retention period
  ssoProviders: ["google", "microsoft"], // Enabled SSO providers
  settings: {
    allowSelfRegistration: false, // Users cannot self-register
    requireAdminApproval: true, // New users need admin approval
    defaultRetentionDays: 90
  },
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

**Indexes**:
```javascript
db.companies.createIndex({ name: 1 })
```

### 4. users (Regular Collection - Extension Users)

**Purpose**: Users who use the extension (never login to portal)

**Schema**:
```javascript
{
  _id: ObjectId("..."),
  companyId: ObjectId("..."), // Reference to companies
  email: "user@example.com",
  userId: "user-123", // Company's internal user ID
  role: "developer", // User role (developer, designer, manager, etc.)
  teamId: ObjectId("..."), // Reference to teams, or null
  webhookUrl: "https://company.com/webhook/user-123", // Per-user webhook URL
  ssoProvider: "google", // google, microsoft, okta
  ssoId: "google-user-id-123", // SSO provider user ID
  isActive: true,
  lastSeenAt: ISODate("..."), // Last time extension was used
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

**Indexes**:
```javascript
// Unique email per company
db.users.createIndex({ 
  companyId: 1, 
  email: 1 
}, { unique: true })

// Query by team
db.users.createIndex({ 
  companyId: 1, 
  teamId: 1 
})

// Query by SSO provider
db.users.createIndex({ 
  ssoProvider: 1, 
  ssoId: 1 
})

// Query active users
db.users.createIndex({ 
  companyId: 1, 
  isActive: 1 
})
```

### 5. teams (Regular Collection)

**Purpose**: Teams within a company

**Schema**:
```javascript
{
  _id: ObjectId("..."),
  companyId: ObjectId("..."), // Reference to companies
  name: "Dev Team",
  description: "Development team working on product",
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

**Indexes**:
```javascript
// Unique team name per company
db.teams.createIndex({ 
  companyId: 1, 
  name: 1 
}, { unique: true })
```

### 6. portal_users (Regular Collection - Admins/Managers)

**Purpose**: Users who can login to portal (admin/manager only)

**Schema**:
```javascript
{
  _id: ObjectId("..."),
  companyId: ObjectId("..."), // Reference to companies
  email: "admin@example.com",
  role: "admin", // Enum: admin, manager
  ssoProvider: "google", // google, microsoft, okta
  ssoId: "google-user-id-123", // SSO provider user ID
  isActive: true,
  lastLoginAt: ISODate("..."),
  invitedBy: ObjectId("..."), // Reference to portal_users (who invited)
  invitationToken: "uuid-token", // For onboarding (null after acceptance)
  invitationExpiresAt: ISODate("..."), // 7 days from creation
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

**Indexes**:
```javascript
// Unique email per company
db.portal_users.createIndex({ 
  companyId: 1, 
  email: 1 
}, { unique: true })

// Query by role
db.portal_users.createIndex({ 
  companyId: 1, 
  role: 1 
})

// Query by invitation token
db.portal_users.createIndex({ 
  invitationToken: 1 
}, { 
  unique: true, 
  sparse: true // Only index documents with invitationToken
})

// Query by SSO
db.portal_users.createIndex({ 
  ssoProvider: 1, 
  ssoId: 1 
})
```

### 7. governance_policies (Regular Collection)

**Purpose**: Governance policies (JSON-based, AWS IAM-style)

**Schema**:
```javascript
{
  _id: ObjectId("..."),
  companyId: ObjectId("..."), // Reference to companies
  name: "Block Sports for Dev Team",
  enabled: true,
  statement: {
    effect: "deny", // Enum: allow, deny
    action: "block_topic", // Enum: block_topic, block_keyword, block_domain, require_approval, rate_limit
    resource: ["sports", "entertainment"], // JSON array (topics, keywords, domains, etc.)
    condition: {
      team: [ObjectId("...")], // Array of team IDs, or empty for all teams
      role: ["developer"], // Array of roles, or empty for all roles
      user: ["user-123"] // Array of user IDs, or empty for all users
    }
  },
  metadata: {
    message: "Dev team cannot search about sports",
    createdBy: ObjectId("..."), // Reference to portal_users
    createdAt: ISODate("...")
  },
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

**Indexes**:
```javascript
// Query active policies for company
db.governance_policies.createIndex({ 
  companyId: 1, 
  enabled: 1 
})

// Query by team condition
db.governance_policies.createIndex({ 
  companyId: 1, 
  "statement.condition.team": 1, 
  enabled: 1 
})

// Query by role condition
db.governance_policies.createIndex({ 
  companyId: 1, 
  "statement.condition.role": 1, 
  enabled: 1 
})

// Query by action type
db.governance_policies.createIndex({ 
  companyId: 1, 
  "statement.action": 1, 
  enabled: 1 
})
```

### 8. company_invitations (Regular Collection)

**Purpose**: Invitations for new companies to onboard

**Schema**:
```javascript
{
  _id: ObjectId("..."),
  companyName: "New Company Inc",
  adminEmail: "admin@newcompany.com",
  invitationToken: "uuid-token", // UUID for invitation link
  invitedBy: ObjectId("..."), // Reference to portal_users (super admin) or null (system)
  status: "pending", // Enum: pending, accepted, expired
  expiresAt: ISODate("..."), // 7 days from creation
  ssoProvider: "google", // Preferred SSO provider
  createdAt: ISODate("..."),
  acceptedAt: ISODate("..."), // When invitation was accepted
  companyId: ObjectId("...") // Reference to companies (set when accepted)
}
```

**Indexes**:
```javascript
// Query by invitation token
db.company_invitations.createIndex({ 
  invitationToken: 1 
}, { unique: true })

// Query pending invitations
db.company_invitations.createIndex({ 
  status: 1, 
  expiresAt: 1 
})

// Query by email
db.company_invitations.createIndex({ 
  adminEmail: 1 
})
```

## Backend API Endpoints

### Authentication & Onboarding

1. **POST /api/v1/auth/sso/:provider** - SSO login (Google, Microsoft, Okta)
   - For portal users (admin/manager)
   - Returns JWT token

2. **POST /api/v1/auth/logout** - Logout

3. **GET /api/v1/auth/me** - Get current admin/manager

4. **POST /api/v1/onboarding/invite** - Invite new company (super admin only)
   - Creates company invitation
   - Sends email with invitation link

5. **GET /api/v1/onboarding/:token** - Get invitation details

6. **POST /api/v1/onboarding/accept** - Accept invitation and create company
   - Creates company, admin user, initial setup

### Webhook

1. **POST /api/v1/webhook/sensitive-prompt** - Receive sensitive prompt from extension
   - Validates HMAC signature
   - Stores in `sensitive_prompts` collection
   - Stores in `audit_logs` time-series collection
   - Returns 200 OK

### Users (Extension)

1. **GET /api/v1/users/me** - Get user context (role, team, webhook URL)
   - Called by extension after SSO login
   - Returns: userId, teamId, role, webhookUrl
   - Authentication: Extension JWT token

### Sensitive Prompts (Portal)

1. **GET /api/v1/sensitive-prompts** - List sensitive prompts (admin/manager)
   - Filters: date range, user, team, platform, severity, false positives
   - Pagination
   - Authentication: Portal JWT token

2. **GET /api/v1/sensitive-prompts/:id** - Get prompt details

3. **POST /api/v1/sensitive-prompts/:id/false-positive** - Mark as false positive

4. **GET /api/v1/sensitive-prompts/stats** - Dashboard statistics

### Users Management (Portal)

1. **GET /api/v1/portal/users** - List all users (admin only)

2. **POST /api/v1/portal/users** - Create user (admin only)
   - Body: email, role, teamId, webhookUrl

3. **PUT /api/v1/portal/users/:id** - Update user (role, team, webhook URL)

4. **DELETE /api/v1/portal/users/:id** - Deactivate user

5. **POST /api/v1/portal/users/bulk** - Bulk operations (assign team, role)

### Teams (Portal)

1. **GET /api/v1/teams** - List teams

2. **POST /api/v1/teams** - Create team

3. **PUT /api/v1/teams/:id** - Update team

4. **DELETE /api/v1/teams/:id** - Delete team

5. **POST /api/v1/teams/:id/members** - Add user to team

### Governance Policies (Portal + Extension)

1. **GET /api/v1/governance/policies** - List policies
   - Used by both portal and extension
   - Extension caches this
   - Authentication: Portal JWT or Extension JWT

2. **POST /api/v1/governance/policies** - Create policy
   - Triggers policy sync to extensions (webhook or flag)
   - Authentication: Portal JWT (admin only)

3. **PUT /api/v1/governance/policies/:id** - Update policy
   - Triggers policy sync

4. **DELETE /api/v1/governance/policies/:id** - Delete policy
   - Triggers policy sync

5. **POST /api/v1/governance/policies/:id/toggle** - Enable/disable policy
   - Triggers policy sync

### Audit Logs (Portal)

1. **GET /api/v1/audit-logs** - Query audit logs
   - Filters: date range, event type, user, company
   - Uses MongoDB time-series collection queries
   - Pagination

2. **GET /api/v1/audit-logs/export** - Export as CSV
   - Streams CSV file
   - Filters same as query endpoint

### Portal Users (Admins/Managers)

1. **GET /api/v1/portal/admins** - List admins/managers (admin only)

2. **POST /api/v1/portal/admins** - Create admin/manager (admin only)
   - Sends invitation email

3. **PUT /api/v1/portal/admins/:id** - Update admin/manager

4. **DELETE /api/v1/portal/admins/:id** - Deactivate admin/manager

### Company Settings

1. **GET /api/v1/company/settings** - Get company settings

2. **PUT /api/v1/company/settings** - Update settings
   - Retention period, webhook secret, SSO providers

## Portal Pages

### 1. Login Page
- SSO login buttons (Google, Microsoft, Okta)
- Company selection dropdown (if admin has access to multiple companies)
- "New company? Request invitation" link
- Error handling

### 2. Onboarding Flow
- Request Invitation: Form (company name, admin email, preferred SSO)
- Invitation Email: Sent to admin email with token link
- Accept Invitation: Click link → Verify email → Complete SSO setup → Create company and admin account → Initial setup wizard

### 3. Dashboard
- Total sensitive prompts (last 7/30/90 days) - cards
- Risk score distribution chart (pie/bar chart)
- Top users by warning count (table)
- Platform breakdown (bar chart)
- Recent prompts timeline (line chart)
- False positive rate (percentage)
- Team-wise breakdown (table)

### 4. Sensitive Prompts
- Table view with filters
- Columns: Timestamp, User, Team, Platform, Risk Score, Detected Types, False Positive, Actions
- Filters: Date range, user email, team, platform, severity, risk score, false positives only
- Search: Full-text search in prompts
- Actions: Mark as false positive (per row), View details
- Export: CSV/JSON export button
- Pagination: 50/100/200 per page
- Real-time updates (polling every 30s)

### 5. User Management
- List all users (table)
- Create user (modal/form): email, role, team, webhook URL
- Edit user (inline or modal): change role, team, webhook URL
- Deactivate user (soft delete)
- Bulk operations: assign team, role to multiple users
- Import users (CSV upload)

### 6. Team Management
- List teams (table with member count)
- Create team (modal): name, description
- Edit team (inline): name, description
- Assign users to teams (drag-drop or multi-select)
- Team statistics (warnings per team)

### 7. Governance Policies (JSON Editor)
- List policies (table)
- Create policy (JSON editor):
  - **Name**: Text input
  - **Match**: Teams (multi-select), Roles (multi-select), Users (multi-select)
  - **Type**: Enum selector (block_topic, block_keyword, block_domain, require_approval, rate_limit)
  - **Resource**: JSON array editor (with validation)
  - **Effect**: Radio (allow/deny)
  - **Message**: Text input (optional)
- Edit policy
- Enable/disable policy (toggle)
- Policy preview (test against sample prompts)
- Policy sync status (last synced, trigger sync button)

### 8. Audit Logs Viewer
- Query interface:
  - Time range selector (date picker)
  - Event type filter (dropdown)
  - User filter (autocomplete)
  - Team filter (dropdown)
- Table view with pagination
- Columns: Timestamp, Event Type, User, Team, Details
- Export logs (CSV button)
- Statistics (total events, by type, by user)

### 9. Settings
- Company information (read-only)
- Retention period (slider: 30-730 days)
- Webhook secret management (show/regenerate)
- SSO configuration (enable/disable providers: Google, Microsoft, Okta)
- Portal user management (admins/managers):
  - List admins/managers
  - Invite new admin/manager
  - Change role
  - Deactivate
- Export all data (button)
- Delete company (with confirmation modal)

### 10. Analytics
- Trends over time (line chart: warnings per day/week/month)
- Most common sensitive data types (bar chart)
- User behavior patterns (heatmap: user vs time)
- Team comparison (bar chart: warnings per team)
- Policy effectiveness (table: policies and violation counts)
- Compliance reports (PDF export)

## Implementation Phases

### Phase 1: Extension Logging (Week 1-2)
- Create `audit-logger.ts`
- Modify `content.ts` to log sensitive prompts
- Trigger webhook on "Proceed Anyway"
- Store in `chrome.storage.local`
- Retry logic for failed webhooks

### Phase 2: Backend API - Basic (Week 3-4)
- Go API server setup (Gin framework)
- MongoDB connection
- Webhook endpoint with HMAC validation
- User context endpoint (`/api/v1/users/me`)
- SSO authentication (Google OAuth)
- Company onboarding flow

### Phase 3: Portal - Basic (Week 5-6)
- React app setup (Vite + TypeScript)
- Login page with SSO
- Onboarding flow (request + accept)
- Dashboard overview
- Sensitive prompts table
- False positive marking

### Phase 4: User & Team Management (Week 7-8)
- User management page
- Team management page
- Role assignment
- Webhook URL per user
- Bulk operations

### Phase 5: Governance Policies (Week 9-10)
- Policy editor (JSON-based)
- Policy CRUD endpoints
- Policy sync to extension (on trigger + 4h fallback)
- Extension policy enforcement
- Policy testing/preview

### Phase 6: Audit Logs (Week 11-12)
- MongoDB time-series collection setup
- Audit log storage (on webhook)
- Log viewer in portal
- CSV export functionality
- Query interface

### Phase 7: Advanced Features (Week 13+)
- Analytics and charts
- Compliance reports
- Advanced policy types (rate limiting)
- Real-time updates (WebSocket or polling)

## Success Criteria

- Extension logs all sensitive prompts with full context
- Webhook triggers in real-time when user proceeds
- Policies enforced in extension based on user role (JSON-based, AWS IAM-style)
- Admins can manage users, teams, policies via portal
- Sensitive prompts stored in MongoDB regular collection
- Audit logs stored in MongoDB time-series collection
- Portal accessible only to admins/managers
- Users authenticate via extension SSO only
- Multiple SSO providers supported
- Per-user webhook URLs
- Company onboarding via invitation system
- Policy sync on trigger + 4-hour fallback

## Cost Estimation

**MongoDB Atlas**: Free tier (512MB) or $9/month (2GB)
**GCP Cloud Run**: Free tier (2M requests/month), then ~$0-20/month
**Vercel**: Free for frontend
**Total**: $0-30/month for small-medium usage
