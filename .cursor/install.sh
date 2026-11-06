#!/usr/bin/env bash
# Warm-boot bootstrap for Cursor Cloud Agents (and local/CI parity).
# Idempotent: safe to re-run. Must exit when finished.
set -euo pipefail

cd "$(dirname "$0")/.."

# Many module jest setups use mongodb-memory-server with a Mongo 5.x binary that
# links against OpenSSL 1.1. Ubuntu 22.04+/24.04+ ship OpenSSL 3 by default.
LIBSSL11_DEB_URL='https://archive.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2.24_amd64.deb'
# SHA-256 of libssl1.1_1.1.1f-1ubuntu2.24_amd64.deb (Ubuntu jammy / Launchpad).
LIBSSL11_DEB_SHA256='7cf39d70a639017d1dd7c8d36daa2258063608688e449fddf40ffdd46f992a78'

if ! ldconfig -p 2>/dev/null | grep -q 'libcrypto\.so\.1\.1 '; then
  echo "[.cursor/install] Installing libssl1.1 for mongodb-memory-server"
  sudo apt-get update -qq
  TMP_DEB="$(mktemp /tmp/libssl1.1.XXXXXX.deb)"
  curl -fsSL -o "$TMP_DEB" "$LIBSSL11_DEB_URL"
  printf '%s  %s\n' "$LIBSSL11_DEB_SHA256" "$TMP_DEB" | sha256sum -c -
  sudo dpkg -i "$TMP_DEB"
  rm -f "$TMP_DEB"
fi

echo "[.cursor/install] node=$(node -v) npm=$(npm -v)"
npm ci --no-audit --no-fund

echo "[.cursor/install] Bootstrap complete"
