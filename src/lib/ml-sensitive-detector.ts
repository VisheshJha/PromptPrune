import { detectSensitiveContent, type SensitiveContentResult, maskSensitiveValue } from "./sensitive-content-detector"

/**
 * ML-based sensitive content detection.
 * These are asynchronous because they may involve model inferences (via background).
 */
export async function detectSensitiveContentML(text: string): Promise<SensitiveContentResult> {
    // 1. Run Regex-based detection first (Fast, High Precision for standard patterns)
    // This is synchronous and runs in the content script immediately
    const regexResult = detectSensitiveContent(text);

    // If text is very long, maybe skip ML or truncate? For now, we send it all but let background handle timeout.

    try {
        // 2. Call Background Service Worker for ML Inference (NER)
        // We use chrome.runtime.sendMessage to offload this to the background
        const mlResponse = await new Promise<any>((resolve, reject) => {
            // Check if extension context is valid
            if (!chrome.runtime?.id) {
                reject(new Error("Extension context invalid"));
                return;
            }

            chrome.runtime.sendMessage({
                type: "DETECT_PII_ML",
                text: text
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });

        if (mlResponse && mlResponse.success && Array.isArray(mlResponse.result)) {
            const mlEntities = mlResponse.result;

            // 3. Merge ML results with Regex results
            // mlEntities format from Transformers.js pipeline (simple aggregation): 
            // [{ entity_group: 'PER', score: 0.99, word: 'John Doe', start: 10, end: 18 }, ...]

            let hasNewDetections = false;

            for (const entity of mlEntities) {
                // Map NER tags to our types
                let type = '';
                let severity: 'low' | 'medium' | 'high' = 'medium';
                let suggestion = '';

                switch (entity.entity_group) {
                    case 'PER':
                        type = 'person_name';
                        // High confidence names are high risk pii
                        severity = entity.score > 0.98 ? 'high' : 'medium';
                        suggestion = '⚠️ Name detected - Consider removing PII';
                        break;
                    case 'LOC':
                        type = 'location';

                        // Smart Context Check for Address/Residency
                        const locContext = text.substring(Math.max(0, entity.start - 30), entity.end + 30).toLowerCase();
                        const isAddressContext = /resident of|lived in|staying at|address|located at|near|flat|bldg|sector|nagar|road|street/i.test(locContext);

                        severity = isAddressContext ? 'high' : 'medium';
                        suggestion = isAddressContext
                            ? '🚨 Likely Address/Residency detected - Consider removing PII (GDPR/India)'
                            : '⚠️ Location detected - Consider removing if sensitive';

                        // Indian Address Context Boost
                        if (/india|bangalore|bengaluru|delhi|mumbai|chennai|kolkata|hyderabad|pune/i.test(entity.word) || /india/i.test(locContext)) {
                            // If it's an Indian city/context, maintain high alertness
                            suggestion += ' (India)';
                        }
                        break;
                    case 'ORG':
                        type = 'organization';
                        severity = 'low'; // Org names are often fine
                        suggestion = '⚠️ Organization detected - Verify if confidential';
                        break;
                    case 'MISC':
                        // Could be anything, usually ignore unless confident
                        if (entity.score > 0.9) {
                            type = 'sensitive_entity';
                            severity = 'medium';
                            suggestion = '⚠️ Sensitive entity detected';
                        }
                        break;
                }

                if (type) {
                    // Check for overlap with existing regex detections
                    // (e.g. dont flag "London" if regex already flagged "London, UK" as address)
                    const isOverlapping = regexResult.detectedItems.some(item => {
                        // Check if ranges overlap
                        return !(entity.end <= item.position || entity.start >= item.position + item.originalValue.length);
                    });

                    if (!isOverlapping) {
                        regexResult.detectedItems.push({
                            type,
                            value: entity.word.replace(/./g, '*'), // Simple mask
                            originalValue: entity.word,
                            severity,
                            position: entity.start,
                            suggestion
                        });
                        hasNewDetections = true;

                        // Add risk score
                        if (severity === 'high') regexResult.riskScore += 20;
                        else if (severity === 'medium') regexResult.riskScore += 10;
                        else regexResult.riskScore += 5;
                    }
                }
            }

            if (hasNewDetections) {
                regexResult.hasSensitiveContent = true;
                regexResult.riskScore = Math.min(100, regexResult.riskScore);
                regexResult.shouldBlock = regexResult.riskScore >= 50;
            }
        }
    } catch (error) {
        // Silent fail for ML layer - fall back to Regex result
        console.warn("[PromptPrune] ML PII detection failed or timed out:", error);
    }

    return regexResult;
}

/**
 * Faster version of ML detection, still async for consistency.
 */
export async function detectSensitiveContentSync(text: string): Promise<SensitiveContentResult> {
    // This is "Sync" in name but Async in signature to match interface if needed,
    // but relies ONLY on fast local regex.
    return detectSensitiveContent(text);
}
