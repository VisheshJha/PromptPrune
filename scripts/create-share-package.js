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
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const version = manifest.version || '1.0.0'

console.log(`✅ Found extension (v${version})`)
console.log(`📁 Extension directory: ${EXTENSION_DIR}\n`)

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

