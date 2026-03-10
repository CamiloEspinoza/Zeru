#!/usr/bin/env bash
# Create release branch from develop with next version.
# Usage: ./scripts/create-release-branch.sh [patch|minor|major]
# Default: patch (0.2.0 → 0.2.1)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Fetch latest tags
git fetch origin --tags 2>/dev/null || true

# Get current version from latest v* tag or package.json
CURRENT_TAG=$(git tag -l 'v*' 2>/dev/null | sort -V | tail -1)
if [[ -n "$CURRENT_TAG" ]]; then
  CURRENT_VERSION="${CURRENT_TAG#v}"
else
  CURRENT_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "0.0.0")
fi

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

case "${1:-patch}" in
  major)
    NEW_VERSION="$((MAJOR + 1)).0.0"
    ;;
  minor)
    NEW_VERSION="$MAJOR.$((MINOR + 1)).0"
    ;;
  patch)
    NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"
    ;;
  *)
    echo "Usage: $0 {patch|minor|major}"
    exit 1
    ;;
esac

BRANCH="release/$NEW_VERSION"

# Ensure we're on develop and up to date
git fetch origin develop 2>/dev/null || true
git checkout develop
git pull origin develop

# Create and push release branch
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "Branch $BRANCH already exists. Checking it out and pulling."
  git checkout "$BRANCH"
  git pull origin "$BRANCH" 2>/dev/null || true
else
  git checkout -b "$BRANCH"
  git push -u origin "$BRANCH"
fi

echo ""
echo "✅ Release branch $BRANCH ready"
echo ""
echo "Next steps:"
echo "  1. Open PR: $BRANCH → main"
echo "  2. Merge when CI passes"
echo "  3. semantic-release will create v$NEW_VERSION and deploy"
echo ""
