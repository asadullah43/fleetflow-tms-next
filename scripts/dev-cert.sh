#!/bin/sh
# Makes a self-signed certificate for trying the HTTPS setup locally
# (docker-compose.prod.yml) — browsers will warn about it; never use it in
# production. Writes ./certs/fullchain.pem and ./certs/privkey.pem (gitignored).
# Runs openssl in a container, so nothing needs installing.
#
#   sh scripts/dev-cert.sh [host name, default localhost]
#
# then in .env: SERVER_NAME=localhost  TLS_CERTS_DIR=./certs  HSTS_MAX_AGE=0
set -eu
name="${1:-localhost}"
cd "$(dirname "$0")/.."
mkdir -p certs
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd)/certs:/certs" alpine/openssl \
  req -x509 -newkey rsa:2048 -sha256 -days 365 -nodes \
  -keyout /certs/privkey.pem -out /certs/fullchain.pem \
  -subj "/CN=${name}" -addext "subjectAltName=DNS:${name},DNS:localhost,IP:127.0.0.1"
echo "Wrote certs/fullchain.pem and certs/privkey.pem for ${name} (valid 365 days)."
