/**
 * ML Engine - Local-First Hybrid Architecture
 *
 * NOTE: This runs in an Offscreen Document context (MV3).
 * This allows WASM compilation (wasm-unsafe-eval) and Web Workers.
 *
 * Architecture:
 * 1. Local Asset Bridge: WASM in /assets; ONNX/model weights via Groot hf-proxy, IndexedDB cache.
 * 2. Hybrid Regex+GLiNER PII: Regex = recall; GLiNER-PII (knowledgator/gliner-pii-small-v1.0) = precision, dynamic entities.
 * 3. Token-Level Pruning + SLM for MATCH_FRAMEWORK.
 *
 * Message queue: VERIFY_PII and OPTIMIZE_PROMPT are queued and processed one-by-one.
 */

import '~/lib/transformers-config';
import { indexedDBModelCache } from '~/lib/indexeddb-model-cache';

// Storage helpers (with safety check for offscreen context)
const getStorage = (keys: string[]): Promise<any> => {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    console.warn('[ML Engine] chrome.storage not available in this context');
    return Promise.resolve({});
  }
  return new Promise(res => chrome.storage.local.get(keys, res));
};
const setStorage = (data: any): Promise<void> => {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    console.warn('[ML Engine] chrome.storage not available in this context');
    return Promise.resolve();
  }
  return new Promise(res => chrome.storage.local.set(data, () => res()));
};

import { env, pipeline } from '@xenova/transformers';
import { Gliner } from 'gliner';

// Gliner specific types/interfaces
import { detectSensitiveContent } from '../lib/sensitive-content-detector';
// Configure ONNX Runtime WASM paths globally before Gliner uses it
import * as ort from 'onnxruntime-web';

// Centralized WASM paths using chrome.runtime.getURL
const wasmPaths = (typeof chrome !== 'undefined' && chrome.runtime?.getURL)
  ? chrome.runtime.getURL('assets/transformers/')
  : '../assets/transformers/';

// Aggressive top-level configuration
const configureOrt = (env: any) => {
  if (!env?.wasm) return;
  env.wasm.wasmPaths = wasmPaths;
  env.wasm.numThreads = 1;
  env.wasm.simd = true; // 1.17.3 has ort-wasm-simd.wasm (non-threaded)
  env.wasm.proxy = false;
};

// Configure both imports and globalThis
configureOrt((ort as any).env);
if ((globalThis as any).ort) configureOrt((globalThis as any).ort.env);

// Set on Transformers.js backend as well
if ((env as any).backends?.onnx?.wasm) {
  const onnxWasm = (env as any).backends.onnx.wasm;
  onnxWasm.wasmPaths = wasmPaths;
  onnxWasm.numThreads = 1;
  onnxWasm.simd = true;
}

// Groot API base (set by background before first ML use). ONNX/tokenizer fetched via {base}/hf-proxy/...
// Use same environment variable replacement as background service worker
const GROOT_BASE_URL_RAW = "__GROOT_API_URL__"
const GROOT_BASE_URL_DEFAULT = GROOT_BASE_URL_RAW === "__GROOT_API_URL__"
  ? "http://localhost:8080/api/v1"
  : GROOT_BASE_URL_RAW

let _grootBase = GROOT_BASE_URL_DEFAULT;
export function setGrootBaseUrl(url: string) {
  _grootBase = url.replace(/\/$/, '');

  // Backend-Proxied: all model requests via Groot hf-proxy
  (env as any).remoteHost = `${_grootBase}/hf-proxy`;
  (env as any).remotePathTemplate = '{model}/resolve/{revision}/';
  (env as any).allowLocalModels = false;

  console.log('[ML Engine] Groot Base URL set:', _grootBase);
  console.log('[ML Engine] Remote Host configured:', (env as any).remoteHost);
}

// Dynamic PII entity labels for GLiNER (zero-shot). Enterprise-ready: person, Indian IDs, financial, email, address.
const entities = [
  'person', 'address', 'aadhaar', 'pan card', 'financial details', 'email',
  'task', 'topic', 'intent', 'role', 'context', 'constraint'
] as const;

// Model instances (lazy loaded)
let glinerModel: Gliner | null = null;
let promptOptimizer: any = null;

