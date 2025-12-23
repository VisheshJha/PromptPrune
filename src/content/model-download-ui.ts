/**
 * Model Download UI
 * Shows download prompt and progress for ML models
 */

import { getUnifiedModelManager } from "~/lib/unified-model-manager"

export interface DownloadProgress {
  progress: number // 0-100
  status: 'idle' | 'downloading' | 'ready' | 'error'
  message: string
}

/**
 * Show download prompt modal
 */
export function showModelDownloadPrompt(): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = document.createElement('div')
    modal.id = 'promptprune-download-modal'
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 100000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `
    
    const content = document.createElement('div')
    content.style.cssText = `
      background: white;
      padding: 32px;
      border-radius: 12px;
      max-width: 500px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `
    
    content.innerHTML = `
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 48px; margin-bottom: 16px;">🚀</div>
        <h2 style="margin: 0 0 8px 0; color: #111827; font-size: 24px; font-weight: 700;">
          Enable Smart Analysis
        </h2>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
          Download AI models for intelligent prompt optimization
        </p>
      </div>
      <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <ul style="margin: 0; padding: 0; list-style: none; color: #374151; line-height: 2;">
          <li style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <span style="color: #10b981; font-size: 20px;">✓</span>
            <span>Works completely offline</span>
          </li>
          <li style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <span style="color: #10b981; font-size: 20px;">✓</span>
            <span>One-time download (~30-50MB)</span>
          </li>
          <li style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <span style="color: #10b981; font-size: 20px;">✓</span>
            <span>Fast and accurate analysis</span>
          </li>
          <li style="display: flex; align-items: center; gap: 12px;">
            <span style="color: #10b981; font-size: 20px;">✓</span>
            <span>Automatic sensitive data detection</span>
          </li>
        </ul>
      </div>
      <div style="display: flex; gap: 12px;">
        <button id="download-yes" style="
          flex: 1;
          padding: 14px 24px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 15px;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
        ">Download & Enable</button>
        <button id="download-no" style="
          padding: 14px 24px;
          background: #ffffff;
          color: #6b7280;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 15px;
          transition: all 0.2s;
        ">Skip</button>
      </div>
    `
    
    modal.appendChild(content)
    document.body.appendChild(modal)
    
    content.querySelector('#download-yes')?.addEventListener('click', () => {
      modal.remove()
      resolve(true)
    })
    
    content.querySelector('#download-no')?.addEventListener('click', () => {
      modal.remove()
      resolve(false)
    })
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove()
        resolve(false)
      }
    })
  })
}

/**
 * Show download progress
 */
export function showDownloadProgress(progress: DownloadProgress): void {
  // Ensure document.body exists
  if (!document.body) {
    console.warn('[PromptPrune] Cannot show progress - document.body not ready')
    // Try again after a short delay
    setTimeout(() => showDownloadProgress(progress), 500)
    return
  }
  
  let progressBar = document.getElementById('promptprune-progress-bar')
  
  if (!progressBar) {
    progressBar = document.createElement('div')
    progressBar.id = 'promptprune-progress-bar'
    progressBar.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 100001;
      min-width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `
    document.body.appendChild(progressBar)
    console.log('[PromptPrune] 📊 Progress bar created and shown')
  }
  
  // Store progress in dataset for tracking
  progressBar.dataset.progress = String(progress.progress)
  
  if (progress.status === 'ready') {
    progressBar.innerHTML = `
      <div style="color: #10b981; font-weight: 600; margin-bottom: 8px;">
        ✅ Models Ready!
      </div>
      <div style="color: #6b7280; font-size: 13px;">
        Smart analysis is now enabled
      </div>
    `
    setTimeout(() => {
      progressBar?.remove()
    }, 3000)
    return
  }
  
  if (progress.status === 'error') {
    progressBar.innerHTML = `
      <div style="color: #dc2626; font-weight: 600; margin-bottom: 8px;">
        ❌ Download Failed
      </div>
      <div style="color: #6b7280; font-size: 13px;">
        ${progress.message}
      </div>
    `
    setTimeout(() => {
      progressBar?.remove()
    }, 5000)
    return
  }
  
  // Hide technical model names from user
  const statusText = progress.status === 'downloading' ? '📥 Downloading AI models...' : '⏳ Preparing...'
  
  progressBar.innerHTML = `
    <div style="color: #374151; font-weight: 600; margin-bottom: 8px; font-size: 14px;">
      ${statusText}
    </div>
    <div style="background: #f3f4f6; border-radius: 4px; height: 8px; margin-bottom: 8px; overflow: hidden;">
      <div style="
        background: linear-gradient(90deg, #10b981 0%, #059669 100%);
        height: 100%;
        width: ${progress.progress}%;
        transition: width 0.3s;
      "></div>
    </div>
    <div style="color: #6b7280; font-size: 13px;">
      ${Math.round(progress.progress)}% complete
    </div>
  `
}

/**
 * Hide progress bar
 */
export function hideDownloadProgress(): void {
  const progressBar = document.getElementById('promptprune-progress-bar')
  if (progressBar) {
    progressBar.remove()
  }
}

/**
 * Download models with progress tracking
 */
export async function downloadModelsWithProgress(): Promise<boolean> {
  const unifiedModel = getUnifiedModelManager()
  
  try {
    showDownloadProgress({
      progress: 0,
      status: 'downloading',
      message: 'Initializing unified model...'
    })
    
    // Download unified model (single model for all tasks)
    showDownloadProgress({
      progress: 20,
      status: 'downloading',
      message: 'Downloading unified model...'
    })
    
    await unifiedModel.initialize()
    
    showDownloadProgress({
      progress: 80,
      status: 'downloading',
      message: 'Finalizing model setup...'
    })
    
    // Small delay to show progress
    await new Promise(resolve => setTimeout(resolve, 500))
    
    showDownloadProgress({
      progress: 100,
      status: 'ready',
      message: 'Model ready!'
    })
    
    // Set flag in localStorage that model is downloaded
    localStorage.setItem('promptprune-unified-model-downloaded', 'true')
    
    return true
  } catch (error) {
    console.warn('[ModelDownload] Download failed, extension will use fallback methods:', error)
    const errorMessage = error instanceof Error ? error.message : 'Download failed'
    
    // Show user-friendly message
    showDownloadProgress({
      progress: 0,
      status: 'error',
      message: `Model unavailable. Extension will work with fallback methods. (${errorMessage.substring(0, 50)})`
    })
    
    // Don't block the extension - it will work with fallbacks
    // Clear the cache flag so it doesn't keep trying
    localStorage.removeItem('promptprune-unified-model-downloaded')
    
    return false
  }
}

