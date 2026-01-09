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

// Read package.json to get the source key
const packageJsonPath = path.join(__dirname, '..', 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

// Read the built manifest
let manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

// PRESERVE the 'key' field from package.json (for stable extension ID)
const existingKey = packageJson.manifest?.key || packageJson.key

// CRITICAL: Move key to the TOP of manifest (Chrome reads it first)
// Create a new manifest object with key first
if (existingKey) {
  const { key, ...rest } = manifest
  manifest = {
    key: existingKey,  // Key MUST be first
    ...rest
  }
  // Also ensure it's set explicitly
  manifest.key = existingKey
}

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

  // Preserve key field before writing
  if (existingKey && !manifest.key) {
    manifest.key = existingKey
  }

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

  // Preserve key field before writing
  if (existingKey && !manifest.key) {
    manifest.key = existingKey
    updated = true
  }

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

// Preserve key field for stable extension ID (always use the one from package.json)
if (existingKey) {
  if (manifest.key !== existingKey) {
    manifest.key = existingKey
    manifestChanged = true
    console.log('✅ Updated key field in manifest.json (ensuring stable extension ID)')
  }
}

if (manifestChanged) {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log('✅ Updated permissions and background in manifest.json')
}

// Replace API URL placeholder in built files
// This allows deploy scripts to set the API URL at build time
const replaceApiUrl = (apiUrl) => {
  if (!apiUrl || apiUrl === '__GROOT_API_URL__') {
    return // Skip if not set or still placeholder
  }

  const buildDir = path.join(__dirname, '..', 'build', 'chrome-mv3-prod')

  // Find all JS files that might contain the placeholder
  const filesToReplace = []

  // Background service worker
  const backgroundFile = path.join(buildDir, 'static', 'background', 'index.js')
  if (fs.existsSync(backgroundFile)) {
    filesToReplace.push(backgroundFile)
  }

  // Popup and other JS files
  try {
    const jsFiles = glob.sync(path.join(buildDir, '*.js'))
    filesToReplace.push(...jsFiles)
  } catch (err) {
    // glob might not be available, try manual search
    try {
      const files = fs.readdirSync(buildDir)
      files.filter(f => f.endsWith('.js')).forEach(f => {
        filesToReplace.push(path.join(buildDir, f))
      })
    } catch (err2) {
      console.warn('Could not find JS files to replace:', err2.message)
    }
  }

  let replacedCount = 0
  filesToReplace.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      try {
        let content = fs.readFileSync(filePath, 'utf8')
        const originalContent = content
        // Replace the placeholder string with actual URL (need to escape for JS string)
        const escapedUrl = apiUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"')
        // Replace both the placeholder constant and the string literal
        content = content.replace(/__GROOT_API_URL__/g, apiUrl)
        content = content.replace(/"__GROOT_API_URL__"/g, `"${apiUrl}"`)
        content = content.replace(/'__GROOT_API_URL__'/g, `'${apiUrl}'`)

        if (content !== originalContent) {
          fs.writeFileSync(filePath, content)
          replacedCount++
          console.log(`✅ Replaced API URL in ${path.basename(filePath)}`)
        }
      } catch (err) {
        console.warn(`⚠️  Could not replace API URL in ${path.basename(filePath)}:`, err.message)
      }
    }
  })

  return replacedCount
}

// Check for API URL from environment variable or use default
const apiUrl = process.env.GROOT_API_URL
if (apiUrl && apiUrl !== '__GROOT_API_URL__') {
  const replaced = replaceApiUrl(apiUrl)
  if (replaced > 0) {
    console.log(`✅ API URL set to: ${apiUrl} (replaced in ${replaced} file(s))`)
  } else {
    console.log(`ℹ️  API URL set to: ${apiUrl} (but no replacements made - placeholder might not exist)`)
  }
} else {
  console.log('ℹ️  Using default API URL (localhost). Set GROOT_API_URL env var to override.')
  console.log('   Example: GROOT_API_URL=https://api.example.com/api/v1 npm run build')
}

