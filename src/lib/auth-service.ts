import { Storage } from "@plasmohq/storage"

const storage = new Storage()

export interface UserProfile {
    id: string
    email: string
    name: string
    picture: string
    hosted_domain?: string
}

export interface CompanyConfig {
    isValid: boolean
    companyId?: string
    companyName?: string
    webhookSecret?: string
    webhookUrl?: string
    settings?: any
    subscription?: string
}

// API URL configuration - replaced at build time by fix-manifest.js script
// Default: localhost for development (if placeholder not replaced)
// Production: deploy script replaces __GROOT_API_URL__ with production URL
const GROOT_BASE_URL_RAW = "__GROOT_API_URL__"
const GROOT_BASE_URL = GROOT_BASE_URL_RAW === "__GROOT_API_URL__"
    ? "http://localhost:8080/api/v1"
    : GROOT_BASE_URL_RAW
const GROOT_API_URL = `${GROOT_BASE_URL}/auth/extension/sync`
// Note: This endpoint stores sensitive data (not audit logs)
// Sensitive data goes to MongoDB sensitive_prompts collection for the "Sensitive Data" section in portal
// Audit logs are separate and will be implemented later (will sync to blob storage)
const GROOT_AUDIT_URL = `${GROOT_BASE_URL}/extension/sensitive-prompts`

// Log the API URL on module load for debugging
console.log(`🔧 Groot API URL: ${GROOT_BASE_URL}`)


export interface AuditLogData {
    userEmail: string
    platform: string
    prompt: string
    detectedItems: any[]
    riskScore: number
    metadata: any
}



class AuthService {
    private static instance: AuthService
    private token: string | null = null
    private loginInProgress: boolean = false
    private loginPromise: Promise<UserProfile> | null = null

    private constructor() { }

