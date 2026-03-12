#!/usr/bin/env bash
# Create a release branch from develop.
# semantic-release determines the version automatically from conventional commits.
# Usage: pnpm release:branch

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Date-based branch name (avoids version guessing)
BRANCH="release/$(date +%Y%m%d)"

# If branch already exists today, append a counter
if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH" 2>/dev/null || \
   git show-ref --verify --quiet "refs/heads/$BRANCH" 2>/dev/null; then
  COUNTER=2
  while git show-ref --verify --quiet "refs/remotes/origin/${BRANCH}-${COUNTER}" 2>/dev/null || \
        git show-ref --verify --quiet "refs/heads/${BRANCH}-${COUNTER}" 2>/dev/null; do
    COUNTER=$((COUNTER + 1))
  done
  BRANCH="${BRANCH}-${COUNTER}"
fi

# Ensure we're on develop and up to date
git fetch origin develop 2>/dev/null || true
git checkout develop
git pull origin develop

# Create and push release branch
git checkout -b "$BRANCH"
git push -u origin "$BRANCH"

echo ""
echo "Release branch $BRANCH ready"
echo ""
echo "Next steps:"
echo "  1. Open PR: $BRANCH -> main"
echo "  2. Merge when CI passes"
echo "  3. semantic-release will determine the version and deploy automatically"
echo ""
echo "Version will be decided by commit types:"
echo "  feat: -> minor bump (0.8.0 -> 0.9.0)"
echo "  fix:  -> patch bump (0.8.0 -> 0.8.1)"
echo "  BREAKING CHANGE -> major bump (0.8.0 -> 1.0.0)"
echo ""
