cat > export_run_summary.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

PROM="${PROM:-http://localhost:9090}"
TEST_ID="${1:?Zadej testid}"
RUNTIME="${2:?Zadej runtime}"
BENCHMARK="${3:?Zadej benchmark}"
TARGET_RPS="${4:?Zadej target RPS}"
RUN="${5:?Zadej run number}"

RANGE="${RANGE:-30m}"
OUT="${OUT:-h1_runs_summary.csv}"

q() {
  local query="$1"
  curl -G -s "$PROM/api/v1/query" \
    --data-urlencode "query=$query" \
  | jq -r '.data.result[0].value[1] // "NA"'
}

HTTP_FILTER="{testid=\"$TEST_ID\",runtime=\"$RUNTIME\",benchmark=\"$BENCHMARK\",phase=\"measurement\"}"
RUN_FILTER="{testid=\"$TEST_ID\",runtime=\"$RUNTIME\",benchmark=\"$BENCHMARK\"}"

AVG_RPS=$(q "avg_over_time((sum(rate(k6_http_reqs_total$HTTP_FILTER[30s])))[$RANGE:5s])")

P99_MS=$(q "1000 * avg_over_time((avg(k6_http_req_duration_p99$HTTP_FILTER))[$RANGE:5s])")

ERRORS_PCT=$(q "100 * avg_over_time((avg(k6_http_req_failed_rate$HTTP_FILTER))[$RANGE:5s])")

DROPPED=$(q "sum(increase(k6_dropped_iterations_total$RUN_FILTER[$RANGE]))")

if [ ! -f "$OUT" ]; then
  echo "testid,Runtime,Benchmark,TARGET_RPS,Run,Avg_RPS,P99_latency_ms,HTTP_errors_pct,Dropped_iterations,Vysledek,Poznamka" > "$OUT"
fi

echo "$TEST_ID,$RUNTIME,$BENCHMARK,$TARGET_RPS,$RUN,$AVG_RPS,$P99_MS,$ERRORS_PCT,$DROPPED,," >> "$OUT"

echo "Hotovo: $OUT"
tail -n 2 "$OUT"
EOF

chmod +x export_run_summary.sh
