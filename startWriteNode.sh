#!/bin/bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export BASE_URL="${NODE_BASE_URL:-${BASE_URL:-http://app-server:3000}}"
export RUNTIME="node"
export BENCHMARK="write"
export K6_SCRIPT="write.js"

bash "${SCRIPT_DIR}/runK6Benchmark.sh"
