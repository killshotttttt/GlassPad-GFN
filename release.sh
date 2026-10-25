#!/usr/bin/env bash
# Publishes gfn-touch-controls.user.js to the update gist, so the Userscripts
# app on the iPad/iPhone offers the new version. Bump @version first.
set -euo pipefail
cd "$(dirname "$0")"

GIST=d4bd9b1bc9ee3115c96c240e08b7fc82
SCRIPT=gfn-touch-controls.user.js
META=gfn-touch-controls.meta.js

local_v=$(sed -n 's|^// @version *||p' "$SCRIPT")
# The settings menu shows VERSION, so keep it equal to @version.
sed -i "s|^  const VERSION = '[^']*';|  const VERSION = '$local_v';|" "$SCRIPT"
grep -q "^  const VERSION = '$local_v';" "$SCRIPT" || { echo "Couldn't set VERSION in $SCRIPT" >&2; exit 1; }
node --check "$SCRIPT"
# Read through the API: the raw gist links are cached for a few minutes.
remote_v=$(gh gist view "$GIST" --filename "$META" --raw 2>/dev/null | sed -n 's|^// @version *||p' || true)
newest=$(printf '%s\n%s\n' "${remote_v:-0}" "$local_v" | sort -V | tail -1)
if [ "$local_v" = "$remote_v" ] || [ "$newest" != "$local_v" ]; then
  echo "Published version is $remote_v and this file is $local_v. Bump // @version above $remote_v first." >&2
  exit 1
fi

# Userscripts compares @version in the .meta.js, then downloads the .user.js.
sed -n '1,/==\/UserScript==/p' "$SCRIPT" > "$META"
gh gist edit "$GIST" --filename "$SCRIPT" "$SCRIPT"
gh gist edit "$GIST" --filename "$META" "$META"
echo "Published $local_v (was ${remote_v:-nothing}). The Userscripts app will offer it on its next update check."
