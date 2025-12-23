# Model Storage & Cross-Platform Behavior

## How Models Are Stored

### Storage Locations:

1. **IndexedDB** (Database: `transformers-cache`)
   - **Where:** Browser's IndexedDB (per-origin)
   - **What:** Actual model files (~53MB)
   - **Managed by:** Transformers.js library
   - **Scope:** Per origin (domain-specific)

2. **localStorage** (Key: `promptprune-unified-model-downloaded`)
   - **Where:** Browser's localStorage (per-origin)
   - **What:** Flag indicating models are downloaded
   - **Scope:** Per origin (domain-specific)

3. **chrome.storage.local** (Extension storage)
   - **Where:** Chrome extension storage (shared)
   - **What:** Settings, flags, saved prompts
   - **Scope:** **Shared across ALL origins** (extension-wide)

---

## Cross-Platform Behavior

### ❌ Models Are NOT Shared Across Platforms

**Why:**
- IndexedDB and localStorage are **origin-specific** (per domain)
- Each platform (ChatGPT, Copilot, Gemini, etc.) is a different origin
- Models downloaded on `chat.openai.com` are NOT available on `copilot.microsoft.com`

### ✅ But Download Logic Is Shared

**How it works:**
1. Extension checks `chrome.storage.local` (shared) for download flag
2. If flag is set, extension tries to download models
3. Models are downloaded to **that specific origin's IndexedDB**
4. Each platform needs its own download

### Example:

```
ChatGPT (chat.openai.com):
  ✅ Models downloaded → Stored in chat.openai.com's IndexedDB
  ✅ Flag set in chat.openai.com's localStorage

Copilot (copilot.microsoft.com):
  ❌ Models NOT downloaded → No models in copilot.microsoft.com's IndexedDB
  ❌ Flag NOT set in copilot.microsoft.com's localStorage

Result: Models need to be downloaded separately for each platform
```

---

## Do You Need to Download for Each Platform?

### **YES** - Models are downloaded per platform

**Current Behavior:**
- Download happens automatically when you visit each platform
- Each platform downloads models to its own IndexedDB
- No sharing between platforms

**Why:**
- Browser security model (origin isolation)
- Each website has its own storage space
- Extension can't share IndexedDB across origins

**What's Shared:**
- ✅ Download flag in `chrome.storage.local` (triggers download on all platforms)
- ✅ Extension settings (shared across platforms)
- ❌ Model files (stored per-origin)

---

## What Happens When Extension Is Removed?

### Storage Cleanup:

1. **chrome.storage.local** ✅ **CLEARED**
   - Extension settings deleted
   - Download flags removed
   - Saved prompts deleted

2. **IndexedDB** ⚠️ **MAY PERSIST** (Browser-dependent)
   - Chrome: Usually cleared, but not guaranteed
   - Firefox: Usually persists
   - Edge: Usually cleared
   - **Note:** Transformers.js models in `transformers-cache` database

3. **localStorage** ⚠️ **MAY PERSIST** (Browser-dependent)
   - Chrome: Usually cleared, but not guaranteed
   - Firefox: Usually persists
   - Edge: Usually cleared
   - **Note:** Flags like `promptprune-unified-model-downloaded`

### Best Practice:

**Manual Cleanup (if needed):**
```javascript
// In browser console on any page:
// Clear IndexedDB
indexedDB.deleteDatabase('transformers-cache')

// Clear localStorage flags
localStorage.removeItem('promptprune-unified-model-downloaded')
localStorage.removeItem('promptprune-model-download-attempted')
```

---

## Storage Size Per Platform

### Per Platform:
- **IndexedDB:** ~53MB (model files)
- **localStorage:** <1KB (flags)
- **Total per platform:** ~53MB

### If You Use 5 Platforms:
- **Total storage:** ~265MB (53MB × 5)
- **Shared storage:** <1KB (extension settings)

---

## Recommendations

### Option 1: Current Behavior (Per-Platform Download)
**Pros:**
- ✅ Automatic download on each platform
- ✅ No manual intervention needed
- ✅ Works with browser security model

**Cons:**
- ❌ Downloads models multiple times
- ❌ Uses more storage (~53MB per platform)
- ❌ Slower first-time experience on each platform

### Option 2: Shared Storage (Future Enhancement)
**Could be improved to:**
- Use `chrome.storage.local` for model files (but limited to 10MB)
- Use SharedArrayBuffer (requires special permissions)
- Use Service Worker cache (complex, may not work)

**Current limitation:** Browser security prevents sharing IndexedDB across origins

---

## Summary

### Questions Answered:

1. **Do I need to download for each platform?**
   - **YES** - Models are downloaded per platform automatically
   - Each platform has its own storage space

2. **Does it download once for all platforms?**
   - **NO** - Each platform downloads separately
   - But download is automatic, so you don't need to do anything

3. **What happens when extension is removed?**
   - Extension storage: ✅ Cleared
   - IndexedDB models: ⚠️ May persist (browser-dependent)
   - localStorage flags: ⚠️ May persist (browser-dependent)
   - **Recommendation:** Manual cleanup if needed

### Current Behavior:
- ✅ **Automatic** - Downloads happen automatically on each platform
- ✅ **Transparent** - You don't need to do anything
- ⚠️ **Per-platform** - Each platform downloads its own copy
- ⚠️ **Storage** - ~53MB per platform used
