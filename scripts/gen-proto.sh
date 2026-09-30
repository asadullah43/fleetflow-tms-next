#!/usr/bin/env bash
# Generates JS + TypeScript message code from proto/*.proto using
# protobufjs (pure-JS, no protoc/native binary required).
#
# Shared by backend and frontend: both get the same generated message
# encode/decode code, plus a .d.ts for type safety. Service *stubs* are
# NOT generated here:
#   - backend implements each RPC by hand against @grpc/proto-loader,
#     which loads the .proto dynamically at server start
#   - frontend calls each RPC by hand against the grpc-web runtime
#     (see frontend/lib/grpc/client.ts), using these message types
#
# Run from repo root: npm run proto:gen
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROTO_DIR="$ROOT_DIR/proto"
PBJS="$ROOT_DIR/node_modules/.bin/pbjs"
PBTS="$ROOT_DIR/node_modules/.bin/pbts"

OUT_DIRS=(
  "$ROOT_DIR/backend/src/generated/proto"
  "$ROOT_DIR/frontend/lib/generated/proto"
)

for OUT in "${OUT_DIRS[@]}"; do
  mkdir -p "$OUT"
  echo "Generating $OUT/messages.js + messages.d.ts ..."
  "$PBJS" -t static-module -w commonjs -o "$OUT/messages.js" "$PROTO_DIR"/*.proto
  "$PBTS" -o "$OUT/messages.d.ts" "$OUT/messages.js"
done

echo "Done."
