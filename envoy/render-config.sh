#!/bin/sh
# Starts Envoy with the CORS allow-list taken from CORS_ALLOWED_ORIGINS
# (comma-separated origins, e.g. "https://fleet.example.com,http://localhost:3000").
# Envoy's config can't read environment variables, so the list is written
# into a copy of envoy.yaml in place of its "#@CORS_ALLOWED_ORIGINS@" line.
# An origin that isn't scheme://host[:port] stops the start-up: a typo must
# not silently become "allow nothing" or, worse, a pattern that allows more.
set -euf  # -f: no globbing, so an origin of "*" stays "*"

template=/etc/envoy/envoy.yaml.in
config=/tmp/envoy.yaml
marker='#@CORS_ALLOWED_ORIGINS@'

line=$(grep -n "^[[:space:]]*$marker[[:space:]]*$" "$template" | cut -d: -f1)
[ -n "$line" ] || { echo "render-config: $marker not found in $template" >&2; exit 1; }
indent=$(sed -n "${line}p" "$template" | sed "s/$marker.*//")

block="${indent}allow_origin_string_match:"
count=0
for origin in $(printf '%s' "${CORS_ALLOWED_ORIGINS:-}" | tr ',' ' '); do
  if ! printf '%s' "$origin" | grep -Eq '^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?$'; then
    echo "render-config: invalid origin in CORS_ALLOWED_ORIGINS: '$origin' (expected scheme://host[:port], no path, no wildcard)" >&2
    exit 1
  fi
  block="$block
${indent}  - exact: \"$origin\""
  count=$((count + 1))
done
[ "$count" -gt 0 ] || block="${indent}allow_origin_string_match: []"

{
  head -n $((line - 1)) "$template"
  printf '%s\n' "$block"
  tail -n +$((line + 1)) "$template"
} > "$config"

echo "render-config: CORS allowed for $count origin(s): ${CORS_ALLOWED_ORIGINS:-<none>}"
exec /docker-entrypoint.sh envoy -c "$config" "$@"
