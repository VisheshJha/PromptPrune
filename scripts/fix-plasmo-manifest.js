#!/usr/bin/env node

/**
 * Fix Plasmo's intermediate manifest before validation
 * This fixes the .ts -> .js issue in service_worker paths
 */

const fs = require('fs')
const path = require('path')
const { glob } = require('glob')

// Find all Plasmo-generated manifest files
const plasmoManifests = [
  path.join(__dirname, '..', '.plasmo', 'chrome-mv3.plasmo.manifest.json'),
  path.join(__dirname, '..', '.plasmo', '**', '*.manifest.json')
]

function fixManifest(manifestPath) {
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
        console.log(`✅ Fixed service_worker path in ${path.basename(manifestPath)}`)
      }
    }

    if (changed) {
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
      return true
    }
    return false
  } catch (error) {
    console.error(`Error fixing manifest ${manifestPath}:`, error.message)
    return false
  }
}

// Fix all found manifests
let fixed = false
for (const pattern of plasmoManifests) {
  const files = glob.sync(pattern, { cwd: __dirname + '/..' })
  for (const file of files) {
    if (fixManifest(file)) {
      fixed = true
    }
  }
}

if (fixed) {
  console.log('✅ Fixed Plasmo intermediate manifests')
}
