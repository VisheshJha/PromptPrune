/**
 * Model Worker Manager
 * Manages communication with the model Web Worker
 */

export interface WorkerMessage {
  type: string
  payload?: any
}

export interface WorkerResponse {
  type: string
  payload?: any
  error?: string
  originalType?: string
}

class ModelWorkerManager {
  private worker: Worker | null = null
  private messageId = 0
  private pendingMessages = new Map<number, {
    resolve: (value: any) => void
    reject: (error: Error) => void
  }>()

  /**
   * Initialize worker
   */
  async initialize(): Promise<void> {
    if (this.worker) return

    try {
      // Create worker from the worker file
      this.worker = new Worker(
        new URL('../workers/model-worker.ts', import.meta.url),
        { type: 'module' }
      )

      this.worker.addEventListener('message', (event: MessageEvent) => {
        this.handleWorkerMessage(event.data)
      })

      this.worker.addEventListener('error', (error) => {
        console.error('[ModelWorkerManager] Worker error:', error)
        // Reject all pending messages
        this.pendingMessages.forEach(({ reject }) => {
          reject(new Error('Worker error'))
        })
        this.pendingMessages.clear()
      })

      // Initialize model in worker
      await this.sendMessage({ type: 'INIT_MODEL' })
    } catch (error) {
      console.error('[ModelWorkerManager] Failed to initialize worker:', error)
      throw error
    }
  }

  /**
   * Send message to worker and wait for response
   */
  private sendMessage(message: WorkerMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'))
        return
      }

      const id = this.messageId++
      this.pendingMessages.set(id, { resolve, reject })

      // Add timeout
      setTimeout(() => {
        if (this.pendingMessages.has(id)) {
          this.pendingMessages.delete(id)
          reject(new Error('Worker message timeout'))
        }
      }, 30000) // 30 second timeout

      this.worker.postMessage(message)
    })
  }

  /**
   * Handle message from worker
   */
  private handleWorkerMessage(response: WorkerResponse): void {
    // For now, resolve the first pending message
    // In a real implementation, you'd match by message ID
    if (this.pendingMessages.size > 0) {
      const [id, { resolve, reject }] = this.pendingMessages.entries().next().value
      this.pendingMessages.delete(id)

      if (response.type === 'ERROR') {
        reject(new Error(response.error || 'Unknown error'))
      } else {
        resolve(response.payload || response)
      }
    }
  }

  /**
   * Classify intent using worker
   */
  async classifyIntent(text: string): Promise<any> {
    await this.initialize()
    return this.sendMessage({ type: 'CLASSIFY_INTENT', payload: { text } })
  }

  /**
   * Match framework using worker
   */
  async matchFramework(text: string): Promise<any> {
    await this.initialize()
    return this.sendMessage({ type: 'MATCH_FRAMEWORK', payload: { text } })
  }

  /**
   * Detect sensitive content using worker
   */
  async detectSensitive(text: string): Promise<any> {
    await this.initialize()
    return this.sendMessage({ type: 'DETECT_SENSITIVE', payload: { text } })
  }

  /**
   * Spell check using worker
   */
  async spellCheck(text: string): Promise<any> {
    await this.initialize()
    return this.sendMessage({ type: 'SPELL_CHECK', payload: { text } })
  }

  /**
   * Terminate worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
      this.pendingMessages.clear()
    }
  }
}

// Singleton instance
let workerManagerInstance: ModelWorkerManager | null = null

export function getModelWorkerManager(): ModelWorkerManager {
  if (!workerManagerInstance) {
    workerManagerInstance = new ModelWorkerManager()
  }
  return workerManagerInstance
}




