#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets', 'transformers');
const ONNX_NODE_MODULES = path.join(__dirname, '..', 'node_modules', 'onnxruntime-web', 'dist');

function setup() {
  console.log('🔧 Setting up Transformers.js Local Asset Bridge (Legacy Compatibility Mode)...\n');

  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
    console.log(`✅ Created directory: ${ASSETS_DIR}`);
  }

  console.log('🧹 Cleaning existing assets...');
  const existingFiles = fs.readdirSync(ASSETS_DIR);
  for (const file of existingFiles) {
    if (file !== 'README.md') {
      fs.unlinkSync(path.join(ASSETS_DIR, file));
    }
  }

  if (fs.existsSync(ONNX_NODE_MODULES)) {
    console.log(`📂 Copying all assets from: ${ONNX_NODE_MODULES}`);
    const files = fs.readdirSync(ONNX_NODE_MODULES);
    let count = 0;

    // Copy main JS files from dist
    for (const file of files) {
      // Exclude Node.js and Training files to prevent build issues
      if (file.includes('.node.') || file.includes('training')) continue;

      if (file.endsWith('.wasm') || file.endsWith('.js') || file.endsWith('.mjs')) {
        const src = path.join(ONNX_NODE_MODULES, file);
        const dest = path.join(ASSETS_DIR, file);
        if (fs.lstatSync(src).isFile()) {
          fs.copyFileSync(src, dest);
          count++;
        }
      }
    }
    console.log(`✅ Copied ${count} file(s) from node_modules/dist.`);
  } else {
    console.error(`❌ Error: Could not find ${ONNX_NODE_MODULES}`);
    process.exit(1);
  }

  console.log('\n✅ Local Asset Bridge setup complete!');
}

try {
  setup();
} catch (err) {
  console.error('❌ Setup failed:', err);
  process.exit(1);
}
