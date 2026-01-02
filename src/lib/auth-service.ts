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

const GROOT_BASE_URL = "https://groot-backend-prod-luun7betqa-el.a.run.app/api/v1"
const GROOT_API_URL = `${GROOT_BASE_URL}/auth/extension/sync`
// Note: This endpoint stores sensitive data (not audit logs)
// Sensitive data goes to MongoDB sensitive_prompts collection for the "Sensitive Data" section in portal
// Audit logs are separate and will be implemented later (will sync to blob storage)
const GROOT_AUDIT_URL = `${GROOT_BASE_URL}/extension/sensitive-prompts`


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

    private constructor() { }

    static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService()
        }
        return AuthService.instance
    }

    async login(): Promise<UserProfile> {
        try {
            // 1. Get Auth Token
            const token = await this.getAuthToken(true)
            if (!token) throw new Error("Failed to get auth token")

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
            chrome.identity.getAuthToken({ interactive }, (token) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError.message || "Unknown auth error")
                } else if (!token) {
                    reject("Failed to retrieve token")
                } else {
                    resolve(token)
                }
            })
        })
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
                body: JSON.stringify({ email })
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
