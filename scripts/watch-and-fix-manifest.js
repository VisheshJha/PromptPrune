#!/usr/bin/env node

/**
 * Watch and fix Plasmo's intermediate manifest as soon as it's created
 * This fixes the .ts -> .js issue in service_worker paths
 */

const fs = require('fs')
const path = require('path')

const manifestPath = path.join(__dirname, '..', '.plasmo', 'chrome-mv3.plasmo.manifest.json')

function fixManifest() {
  if (!fs.existsSync(manifestPath)) {
    return false
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    let changed = false

    // Fix service_worker path: replace .ts with .js
    if (manifest.background?.service_worker) {
      if (manifest.background.service_worker.endsWith('.ts')) {
        manifest.background.service_worker = manifest.background.service_worker.replace(/\.ts$/, '.js')
        changed = true
        console.log('✅ Fixed service_worker path: .ts -> .js')
      }
    }

    if (changed) {
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
      return true
    }
    return false
  } catch (error) {
    return false
  }
}

// Watch for the manifest file
const maxAttempts = 60
let attempts = 0

const checkInterval = setInterval(() => {
  attempts++
  if (fixManifest()) {
    clearInterval(checkInterval)
    process.exit(0)
  }
  if (attempts >= maxAttempts) {
    clearInterval(checkInterval)
    process.exit(0)
  }
}, 500)

// Also check immediately
fixManifest()