    static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService()
        }
        return AuthService.instance
    }

    async login(): Promise<UserProfile> {
        // Prevent multiple simultaneous login attempts
        if (this.loginInProgress && this.loginPromise) {
            console.log('⏳ Login already in progress, waiting for existing attempt...')
            return this.loginPromise
        }

        this.loginInProgress = true
        this.loginPromise = this._login().finally(() => {
            this.loginInProgress = false
            this.loginPromise = null
        })

        return this.loginPromise
    }

    private async _login(): Promise<UserProfile> {
        try {
            // Log OAuth configuration for debugging
            try {
                const manifest = chrome.runtime.getManifest()
                console.log("🔐 OAuth Configuration:", {
                    clientId: manifest.oauth2?.client_id || "NOT FOUND",
                    scopes: manifest.oauth2?.scopes || [],
                    extensionId: chrome.runtime.id
                })
            } catch (e) {
                console.warn("Could not read manifest for OAuth config:", e)
            }

            // 1. Get Auth Token
            console.log("🔑 Requesting OAuth token...")
            const token = await this.getAuthToken(true)
            if (!token) throw new Error("Failed to get auth token")

            console.log("✅ OAuth token received")
            this.token = token

            // 2. Fetch User Profile
            const user = await this.fetchUserProfile(token)

            // 3. Sync with Portal (Groot)
            try {
                const config = await this.syncWithPortal(user.email, token)
                console.log("📥 Portal sync response:", {
                    isValid: config.isValid,
                    companyId: config.companyId,
                    hasWebhookSecret: !!config.webhookSecret
                })

                if (config.isValid) {
                    // Store in both storage systems
                    await storage.set("company_config", config)
                    await chrome.storage.local.set({ company_config: config })

                    // Verify it was stored
                    const verify = await chrome.storage.local.get("company_config")
                    console.log("✅ Company config saved and verified:", {
                        stored: !!verify.company_config,
                        isValid: verify.company_config?.isValid,
                        companyId: verify.company_config?.companyId
                    })
                    console.log("✅ Successfully synced with portal, company config saved")
                } else {
                    console.warn("⚠️ User not found in Groot portal or invalid config")
                    // Store invalid config so we know sync was attempted
                    await storage.set("company_config", config)
                    await chrome.storage.local.set({ company_config: config })
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err)
                console.error("❌ Failed to sync with portal:", errorMessage)
                console.warn("⚠️ Extension will work in local mode without portal sync")
                // Don't block login if portal sync fails - allow local testing
                // Set a placeholder config so we know sync was attempted but failed
                const invalidConfig = {
                    isValid: false,
                    companyId: undefined,
                    companyName: undefined,
                    webhookSecret: undefined
                }
                await storage.set("company_config", invalidConfig)
                await chrome.storage.local.set({ company_config: invalidConfig })
            }

            // 4. Persist check (storage is async)
            await storage.set("auth_user", user)
            await storage.set("auth_token", token) // Storing token mainly for quick checks, but use identity.getAuthToken to refresh

            return user
        } catch (error) {
            console.error("Login failed:", error)
            throw error
        }
    }

    async logout(): Promise<void> {
        try {
            const token = await storage.get("auth_token")

            if (token) {
                // Revoke token (best practice)
                await this.revokeToken(token)

                // Remove from Chrome cache
                await new Promise<void>((resolve) => {
                    chrome.identity.removeCachedAuthToken({ token }, () => resolve())
                })
            }

            // Clear local storage
            this.token = null
            await storage.remove("auth_user")
            await storage.remove("auth_token")
            await storage.remove("company_config") // Clear company config on logout
            await chrome.storage.local.remove("company_config") // Also clear from chrome.storage.local

        } catch (error) {
            console.error("Logout error:", error)
        }
    }

    async getCurrentUser(): Promise<UserProfile | null> {
        // Fast check from local storage first
        const user = await storage.get<UserProfile>("auth_user")
        const config = await chrome.storage.local.get("company_config")

        // If user exists but no config, trigger sync
        if (user && (!config.company_config || !config.company_config.isValid)) {
            console.log("⚠️ User logged in but no company config found - triggering sync...")
            try {
                const token = await this.getAuthToken(false) // interactive: false
                if (token) {
                    const syncedConfig = await this.syncWithPortal(user.email, token)
                    if (syncedConfig.isValid) {
                        await storage.set("company_config", syncedConfig)
                        await chrome.storage.local.set({ company_config: syncedConfig })
                        console.log("✅ Company config synced on getCurrentUser")
                    }
                }
            } catch (err) {
                console.warn("Failed to sync config on getCurrentUser:", err)
            }
        }

        if (user) return user

        // Validate session silently if needed
        try {
            const token = await this.getAuthToken(false) // interactive: false
            if (token) {
                // Refresh profile to be safe
                const refreshedUser = await this.fetchUserProfile(token)
                await storage.set("auth_user", refreshedUser)

                // Also sync config if we have a valid token
                try {
                    const syncedConfig = await this.syncWithPortal(refreshedUser.email, token)
                    if (syncedConfig.isValid) {
                        await storage.set("company_config", syncedConfig)
                        await chrome.storage.local.set({ company_config: syncedConfig })
                        console.log("✅ Company config synced on getCurrentUser (refreshed)")
                    }
                } catch (err) {
                    console.warn("Failed to sync config on getCurrentUser (refreshed):", err)
                }

                return refreshedUser
            }
        } catch {
            // Session expired
        }

        return null
    }

    private getAuthToken(interactive: boolean): Promise<string> {
        return new Promise((resolve, reject) => {
            const manifest = chrome.runtime.getManifest()
            const clientId = manifest.oauth2?.client_id

            if (!clientId) {
                reject(new Error("OAuth client ID not found in manifest"))
                return
            }

            // Build OAuth URL - use authorization code flow with Chrome extension redirect
            // Chrome extensions use a special redirect URI: https://<extension-id>.chromiumapp.org/
            const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`

            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${encodeURIComponent(clientId)}&` +
                `response_type=code&` +
                `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                `scope=${encodeURIComponent('https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile')}&` +
                `access_type=offline&` +
                `prompt=consent select_account`

            console.log('🔑 Using Chrome Identity API (standard Chrome extension OAuth)')
            console.log('🔑 Extension ID:', chrome.runtime.id)
            console.log('🔑 Redirect URI:', redirectUri)

            chrome.identity.launchWebAuthFlow({
                url: authUrl,
                interactive: interactive
            }, async (responseUrl) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message || "Unknown error"))
                    return
                }

                if (!responseUrl) {
                    reject(new Error("No response URL from OAuth flow"))
                    return
                }

                console.log('✅ OAuth response received')

                try {
                    const url = new URL(responseUrl)
                    const error = url.searchParams.get('error')
                    if (error) {
                        const errorDesc = url.searchParams.get('error_description') || error
                        reject(new Error(`OAuth error: ${errorDesc}`))
                        return
                    }

                    const code = url.searchParams.get('code')
                    if (!code) {
                        reject(new Error('No authorization code in OAuth response'))
                        return
                    }

                    console.log('🔄 Exchanging authorization code for access token...')

                    // Exchange code for token via backend
                    const token = await this.exchangeCodeForToken(code, redirectUri)

                    console.log('✅ Access token received')
                    resolve(token)

                } catch (err) {
                    reject(new Error(`Failed to process OAuth response: ${err instanceof Error ? err.message : String(err)}`))
                }
            })
        })
    }

    private async exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
        const exchangeUrl = `${GROOT_BASE_URL}/auth/extension/exchange`

        const response = await fetch(exchangeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code,
                redirect_uri: redirectUri,
                extensionId: chrome.runtime.id // Send extension ID for account linking
            })
        })

        if (!response.ok) {
            // Try to parse error response for user-friendly messages
            try {
                const errorData = await response.json()

                // Handle specific error: user not registered in portal
                if (errorData.error === 'user_not_registered') {
                    throw new Error(`Not registered: ${errorData.description || 'Please register on the portal first.'}`)
                }

                // Generic error with description
                throw new Error(errorData.description || errorData.error || `Token exchange failed: ${response.status}`)
            } catch (parseError) {
                // If JSON parsing fails, use generic error
                const errorText = await response.text().catch(() => 'Unknown error')
                throw new Error(`Token exchange failed: ${response.status} ${errorText}`)
            }
        }

        const data = await response.json()
        if (!data.access_token) {
            throw new Error('No access token in response')
        }

        return data.access_token
    }

    private async fetchUserProfile(token: string): Promise<UserProfile> {
        const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })

        if (!response.ok) {
            throw new Error("Failed to fetch user profile")
        }

        return await response.json()
    }

    private async revokeToken(token: string): Promise<void> {
        await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`)
    }

    private async syncWithPortal(email: string, token: string): Promise<CompanyConfig> {
        console.log(`📡 Syncing with portal: ${GROOT_API_URL} for email: ${email}`)
        try {
            const response = await fetch(GROOT_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // "Authorization": `Bearer ${token}` // Optional: Send Google token for extra verification if needed later
                },
                body: JSON.stringify({
                    email,
                    extensionId: chrome.runtime.id // Send extension ID for account linking
                })
            })

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error')
                console.error(`❌ Portal sync failed: ${response.status} ${response.statusText}`, errorText)
                throw new Error(`Failed to sync with portal: ${response.status} ${response.statusText} - ${errorText}`)
            }

            const config = await response.json()
            console.log("📥 Portal sync response received:", {
                isValid: config.isValid,
                companyId: config.companyId,
                companyName: config.companyName,
                hasWebhookSecret: !!config.webhookSecret
            })
            return config
        } catch (error) {
            // Provide more helpful error messages
            if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                console.error(`❌ Cannot connect to portal: ${GROOT_API_URL}`)
                throw new Error(`Failed to sync with portal: Cannot connect to ${GROOT_API_URL}. Is the portal server running?`)
            }
            throw error
        }
    }

    // Sends sensitive data to portal when user proceeds despite warning
    // This stores in MongoDB sensitive_prompts collection (not audit_logs)
    // Shows up in the "Sensitive Data" section of the portal
    async sendAuditLog(data: AuditLogData): Promise<void> {
        const config = await storage.get<CompanyConfig>("company_config")
        const hasValidConfig = config && config.isValid && config.companyId

        if (!hasValidConfig) {
            console.warn("⚠️ Missing company config - attempting to send anyway (for testing)")
            console.warn("💡 This usually means:")
            console.warn("   1. Portal server is not accessible (check https://groot-backend-prod-luun7betqa-el.a.run.app)")
            console.warn("   2. User is not registered in the portal")
            console.warn("   3. Portal sync failed during login")
            console.warn("💡 Still attempting to send to portal for testing purposes...")
        }

        // Always attempt to send to portal's sensitive-prompts endpoint
        // This stores in MongoDB sensitive_prompts collection for the "Sensitive Data" section
        // Note: Audit logs are separate and will be implemented later
        try {
            const headers: Record<string, string> = {
                "Content-Type": "application/json"
            }

            // Add company headers if available
            if (config?.companyId) {
                headers["X-Company-Id"] = config.companyId
            }
            if (config?.webhookSecret) {
                headers["X-Webhook-Secret"] = config.webhookSecret
            }

            console.log(`📤 Attempting to send sensitive data to portal: ${GROOT_AUDIT_URL}`)
            console.log(`📤 Headers:`, headers)
            console.log(`📤 Data:`, {
                userEmail: data.userEmail,
                platform: data.platform,
                riskScore: data.riskScore,
                detectedItemsCount: data.detectedItems?.length || 0
            })

            const response = await fetch(GROOT_AUDIT_URL, {
                method: "POST",
                headers,
                body: JSON.stringify(data)
            })

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error')
                console.error(`❌ Failed to send audit log to portal: ${response.status} ${response.statusText}`)
                console.error(`❌ Response:`, errorText)
                if (response.status === 401 || response.status === 403) {
                    console.error("💡 Authentication failed - check if company config is valid")
                } else if (response.status === 400) {
                    console.error("💡 Bad request - check if data format is correct")
                }
            } else {
                const responseText = await response.text().catch(() => '')
                console.log("✅ Sensitive data sent to portal successfully")
                console.log("✅ Response:", responseText || '(empty response)')
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            console.error(`❌ Failed to send audit log: ${errorMessage}`)
            if (errorMessage.includes('Failed to fetch')) {
                console.error(`❌ Cannot connect to portal at ${GROOT_AUDIT_URL}`)
                console.error("💡 Is the portal server accessible? Check https://groot-backend-prod-luun7betqa-el.a.run.app")
                console.error("💡 Check browser console for CORS errors")
            } else {
                console.error("❌ Error details:", error)
            }
        }
    }
}

export const authService = AuthService.getInstance()
