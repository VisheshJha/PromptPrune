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

// Ensure transformers assets are copied to build directory
const assetsSource = path.join(__dirname, '..', 'assets', 'transformers')
const assetsDest = path.join(buildDir, 'assets', 'transformers')

if (fs.existsSync(assetsSource)) {
  try {
    if (!fs.existsSync(assetsDest)) {
      fs.mkdirSync(assetsDest, { recursive: true })
    }
    
    // Copy all WASM and MJS files
    const files = fs.readdirSync(assetsSource)
    let copiedCount = 0
    files.forEach(file => {
      if (file.endsWith('.wasm') || file.endsWith('.mjs') || file.endsWith('.js')) {
        const srcPath = path.join(assetsSource, file)
        const destPath = path.join(assetsDest, file)
        fs.copyFileSync(srcPath, destPath)
        copiedCount++
      }
    })
    
    if (copiedCount > 0) {
      console.log(`✅ Copied ${copiedCount} transformers asset file(s) to build directory`)
    }
  } catch (error) {
    console.warn('⚠️  Could not copy transformers assets:', error.message)
  }
} else {
  console.warn('⚠️  Transformers assets directory not found.')
  console.warn('   Run: npm run setup:assets')
  console.warn('   Or: node scripts/setup-transformers-assets.js')
  console.warn('   Note: Assets should be committed to git for sharing.')
}

