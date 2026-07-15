#!/usr/bin/env bash
# Build a Chrome Web Store submission zip from a clean production build.
#
# The zip is created FROM build/chrome-mv3-prod only, so dev artifacts
# (.git, node_modules, tests, docs, sources) can never leak into the package.
# Output: dist/gitlab-ai-review-bridge-v<version>.zip
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT/build/chrome-mv3-prod"
DIST_DIR="$ROOT/dist"

cd "$ROOT"

echo "==> Production build (plasmo, hermetic env)"
# Store packages must not pick up .env.local & co (they may add a private
# self-hosted GitLab host). Empty process-env overrides do NOT beat Plasmo's
# .env loading, so stash every .env* file (except the committed template)
# for the duration of the build and restore afterwards.
STASH_DIR="$(mktemp -d)"
restore_env() {
  find "$STASH_DIR" -maxdepth 1 -name '.env*' -exec mv {} "$ROOT/" \; 2>/dev/null || true
  rmdir "$STASH_DIR" 2>/dev/null || true
}
trap restore_env EXIT
for f in "$ROOT"/.env*; do
  [[ -e "$f" ]] || continue
  [[ "$(basename "$f")" == ".env.example" ]] && continue
  mv "$f" "$STASH_DIR/"
done
npm run build

if [[ ! -f "$BUILD_DIR/manifest.json" ]]; then
  echo "ERROR: $BUILD_DIR/manifest.json not found — build failed?" >&2
  exit 1
fi

VERSION="$(node -p "require('$BUILD_DIR/manifest.json').version")"
ZIP="$DIST_DIR/gitlab-ai-review-bridge-v$VERSION.zip"

echo "==> Sanity checks"
# manifest_version must be 3
MV="$(node -p "require('$BUILD_DIR/manifest.json').manifest_version")"
if [[ "$MV" != "3" ]]; then
  echo "ERROR: manifest_version is $MV, expected 3" >&2
  exit 1
fi
# No secrets in the package ("Bearer " with trailing space; sk- as a word
# prefix to avoid matching CSS classes like "task--resolved").
if grep -rInE '(^|[^a-zA-Z-])sk-[a-zA-Z0-9]{8,}|api_key\s*=|Bearer ' "$BUILD_DIR" >/dev/null 2>&1; then
  echo "ERROR: potential secret found in build output:" >&2
  grep -rInE '(^|[^a-zA-Z-])sk-[a-zA-Z0-9]{8,}|api_key\s*=|Bearer ' "$BUILD_DIR" >&2
  exit 1
fi
# Store package must contain exactly the public host — no self-hosted
# instances and no unsubstituted "$PLASMO_*" literals.
node - "$BUILD_DIR" <<'EOF'
const m = require(`${process.argv[2]}/manifest.json`)
const hosts = m.host_permissions ?? []
const matches = (m.content_scripts ?? []).flatMap((cs) => cs.matches ?? [])
const bad = [...hosts, ...matches].filter(
  (p) => p.includes('$') || !p.startsWith('https://gitlab.com/'),
)
if (bad.length) {
  console.error('ERROR: unexpected host patterns in Store manifest:', bad)
  process.exit(1)
}
EOF
# No remote code references
if grep -rInE 'importScripts\(|https?://[^"'"'"' ]+\.js' "$BUILD_DIR" --include='*.js' --include='*.html' >/dev/null 2>&1; then
  echo "ERROR: remote code reference found in build output:" >&2
  grep -rInE 'importScripts\(|https?://[^"'"'"' ]+\.js' "$BUILD_DIR" --include='*.js' --include='*.html' >&2
  exit 1
fi
echo "    manifest_version=3, no secrets, no remote code — OK"

# Plasmo declares the content-script CSS in web_accessible_resources even
# when it is inlined via `data-text:` and never emitted. Prune WAR entries
# pointing at files absent from the build so the manifest has no dangling
# references (a red flag for Store review).
node - "$BUILD_DIR" <<'EOF'
const fs = require('fs')
const path = require('path')
const dir = process.argv[2]
const file = path.join(dir, 'manifest.json')
const m = JSON.parse(fs.readFileSync(file, 'utf8'))
if (Array.isArray(m.web_accessible_resources)) {
  m.web_accessible_resources = m.web_accessible_resources
    .map((e) => ({
      ...e,
      resources: (e.resources ?? []).filter((r) => {
        const ok = fs.existsSync(path.join(dir, r))
        if (!ok) console.log(`    pruned dangling web_accessible_resource: ${r}`)
        return ok
      }),
    }))
    .filter((e) => e.resources.length > 0)
  if (m.web_accessible_resources.length === 0) delete m.web_accessible_resources
  fs.writeFileSync(file, JSON.stringify(m))
}
EOF

echo "==> Packing $ZIP"
mkdir -p "$DIST_DIR"
rm -f "$ZIP"
# Zip the CONTENTS of the build dir (manifest.json at zip root — Store requirement).
(cd "$BUILD_DIR" && zip -r -q -X "$ZIP" . -x '.*')

echo "==> Contents"
unzip -l "$ZIP"

SIZE="$(du -h "$ZIP" | cut -f1)"
echo "==> Done: $ZIP ($SIZE)"