/**
 * Check if both models are ready and notify
 */
async function checkAndNotifyBothModelsReady(): Promise<void> {
  try {
    const storage = await getStorage(['pii-model-ready', 'optimizer-model-ready']);
    const piiReady = storage['pii-model-ready'] === true || !!glinerModel;
    const optimizerReady = storage['optimizer-model-ready'] === true || !!promptOptimizer;
    
    if (piiReady && optimizerReady) {
      console.log('[ML Engine] 🎉 Both models ready: PII model ✅ + Optimizer model ✅');
      
      // Set final status
      setStorage({
        'promptprune-model-download-progress': 100,
        'promptprune-model-download-status': 'done',
        'promptprune-models-ready': true,
        'pii-model-ready': true,
        'optimizer-model-ready': true,
      });
      
      // Send notification to content scripts via storage event (more reliable)
      // Content scripts listen for storage changes
      console.log('[ML Engine] 🎉 Both models downloaded! Setting storage flag for content scripts...')
      setStorage({
        'models-download-complete': true,
        'models-download-timestamp': Date.now()
      })
      
      // Also try direct message to tabs
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        try {
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, {
                  type: 'MODELS_DOWNLOADED',
                  piiReady: true,
                  optimizerReady: true
                }).catch(() => {
                  // Ignore errors if content script not loaded on that tab
                });
              }
            });
          });
        } catch (e) {
          console.warn('[ML Engine] Could not send message to tabs:', e);
        }
      }
    } else if (piiReady) {
      console.log('[ML Engine] PII model ready ✅, waiting for Optimizer model...');
    } else if (optimizerReady) {
      console.log('[ML Engine] Optimizer model ready ✅, waiting for PII model...');
    }
  } catch (e) {
    console.warn('[ML Engine] Error checking model readiness:', e);
  }
}

// Request queue for non-blocking operation
interface QueuedRequest {
  id: string;
  type: 'VERIFY_PII' | 'OPTIMIZE_PROMPT';
  payload: any;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

const requestQueue: QueuedRequest[] = [];
let isProcessing = false;

/**
 * Process queued requests one at a time (non-blocking via async)
 */
async function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;

  isProcessing = true;
  const request = requestQueue.shift();

  if (!request) {
    isProcessing = false;
    return;
  }

  try {
    let result;
    if (request.type === 'VERIFY_PII') {
      result = await handlePIIVerification(request.payload);
    } else if (request.type === 'OPTIMIZE_PROMPT') {
      // Add timeout wrapper for optimization (90 seconds max)
      const optimizationTimeout = 90000;
      result = await Promise.race([
        prunePrompt(request.payload),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Optimization timeout after 90s')), optimizationTimeout)
        )
      ]);
    } else {
      throw new Error(`Unknown request type: ${request.type}`);
    }

    request.resolve(result);
  } catch (error) {
    console.error('[ML Engine] processQueue: Error processing', request.type, ':', error);
    request.reject(error instanceof Error ? error : new Error(String(error)));
  } finally {
    isProcessing = false;
    // Process next item in queue (use setTimeout to yield to event loop)
    setTimeout(() => processQueue(), 0);
  }
}

/**
 * Queue a new request
 */
function queueRequest<T>(type: 'VERIFY_PII' | 'OPTIMIZE_PROMPT', payload: any): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = `${type}-${Date.now()}-${Math.random()}`;
    requestQueue.push({ id, type, payload, resolve, reject });
    // Trigger queue processing
    setTimeout(() => processQueue(), 0);
  });
}

const GLINER_PII_MODEL = 'knowledgator/gliner-pii-small-v1.0';

/**
 * Initialize GLiNER-PII (Model A) - Lazy loaded. Zero-shot PII with dynamic entities.
 * ONNX and tokenizer fetched via Groot hf-proxy; WASM from /assets/transformers/ (Local Asset Bridge).
 */
