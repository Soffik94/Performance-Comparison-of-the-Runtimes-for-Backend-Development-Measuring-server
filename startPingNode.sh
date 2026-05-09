#!/bin/bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export BASE_URL="${BASE_URL:-http://10.0.0.4:3000}"
export RUNTIME="${RUNTIME:-node}"
export BENCHMARK="${BENCHMARK:-ping}"
export K6_SCRIPT="${K6_SCRIPT:-ping.js}"

bash "${SCRIPT_DIR}/runK6Benchmark.sh"
