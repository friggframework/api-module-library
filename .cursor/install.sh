#!/usr/bin/env bash
# Warm-boot bootstrap for Cursor Cloud Agents (and local parity).
# Idempotent: safe to re-run. Must exit when finished.
set -euo pipefail

cd "$(dirname "$0")/.."

# Many module jest setups use mongodb-memory-server with a Mongo 5.x binary that
# links against OpenSSL 1.1. Ubuntu 24.04+ only ships OpenSSL 3 by default.
if ! ldconfig -p 2>/dev/null | grep -q 'libcrypto\.so\.1\.1 '; then
  echo "[.cursor/install] Installing libssl1.1 for mongodb-memory-server"
  sudo apt-get update -qq
  TMP_DEB="$(mktemp /tmp/libssl1.1.XXXXXX.deb)"
  wget -qO "$TMP_DEB" \
    http://archive.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2.24_amd64.deb
  sudo dpkg -i "$TMP_DEB"
  rm -f "$TMP_DEB"
fi

echo "[.cursor/install] node=$(node -v) npm=$(npm -v)"
npm ci --no-audit --no-fund

echo "[.cursor/install] Bootstrap complete"
