#!/bin/bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BASE_URL="${BASE_URL:-http://10.0.0.4:3000}"
RUNTIME="${RUNTIME:-node}"
BENCHMARK="${BENCHMARK:-ping}"
K6_SCRIPT="${K6_SCRIPT:-${BENCHMARK}.js}"
TARGET_RPS="${TARGET_RPS:-1000}"
WARMUP_DURATION="${WARMUP_DURATION:-1m}"
MEASURE_DURATION="${MEASURE_DURATION:-3m}"
PRE_ALLOCATED_VUS="${PRE_ALLOCATED_VUS:-100}"
MAX_VUS="${MAX_VUS:-1000}"
ITERATIONS="${ITERATIONS:-${N:-10000}}"
N="${N:-${ITERATIONS}}"
COOLDOWN_DURATION="${COOLDOWN_DURATION:-60}"
K6_PROMETHEUS_RW_SERVER_URL="${K6_PROMETHEUS_RW_SERVER_URL:-${PROMETHEUS_RW_SERVER_URL:-http://10.0.0.3:9090/api/v1/write}}"
TEST_ID="${TEST_ID:-${BENCHMARK}-${RUNTIME}-rps${TARGET_RPS}-$(date -u +%Y%m%dT%H%M%SZ)}"
RUN_ID="${RUN_ID:-${TEST_ID}}"

echo "Running ${BENCHMARK} benchmark for ${RUNTIME}"
echo "TEST_ID=${TEST_ID} TARGET_RPS=${TARGET_RPS} WARMUP=${WARMUP_DURATION} MEASURE=${MEASURE_DURATION}"

docker run --rm -i \
  --user 0 \
  -e "K6_PROMETHEUS_RW_SERVER_URL=${K6_PROMETHEUS_RW_SERVER_URL}" \
  -v "${SCRIPT_DIR}:/scripts" \
  grafana/k6 run \
  -e "BASE_URL=${BASE_URL}" \
  -e "RUNTIME=${RUNTIME}" \
  -e "BENCHMARK=${BENCHMARK}" \
  -e "TEST_ID=${TEST_ID}" \
  -e "TARGET_RPS=${TARGET_RPS}" \
  -e "WARMUP_DURATION=${WARMUP_DURATION}" \
  -e "MEASURE_DURATION=${MEASURE_DURATION}" \
  -e "PRE_ALLOCATED_VUS=${PRE_ALLOCATED_VUS}" \
  -e "MAX_VUS=${MAX_VUS}" \
  -e "ITERATIONS=${ITERATIONS}" \
  -e "N=${N}" \
  -e "RUN_ID=${RUN_ID}" \
  -o experimental-prometheus-rw \
  --tag "runtime=${RUNTIME}" \
  --tag "benchmark=${BENCHMARK}" \
  --tag "testid=${TEST_ID}" \
  "/scripts/${K6_SCRIPT}"

status=$?

echo "Cooldown ${COOLDOWN_DURATION}s"
sleep "${COOLDOWN_DURATION}"

exit "${status}"
