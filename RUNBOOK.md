# Benchmark Runbook

## 1. Verify Containers

Database server `10.0.0.2`:

```bash
docker ps
```

Required containers:

- `postgres-db`
- `postgres-exporter`
- `node-exporter`

Measurement server `10.0.0.3`:

```bash
docker ps
```

Required containers:

- `prometheus`
- `grafana`
- `node-exporter`

Application server `10.0.0.4`:

```bash
docker ps
```

Required containers:

- `node-app-container`
- `deno-app-container`
- `bun-app-container`
- `node-exporter`

## 2. Verify Network

From `merici`:

```bash
curl http://10.0.0.4:3000/ping
curl http://10.0.0.4:3001/ping
curl http://10.0.0.4:3002/ping
curl http://10.0.0.3:9090/-/ready
curl http://10.0.0.2:9187/metrics
```

Expected result: all commands return successfully. The three `/ping` endpoints
return `{"message":"pong"}`.

## 3. Prepare Database

For write tests, reset all runtime tables:

```sql
TRUNCATE node_schema.users RESTART IDENTITY;
TRUNCATE deno_schema.users RESTART IDENTITY;
TRUNCATE bun_schema.users RESTART IDENTITY;
```

For read tests, seed all three schemas with the same amount of data.

## 4. Run Benchmarks

Use one runtime and one benchmark type per measured run:

```bash
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

k6 metrics are tagged with `runtime`, `benchmark`, `testid`, and `phase`.
Use `phase="measurement"` for final evaluation so warmup data is excluded.

Load is controlled by `TARGET_RPS`; VUs are configured only as generator
capacity via `PRE_ALLOCATED_VUS` and `MAX_VUS`.

For write tests, the generated rows include a run identifier in `name` and
`email`. By default this is `TEST_ID`; to set a separate value manually:

```bash
RUN_ID=node-write-001 ./startWriteNode.sh
```

## 5. Check Prometheus

Open Prometheus:

```text
http://178.105.65.16:9090
```

Useful checks:

```promql
up
k6_http_reqs_total
{__name__=~"k6_http_req_duration.*", runtime="node", phase="measurement"}
{__name__=~"k6_http_req_duration.*", benchmark="write", phase="measurement"}
```

## 6. Check Grafana

Open Grafana:

```text
http://178.105.65.16:3000
```

Import or use the current measurement dashboard:

```text
dashboard/runtimeBenchmarkDashboard_v2_measurement.json
```

It should show variables `runtime`, `benchmark`, `testid`, `server_job`, and
`db`. Final k6 panels must use `phase="measurement"` so warmup data is excluded.

Use Prometheus as the data source:

```text
http://prometheus:9090
```

If Grafana is outside the Docker network, use:

```text
http://10.0.0.3:9090
```

## 7. Common Failure Points

| Symptom | Likely cause | Check |
| --- | --- | --- |
| k6 cannot push metrics | Prometheus remote write receiver is disabled | Prometheus command must include `--web.enable-remote-write-receiver` |
| Prometheus target `10.0.0.x:9100` is down | node-exporter is not reachable | check port mapping or host network mode |
| read/write test returns `500` | application cannot connect to PostgreSQL or schema is missing | check `.env`, `DB_HOST`, `DB_SCHEMA`, and `runtime-schemas.sql` |
| read test returns empty array | table has no seeded rows | seed the runtime schema before read benchmark |
| Grafana cannot distinguish runtimes | k6 tags missing | use the provided `start*.sh` scripts |
| Dropped iterations are non-zero | k6 load generator could not keep target arrival rate | increase `PRE_ALLOCATED_VUS`/`MAX_VUS` or lower `TARGET_RPS` |