async function initPIIClassifier(): Promise<void> {
  console.log('[ML Engine] initPIIClassifier: entry');
  if (glinerModel) {
    console.log('[ML Engine] initPIIClassifier: already loaded, skip');
    return;
  }
  
  // Check if model was previously initialized (from storage)
  try {
    const storage = await getStorage(['promptprune-models-ready', 'promptprune-model-download-status']);
    if (storage['promptprune-models-ready'] && storage['promptprune-model-download-status'] === 'done') {
      console.log('[ML Engine] initPIIClassifier: Model was previously initialized, but instance lost (extension reload). Will re-initialize (cache should prevent re-download).');
    }
  } catch (e) {
    // Ignore storage errors
  }

  // Defensive: ensure Transformers.js hub uses Groot hf-proxy before any fetch (tokenizer/ONNX)
  // Use current _grootBase (which may have been set via setGrootBaseUrl or uses default from env var)
  const base = _grootBase.replace(/\/$/, '');
  (env as any).remoteHost = `${base}/hf-proxy`;
  (env as any).remotePathTemplate = '{model}/resolve/{revision}/';
  (env as any).allowLocalModels = false;
  
  console.log('[ML Engine] initPIIClassifier: Using Groot base URL:', base);
  
  // Ensure cache is configured on global env (Gliner will use this)
  (env as any).useCustomCache = true;
  (env as any).customCache = indexedDBModelCache;
  (env as any).useBrowserCache = false;
  
  console.log('[ML Engine] Cache configured:', {
    useCustomCache: (env as any).useCustomCache,
    hasCustomCache: !!(env as any).customCache
  });

  // One-time download state for content-script overlay (blocking "please wait" screen)
  const setStorage = (k: Record<string, any>) => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local?.set) chrome.storage.local.set(k);
  };
  setStorage({
    'promptprune-model-download-attempted': 'true',
    'promptprune-model-download-status': 'downloading',
    'promptprune-model-download-progress': 0,
    pii_model_progress: 0,
  });
  console.log('[ML Engine] initPIIClassifier: storage set downloading, remoteHost=', (env as any).remoteHost);

  console.log('[ML Engine] Initializing GLiNER-PII (knowledgator/gliner-pii-small-v1.0)...');
  console.log('[ML Engine] ONNX URL =', `${base}/hf-proxy/${GLINER_PII_MODEL}/resolve/main/onnx/model.onnx`);

  const maxRetries = 3;
  let lastError: any = null;

  // Centralized WASM paths using chrome.runtime.getURL
  const onnxUrl = `${base}/hf-proxy/${GLINER_PII_MODEL}/resolve/main/onnx/model.onnx`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log('[ML Engine] initPIIClassifier: attempt', attempt, 'new Gliner({...})');
      
      // Check cache first to see if model files are already downloaded
      let usingCache = false;
      try {
        const cache = indexedDBModelCache;
        const tokenizerUrl = `${base}/hf-proxy/${GLINER_PII_MODEL}/resolve/main/tokenizer.json`;
        const cachedTokenizer = await cache.match(tokenizerUrl);
        const cachedModel = await cache.match(onnxUrl);
        
        if (cachedTokenizer && cachedModel) {
          usingCache = true;
          console.log('[ML Engine] ✅ Model files found in IndexedDB cache - will use cached versions (no download needed)');
          // Update progress immediately since we're using cache
          setStorage({ 
            'promptprune-model-download-progress': 50, 
            pii_model_progress: 50 
          });
        } else {
          console.log('[ML Engine] ⬇️ Model files not in cache - will download (this is normal on first use)');
        }
      } catch (cacheErr) {
        console.warn('[ML Engine] Cache check failed (non-fatal):', cacheErr);
      }
      
      const gliner = new Gliner({
        tokenizerPath: GLINER_PII_MODEL,
        onnxSettings: {
          modelPath: onnxUrl,
          executionProvider: 'wasm',
          wasmPaths,
          // REVERT: Disable multi-threading. Extension pages lack SharedArrayBuffer
          // which is required for the -threaded runtime. This fixes "Cannot find module" errors.
          multiThread: false,
          numThreads: 1, // Be explicit to force non-threaded build load
          simd: true,    // 1.17.3 has single-threaded SIMD (ort-wasm-simd.wasm)
        } as any,
        transformersSettings: {
          allowLocalModels: false,
          useBrowserCache: false,
          useCustomCache: true,
          customCache: indexedDBModelCache
        } as any,
        maxWidth: 12,
        modelType: 'span-level',
      });
      if (!usingCache) {
        setStorage({ 'promptprune-model-download-progress': 20, pii_model_progress: 20 });
      }
      console.log('[ML Engine] initPIIClassifier: await gliner.initialize() — fetches (tokenizer, ONNX) go to Groot hf-proxy next');
      await gliner.initialize();
      glinerModel = gliner;
      const entitiesToUse = entities.filter(e => !['task', 'topic', 'intent', 'role', 'context', 'constraint'].includes(e));
      
      // Mark PII model as ready
      setStorage({
        pii_model_progress: 100,
        'pii-model-ready': true,
      });
      
      // Update overall progress (PII = 50% of total if optimizer not ready)
      const optimizerReady = !!promptOptimizer;
      setStorage({
        'promptprune-model-download-progress': optimizerReady ? 100 : 50,
        'promptprune-model-download-status': optimizerReady ? 'done' : 'downloading',
        'promptprune-models-ready': optimizerReady, // Only ready if both are done
      });
      
      if (usingCache) {
        console.log('[ML Engine] ✅ GLiNER-PII initialized from cache (entities: ' + entitiesToUse.join(', ') + ') - no download needed');
      } else {
        console.log('[ML Engine] ✅ GLiNER-PII model downloaded and initialized (entities: ' + entitiesToUse.join(', ') + ')');
      }
      
      // Check if optimizer is also ready, then mark both as complete
      checkAndNotifyBothModelsReady();
      return;
    } catch (error: any) {
      lastError = error;
      const msg = error?.message || String(error);
      console.error('[ML Engine] initPIIClassifier: attempt', attempt, 'error:', msg);
      if ((msg.includes('401') || msg.includes('403') || msg.includes('404') || msg.includes('fetch') || msg.includes('Failed')) && attempt < maxRetries) {
        const delay = attempt * 2000;
        console.warn(`[ML Engine] ⚠️ GLiNER load error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      if (attempt === maxRetries) {
        const errMsg = lastError?.message || String(lastError);
        setStorage({
          'promptprune-model-download-status': 'failed',
          'promptprune-model-download-error': errMsg,
        });
        console.error('[ML Engine] ❌ GLiNER-PII init failed after retries:', error);
        console.warn('[ML Engine] ⚠️ Falling back to default PII detection');
        console.warn('[ML Engine] 💡 Ensure Groot is running with HF_TOKEN and hf-proxy reachable');
        return;
      }
    }
  }
  throw lastError;
}

// PrunePrompt: 270M-class SLM, INT4. 
// Primary: Xenova/OpenELM-270M-Instruct (smaller, faster)
// Fallback: Try Qwen2.5-0.5B-Instruct (if available) or use token-level pruning
// Note: Some ONNX models may not have all required files - we fallback gracefully
const OPTIMIZER_MODEL_PRIMARY = 'Xenova/OpenELM-270M-Instruct';
const OPTIMIZER_MODEL_FALLBACK = 'onnx-community/Qwen2.5-0.5B-Instruct';

/**
 * Initialize Prompt Optimizer (Model B) - Lazy loaded when OPTIMIZE or MATCH_FRAMEWORK is used.
 * Uses Qwen2.5-0.5B-Instruct (or OpenELM-270M-Instruct as primary) for intelligent prompt optimization.
 * Uses WebGPU when available to balance thermal load (PII stays on CPU). INT4 quantized.
 * Model weights are cached in IndexedDB after first download.
 * 
 * DISABLED FOR ROLLOUT: Optimizer model download disabled to keep extension light.
 * TODO: Re-enable when ready to launch optimize feature.
 */
async function initPromptOptimizer(): Promise<void> {
  // DISABLED: Optimizer model initialization commented out for rollout
  console.log('[ML Engine] ⚠️ Optimizer model initialization is disabled for rollout');
  return;
  /*
  if (promptOptimizer) return;

  console.log('[ML Engine] Initializing Prompt Optimizer (Model B - PrunePrompt, INT4)...');

  const maxRetries = 3;
  let lastError: any = null;
  const device = (typeof navigator !== 'undefined' && (navigator as any).gpu) ? 'webgpu' : 'cpu';

  const tryModel = async (modelId: string) => {
    console.log('[ML Engine] Attempting to load model:', modelId);
    try {
      const result = await (pipeline as any)('text-generation', modelId, {
        quantized: true,
        device,
        dtype: 'qint4' as any, // Force INT4 to prevent OOM on 8GB machines
        // Use custom cache for model weights (IndexedDB)
        useCustomCache: true,
        customCache: indexedDBModelCache,
        useBrowserCache: false,
        progress_callback: (p: any) => {
          const v = p?.progress ?? (p?.loaded && p?.total ? (p.loaded / p.total) * 100 : 0);
          setStorage({ optimizer_model_progress: v });
        },
      });
      console.log('[ML Engine] Model loaded successfully:', modelId);
      return result;
    } catch (err: any) {
      console.error('[ML Engine] Model load error for', modelId, ':', err?.message || err);
      throw err;
    }
  };

  for (const modelId of [OPTIMIZER_MODEL_PRIMARY, OPTIMIZER_MODEL_FALLBACK]) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        promptOptimizer = await tryModel(modelId);
        console.log('[ML Engine] ✅ Prompt Optimizer model downloaded and initialized (PrunePrompt, INT4, ' + device + ', ' + modelId + ')');
        
        // Mark optimizer as ready
        setStorage({ 
          'optimizer_model_progress': 100,
          'optimizer-model-ready': true
        });
        
        // Update overall progress
        const piiReady = !!glinerModel;
        setStorage({
          'promptprune-model-download-progress': piiReady ? 100 : 75, // 75% if only optimizer ready
          'promptprune-model-download-status': piiReady ? 'done' : 'downloading',
          'promptprune-models-ready': piiReady, // Only ready if both are done
        });
        
        // Check if both models are ready and notify
        checkAndNotifyBothModelsReady();
        return;
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        if ((msg.includes('Unauthorized') || msg.includes('401') || msg.includes('403') || msg.includes('404') || msg.includes('not found')) && attempt < maxRetries) {
          const delay = attempt * 2000;
          console.warn(`[ML Engine] ⚠️ Model error (${modelId}, attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        if (modelId === OPTIMIZER_MODEL_FALLBACK) {
          console.error('[ML Engine] ❌ Prompt Optimizer init failed after retries:', err);
          console.warn('[ML Engine] 💡 Token-level pruning will still work (no model needed)');
          console.warn('[ML Engine] 💡 The model file structure may not be compatible with hf-proxy.');
          console.warn('[ML Engine] 💡 Error details:', err?.message || String(err));
          console.warn('[ML Engine] 💡 This is expected if the ONNX model files are not available. Using fallback optimization.');
          // Don't throw - allow fallback to token-level pruning
          promptOptimizer = null; // Explicitly set to null
          return; // Exit function gracefully
        }
        console.warn('[ML Engine] ⚠️ Primary model unavailable, trying fallback:', OPTIMIZER_MODEL_FALLBACK);
        break; // next model
      }
    }
  }
  // DISABLED: Don't throw error, just return (model disabled for rollout)
  // throw lastError;
  return; // Early return - model disabled
  */
}

