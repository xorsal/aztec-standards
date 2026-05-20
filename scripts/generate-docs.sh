#!/usr/bin/env bash
# Generate aztec-standards API documentation using `nargo doc`.
# Output lands in docs/api/latest/.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$REPO_ROOT/docs/api/latest"
NARGO="${NARGO:-nargo}"

if ! command -v "$NARGO" >/dev/null 2>&1; then
    echo "error: nargo not found. Install the Aztec toolchain or set NARGO=/path/to/nargo." >&2
    exit 1
fi

cd "$REPO_ROOT"

echo "Generating docs with $($NARGO --version | head -n1)..."
"$NARGO" doc --workspace

if [[ ! -d "$REPO_ROOT/target/docs" ]]; then
    echo "error: nargo doc did not produce target/docs/" >&2
    exit 1
fi

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"
cp -r "$REPO_ROOT/target/docs/." "$OUTPUT_DIR/"

count=$(find "$OUTPUT_DIR" -name "*.html" | wc -l | tr -d ' ')
echo "Wrote $count HTML files to $OUTPUT_DIR"
echo "Open $OUTPUT_DIR/index.html in a browser."
