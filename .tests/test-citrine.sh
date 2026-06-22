#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd -P)

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'skip: node is required for Citrine JavaScript unit tests'
  exit 0
fi

node "$ROOT_DIR/.tests/test-citrine-node.js"
