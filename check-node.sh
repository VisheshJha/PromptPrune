#!/bin/bash

# Check Node.js version
CURRENT_NODE=$(node --version)
REQUIRED_NODE="v20"

echo "Current Node.js version: $CURRENT_NODE"
echo "Required Node.js version: $REQUIRED_NODE.x.x"
echo ""

if [[ $CURRENT_NODE == v20.* ]]; then
    echo "✅ Node.js version is correct!"
    exit 0
else
    echo "❌ Wrong Node.js version!"
    echo ""
    echo "To fix:"
    echo "  1. source ~/.zshrc"
    echo "  2. nvm use 20"
    echo "  3. node --version  # Verify it shows v20.x.x"
    echo ""
    exit 1
fi
