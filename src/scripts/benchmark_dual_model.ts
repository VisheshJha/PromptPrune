/**
 * Benchmark Script for Dual-Model Architecture
 * Tests:
 * 1. PII Verification (Model A) simulation
 * 2. Prompt Optimization (Model B) simulation
 * 3. Service orchestration via SharedModelManager (mocked)
 * 
 * Run with: npx ts-node src/scripts/benchmark_dual_model.ts
 */

import { PIIVerifier } from '../lib/pii-verifier';
import { PromptOptimizer } from '../lib/prompt-optimizer';

// Mock Worker environment for Node.js testing
// Since we can't easily run actual Web Workers in Node without 'web-worker' package setup,
// we will mock the worker response to verify the Service logic and types.

class MockWorker {
    onmessage: ((e: any) => void) | null = null;
    onerror: ((e: any) => void) | null = null;

    constructor(public url: string) {
        console.log(`[MockWorker] Created for ${url}`);
    }

    postMessage(data: any) {
        console.log(`[MockWorker] Received message:`, data);

        // Simulate async processing
        setTimeout(() => {
            if (data.type === 'VERIFY_PII') {
                this.handlePII(data);
            } else if (data.type === 'RUN_TASK') {
                this.handleOptimizer(data);
            }
        }, 100);
    }

    handlePII(data: any) {
        // Simulate Model A finding a person name
        const result = {
            success: true,
            result: [
                { entity: 'PER', score: 0.99, word: 'John', start: 0, end: 4 },
                { entity: 'PER', score: 0.98, word: 'Doe', start: 5, end: 8 }
            ]
        };
        if (this.onmessage) this.onmessage({ data: result });
    }

    handleOptimizer(data: any) {
        // Simulate Model B optimizing text
        let resultText = data.text;
        if (data.mode === 'SHORTEN') resultText = "Shortened: " + data.text.substring(0, 20) + "...";
        else if (data.mode === 'FIX_SPELLING') resultText = "Corrected: " + data.text;
        else if (data.mode === 'MATCH_FRAMEWORK') resultText = "Chain of Thought";

        const result = {
            success: true,
            result: resultText,
            stats: { duration: 150 }
        };
        if (this.onmessage) this.onmessage({ data: result });
    }

    terminate() {
        console.log('[MockWorker] Terminated');
    }

    addEventListener(type: string, listener: any) {
        if (type === 'message') this.onmessage = listener;
        if (type === 'error') this.onerror = listener;
    }

    removeEventListener(type: string, listener: any) {
        if (type === 'message' && this.onmessage === listener) this.onmessage = null;
        if (type === 'error' && this.onerror === listener) this.onerror = null;
    }
}

// Polyfill Worker for Node.js environment
(global as any).Worker = MockWorker;

async function runBenchmark() {
    console.log('--- Starting Dual-Model Benchmark ---');

    // Test 1: PII Verifier
    console.log('\n[Test 1] Testing PIIVerifier Service...');
    const piiVerifier = new PIIVerifier();
    await piiVerifier.init('mock-pii-worker.js');

    const piiResult = await piiVerifier.verify("My name is John Doe and I live in Bangalore.");
    console.log('[PII Result]', JSON.stringify(piiResult, null, 2));

    if (piiResult.length === 2 && piiResult[0].word === 'John') {
        console.log('✅ PII Verification Mock Test Passed');
    } else {
        console.error('❌ PII Verification Mock Test Failed');
    }

    // Test 2: Prompt Optimizer
    console.log('\n[Test 2] Testing PromptOptimizer Service...');
    const optimizer = new PromptOptimizer();
    await optimizer.init('mock-optimizer-worker.js');

    console.log('Testing MATCH_FRAMEWORK mode...');
    const fwResult = await optimizer.runTask('MATCH_FRAMEWORK', "Let's think step by step to solve this math problem.");
    console.log('[Optimizer Result]', fwResult);

    if (fwResult === 'Chain of Thought') {
        console.log('✅ Framework Matching Mock Test Passed');
    } else {
        console.error('❌ Framework Matching Mock Test Failed');
    }

    console.log('\n--- Benchmark Complete ---');
}

runBenchmark().catch(console.error);
