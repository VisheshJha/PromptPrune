# Auto-Download Issue Analysis

## Problem Breakdown

### Why Different Logs Between Platforms?

**ChatGPT Logs:**
```
shouldAutoDownload: false
alreadyDownloaded: false
downloadAttempted: false
flagValue: undefined
```

**Copilot Logs:**
```
shouldAutoDownload: false
alreadyDownloaded: false
downloadAttempted: true  ← DIFFERENT!
flagValue: undefined
```

### Root Cause: `chrome.runtime.onInstalled` Only Fires On:

1. ✅ **First Install** - When extension is installed for the first time
2. ✅ **Extension Update** - When version number changes in manifest
3. ❌ **Extension Reload** - Does NOT fire when you click "Reload" in chrome://extensions
4. ❌ **Browser Restart** - Does NOT fire on browser startup (for existing extensions)

### What Happened:

1. **You already had the extension installed**
2. **You reloaded it** (which doesn't trigger `onInstalled`)
3. **The flag was never set** because `onInstalled` didn't fire
4. **Result**: `flagValue: undefined` → No auto-download triggered

### Why Different Behavior?

**ChatGPT:**
- `downloadAttempted: false` - User never tried to download models
- First time checking, no previous attempts

**Copilot:**
- `downloadAttempted: true` - User previously attempted download (maybe failed or declined)
- This prevents auto-download from triggering again

### The HFIntentExtractor Errors (Separate Issue):

```
[HFIntentExtractor] ❌ Classifier model failed: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

**This is a DIFFERENT model system** (HuggingFace Intent Extractor) trying to load, but:
- Missing `host_permissions` for `https://huggingface.co/*` in manifest
- OR CORS issue
- OR Network problem

**This is NOT the unified model manager** - it's a separate feature that's failing.

## Fixes Applied

### 1. Added `chrome.runtime.onStartup` Listener
- Now checks on browser startup (for existing users)
- Sets auto-download flag if models aren't downloaded

### 2. Fallback Logic in Content Script
- If models aren't downloaded AND user hasn't declined → Auto-download
- Works for existing users who reload the extension

### 3. Better Logging
- Shows exactly why auto-download is skipped
- Helps debug issues

## How to Test

### For New Users:
1. Uninstall extension
2. Reinstall extension
3. `onInstalled` fires → Flag set → Auto-download starts

### For Existing Users:
1. Reload extension
2. Content script checks: models not downloaded + not attempted
3. Auto-download starts automatically

### Manual Trigger (For Testing):
```javascript
// In browser console on any page:
chrome.storage.local.set({ 'promptprune-auto-download': true })
// Then reload the page
```

## Next Steps

1. **Reload the extension** - The new code should now trigger auto-download
2. **Check console** - You should see:
   ```
   [PromptPrune] ✅ Starting automatic model download...
   [PromptPrune] 🚀 Starting background model download...
   ```
3. **Look for progress bar** - Should appear at bottom-right
4. **Check for errors** - If download fails, error will be logged

## Separate Issue: HFIntentExtractor

The `HFIntentExtractor` errors are from a different model system. To fix:
1. Ensure `host_permissions` includes `https://huggingface.co/*` in manifest
2. Reload extension after manifest changes
3. Check network tab for CORS errors

This doesn't affect the unified model manager auto-download feature.
