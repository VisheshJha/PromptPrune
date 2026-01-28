#!/usr/bin/env node

/**
 * Create a shareable package for the Chrome extension
 * This script builds the extension and creates a zip file ready to share
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Try different possible build directories
const possibleDirs = [
  path.join(__dirname, '..', 'build', 'chrome-mv3-prod'),
  path.join(__dirname, '..', '.plasmo', 'chrome-mv3-prod'),
  path.join(__dirname, '..', 'chrome-mv3-prod')
]

let EXTENSION_DIR = null
for (const dir of possibleDirs) {
  if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'manifest.json'))) {
    EXTENSION_DIR = dir
    break
  }
}

const OUTPUT_DIR = path.join(__dirname, '..')
const ZIP_NAME = 'PromptPrune-Extension.zip'
const ZIP_PATH = path.join(OUTPUT_DIR, ZIP_NAME)

console.log('📦 Creating shareable extension package...\n')

// Check if extension is built
if (!fs.existsSync(EXTENSION_DIR)) {
  console.error('❌ Extension not built yet. Run "npm run build" first.')
  process.exit(1)
}

// Check if manifest exists
const manifestPath = path.join(EXTENSION_DIR, 'manifest.json')
if (!fs.existsSync(manifestPath)) {
  console.error('❌ Manifest not found. Extension may not be built correctly.')
  process.exit(1)
}

// Read version from manifest
let manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const version = manifest.version || '1.0.0'

// Conditionally remove 'key' field based on environment variable
// Chrome Web Store CAN accept the key field - it uses it to set your extension ID
// Only remove if explicitly requested (for cases where you want Chrome to generate a new ID)
const shouldRemoveKey = process.env.REMOVE_KEY === 'true' || process.env.CHROME_WEB_STORE_BUILD === 'true'
if (manifest.key && shouldRemoveKey) {
  console.log('⚠️  Removing "key" field from manifest (as requested)')
  delete manifest.key
  // Write the updated manifest back
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
} else if (manifest.key) {
  console.log('✅ Keeping "key" field in manifest (will use your extension ID)')
}

console.log(`✅ Found extension (v${version})`)
console.log(`📁 Extension directory: ${EXTENSION_DIR}\n`)

// Verify icon exists (required for Chrome Web Store)
const iconPaths = [
  path.join(EXTENSION_DIR, 'icon.png'),
  path.join(EXTENSION_DIR, 'icon-128.png'),
  path.join(EXTENSION_DIR, 'icons', 'icon-128.png'),
  path.join(EXTENSION_DIR, 'icons', 'icon.png')
]

let iconFound = false
let iconPath = null
for (const iconFile of iconPaths) {
  if (fs.existsSync(iconFile)) {
    iconFound = true
    iconPath = iconFile
    const stats = fs.statSync(iconFile)
    console.log(`✅ Found extension icon: ${path.basename(iconFile)} (${(stats.size / 1024).toFixed(1)} KB)`)
    break
  }
}

if (!iconFound) {
  console.warn('⚠️  WARNING: Extension icon not found in build directory!')
  console.warn('   Chrome Web Store requires a 128x128 PNG icon in the ZIP file.')
  console.warn('   Expected locations:')
  iconPaths.forEach(p => console.warn(`     - ${p}`))
  console.warn('   Please ensure icon exists before submitting to Chrome Web Store.\n')
} else {
  // Verify icon dimensions (basic check - file size)
  const stats = fs.statSync(iconPath)
  if (stats.size < 1000) {
    console.warn('⚠️  WARNING: Icon file seems too small. Verify it\'s 128x128 pixels.')
  }
  console.log('')
}

// Create zip file
console.log('📦 Creating zip file...')

try {
  // Use zip command (available on Mac/Linux)
  const zipCommand = `cd "${path.dirname(EXTENSION_DIR)}" && zip -r "${ZIP_PATH}" "$(basename "${EXTENSION_DIR}")" -x "*.DS_Store" -x "__MACOSX/*"`
  execSync(zipCommand, { stdio: 'inherit' })
  
  // Get file size
  const stats = fs.statSync(ZIP_PATH)
  const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2)
  
  console.log('\n✅ Package created successfully!')
  console.log(`📦 File: ${ZIP_PATH}`)
  console.log(`📊 Size: ${fileSizeMB} MB`)
  console.log(`\n📤 Share this file with your friend:`)
  console.log(`   ${ZIP_PATH}\n`)
  console.log('📖 Installation instructions are in SHARE_WITH_FRIEND.md\n')
  
} catch (error) {
  // Fallback: try using Node.js archiver if zip command fails
  console.log('⚠️  zip command not available, trying alternative method...')
  
  try {
    // Try using archiver package if available, otherwise provide manual instructions
    const archiver = require('archiver')
    const output = fs.createWriteStream(ZIP_PATH)
    const archive = archiver('zip', { zlib: { level: 9 } })
    
    output.on('close', () => {
      const fileSizeMB = (archive.pointer() / (1024 * 1024)).toFixed(2)
      console.log('\n✅ Package created successfully!')
      console.log(`📦 File: ${ZIP_PATH}`)
      console.log(`📊 Size: ${fileSizeMB} MB`)
      console.log(`\n📤 Share this file with your friend:`)
      console.log(`   ${ZIP_PATH}\n`)
      console.log('📖 Installation instructions are in SHARE_WITH_FRIEND.md\n')
    })
    
    archive.on('error', (err) => {
      throw err
    })
    
    archive.pipe(output)
    archive.directory(EXTENSION_DIR, false)
    archive.finalize()
    
  } catch (archiverError) {
    console.error('\n❌ Could not create zip file automatically.')
    console.log('\n📝 Manual instructions:')
    console.log(`   1. Navigate to: ${path.dirname(EXTENSION_DIR)}`)
    console.log(`   2. Right-click on "chrome-mv3-prod" folder`)
    console.log(`   3. Select "Compress" (Mac) or "Send to > Compressed folder" (Windows)`)
    console.log(`   4. Share the created zip file\n`)
    process.exit(1)
  }
}

