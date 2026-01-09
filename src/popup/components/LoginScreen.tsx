import React, { useState } from "react"
import { authService } from "~/lib/auth-service"

interface LoginScreenProps {
    onLoginSuccess: () => void
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleLogin = async () => {
        setIsLoading(true)
        setError(null)
        try {
            await authService.login()
            
            // Notify all content scripts that login succeeded
            try {
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        if (tab.id) {
                            chrome.tabs.sendMessage(tab.id, { type: 'AUTH_STATE_CHANGED', loggedIn: true }).catch(() => {
                                // Ignore errors (tab might not have content script)
                            })
                        }
                    })
                })
            } catch (err) {
                console.warn("Failed to notify content scripts:", err)
            }
            console.log("Login successful")
            onLoginSuccess()
        } catch (err: any) {
            console.error("Login failed", err)

            // Better error messages for different error types
            const errorMessage = err.message || String(err)
            
            if (errorMessage.toLowerCase().includes("oauth") || 
                errorMessage.toLowerCase().includes("authentication")) {
                setError(`Authentication Error: ${errorMessage}`)
            } else {
                setError(`Failed to sign in: ${errorMessage}`)
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex flex-col items-center justify-center h-[500px] bg-white p-8">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
            </div>

            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Welcome to PromptPrune</h1>
            <p className="text-gray-500 text-center mb-8 max-w-xs">
                Please sign in to access prompt optimization and security features.
            </p>

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md w-full text-center">
                    {error}
                </div>
            )}

            <button
                onClick={handleLogin}
                disabled={isLoading}
                className="flex items-center justify-center w-full max-w-xs px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isLoading ? (
                    <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Signing in...
                    </span>
                ) : (
                    <span className="flex items-center">
                        <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                            />
                        </svg>
                        Sign in with Google
                    </span>
                )}
            </button>

            <div className="mt-8 text-xs text-gray-400">
                Enterprise-grade security by PromptPrune
            </div>
        </div>
    )
}
