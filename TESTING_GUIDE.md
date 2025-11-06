# Testing Guide - How to Fix Errors and Run PromptPrune

## Understanding the Errors

The TypeScript errors you see in your IDE are **normal** and expected before dependencies are installed. They will disappear or be resolved during the build process.

## Complete Setup & Testing Steps

### 1. Install Dependencies

```bash
cd /Users/vishesh/Documents/PromptPrune
npm install --ignore-scripts
npm rebuild sharp
```

**Why `--ignore-scripts`?** Some native modules (like @parcel/watcher) can fail to build. We install everything first, then rebuild only what's needed.

### 2. Fix Icon Issue (if needed)

If you get icon errors, Plasmo will generate default icons. You can also create a simple icon:

```bash
# Create a simple 512x512 icon (or use any PNG)
# Plasmo will auto-generate sizes from it
```

Or just proceed - Plasmo will use defaults.

### 3. Build the Extension

```bash
npm run build
```

This creates the extension in `build/chrome-mv3-prod/`

### 4. OR Run in Development Mode

```bash
npm run dev
```

This:
- Builds the extension
- Watches for changes
- Outputs to `build/chrome-mv3-dev/`

### 5. Load in Chrome

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable **"Developer mode"** (top-right toggle)
4. Click **"Load unpacked"**
5. Navigate to: `/Users/vishesh/Documents/PromptPrune/build/chrome-mv3-dev/` (or `-prod` if you built)
6. Select the folder

### 6. Test the Extension

1. **Click the PromptPrune icon** in Chrome toolbar
2. **Test Token Counting:**
   - Enter a prompt in the textarea
   - Go to "Token Count" tab
   - Should see token counts for GPT-4, Claude, Gemini

3. **Test Optimization:**
   - Go to "Optimize" tab
   - Click "Optimize Prompt"
   - Should see optimized version (rule-based, works without Ollama)

4. **Test Savings Calculator:**
   - After optimizing, go to "Savings" tab
   - Should see cost savings estimates

## Running Tests

```bash
# Run all tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage
```

## Troubleshooting

### TypeScript Errors in IDE
- **These are normal!** They appear because the IDE checks types before build
- Plasmo handles TypeScript compilation during build
- Errors should resolve after `npm install`
- If they persist, restart your IDE/TypeScript server

### "Cannot find module" errors
- Run `npm install --ignore-scripts` again
- Check `node_modules` exists
- Restart TypeScript server in your IDE

### Build fails with "sharp" error
```bash
npm rebuild sharp
# Or for your platform:
npm install sharp --platform=darwin --arch=arm64v8
```

### Extension not loading in Chrome
- Check `chrome://extensions/` for error messages
- Make sure you're loading from `build/chrome-mv3-dev/` (not the root folder)
- Try reloading the extension (click the reload icon)

### "No icon found" warning
- This is just a warning, not an error
- Plasmo will use default icons
- Extension will still work

## What Works Without Setup

✅ **Token Counting** - Works immediately, no setup needed
✅ **Rule-Based Optimization** - Works immediately, no setup needed  
✅ **Savings Calculator** - Works immediately, no setup needed
✅ **Copy to Clipboard** - Works immediately

❌ **ML Optimization** - Requires Ollama to be installed and running separately

## Quick Test Checklist

- [ ] Dependencies installed (`npm install --ignore-scripts && npm rebuild sharp`)
- [ ] Extension built (`npm run build` or `npm run dev`)
- [ ] Loaded in Chrome (`chrome://extensions/` → Load unpacked)
- [ ] Icon appears in toolbar
- [ ] Popup opens when clicking icon
- [ ] Token counting works
- [ ] Optimization works (rule-based)
- [ ] Copy button works

## Next Steps After Testing

1. **Test with real prompts** - Try different prompt lengths
2. **Test optimization quality** - Compare original vs optimized
3. **Optional: Set up Ollama** - For ML-based optimization (see SETUP.md)
4. **Run tests** - `npm test` to verify everything works

## Getting Help

If you encounter issues:
1. Check the error message in Chrome (`chrome://extensions/` → Details → Errors)
2. Check terminal output from `npm run dev`
3. Check browser console (right-click extension popup → Inspect)

