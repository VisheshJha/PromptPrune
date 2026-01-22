/**
 * Preview Modal for PromptPrune
 * Shows a comparison between original and optimized prompt.
 */

export class PreviewModal {
    private element: HTMLElement
    private shadowRoot: ShadowRoot
    private onApply: ((text: string) => void) | null = null
    private onCancel: (() => void) | null = null

    constructor() {
        this.element = document.createElement('div')
        this.element.id = 'promptprune-preview-modal'
        this.element.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 2147483647;
            pointer-events: none; /* Allow clicks to pass through when hidden */
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s ease-in-out;
        `
        this.shadowRoot = this.element.attachShadow({ mode: 'open' })
        this.render()
        document.body.appendChild(this.element)
    }

    show(original: string, optimized: string, onApply: (text: string) => void, onCancel?: () => void) {
        this.onApply = onApply
        this.onCancel = onCancel || null

        const originalEl = this.shadowRoot.getElementById('original-text') as HTMLTextAreaElement
        const optimizedEl = this.shadowRoot.getElementById('optimized-text') as HTMLTextAreaElement

        console.log('[PreviewModal] show called with:', {
            originalLength: original?.length || 0,
            optimizedLength: optimized?.length || 0,
            optimizedType: typeof optimized,
            optimizedPreview: typeof optimized === 'string' ? optimized.substring(0, 50) : optimized
        })

        if (originalEl) {
            originalEl.value = original || ''
            console.log('[PreviewModal] Set original textarea value, length:', originalEl.value.length)
        }
        if (optimizedEl) {
            // Ensure we have a valid string
            const optimizedText = (typeof optimized === 'string' && optimized.trim()) ? optimized : original || ''
            optimizedEl.value = optimizedText
            console.log('[PreviewModal] Set optimized textarea value, length:', optimizedEl.value.length, 'text:', optimizedEl.value.substring(0, 50))
        }

        this.element.style.pointerEvents = 'auto'
        this.element.style.opacity = '1'
    }

    hide() {
        this.element.style.opacity = '0'
        this.element.style.pointerEvents = 'none'
        if (this.onCancel) this.onCancel()
    }

    private render() {
        const style = document.createElement('style')
        style.textContent = `
            :host {
                --pp-bg: #ffffff;
                --pp-text: #1f2937;
                --pp-border: #e5e7eb;
                --pp-primary: #10b981;
                --pp-primary-dark: #059669;
                --pp-danger: #ef4444;
            }
            
            @media (prefers-color-scheme: dark) {
                :host {
                    --pp-bg: #1f2937;
                    --pp-text: #f3f4f6;
                    --pp-border: #374151;
                }
            }

            .modal-overlay {
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
            }

            .modal-content {
                background: var(--pp-bg);
                color: var(--pp-text);
                border-radius: 12px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                width: 90%;
                max-width: 800px;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
                position: relative;
                z-index: 10;
                overflow: hidden;
                border: 1px solid var(--pp-border);
            }

            .header {
                padding: 16px 24px;
                border-bottom: 1px solid var(--pp-border);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .title {
                font-size: 18px;
                font-weight: 600;
                margin: 0;
            }

            .close-btn {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 24px;
                color: #9ca3af;
                padding: 0;
                line-height: 1;
            }

            .close-btn:hover {
                color: var(--pp-text);
            }

            .body {
                padding: 24px;
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 24px;
                overflow-y: auto;
            }

            .column {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .label {
                font-size: 14px;
                font-weight: 500;
                color: #6b7280;
            }

            textarea {
                width: 100%;
                height: 300px;
                padding: 12px;
                border: 1px solid var(--pp-border);
                border-radius: 8px;
                background: rgba(0,0,0,0.02);
                color: var(--pp-text);
                font-family: monospace;
                font-size: 14px;
                resize: none;
                box-sizing: border-box;
            }
            
            textarea:focus {
                outline: 2px solid var(--pp-primary);
                border-color: transparent;
            }

            .footer {
                padding: 16px 24px;
                border-top: 1px solid var(--pp-border);
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                background: rgba(0,0,0,0.02);
            }

            .btn {
                padding: 8px 16px;
                border-radius: 6px;
                font-weight: 500;
                cursor: pointer;
                border: 1px solid transparent;
                transition: all 0.2s;
            }

            .btn-secondary {
                background: white;
                border-color: var(--pp-border);
                color: var(--pp-text);
            }

            .btn-secondary:hover {
                background: #f9fafb;
            }

            .btn-primary {
                background: var(--pp-primary);
                color: white;
            }

            .btn-primary:hover {
                background: var(--pp-primary-dark);
            }
            
            @media (prefers-color-scheme: dark) {
                .btn-secondary {
                    background: #374151;
                    border-color: #4b5563;
                }
                .btn-secondary:hover {
                    background: #4b5563;
                }
                
                textarea {
                    background: rgba(255,255,255,0.05);
                }
            }
        `

        const container = document.createElement('div')
        container.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content" role="dialog" aria-labelledby="modal-title" aria-modal="true">
                <header class="header">
                    <h2 class="title" id="modal-title">Review Changes</h2>
                    <button class="close-btn" aria-label="Close">&times;</button>
                </header>
                <div class="body">
                    <div class="column">
                        <span class="label">Original</span>
                        <textarea id="original-text" readonly></textarea>
                    </div>
                    <div class="column">
                        <span class="label">Optimized</span>
                        <textarea id="optimized-text"></textarea>
                    </div>
                </div>
                <div class="footer">
                    <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
                    <button class="btn btn-primary" id="apply-btn">Apply Changes</button>
                </div>
            </div>
        `

        this.shadowRoot.appendChild(style)
        this.shadowRoot.appendChild(container)

        // Event Listeners
        this.shadowRoot.querySelector('.close-btn')?.addEventListener('click', () => this.hide())
        this.shadowRoot.querySelector('.modal-overlay')?.addEventListener('click', () => this.hide())
        this.shadowRoot.getElementById('cancel-btn')?.addEventListener('click', () => this.hide())

        this.shadowRoot.getElementById('apply-btn')?.addEventListener('click', () => {
            const optimizedText = (this.shadowRoot.getElementById('optimized-text') as HTMLTextAreaElement).value
            if (this.onApply) this.onApply(optimizedText)
            this.hide()
        })
    }
}

// Singleton
let previewModal: PreviewModal | null = null

export function getPreviewModal(): PreviewModal {
    if (!previewModal) {
        previewModal = new PreviewModal()
    }
    return previewModal
}
