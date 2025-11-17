#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, pipe failures

if [ -z "${1:-}" ]; then
  echo "Usage: $0 \"commit message\""
  exit 1
fi

COMMIT_MSG="$1"

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"

echo "📦 Publishing version ${VERSION}..."

# Check if version tag already exists
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "❌ Error: Tag $TAG already exists. Did you forget to bump the version in package.json?"
  exit 1
fi

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
  echo "⚠️  Uncommitted changes detected. Adding all files..."
  git add .
fi

# Compile
echo "🔨 Compiling..."
npm run compile || exit 1

# Run tests (if you have them)
# npm test || exit 1

# Package (creates .vsix file)
echo "📦 Packaging..."
vsce package || exit 1

# Commit changes
echo "💾 Committing..."
git commit -m "$COMMIT_MSG" || echo "Nothing to commit"

# Create and push tag
echo "🏷️  Creating tag ${TAG}..."
git tag "$TAG"

# Push commit and tag together (atomic operation)
echo "⬆️  Pushing to GitHub..."
git push origin main || exit 1
git push origin "$TAG" || exit 1

# Publish to Microsoft Marketplace
echo "📤 Publishing to VS Code Marketplace..."
vsce publish || {
  echo "❌ Marketplace publish failed. Rolling back tag..."
  git tag -d "$TAG"
  git push --delete origin "$TAG"
  exit 1
}

# Publish to Open VSX
echo "📤 Publishing to Open VSX..."
npx ovsx publish || {
  echo "⚠️  Open VSX publish failed (VS Code Marketplace publish succeeded)"
  exit 1
}

echo "✅ Successfully published ${TAG} to both marketplaces!"
echo "📝 Create GitHub release at: https://github.com/bobcozzi/rpgiv2free/releases/new?tag=${TAG}"