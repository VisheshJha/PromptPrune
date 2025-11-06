# Icon Requirements for PromptPrune

## Quick Answer

**Location:** `assets/icon.png`  
**Format:** PNG  
**Size:** 512x512 pixels (recommended) or any square size (256x256, 1024x1024, etc.)  
**What it should show:** Anything related to "P" for PromptPrune, or a pruning/optimization symbol

## Details

### Where to Save
```
PromptPrune/
└── assets/
    └── icon.png  ← Save your icon here
```

### Format & Size
- **Format:** PNG (required)
- **Size:** 512x512 pixels is ideal, but Plasmo will auto-resize from any square size
- **Minimum:** 128x128 pixels
- **Maximum:** 1024x1024 pixels (larger is fine, but 512x512 is optimal)

### What Plasmo Does
Plasmo will automatically generate these sizes from your icon:
- 16x16 (toolbar)
- 32x32 (toolbar)
- 48x48 (extension management page)
- 128x128 (Chrome Web Store)

So you only need to provide **one icon file**!

## How to Create/Get an Icon

### Option 1: Use Any Image
1. Find any square PNG image (512x512 or larger)
2. Rename it to `icon.png`
3. Save it in the `assets/` folder

### Option 2: Create Online
Use any online icon generator:
- https://www.favicon-generator.org/
- https://realfavicongenerator.net/
- https://www.canva.com/ (create 512x512 design)

### Option 3: Use a Simple Design
- Blue background (#0ea5e9)
- White letter "P" in the center
- Or a pruning/optimization symbol

### Option 4: Use an AI Image Generator
Ask for: "A simple icon for a Chrome extension called PromptPrune, 512x512, blue background, white P letter, minimalist style"

## Quick Test

After adding your icon:

```bash
npm run build
```

If it works, you'll see:
```
✅ INFO   | Icon found in assets directory
```

Instead of:
```
❌ ERROR  | Failed to resolve './gen-assets/icon128.plasmo.png'
```

## Example Icon Ideas

- Letter "P" on blue background
- Scissors/pruning tool (for "pruning" prompts)
- Optimization symbol (arrow pointing down)
- Token/coin symbol
- Simple geometric design

## File Structure After Adding Icon

```
PromptPrune/
├── assets/
│   └── icon.png  ← Your icon here
├── src/
├── package.json
└── ...
```

That's it! Just one file, and Plasmo handles the rest.

