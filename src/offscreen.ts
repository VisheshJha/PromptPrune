/**
 * Offscreen Script for PromptPrune
 * 
 * Runs in a hidden tab with full DOM access and relaxed CSP.
 * This allows WASM compilation (wasm-unsafe-eval) which is restricted in Service Workers.
 */

console.log('[Offscreen] 🚀 Offscreen document context initialized');

// Keep-alive: Listen for connections from the background to stay active
chrome.runtime.onConnect.addListener((port) => {
    console.log('[Offscreen] 🔌 Keep-alive connection established:', port.name);
    port.onDisconnect.addListener(() => {
        console.log('[Offscreen] 🔌 Keep-alive connection severed');
    });
});

// Import transformers config first to set up environment
import '~/lib/transformers-config';
import { handleMLEngineRequest, setGrootBaseUrl } from './background/ml-engine';

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only handle messages targeted for offscreen
    if (message.target !== 'offscreen') return false;

    console.log('[Offscreen] 📨 Received message:', message.type);

    // Handle async responses
    const handleAsync = async () => {
        try {
            const response = await handleMLEngineRequest(message.type, message.payload);
            sendResponse(response);
        } catch (error: any) {
            console.error('[Offscreen] ❌ Error handling message:', error);
            sendResponse({
                success: false,
                error: error?.message || String(error),
                stack: error?.stack
            });
        }
    };

    handleAsync();
    return true; // Keep channel open for async response
});

// Notify service worker that offscreen is ready
console.log('[Offscreen] ✅ Message listener registered, ready to receive messages');
