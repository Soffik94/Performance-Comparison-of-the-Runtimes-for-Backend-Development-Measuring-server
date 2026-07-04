#!/bin/bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export BASE_URL="${DENO_BASE_URL:-${BASE_URL:-http://app-server:3001}}"
export RUNTIME="deno"
export BENCHMARK="compute"
export K6_SCRIPT="compute.js"
export COMPUTE_ITERATIONS="${COMPUTE_ITERATIONS:-${ITERATIONS:-${N:-1000}}}"

bash "${SCRIPT_DIR}/runK6Benchmark.sh"
