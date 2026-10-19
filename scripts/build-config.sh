#!/bin/sh
# Writes web/config.js from SUPABASE_URL and SUPABASE_KEY.
# Used as the build command on Cloudflare Pages.
set -eu

: "${SUPABASE_URL:?SUPABASE_URL is not set}"
: "${SUPABASE_KEY:?SUPABASE_KEY is not set}"

out="$(dirname "$0")/../web/config.js"
cat > "$out" <<JS
window.TALIS_CONFIG = {
  supabaseUrl: "$SUPABASE_URL",
  supabaseKey: "$SUPABASE_KEY",
};
JS
echo "Wrote $out"
