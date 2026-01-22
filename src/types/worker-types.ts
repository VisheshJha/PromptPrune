export interface ModelConfig {
    modelId: string
    quantized: boolean
    task: string
    executionProvider: 'cpu' | 'wasm' | 'webgpu'
}

// --- PII Verification (Model A) ---

export interface PIIWorkerRequest {
    type: 'VERIFY_PII'
    text: string
    // Pass regex detections to be verified/refined
    regexFlags?: Array<{
        type: string
        value: string
        position: number
    }>
}

export interface PIIEntity {
    entity: string
    score: number
    index: number
    word: string
    start: number
    end: number
}

export interface PIIWorkerResponse {
    success: boolean
    result?: PIIEntity[]
    error?: string
}

// --- Prompt Optimization (Model B) ---

export type OptimizationMode = 'SHORTEN' | 'FIX_SPELLING' | 'OPTIMIZE' | 'MATCH_FRAMEWORK'

export interface OptimizerWorkerRequest {
    type: 'RUN_TASK'
    mode: OptimizationMode
    text: string
    frameworks?: string[] // For MATCH_FRAMEWORK mode
}

export interface OptimizerWorkerResponse {
    success: boolean
    result?: string
    stats?: {
        originalLength: number
        optimizedLength: number
        inferenceTime: number
    }
    error?: string
}

// --- Shared Worker/Service Types ---

export interface WorkerMessage<T> {
    id: string
    data: T
}

export interface ModelStatus {
    modelId: string
    status: 'unloaded' | 'loading' | 'ready' | 'failed'
    progress?: number
    error?: string
}
