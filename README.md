# k6 Benchmark Tests

This repository contains Grafana k6 scripts for benchmarking three backend
runtimes: Node.js, Deno, and Bun. The scripts are intended to run from the
measurement server `merici` against applications running on a separate
application server.

## Server Topology

| Role | Hostname | Public IP | Private IP | Services |
| --- | --- | --- | --- | --- |
| Database server | `db` | `138.199.161.252` | `10.0.0.2` | PostgreSQL, postgres-exporter, node-exporter |
| Measurement server | `merici` | `178.105.65.16` | `10.0.0.3` | Grafana, Prometheus, k6 runner, node-exporter |
| Application server | `app` | `178.105.79.83` | `10.0.0.4` | Node.js app, Deno app, Bun app, node-exporter |

Benchmark traffic uses the private address of the application server:
`10.0.0.4`.

## Application Targets

| Runtime | Base URL | Container | Host port | Container port |
| --- | --- | --- | --- | --- |
| Node.js | `http://10.0.0.4:3000` | `node-app-container` | `3000` | `3000` |
| Deno | `http://10.0.0.4:3001` | `deno-app-container` | `3001` | `3000` |
| Bun | `http://10.0.0.4:3002` | `bun-app-container` | `3002` | `3000` |

## Test Scripts

| Script | Endpoint | Purpose |
| --- | --- | --- |
| `ping.js` | `GET /ping` | basic HTTP request-response benchmark |
| `compute.js` | `GET /compute?iterations=...` | CPU-bound SHA-256 hashing benchmark |
| `read.js` | `GET /items` | PostgreSQL read benchmark |
| `write.js` | `POST /items` | PostgreSQL write benchmark |

Each runtime has a matching shell wrapper:

| Runtime | Ping | Compute | Read | Write |
| --- | --- | --- | --- | --- |
| Node.js | `./startPingNode.sh` | `./startComputeNode.sh` | `./startReadNode.sh` | `./startWriteNode.sh` |
| Deno | `./startPingDeno.sh` | `./startComputeDeno.sh` | `./startReadDeno.sh` | `./startWriteDeno.sh` |
| Bun | `./startPingBun.sh` | `./startComputeBun.sh` | `./startReadBun.sh` | `./startWriteBun.sh` |

## Load Model And Labels

The k6 scripts use an open workload model with two `constant-arrival-rate`
scenarios:

- `warmup`, controlled by `WARMUP_DURATION`
- `measurement`, controlled by `MEASURE_DURATION`

The target load is `TARGET_RPS`. `PRE_ALLOCATED_VUS` and `MAX_VUS` are only the
load-generator capacity reserve.

The start scripts add k6 tags so Grafana and Prometheus can distinguish results:

| Label | Values |
| --- | --- |
| `runtime` | `node`, `deno`, `bun` |
| `benchmark` | `ping`, `compute`, `read`, `write` |
| `testid` | explicit `TEST_ID` or generated value |
| `phase` | `warmup`, `measurement` |

Example PromQL filter:

```promql
{__name__=~"k6_http_req_duration.*", runtime="deno", benchmark="write", phase="measurement"}
```

Filter final thesis results by `phase="measurement"` so warmup samples are not
mixed into the evaluated data.

Write tests include `RUNTIME` and the run identifier in generated `name` and
`email` values. If `RUN_ID` is not set explicitly, the scripts use `TEST_ID`.

## Prometheus And Grafana

Prometheus runs on `10.0.0.3:9090`. Grafana runs on `10.0.0.3:3000`.

Detailed Grafana setup instructions and thesis-oriented PromQL queries are in
`GRAFANA_PROMETHEUS_QUERIES.md`.

k6 sends metrics to Prometheus by remote write:

```bash
K6_PROMETHEUS_RW_SERVER_URL=http://10.0.0.3:9090/api/v1/write
```

Prometheus must be started with:

```bash
--web.enable-remote-write-receiver
```

The included `prometheus.yml` scrapes:

- Prometheus itself on `localhost:9090`
- application server node-exporter on `10.0.0.4:9100`
- measurement server node-exporter on `10.0.0.3:9100`
- database server node-exporter on `10.0.0.2:9100`
- postgres-exporter on `10.0.0.2:9187`

The benchmark applications do not expose `/metrics`, so Prometheus should not
scrape the app ports `3000`, `3001`, or `3002` directly.

## Running Tests

On the measurement server:

```bash
cd ~/Merici
chmod +x start*.sh

TARGET_RPS=2000 TEST_ID=ping-node-rps2000-run1 ./startPingNode.sh
TARGET_RPS=2000 TEST_ID=ping-deno-rps2000-run1 ./startPingDeno.sh
TARGET_RPS=2000 TEST_ID=ping-bun-rps2000-run1 ./startPingBun.sh

./startComputeNode.sh
./startComputeDeno.sh
./startComputeBun.sh

./startReadNode.sh
./startReadDeno.sh
./startReadBun.sh

./startWriteNode.sh
./startWriteDeno.sh
./startWriteBun.sh
```

Run tests one at a time for cleaner comparison unless the methodology explicitly
requires concurrent runtime tests.

Common environment variables:

| Variable | Default |
| --- | --- |
| `BASE_URL` | runtime-specific app URL |
| `RUNTIME` | wrapper-specific runtime |
| `BENCHMARK` | wrapper-specific benchmark |
| `TEST_ID` | generated from benchmark, runtime, RPS, timestamp |
| `TARGET_RPS` | `1000` |
| `WARMUP_DURATION` | `1m` |
| `MEASURE_DURATION` | `3m` |
| `PRE_ALLOCATED_VUS` | `100` |
| `MAX_VUS` | `1000` |
| `COOLDOWN_DURATION` | `60` |

## Preflight Checks

Before running benchmarks from `merici`, verify connectivity:

```bash
curl http://10.0.0.4:3000/ping
curl http://10.0.0.4:3001/ping
curl http://10.0.0.4:3002/ping
curl http://10.0.0.3:9090/-/ready
curl http://10.0.0.2:9187/metrics
```

If host metrics are required, also verify:

```bash
curl http://10.0.0.4:9100/metrics
curl http://10.0.0.3:9100/metrics
curl http://10.0.0.2:9100/metrics
```

If a node-exporter container does not publish port `9100`, it must either run in
host network mode or be recreated with a reachable port mapping.

## Database Notes

Read tests require existing rows in the corresponding runtime schema. Write
tests insert rows into runtime-specific schemas:

| Runtime | Schema |
| --- | --- |
| Node.js | `node_schema` |
| Deno | `deno_schema` |
| Bun | `bun_schema` |

For comparable read/write tests, reset or seed all schemas consistently before
each measured run.
