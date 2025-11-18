#!/bin/bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 \"commit message\""
  exit 1
fi

COMMIT_MSG="$1"

# Ensure we're on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "❌ Error: Not on main branch (currently on: $CURRENT_BRANCH)"
  echo "Run: git checkout main"
  exit 1
fi

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"

echo "📦 Publishing version ${VERSION}..."

# Check if version tag already exists locally
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "❌ Error: Tag $TAG already exists locally."
  echo "Did you forget to bump the version in package.json?"
  exit 1
fi

# Check if version tag already exists on remote
if git ls-remote --tags origin | grep -q "refs/tags/$TAG"; then
  echo "❌ Error: Tag $TAG already exists on remote."
  echo "Did you forget to bump the version in package.json?"
  exit 1
fi

# Compile
echo "🔨 Compiling..."
npm run compile || exit 1

# Package
echo "📦 Packaging..."
vsce package || exit 1

# Git commit/push
echo "💾 Committing and pushing..."
git add .
git commit -m "$COMMIT_MSG" || echo "Nothing to commit"

# Create tag
echo "🏷️  Creating tag ${TAG}..."
git tag "$TAG"

# Push to GitHub
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
}

# Create GitHub Release (auto-extracts changelog)
echo "📝 Creating GitHub Release..."
if command -v gh &> /dev/null; then
  # Extract changelog entry for this version
  CHANGELOG_ENTRY=$(awk "/## \[${VERSION}\]/,/## \[/" CHANGELOG.md | sed '$d')

  # Create release with .vsix file attached
  gh release create "$TAG" \
    --title "$TAG" \
    --notes "$CHANGELOG_ENTRY" \
    ./rpgiv2free-${VERSION}.vsix || {
    echo "⚠️  GitHub release creation failed (marketplace publish succeeded)"
    echo "📝 Create release manually at: https://github.com/bobcozzi/rpgiv2free/releases/new?tag=${TAG}"
  }
else
  echo "⚠️  GitHub CLI (gh) not installed. Opening browser for manual release creation..."
  echo "📝 Copy this changelog entry:"
  echo "----------------------------------------"
  awk "/## \[${VERSION}\]/,/## \[/" CHANGELOG.md | sed '$d'
  echo "----------------------------------------"
  open "https://github.com/bobcozzi/rpgiv2free/releases/new?tag=${TAG}" 2>/dev/null || {
    echo "📝 Create release manually at: https://github.com/bobcozzi/rpgiv2free/releases/new?tag=${TAG}"
  }
fi

echo "✅ Successfully published ${TAG}!"
echo "📦 VS Code Marketplace: https://marketplace.visualstudio.com/items?itemName=CozziResearch.rpgiv2free"
echo "📦 Open VSX: https://open-vsx.org/extension/CozziResearch/rpgiv2free"
echo "📝 GitHub Release: https://github.com/bobcozzi/rpgiv2free/releases/tag/${TAG}"