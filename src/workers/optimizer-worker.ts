import { pipeline, env } from '@xenova/transformers';
import type { OptimizerWorkerRequest, OptimizerWorkerResponse } from '../types/worker-types';
import { ModelCache } from '../lib/model-cache';

// Configure transformers
ModelCache.configure();

// Global pipeline instance
let generator: any = null;
// Using Qwen2.5-0.5B-Instruct as discussed
const MODEL_ID = 'Xenova/Qwen2.5-0.5B-Instruct';

// Retry helper
async function withRetry(fn: () => Promise<any>, retries = 3, delay = 1000): Promise<any> {
    try {
        return await fn();
    } catch (e) {
        if (retries > 0) {
            console.warn(`[Optimizer Worker] Retrying... (${retries} left)`);
            await new Promise(r => setTimeout(r, delay));
            return withRetry(fn, retries - 1, delay * 2);
        }
        throw e;
    }
}

// Initialize the model
async function initModel() {
    if (generator) return;

    console.log('[Optimizer Worker] Initializing model:', MODEL_ID);

    const progressCallback = (progress: any) => {
        self.postMessage({
            type: 'MODEL_PROGRESS',
            payload: progress
        });
    };

    try {
        // Use quantized model (will auto-select best device: WebGPU > WASM)
        await withRetry(async () => {
            generator = await pipeline('text-generation', MODEL_ID, {
                quantized: true,
                progress_callback: progressCallback
            });
        });

        console.log('[Optimizer Worker] Model initialized successfully');
    } catch (err) {
        console.error('[Optimizer Worker] Init failed after retries', err);
        throw err;
    }
}

// Helper to construct prompts based on task mode
function createPrompt(mode: string, text: string, frameworks?: string[]): string {
    const systemPrompt = "You are a professional AI prompt engineer and editor. Follow instructions strictly.";

    // Qwen2.5 uses ChatML format: <|im_start|>system\n...\n<|im_end|>\n<|im_start|>user\n...\n<|im_end|>\n<|im_start|>assistant\n

    switch (mode) {
        case 'SHORTEN':
            return `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\nShorten the following prompt while preserving its core intent and meaning. Remove unnecessary fluff. Output ONLY the shortened prompt without quotes or preamble.\n\nPrompt:\n${text}<|im_end|>\n<|im_start|>assistant\n`;

        case 'FIX_SPELLING':
            return `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\nFix any spelling or grammar errors in the following text. Do not change the meaning. Output ONLY the corrected text without preamble.\n\nText:\n${text}<|im_end|>\n<|im_start|>assistant\n`;

        case 'MATCH_FRAMEWORK':
            const frameworkList = frameworks?.join(', ') || "Chain of Thought, Tree of Thoughts, ReAct, RAG, Few-Shot";
            return `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\nAnalyze the following prompt and determine which prompt engineering framework it best fits from this list: [${frameworkList}].\nSelect the single best fit.\nReturn ONLY the name of the framework.\n\nPrompt:\n${text}<|im_end|>\n<|im_start|>assistant\n`;

        case 'OPTIMIZE':
        default:
            return `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\nOptimize the following prompt to be more effective for LLMs. Improve clarity, structure, and persona. Add necessary context if missing.\nOutput ONLY the optimized prompt without quotes or preamble.\n\nPrompt:\n${text}<|im_end|>\n<|im_start|>assistant\n`;
    }
}

self.onmessage = async (e: MessageEvent<OptimizerWorkerRequest>) => {
    const { type, mode, text, frameworks } = e.data;

    if (type !== 'RUN_TASK') {
        return;
    }

    const startTime = performance.now();

    try {
        if (!generator) {
            await initModel();
        }

        const messages = createPrompt(mode, text, frameworks);

        // Run inference
        const output = await generator(messages, {
            max_new_tokens: 512,
            do_sample: false, // Deterministic for tools
            temperature: 0.1,
            return_full_text: false // Optimization: don't return input prompt, works on some pipelines
        });

        // Handle result
        // Some pipelines return full text despite options, so we still parse
        let cleanResult = '';
        if (Array.isArray(output) && output.length > 0) {
            const raw = output[0].generated_text || '';
            // Clean up ChatML artifacts if present
            cleanResult = raw.replace(messages, '').replace(/<\|im_end\|>/g, '').trim();
            // Fallback cleanup
            const sentinels = ["<|im_start|>assistant\n", "Assistant:", "ASSISTANT:"];
            for (const s of sentinels) {
                if (cleanResult.includes(s)) {
                    cleanResult = cleanResult.split(s).pop() || cleanResult;
                }
            }
        }

        const endTime = performance.now();

        const response: OptimizerWorkerResponse = {
            success: true,
            result: cleanResult.trim(),
            stats: {
                originalLength: text.length,
                optimizedLength: cleanResult.trim().length,
                inferenceTime: endTime - startTime
            }
        };

        self.postMessage(response);

    } catch (error) {
        console.error('[Optimizer Worker] Inference error:', error);
        const response: OptimizerWorkerResponse = {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
        self.postMessage(response);
    }
};
