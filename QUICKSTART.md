# Quick Start Guide

## Step 1: Install Dependencies

First, install all required packages:

```bash
npm install --ignore-scripts
npm rebuild sharp
```

**Note:** We use `--ignore-scripts` first to avoid native build issues, then rebuild `sharp` which is needed.

This will install:
- React and TypeScript dependencies
- Plasmo framework
- Testing libraries
- Tailwind CSS
- Token counting libraries

**This will fix all the TypeScript errors you're seeing!**

### If you get build errors:
- Make sure Node.js version is 18+: `node --version`
- Try: `npm rebuild` to rebuild native modules
- If sharp fails: `npm install sharp --platform=darwin --arch=arm64v8` (adjust for your platform)

## Step 2: Run Development Server

Start the development server:

```bash
npm run dev
```

This will:
- Compile TypeScript
- Build the extension
- Watch for file changes
- Output the build location (usually `build/chrome-mv3-dev`)

## Step 3: Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top-right corner)
3. Click **"Load unpacked"**
4. Navigate to the `build/chrome-mv3-dev` folder in your project
5. Select the folder and click "Select"

The extension should now appear in your Chrome toolbar!

## Step 4: Test the Extension

1. Click the PromptPrune icon in your Chrome toolbar
2. Try entering a prompt in the textarea
3. Check the "Token Count" tab - you should see token counts
4. Go to "Optimize" tab - try optimizing a prompt
5. Check "Savings" tab after optimizing

## Step 5: Run Tests (Optional)

```bash
npm test
```

Or with coverage:

```bash
npm run test:coverage
```

## Troubleshooting

### "Cannot find module" errors
- Make sure you ran `npm install`
- Delete `node_modules` and `package-lock.json`, then run `npm install` again

### Extension not loading
- Check Chrome's extension error page: `chrome://extensions/`
- Look for red error messages
- Make sure you're loading from `build/chrome-mv3-dev` (not `build/chrome-mv3-prod`)

### Build errors
- Check that Node.js version is 18 or higher: `node --version`
- Try deleting `build` folder and running `npm run dev` again

### TypeScript errors persist
- Make sure all dependencies installed: `npm install`
- Check `tsconfig.json` exists
- Try: `npm run build` to see detailed error messages

## Common Commands

```bash
# Install dependencies
npm install

# Development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## What to Expect

After `npm install`:
- ✅ All TypeScript errors should disappear
- ✅ `node_modules` folder will be created
- ✅ Dependencies will be downloaded

After `npm run dev`:
- ✅ Extension will be built
- ✅ You'll see a build output path
- ✅ Changes will auto-reload

After loading in Chrome:
- ✅ Extension icon appears in toolbar
- ✅ Clicking opens the popup
- ✅ Token counting works immediately
- ✅ Optimization works (rule-based, no Ollama needed)