// Note: ML Engine Worker is automatically bundled by Plasmo/Vite
// No manual file copying needed for workers

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
      service_worker: 'static/background/index.js',
      type: 'module'
    }
  } else if (manifest.background && !manifest.background.type) {
    manifest.background.type = 'module'
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
  // Major AI Chat Platforms
  "https://chat.openai.com/*",
  "https://chatgpt.com/*",
  "https://www.chatgpt.com/*",
  "https://claude.ai/*",
  "https://www.claude.ai/*",
  "https://console.anthropic.com/*",
  "https://gemini.google.com/*",
  "https://gemini.google.com/app/*",
  "https://bard.google.com/*",
  "https://copilot.microsoft.com/*",
  "https://www.copilot.microsoft.com/*",
  "https://*.copilot.microsoft.com/*",
  "https://copilot.microsoft.com/**",
  "https://www.bing.com/chat*",
  "https://bing.com/chat*",
  "https://www.perplexity.ai/*",
  "https://perplexity.ai/*",
  
  // AI-Powered Productivity Tools
  "https://www.canva.com/*",
  "https://canva.com/*",
  "https://www.notion.so/*",
  "https://notion.so/*",
  "https://www.jasper.ai/*",
  "https://jasper.ai/*",
  "https://www.copy.ai/*",
  "https://copy.ai/*",
  "https://www.grammarly.com/*",
  "https://grammarly.com/*",
  "https://www.quillbot.com/*",
  "https://quillbot.com/*",
  "https://www.wordtune.com/*",
  "https://wordtune.com/*",
  "https://www.rytr.me/*",
  "https://rytr.me/*",
  "https://writesonic.com/*",
  "https://www.writesonic.com/*",
  
  // AI Development Tools
  "https://github.com/*",
  "https://cursor.sh/*",
  "https://www.cursor.sh/*",
  "https://codeium.com/*",
  "https://www.codeium.com/*",
  "https://www.tabnine.com/*",
  "https://tabnine.com/*",
  "https://replit.com/*",
  "https://www.replit.com/*",
  "https://sourcegraph.com/*",
  "https://www.sourcegraph.com/*",
  
  // AI Research & Analysis
  "https://elicit.com/*",
  "https://www.elicit.com/*",
  "https://consensus.app/*",
  "https://www.consensus.app/*",
  "https://www.scholarcy.com/*",
  "https://scholarcy.com/*",
  "https://www.semanticscholar.org/*",
  "https://semanticscholar.org/*",
  
  // AI Image & Design
  "https://www.midjourney.com/*",
  "https://midjourney.com/*",
  "https://labs.openai.com/*",
  "https://www.leonardo.ai/*",
  "https://leonardo.ai/*",
  "https://www.figma.com/*",
  "https://figma.com/*",
  "https://www.adobe.com/*",
  "https://adobe.com/*",
  "https://www.runwayml.com/*",
  "https://runwayml.com/*",
  
  // AI Video & Media
  "https://www.synthesia.io/*",
  "https://synthesia.io/*",
  "https://lumalabs.ai/*",
  "https://www.lumalabs.ai/*",
  "https://pika.art/*",
  "https://www.pika.art/*",
  "https://www.descript.com/*",
  "https://descript.com/*",
  
  // AI Business & Marketing Tools
  "https://surferseo.com/*",
  "https://www.surferseo.com/*",
  "https://www.frase.io/*",
  "https://frase.io/*",
  "https://outranking.io/*",
  "https://www.outranking.io/*",
  "https://anyword.com/*",
  "https://www.anyword.com/*",
  
  // AI Platforms & APIs
  "https://character.ai/*",
  "https://www.character.ai/*",
  "https://replicate.com/*",
  "https://www.replicate.com/*",
  "https://platform.openai.com/*",
  "https://aistudio.google.com/*",
  "https://cohere.com/*",
  "https://www.cohere.com/*",
  "https://www.ai21.com/*",
  "https://ai21.com/*",
  "https://you.com/*",
  "https://www.you.com/*",
  "https://poe.com/*",
  "https://www.poe.com/*",
  "https://heypi.com/*",
  "https://www.heypi.com/*",
  "https://inflection.ai/*",
  "https://www.inflection.ai/*",
  "https://www.meta.ai/*",
  "https://meta.ai/*",
  "https://grok.com/*",
  "https://www.grok.com/*",
  "https://x.com/*",
  "https://twitter.com/*",
  "https://mistral.ai/*",
  "https://www.mistral.ai/*",
  "https://together.ai/*",
  "https://www.together.ai/*",
  "https://manus.im/*",
  "https://www.deepseek.com/*",
  "https://deepseek.com/*",
  
  // Local development
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

// Add CSP for WASM (Critical for ML Engine - runs directly in service worker)
// Forcefully set it to ensure it's correct
manifest.content_security_policy = manifest.content_security_policy || {}
// MV3: wasm-unsafe-eval for WASM. 'unsafe-eval' is not allowed in extension_pages.
manifest.content_security_policy.extension_pages = "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
manifestChanged = true
console.log('✅ Added CSP for WASM (wasm-unsafe-eval for MV3) - enables ML Engine in Service Worker')

// Ensure web_accessible_resources includes transformers assets for Local Asset Bridge
if (!manifest.web_accessible_resources) {
  manifest.web_accessible_resources = []
}

// Check if transformers assets are already included
const hasTransformersAssets = manifest.web_accessible_resources.some((resource) => {
  if (typeof resource === 'string') {
    return resource.includes('assets/transformers')
  }
  if (resource.resources) {
    return resource.resources.some((r) => r.includes('assets/transformers'))
  }
  return false
})

if (!hasTransformersAssets) {
  // Add transformers assets to web_accessible_resources
  manifest.web_accessible_resources.push({
    resources: [
      'assets/transformers/*.wasm',
      'assets/transformers/*.mjs',
      'assets/transformers/*.js'
    ],
    matches: ['<all_urls>']
  })
  manifestChanged = true
  console.log('✅ Added transformers assets to web_accessible_resources (Local Asset Bridge)')
}

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
// Use the same allMatches array for host_permissions
const requiredHosts = allMatches
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
      service_worker: 'static/background/index.js',
      type: 'module'
    }
    manifestChanged = true
  }
} else if (manifest.background && !manifest.background.type) {
  manifest.background.type = 'module'
  manifestChanged = true
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

  // Offscreen document (contains ml-engine.ts)
  const tabsDir = path.join(buildDir, 'tabs')
  if (fs.existsSync(tabsDir)) {
    try {
      const offscreenFiles = glob.sync(path.join(tabsDir, 'offscreen.*.js'))
      filesToReplace.push(...offscreenFiles)
    } catch (err) {
      // Fallback: try to find offscreen files manually
      try {
        const files = fs.readdirSync(tabsDir)
        files.filter(f => f.startsWith('offscreen.') && f.endsWith('.js')).forEach(f => {
          filesToReplace.push(path.join(tabsDir, f))
        })
      } catch (err2) {
        console.warn('Could not find offscreen files:', err2.message)
      }
    }
  }

  // Popup files (auth-service is bundled here)
  const popupDir = path.join(buildDir, 'static', 'popup')
  if (fs.existsSync(popupDir)) {
    try {
      const popupFiles = glob.sync(path.join(popupDir, '*.js'))
      filesToReplace.push(...popupFiles)
    } catch (err) {
      try {
        const files = fs.readdirSync(popupDir)
        files.filter(f => f.endsWith('.js')).forEach(f => {
          filesToReplace.push(path.join(popupDir, f))
        })
      } catch (err2) {
        console.warn('Could not find popup files:', err2.message)
      }
    }
  }

  // Popup and other JS files in root
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
  
  // Also check all subdirectories recursively for JS files
  try {
    const allJsFiles = glob.sync(path.join(buildDir, '**/*.js'))
    allJsFiles.forEach(file => {
      if (!filesToReplace.includes(file)) {
        filesToReplace.push(file)
      }
    })
  } catch (err) {
    console.warn('Could not recursively find JS files:', err.message)
  }

  let replacedCount = 0
  filesToReplace.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      try {
        let content = fs.readFileSync(filePath, 'utf8')
        const originalContent = content
        
        // Replace the placeholder with production URL
        // Source code: const GROOT_BASE_URL_RAW = "__GROOT_API_URL__"
        // const GROOT_BASE_URL = GROOT_BASE_URL_RAW === "__GROOT_API_URL__" ? "http://localhost:8080/api/v1" : GROOT_BASE_URL_RAW
        // When minified: "__GROOT_API_URL__"===i?"http://localhost:8080/api/v1":i
        
        // STEP 1: Replace placeholders first (before they get minified to localhost)
        // 4. Replace direct placeholder: __GROOT_API_URL__
        content = content.replace(/__GROOT_API_URL__/g, apiUrl)
        
        // 5. Replace string literals: "__GROOT_API_URL__" or '__GROOT_API_URL__'
        content = content.replace(/"__GROOT_API_URL__"/g, `"${apiUrl}"`)
        content = content.replace(/'__GROOT_API_URL__'/g, `'${apiUrl}'`)
        
        // 3. Replace minified ternary pattern
        // Pattern: "__GROOT_API_URL__"===var?"http://localhost:8080/api/v1":var
        // Replace with production URL directly (no ternary needed in production)
        const minifiedTernaryPattern = /"__GROOT_API_URL__"===([a-zA-Z_$][a-zA-Z0-9_$]*)\?"http:\/\/localhost:8080\/api\/v1":\1/g
        content = content.replace(minifiedTernaryPattern, `"${apiUrl}"`)
        
        // STEP 2: Replace any localhost URLs (in case placeholder was already replaced or code has hardcoded localhost)
        // This is critical - replace ALL instances of localhost URLs
        const localhostPatterns = [
          /"http:\/\/localhost:8080\/api\/v1"/g,
          /'http:\/\/localhost:8080\/api\/v1'/g,
          /`http:\/\/localhost:8080\/api\/v1`/g,
          /http:\/\/localhost:8080\/api\/v1/g
        ]
        localhostPatterns.forEach(pattern => {
          content = content.replace(pattern, (match) => {
            // Preserve quotes if they exist
            if (match.startsWith('"') && match.endsWith('"')) {
              return `"${apiUrl}"`
            }
            if (match.startsWith("'") && match.endsWith("'")) {
              return `'${apiUrl}'`
            }
            if (match.startsWith('`') && match.endsWith('`')) {
              return `\`${apiUrl}\``
            }
            return apiUrl
          })
        })
        
        // Also replace any remaining localhost URLs (case-insensitive, any quote style)
        content = content.replace(/http:\/\/localhost:8080\/api\/v1/gi, apiUrl)
        
        // Special handling for auth endpoints that might be constructed differently
        // Pattern: base + "/auth/extension/exchange" or base + '/auth/extension/exchange'
        const authEndpointPatterns = [
          /(http:\/\/localhost:8080\/api\/v1)\s*\+\s*["']\/auth\/extension\/exchange["']/g,
          /(http:\/\/localhost:8080\/api\/v1)\s*\+\s*`\/auth\/extension\/exchange`/g
        ]
        authEndpointPatterns.forEach(pattern => {
          content = content.replace(pattern, (match) => {
            // Replace the localhost part with production URL
            return match.replace(/http:\/\/localhost:8080\/api\/v1/gi, apiUrl)
          })
        })
        
        // Fix unquoted URLs (common issue after minification)
        // Pattern: let i=https://... or const i=https://... or var i=https://...
        const unquotedUrlPattern = /(let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(https?:\/\/[^"'\s,;\)]+)/g
        content = content.replace(unquotedUrlPattern, (match, keyword, varName, url) => {
          // Only fix if it's our API URL
          if (url.includes('localhost:8080/api/v1')) {
            return `${keyword} ${varName}="${apiUrl}"`
          }
          return match
        })

        // Verify replacement worked - check if any localhost URLs remain
        const hasLocalhost = /localhost:8080\/api\/v1/i.test(content)
        const hasPlaceholder = /__GROOT_API_URL__/.test(content)
        
        if (content !== originalContent) {
          fs.writeFileSync(filePath, content)
          replacedCount++
          if (hasLocalhost) {
            console.warn(`⚠️  Replaced API URL in ${path.basename(filePath)} but localhost URLs may still remain`)
          } else if (hasPlaceholder) {
            console.warn(`⚠️  Replaced API URL in ${path.basename(filePath)} but placeholder may still remain`)
          } else {
            console.log(`✅ Replaced API URL in ${path.basename(filePath)}`)
          }
        } else if (hasLocalhost || hasPlaceholder) {
          console.warn(`⚠️  ${path.basename(filePath)} contains localhost or placeholder but no replacements were made`)
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
  // For local dev builds: replace any production URLs back to localhost
  // This fixes the case where a previous prod build left production URLs in the build
  const localhostUrl = 'http://localhost:8080/api/v1'
  const productionUrl = 'https://groot-backend-prod-luun7betqa-el.a.run.app/api/v1'
  
  // Check if production URL exists in build files
  const buildDir = path.join(__dirname, '..', 'build', 'chrome-mv3-prod')
  const backgroundFile = path.join(buildDir, 'static', 'background', 'index.js')
  
  let needsCleanup = false
  if (fs.existsSync(backgroundFile)) {
    const content = fs.readFileSync(backgroundFile, 'utf8')
    if (content.includes(productionUrl)) {
      needsCleanup = true
    }
  }
  
  if (needsCleanup) {
    console.log('🔄 Detected production URLs in build - replacing with localhost for local dev...')
    const replaced = replaceApiUrl(localhostUrl)
    if (replaced > 0) {
      console.log(`✅ Replaced production URLs with localhost (${replaced} file(s))`)
    }
  } else {
    console.log('ℹ️  Using default API URL (localhost). This is correct for dev builds.')
    console.log('   For production builds, use: npm run build:prod')
    console.log('   Or set GROOT_API_URL env var: GROOT_API_URL=https://api.example.com/api/v1 npm run build')
  }
}

