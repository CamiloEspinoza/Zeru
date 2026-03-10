#!/usr/bin/env bash
# Manual version bump fallback. Prefer: merge to main → semantic-release runs automatically.
# Usage: ./scripts/bump-version.sh [major|minor|patch]

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CURRENT_VERSION=$(node -p "require('./package.json').version")
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

case "${1:-patch}" in
  major) NEW_VERSION="$((MAJOR + 1)).0.0" ;;
  minor) NEW_VERSION="$MAJOR.$((MINOR + 1)).0" ;;
  patch) NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))" ;;
  *)     echo "Usage: $0 {major|minor|patch}"; exit 1 ;;
esac

echo "Bumping version from $CURRENT_VERSION to $NEW_VERSION"
node scripts/sync-versions.js "$NEW_VERSION"

echo ""
echo "Done. Next steps:"
echo "  1. git add package.json apps/*/package.json packages/*/package.json"
echo "  2. git commit -m 'chore(release): version $NEW_VERSION'"
echo "  3. git tag -a v$NEW_VERSION -m 'Release v$NEW_VERSION'"
echo "  4. git push origin main --follow-tags"
echo ""
echo "Or merge your release branch to main and let semantic-release handle it."
