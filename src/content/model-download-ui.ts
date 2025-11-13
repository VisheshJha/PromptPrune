/**
 * Model Download UI
 * Shows download prompt and progress for ML models
 */

import { getModelManager } from "~/lib/model-manager"

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
      <h2 style="margin: 0 0 16px 0; color: #10b981; font-size: 24px;">
        🚀 Enable Smart Analysis
      </h2>
      <p style="margin: 0 0 20px 0; color: #374151; line-height: 1.6;">
        Download AI models (~163MB) for intelligent prompt optimization?
      </p>
      <ul style="margin: 0 0 24px 0; padding-left: 24px; color: #6b7280; line-height: 1.8;">
        <li>✅ Works completely offline</li>
        <li>✅ One-time download (cached forever)</li>
        <li>✅ Fast and accurate analysis</li>
        <li>✅ Detects sensitive data automatically</li>
      </ul>
      <div style="display: flex; gap: 12px;">
        <button id="download-yes" style="
          flex: 1;
          padding: 12px 24px;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
        ">Download & Enable</button>
        <button id="download-no" style="
          flex: 1;
          padding: 12px 24px;
          background: #f3f4f6;
          color: #374151;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
        ">Use Basic Mode</button>
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
  }
  
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
  
  progressBar.innerHTML = `
    <div style="color: #374151; font-weight: 600; margin-bottom: 8px;">
      ${progress.status === 'downloading' ? '📥 Downloading Models...' : '⏳ Preparing...'}
    </div>
    <div style="background: #f3f4f6; border-radius: 4px; height: 8px; margin-bottom: 8px; overflow: hidden;">
      <div style="
        background: #10b981;
        height: 100%;
        width: ${progress.progress}%;
        transition: width 0.3s;
      "></div>
    </div>
    <div style="color: #6b7280; font-size: 13px;">
      ${progress.message || `${Math.round(progress.progress)}%`}
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
  const modelManager = getModelManager()
  
  try {
    showDownloadProgress({
      progress: 0,
      status: 'downloading',
      message: 'Initializing models...'
    })
    
    // Download embedder first (smallest, most useful)
    showDownloadProgress({
      progress: 10,
      status: 'downloading',
      message: 'Downloading embedder (MiniLM)...'
    })
    await modelManager.initializeEmbedder()
    
    showDownloadProgress({
      progress: 40,
      status: 'downloading',
      message: 'Downloading classifier (DistilBERT)...'
    })
    await modelManager.initializeClassifier()
    
    showDownloadProgress({
      progress: 70,
      status: 'downloading',
      message: 'Downloading NER model (DistilBERT)...'
    })
    await modelManager.initializeNER()
    
    showDownloadProgress({
      progress: 100,
      status: 'ready',
      message: 'All models ready!'
    })
    
    // Set flag in localStorage that models are downloaded
    localStorage.setItem('promptprune-models-downloaded', 'true')
    
    return true
  } catch (error) {
    console.error('[ModelDownload] Download failed:', error)
    showDownloadProgress({
      progress: 0,
      status: 'error',
      message: error instanceof Error ? error.message : 'Download failed'
    })
    return false
  }
}

