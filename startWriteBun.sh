#!/bin/bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export BASE_URL="${BASE_URL:-http://10.0.0.4:3002}"
export RUNTIME="${RUNTIME:-bun}"
export BENCHMARK="${BENCHMARK:-write}"
export K6_SCRIPT="${K6_SCRIPT:-write.js}"

bash "${SCRIPT_DIR}/runK6Benchmark.sh"
