#!/usr/bin/env node

/**
 * Pre-build script to ensure manifest is fixed before Plasmo validates it
 * This runs BEFORE plasmo build
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('🔧 Pre-build: Setting up manifest fix watcher...')

// Start the watch script in background
const watchScript = path.join(__dirname, 'fix-plasmo-manifest-sync.js')
try {
  // Start watcher
  const child = require('child_process').spawn('node', [watchScript], {
    detached: true,
    stdio: 'ignore'
  })
  child.unref()
  console.log('✅ Manifest fix watcher started')
  
  // Give it a moment to start
  setTimeout(() => {
    console.log('✅ Ready for build')
  }, 500)
} catch (error) {
  console.warn('⚠️  Could not start watcher:', error.message)
}
