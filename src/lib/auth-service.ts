import { Storage } from "@plasmohq/storage"

const storage = new Storage()

export interface UserProfile {
    id: string
    email: string
    name: string
    picture: string
    hosted_domain?: string
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

            // 3. Persist check (storage is async)
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

        } catch (error) {
            console.error("Logout error:", error)
        }
    }

    async getCurrentUser(): Promise<UserProfile | null> {
        // Fast check from local storage first
        const user = await storage.get<UserProfile>("auth_user")
        if (user) return user

        // Validate session silently if needed
        try {
            const token = await this.getAuthToken(false) // interactive: false
            if (token) {
                // Refresh profile to be safe
                const refreshedUser = await this.fetchUserProfile(token)
                await storage.set("auth_user", refreshedUser)
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
}

export const authService = AuthService.getInstance()
