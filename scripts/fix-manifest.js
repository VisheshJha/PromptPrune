#!/usr/bin/env node

/**
 * Fix manifest.json to include content scripts
 * This is a workaround for Plasmo not automatically adding content_scripts
 */

const fs = require('fs')
const path = require('path')
const { glob } = require('glob')

const manifestPath = path.join(__dirname, '..', 'build', 'chrome-mv3-prod', 'manifest.json')
const buildDir = path.join(__dirname, '..', 'build', 'chrome-mv3-prod')

if (!fs.existsSync(manifestPath)) {
  console.error('Manifest not found:', manifestPath)
  process.exit(1)
}

// Find content script file
let contentScriptFile = null
try {
  const files = fs.readdirSync(buildDir)
  const contentFiles = files.filter(f => f.startsWith('content.') && f.endsWith('.js'))
  if (contentFiles.length > 0) {
    contentScriptFile = contentFiles[0]
    console.log('Found content script:', contentScriptFile)
  } else {
    console.warn('⚠️  No content script found - widget may not work')
    process.exit(0) // Don't fail, just warn
  }
} catch (error) {
  console.error('Error finding content script:', error.message)
  process.exit(0) // Don't fail build
}

// Read manifest
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

// Ensure required permissions
if (!manifest.permissions) {
  manifest.permissions = []
}
if (!manifest.permissions.includes('storage')) {
  manifest.permissions.push('storage')
}
if (!manifest.permissions.includes('scripting')) {
  manifest.permissions.push('scripting')
}

// Only add background if the file actually exists
const backgroundFile = path.join(buildDir, 'static', 'background', 'index.js')
if (fs.existsSync(backgroundFile)) {
  if (!manifest.background) {
    manifest.background = {
      service_worker: 'static/background/index.js'
    }
  }
} else {
  // Remove background if file doesn't exist
  if (manifest.background) {
    delete manifest.background
  }
}

// Add or update content_scripts
if (!contentScriptFile) {
  console.log('⚠️  Skipping content_scripts (no content script file found)')
  process.exit(0)
}

if (!manifest.content_scripts || manifest.content_scripts.length === 0) {
  manifest.content_scripts = [
    {
      matches: [
        "https://chat.openai.com/*",
        "https://claude.ai/*",
        "https://gemini.google.com/*",
        "https://www.perplexity.ai/*",
        "https://poe.com/*",
        "https://*.openai.com/*",
        "https://*.anthropic.com/*"
      ],
      js: [contentScriptFile],
      run_at: "document_idle"
    }
  ]

  // Write updated manifest
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log('✅ Added content_scripts to manifest.json')
} else {
  // Update existing content_scripts with correct file name
  const updated = manifest.content_scripts.some(cs => {
    if (cs.js && cs.js.length > 0 && !cs.js[0].includes(contentScriptFile)) {
      cs.js = [contentScriptFile]
      return true
    }
    return false
  })
  
  if (updated) {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    console.log('✅ Updated content_scripts in manifest.json')
  } else {
    console.log('✅ Content scripts already correct in manifest')
  }
}

// Always ensure permissions and background are set
let manifestChanged = false

if (!manifest.permissions) {
  manifest.permissions = []
}
if (!manifest.permissions.includes('storage')) {
  manifest.permissions.push('storage')
  manifestChanged = true
}
if (!manifest.permissions.includes('scripting')) {
  manifest.permissions.push('scripting')
  manifestChanged = true
}

if (!manifest.background) {
  const backgroundFile = path.join(buildDir, 'static', 'background', 'index.js')
  if (fs.existsSync(backgroundFile)) {
    manifest.background = {
      service_worker: 'static/background/index.js'
    }
    manifestChanged = true
  }
}

if (manifestChanged) {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log('✅ Updated permissions and background in manifest.json')
}