type DetectedItem = {
  type: string;
  value: string;
  originalValue: string;
  severity: 'low' | 'medium' | 'high';
  position: number;
  suggestion: string;
  start?: number;
  end?: number;
};

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && a.end > b.start;
}

/**
 * Hybrid PII: Regex (recall) + GLiNER-PII (precision, dynamic entities). Merge and dedupe.
 */
async function handlePIIVerification(payload: { text: string }): Promise<any> {
  const { text } = payload;

  const regexResult = detectSensitiveContent(text);
  const regexItems: DetectedItem[] = (regexResult.detectedItems || []).map((r: any) => ({
    ...r,
    start: r.position,
    end: r.position + (r.originalValue || r.value || '').length,
  }));

  if (!glinerModel) {
    try {
      await initPIIClassifier();
    } catch {
      console.warn('[ML Engine] GLiNER unavailable, using default mode');
    }
  }

  if (!glinerModel) {
    return {
      success: true,
      hasSensitiveContent: regexResult.hasSensitiveContent,
      detectedItems: regexResult.detectedItems,
      riskScore: regexResult.riskScore,
      verifiedByML: false,
      mlUnavailable: true,
    };
  }

  try {
    // Use only PII entities for verification
    const piiEntities = entities.filter(e => ['person', 'address', 'aadhaar', 'pan card', 'financial details', 'email'].includes(e));
    const glinerOut = await glinerModel.inference({
      texts: [payload.text],
      entities: piiEntities as any,
      threshold: 0.3,
      flatNer: true,
    });
    const glinerEntities = (glinerOut[0] || []) as Array<{ spanText: string; start: number; end: number; label: string; score: number }>;

    const merged: DetectedItem[] = [];
    const added: Array<{ start: number; end: number }> = [];

    for (const r of regexItems) {
      merged.push(r);
      added.push({ start: r.start!, end: r.end! });
    }

    for (const g of glinerEntities) {
      const span = { start: g.start, end: g.end };
      if (added.some((a) => overlaps(a, span))) continue;
      merged.push({
        type: g.label,
        value: g.spanText,
        originalValue: g.spanText,
        severity: g.score >= 0.6 ? 'high' : 'medium',
        position: g.start,
        suggestion: `PII (${g.label}) detected`,
        start: g.start,
        end: g.end,
      });
      added.push(span);
    }

    const hasAny = merged.length > 0;
    const risk = hasAny ? Math.min(100, regexResult.riskScore + merged.length * 5) : 0;

    if (!hasAny && !regexResult.hasSensitiveContent) {
      return { success: true, hasSensitiveContent: false, detectedItems: [], riskScore: 0, verifiedByML: true };
    }

    return {
      success: true,
      hasSensitiveContent: hasAny,
      detectedItems: merged,
      riskScore: hasAny ? risk : regexResult.riskScore,
      verifiedByML: true,
      mlPredictions: glinerEntities.length,
    };
  } catch (err) {
    console.error('[ML Engine] GLiNER inference failed, using default mode:', err);
    return {
      success: true,
      hasSensitiveContent: regexResult.hasSensitiveContent,
      detectedItems: regexResult.detectedItems,
      riskScore: regexResult.riskScore,
      verifiedByML: false,
    };
  }
}

