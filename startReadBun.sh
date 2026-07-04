#!/bin/bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export BASE_URL="${BUN_BASE_URL:-${BASE_URL:-http://app-server:3002}}"
export RUNTIME="bun"
export BENCHMARK="read"
export K6_SCRIPT="read.js"

bash "${SCRIPT_DIR}/runK6Benchmark.sh"
