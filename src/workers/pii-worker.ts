import { pipeline, env } from '@xenova/transformers';
import type { PIIWorkerRequest, PIIWorkerResponse, PIIEntity } from '../types/worker-types';
import { ModelCache } from '../lib/model-cache';

// Configure transformers
ModelCache.configure();

// Global pipeline instance
let classifier: any = null;
const MODEL_ID = 'Xenova/bert-base-NER';

// Initialize the model
async function initModel() {
    if (classifier) return;

    console.log('[PII Worker] Initializing model:', MODEL_ID);

    // Progress callback
    const progressCallback = (progress: any) => {
        // Transformers.js sends { status: 'progress', file: '...', progress: 0-100, loaded: bytes, total: bytes }
        // or { status: 'initiate', ... } or { status: 'done', ... }
        self.postMessage({
            type: 'MODEL_PROGRESS',
            payload: progress
        });
    };

    try {
        // Use CPU by default for this small model (quantized automatically uses WASM)
        classifier = await pipeline('token-classification', MODEL_ID, {
            quantized: true,
            revision: 'main',
            progress_callback: progressCallback
        });

        console.log('[PII Worker] Model initialized successfully');
    } catch (err) {
        console.error('[PII Worker] Init failed', err);
        throw err;
    }
}

// Handle messages
self.onmessage = async (e: MessageEvent<PIIWorkerRequest>) => {
    const { type, text } = e.data;

    if (type !== 'VERIFY_PII') {
        return;
    }

    try {
        if (!classifier) {
            await initModel();
        }

        // Run inference
        const output = await classifier(text, {
            ignore_labels: ['O'],
            aggregation_strategy: 'simple',
        });

        const entities: PIIEntity[] = output.map((item: any) => ({
            entity: item.entity_group,
            score: item.score,
            index: item.index,
            word: item.word,
            start: item.start,
            end: item.end
        }));

        const response: PIIWorkerResponse = {
            success: true,
            result: entities
        };

        self.postMessage(response);

    } catch (error) {
        console.error('[PII Worker] Inference error:', error);
        const response: PIIWorkerResponse = {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
        self.postMessage(response);
    }
};