/**
 * Token-Level Pruning: Identify and remove filler tokens
 * More efficient than full generation - works at token level
 */
function identifyFillerTokens(tokens: string[]): Set<number> {
  // Common filler words/phrases that can be removed without losing meaning
  const fillerPatterns = [
    // Conversational fluff
    /\b(actually|basically|literally|really|very|quite|rather|pretty|somewhat)\b/gi,
    // Redundant qualifiers
    /\b(kind of|sort of|type of|a bit|a little|a lot)\b/gi,
    // Unnecessary intensifiers
    /\b(extremely|incredibly|absolutely|totally|completely|entirely)\b/gi,
    // Filler phrases
    /\b(I think|I believe|I feel|in my opinion|it seems|it appears)\b/gi,
    // Redundant connectors
    /\b(and also|and then|and so|but also|or else)\b/gi,
    // Unnecessary articles in some contexts
    /\b(the fact that|the thing is|the point is)\b/gi
  ];

  const fillerIndices = new Set<number>();

  tokens.forEach((token, index) => {
    const lowerToken = token.toLowerCase().trim();

    // Check against filler patterns
    for (const pattern of fillerPatterns) {
      if (pattern.test(lowerToken)) {
        fillerIndices.add(index);
        break;
      }
    }

    // Check for very short tokens that are likely filler
    if (lowerToken.length <= 2 && !/^[a-z]$/i.test(lowerToken)) {
      // Skip punctuation and very short words that might be important
      if (!['a', 'i', 'an', 'am', 'is', 'it', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'the'].includes(lowerToken)) {
        fillerIndices.add(index);
      }
    }
  });

  return fillerIndices;
}

