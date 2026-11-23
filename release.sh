#!/usr/bin/env bash
# Release a new version: sets the version in extension/manifest.json, commits,
# tags and pushes. The GitHub Action then signs it and publishes the update.
#
#   bash release.sh 1.6.1
set -euo pipefail

VERSION="${1:-}"
if [[ ! "$VERSION" =~ ^[0-9]+(\.[0-9]+){1,3}$ ]]; then
  echo "Usage: bash release.sh <version>   e.g. bash release.sh 1.6.1" >&2
  exit 1
fi
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
  echo "Tag v$VERSION already exists. Pick a higher version." >&2
  exit 1
fi

if ! grep -q "^## $VERSION\s*$" CHANGELOG.md 2>/dev/null; then
  echo "Add a '## $VERSION' section to CHANGELOG.md first (it becomes the release notes)." >&2
  exit 1
fi

# Only the top-level "version" key ("strict_min_version" doesn't match).
perl -0pi -e 's/("version":\s*")[^"]+(")/${1}'"$VERSION"'${2}/' extension/manifest.json
grep -q "\"version\": \"$VERSION\"" extension/manifest.json || { echo "Couldn't set the version in manifest.json" >&2; exit 1; }

git add -A
git diff --cached --quiet || git commit -m "Release v$VERSION"
git tag "v$VERSION"
git push origin HEAD
git push origin "v$VERSION"

echo "Pushed v$VERSION. Watch it sign and publish under the repo's Actions tab."
