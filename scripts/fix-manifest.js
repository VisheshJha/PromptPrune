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

// Update content_scripts matches to include all platforms
const allMatches = [
  "https://chat.openai.com/*",
  "https://chatgpt.com/*",
  "https://claude.ai/*",
  "https://gemini.google.com/*",
  "https://gemini.google.com/app/*",
  "https://www.perplexity.ai/*",
  "https://perplexity.ai/*",
  "https://poe.com/*",
  "https://grok.com/*",
  "https://x.com/*",
  "https://twitter.com/*",
  "https://copilot.microsoft.com/*",
  "https://manus.im/*",
  "https://www.deepseek.com/*",
  "https://deepseek.com/*",
  "https://www.midjourney.com/*",
  "https://midjourney.com/*",
  "https://huggingface.co/*",
  "https://*.huggingface.co/*",
  "http://localhost/*",
  "http://127.0.0.1/*"
]

if (!manifest.content_scripts || manifest.content_scripts.length === 0) {
  manifest.content_scripts = [
    {
      matches: allMatches,
      js: [contentScriptFile],
      run_at: "document_idle"
    }
  ]

  // Write updated manifest
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log('✅ Added content_scripts to manifest.json')
} else {
  // Update existing content_scripts with correct file name and matches
  let updated = false
  manifest.content_scripts.forEach(cs => {
    if (cs.js && cs.js.length > 0 && !cs.js[0].includes(contentScriptFile)) {
      cs.js = [contentScriptFile]
      updated = true
    }
    // Update matches to include all platforms
    if (JSON.stringify(cs.matches || []) !== JSON.stringify(allMatches)) {
      cs.matches = allMatches
      updated = true
    }
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

// Add CSP for WASM (Critical for onnxruntime-web)
// Forcefully set it to ensure it's correct
manifest.content_security_policy = manifest.content_security_policy || {}
manifest.content_security_policy.extension_pages = "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
manifestChanged = true
console.log('✅ Added CSP for WASM')

if (!manifest.permissions) {
  manifest.permissions = []
}
const requiredPermissions = ['storage', 'unlimitedStorage', 'scripting', 'tabs']
requiredPermissions.forEach(perm => {
  if (!manifest.permissions.includes(perm)) {
    manifest.permissions.push(perm)
    manifestChanged = true
  }
})

// Ensure host_permissions are set
if (!manifest.host_permissions) {
  manifest.host_permissions = []
}
const requiredHosts = [
  "https://chat.openai.com/*",
  "https://chatgpt.com/*",
  "https://claude.ai/*",
  "https://gemini.google.com/*",
  "https://www.perplexity.ai/*",
  "https://perplexity.ai/*",
  "https://poe.com/*",
  "https://grok.com/*",
  "https://x.com/*",
  "https://twitter.com/*",
  "https://copilot.microsoft.com/*",
  "https://manus.im/*",
  "https://www.deepseek.com/*",
  "https://deepseek.com/*",
  "https://www.midjourney.com/*",
  "https://midjourney.com/*",
  "https://huggingface.co/*",
  "https://*.huggingface.co/*"
]
requiredHosts.forEach(host => {
  if (!manifest.host_permissions.includes(host)) {
    manifest.host_permissions.push(host)
    manifestChanged = true
  }
})

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