/**
 * Fix spelling errors at token level
 */
async function fixSpellingTokens(text: string): Promise<string> {
  // Simple spell check using common word list
  // For production, you'd use a proper spell checker library
  const commonWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their'
  ]);

  // Split into words, check each
  const words = text.split(/(\s+|[.,!?;:])/);
  const corrected = words.map(word => {
    const cleanWord = word.toLowerCase().replace(/[.,!?;:]/g, '');
    // If it's a known word or short, keep it
    if (commonWords.has(cleanWord) || cleanWord.length <= 2 || /^\d+$/.test(cleanWord)) {
      return word;
    }
    // For unknown words, try simple corrections (this is simplified)
    // In production, use a proper spell checker
    return word; // Keep original for now
  });

  return corrected.join('');
}

/**
 * Prompt Optimization: Token-Level Pruning (Local-First)
 * Removes filler tokens and fixes spelling without full model generation
 */
async function prunePrompt(payload: {
  text: string;
  mode: 'SHORTEN' | 'FIX_SPELLING' | 'OPTIMIZE' | 'MATCH_FRAMEWORK';
  frameworks?: string[];
}): Promise<string> {
  const { text, mode } = payload;

  try {
    switch (mode) {
      case 'FIX_SPELLING':
        // Token-level spell checking
        return await fixSpellingTokens(text);

      case 'SHORTEN': {
        // SHORTEN mode: simple token-level pruning for quick shortening
        console.log('[ML Engine] prunePrompt SHORTEN: original length=', text.length);
        
        const tokens = text.split(/(\s+|[.,!?;:()\[\]{}"'])/);
        const fillerIndices = identifyFillerTokens(tokens);
        
        console.log('[ML Engine] prunePrompt SHORTEN: filler tokens found=', fillerIndices.size, 'out of', tokens.length);

        const pruned = tokens
          .map((token, index) => fillerIndices.has(index) ? '' : token)
          .join('')
          .replace(/\s+/g, ' ')
          .replace(/\s+([.,!?;:])/g, '$1')
          .replace(/([.,!?;:])\s+/g, '$1 ')
          .trim();

        const result = pruned || text;
        
        console.log('[ML Engine] prunePrompt SHORTEN: result length=', result.length);
        return result || text;
      }

      case 'OPTIMIZE': {
        // OPTIMIZE mode: Use Qwen model for intelligent AI-optimized prompt rewriting
        console.log('[ML Engine] prunePrompt OPTIMIZE: Using Qwen model for intelligent optimization');
        console.log('[ML Engine] prunePrompt OPTIMIZE: original length=', text.length);
        
        // Skip optimization if text is just a template (empty fields)
        const isTemplate = /^(Role:\s*\nTask:\s*\nContext:\s*\nFormat:\s*\nTone:\s*)$/m.test(text.trim()) ||
                          /^(Role:\s*\nTask:\s*\nContext:\s*\nFormat:\s*\nTone:\s*)$/m.test(text.trim().replace(/\r/g, ''));
        if (isTemplate) {
          console.log('[ML Engine] prunePrompt OPTIMIZE: Text is empty template, skipping optimization');
          return text; // Return template as-is
        }
        
        // DISABLED: Optimizer model initialization commented out for rollout
        // Initialize optimizer model if not already loaded
        if (!promptOptimizer) {
          // DISABLED: Skip optimizer model initialization, use fallback directly
          console.log('[ML Engine] prunePrompt OPTIMIZE: Optimizer model disabled for rollout, using fallback');
          // Clear progress
          setStorage({ 
            'optimizer_model_progress': 0,
            'optimizer_model_status': 'disabled'
          });
          // Fallback to token-level pruning (improved to preserve spaces)
          console.log('[ML Engine] prunePrompt OPTIMIZE: Falling back to token-level pruning');
          // Better approach: split into words, remove filler words, preserve structure
          const words = text.split(/\s+/);
          const fillerWords = ['actually', 'basically', 'literally', 'really', 'very', 'quite', 'rather', 'pretty', 'somewhat', 
                               'kind of', 'sort of', 'type of', 'a bit', 'a little', 'a lot',
                               'extremely', 'incredibly', 'absolutely', 'totally', 'completely', 'entirely',
                               'I think', 'I believe', 'I feel', 'in my opinion', 'it seems', 'it appears',
                               'and also', 'and then', 'and so', 'but also', 'or else',
                               'the fact that', 'the thing is', 'the point is'];
          
          const filtered = words.filter(word => {
            const lower = word.toLowerCase().replace(/[.,!?;:()\[\]{}"']/g, '');
            return !fillerWords.some(filler => lower === filler || lower.includes(filler));
          });
          
          // Reconstruct with proper spacing
          const pruned = filtered.join(' ')
            .replace(/\s+([.,!?;:])/g, '$1') // Remove space before punctuation
            .replace(/([.,!?;:])\s+/g, '$1 ') // Ensure space after punctuation
            .replace(/\s+/g, ' ') // Normalize multiple spaces
            .trim();
          
          return pruned || text;
        }
        
        // DISABLED: Model-based optimization code removed for rollout
        // The code below would use the Qwen model for intelligent optimization
        // Re-enable when ready to launch optimize feature
        // (Code removed to keep extension light and avoid syntax issues)
      }

      case 'MATCH_FRAMEWORK': {
        // DISABLED: Framework matching with optimizer model disabled for rollout
        // For framework matching, we still need model generation
        // But use token-level pruning first, then apply framework style
        if (!promptOptimizer) {
          // DISABLED: Skip optimizer model initialization
          console.log('[ML Engine] prunePrompt MATCH_FRAMEWORK: Optimizer model disabled for rollout, using fallback');
          // await initPromptOptimizer();
        }

        // First, prune filler tokens
        const tokens = text.split(/(\s+|[.,!?;:()\[\]{}"'])/);
        const fillerIndices = identifyFillerTokens(tokens);
        const pruned = tokens
          .map((token, index) => fillerIndices.has(index) ? '' : token)
          .join('')
          .replace(/\s+/g, ' ')
          .trim();

        // DISABLED: Skip model-based framework matching, use fallback
        console.log('[ML Engine] prunePrompt MATCH_FRAMEWORK: Using token-level pruning fallback (model disabled)');
        return pruned; // Return pruned text without framework styling
      }

      default:
        return text;
    }
  } catch (error) {
    console.error('[ML Engine] Token-level pruning failed:', error);
    // Fallback to original text
    return text;
  }
}

/**
 * Main handler function - called from service worker
 */
export async function handleMLEngineRequest(type: string, payload: any): Promise<any> {
  console.log('[ML Engine] handleMLEngineRequest:', type);
  try {
    let result;

    switch (type) {
      case 'VERIFY_PII':
        result = await queueRequest('VERIFY_PII', payload);
        break;

      case 'OPTIMIZE_PROMPT':
        console.log('[ML Engine] OPTIMIZE_PROMPT: Starting optimization, payload=', { 
          textLength: payload?.text?.length || 0, 
          mode: payload?.mode || 'unknown' 
        });
        try {
          result = await queueRequest('OPTIMIZE_PROMPT', payload);
          console.log('[ML Engine] OPTIMIZE_PROMPT: Success, result type:', typeof result, 'length:', typeof result === 'string' ? result.length : 'N/A');
          console.log('[ML Engine] OPTIMIZE_PROMPT result preview:', typeof result === 'string' ? result.substring(0, 100) : result);
        } catch (err) {
          console.error('[ML Engine] OPTIMIZE_PROMPT: Error in queueRequest:', err);
          throw err; // Re-throw to be caught by outer try-catch
        }
        break;

      case 'INIT_MODELS':
        console.log('[ML Engine] INIT_MODELS: calling initPIIClassifier()');
        console.log('[ML Engine] Note: Optimizer model is lazy-loaded (only when MATCH_FRAMEWORK is used)');
        if (payload?.grootBase) {
          setGrootBaseUrl(payload.grootBase);
        }
        await Promise.all([
          initPIIClassifier().catch(err => {
            console.warn('[ML Engine] INIT_MODELS: initPIIClassifier() catch:', err?.message || err);
            return err;
          }),
        ]);
        result = { 
          success: true, 
          piiReady: !!glinerModel,
          optimizerReady: !!promptOptimizer // Will be false until MATCH_FRAMEWORK is used
        };
        console.log('[ML Engine] INIT_MODELS: done, piiReady=', !!glinerModel, 'optimizerReady=', !!promptOptimizer);
        break;

      case 'CHECK_STATUS':
        result = {
          piiReady: !!glinerModel,
          optimizerReady: !!promptOptimizer,
          queueLength: requestQueue.length,
          isProcessing,
        };
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    return { success: true, result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

console.log('[ML Engine] 🚀 Local PII & Optimizer engine initialized (Offscreen Document context)');
