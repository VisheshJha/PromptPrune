#!/bin/bash
# Commit script for PromptPrune - excludes .md files

# Stage all changes except .md files
git add -u
git add src/background/ml-engine.ts src/offscreen.ts src/lib/indexeddb-model-cache.ts
git add assets/transformers/*.wasm assets/transformers/*.js
git add scripts/fix-dev-manifest.js scripts/fix-onnx-imports.js scripts/setup-transformers-assets.js
git add src/scripts/ src/tabs/ src/types/ src/workers/ patches/ offscreen.html

# Explicitly exclude .md files
git reset HEAD -- *.md **/*.md

# Commit with message
git commit -F COMMIT_MESSAGE.txt

echo "✅ Committed changes (excluding .md files)"
