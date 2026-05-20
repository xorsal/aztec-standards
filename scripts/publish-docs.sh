#!/usr/bin/env bash
# Regenerate API docs and publish to the GitHub Pages repo.
#
# The destination repo is hosted separately from this one because
# defi-wonderland disables Pages on forks of its repositories.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_REPO="${DOCS_REPO:-git@github.com:xorsal/aztec-standards-docs.git}"
DOCS_BRANCH="${DOCS_BRANCH:-main}"

"$REPO_ROOT/scripts/generate-docs.sh"

src="$REPO_ROOT/docs/api/latest"
if [[ ! -f "$src/index.html" ]]; then
    echo "error: $src/index.html missing — did generate-docs.sh fail?" >&2
    exit 1
fi

tmpdir="$(mktemp -d -t aztec-docs-publish-XXXX)"
trap 'rm -rf "$tmpdir"' EXIT

echo "Cloning $DOCS_REPO ($DOCS_BRANCH)..."
git clone --depth=1 --branch "$DOCS_BRANCH" "$DOCS_REPO" "$tmpdir"

find "$tmpdir" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -r "$src/." "$tmpdir/"
touch "$tmpdir/.nojekyll"

cd "$tmpdir"
git add -A
if git diff --cached --quiet; then
    echo "No changes to publish."
    exit 0
fi

source_sha="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
git commit -m "docs: refresh from aztec-standards@${source_sha}"
git push origin "$DOCS_BRANCH"
echo "Published. Live at https://xorsal.github.io/aztec-standards-docs/"
