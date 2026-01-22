/**
 * Offscreen Page for PromptPrune
 * This page is managed by Plasmo and provides a DOM context for WASM/Web Workers.
 */
import React from "react"
import "../offscreen"

function OffscreenPage() {
    return (
        <div>
            <h1>PromptPrune Offscreen Model Manager</h1>
            <p>This page handles local ML processing in the background.</p>
        </div>
    )
}

export default OffscreenPage
