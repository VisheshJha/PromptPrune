# How to Share PromptPrune Extension with Friends

## Option 1: Share the Built Extension Folder (Recommended)

### Step 1: Build the Extension
```bash
npm run build
```

### Step 2: Find the Built Extension
After building, the extension will be in:
```
build/chrome-mv3-prod/
```
(Or check `.plasmo/chrome-mv3-prod/` if using Plasmo's default)

### Step 3: Share the Folder
1. **Zip the folder**: Right-click on `build/chrome-mv3-prod/` and select "Compress" (Mac) or "Send to > Compressed folder" (Windows)
2. **Share the zip file** via:
   - Email
   - Google Drive / Dropbox
   - USB drive
   - Any file sharing service

**OR** use the automated script:
```bash
npm run share
```
This will create `PromptPrune-Extension.zip` in the project root, ready to share!

### Step 4: Installation Instructions for Your Friend

Send these instructions to your friend:

#### For Chrome/Edge/Brave:

1. **Download and extract** the zip file you received
2. **Open Chrome** and go to: `chrome://extensions/`
   - Or: Menu (⋮) → Extensions → Manage Extensions
3. **Enable Developer Mode** (toggle in top-right corner)
4. **Click "Load unpacked"**
5. **Select the extracted folder** (the one containing `manifest.json`)
6. **Done!** The extension icon should appear in your toolbar

#### For Firefox:

1. **Download and extract** the zip file
2. **Open Firefox** and go to: `about:debugging`
3. **Click "This Firefox"** in the left sidebar
4. **Click "Load Temporary Add-on"**
5. **Select the `manifest.json` file** from the extracted folder
6. **Done!** The extension will work (note: it's temporary and will be removed when Firefox restarts)

---

## Option 2: Create a Distribution Package

### Automated Package Creation

Run this command to create a ready-to-share package:

```bash
npm run package
```

This will create a zip file in the `.plasmo/` directory that you can share directly.

---

## Option 3: Share via GitHub (Best for Updates)

### If you have a GitHub repository:

1. **Push your code to GitHub** (make sure `.plasmo/` is in `.gitignore`)
2. **Share the repository link** with your friend
3. **Your friend can:**
   ```bash
   git clone <your-repo-url>
   cd PromptPrune
   npm install
   npm run build
   ```
   Then follow the installation instructions above

---

## Quick Share Script

I've created a script to make sharing easier. Run:

```bash
npm run share
```

This will:
1. Build the extension
2. Create a zip file
3. Tell you where to find it

---

## Important Notes

⚠️ **Developer Mode Warning**: Chrome will show a warning about Developer Mode extensions. This is normal for manually installed extensions.

⚠️ **Updates**: Manual installations don't auto-update. You'll need to share new versions when you make updates.

⚠️ **Permissions**: The extension requests storage permissions (for saving optimization history). This is safe and all processing is done locally.

---

## Troubleshooting

### "Manifest file is missing or unreadable"
- Make sure you selected the folder containing `manifest.json`, not a parent folder

### "This extension may have been corrupted"
- Try rebuilding: `npm run build`
- Make sure you're sharing the entire `.plasmo/chrome-mv3-prod/` folder

### Extension not appearing
- Check Chrome's extension page for error messages
- Make sure Developer Mode is enabled
- Try reloading the extension

---

## File Size

The built extension is typically:
- **~2-5 MB** (uncompressed)
- **~1-2 MB** (compressed zip)

This is small enough to share via email or most file sharing services.

