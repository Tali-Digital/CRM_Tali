#!/bin/bash

# Build the project
echo "📦 Building project..."
npm run build

# Add all changes (including dist)
echo "🔍 Adding changes..."
git add .

# Commit with a message (or default)
MESSAGE="${1:-Atualização automática: build e deploy}"
echo "📝 Committing: $MESSAGE"
git commit -m "$MESSAGE"

# Push to origin main
echo "🚀 Pushing to GitHub..."
git push origin main

echo "✅ Done! Deploy and commit completed."
