# Grafana a Prometheus dotazy pro bakalarskou praci

Tento soubor popisuje, jak nastavit Prometheus a Grafanu pro vyhodnoceni
benchmarku Node.js, Deno a Bun aplikaci. Dotazy jsou pripravene pro aktualni
merici repozitar `Merici`, kde k6 posila metriky do Promethea pres
`experimental-prometheus-rw` a start skripty pridavaji tagy:

| Label | Hodnoty | Vyznam |
| --- | --- | --- |
| `runtime` | `node`, `deno`, `bun` | testovane behove prostredi |
| `benchmark` | `ping`, `compute`, `read`, `write` | testovany scenar |
| `testid` | napr. `ping-node-rps2000-run1` | jednoznacny identifikator behu |
| `phase` | `warmup`, `measurement` | faze mereni |

Aktualni setup meri aplikace z klientské strany pomoci k6 a infrastrukturu pres
node-exporter a postgres-exporter. Aplikace samotne nevystavuji `/metrics`.

## Vztah k hypotezam

| Hypoteza | Primarni dotazy |
| --- | --- |
| H1: Bun a Deno dosahnou vyssi propustnosti u I/O operaci | RPS pro `ping`, `read`, `write` |
| H2: Bun nativni driver snizi P99 latenci u PostgreSQL komunikace | P99 pro `read` a `write`, pripadne TTFB `http_req_waiting` |
| H3: Node.js + Express bude mit vyssi rezii a latenci | P99/avg latence napric scenari, CPU a RAM app serveru |

Pro statisticke vyhodnoceni pouzivej stejne casove okno pro vsechny dotazy
v ramci jednoho behu a filtruj k6 metriky pres `phase="measurement"`. Warmup
data se nesmi michat do finalniho vyhodnoceni.

## Prometheus setup

Soubor `prometheus.yml` v tomto repozitari uz obsahuje potrebne scrape targety:

```yaml
scrape_configs:
  - job_name: 'app-server-node-exporter'
    static_configs:
      - targets: ['10.0.0.4:9100']

  - job_name: 'measurement-server-node-exporter'
    static_configs:
      - targets: ['10.0.0.3:9100']

  - job_name: 'db-server-node-exporter'
    static_configs:
      - targets: ['10.0.0.2:9100']

  - job_name: 'postgres'
    static_configs:
      - targets: ['10.0.0.2:9187']
```

Prometheus musi byt spusteny s remote-write receiverem:

```bash
docker rm -f prometheus || true
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v prometheus-data:/prometheus \
  -v "$(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml:ro" \
  prom/prometheus \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/prometheus \
  --web.enable-remote-write-receiver
```

Overeni z mericiho serveru:

```bash
curl http://10.0.0.3:9090/-/ready
curl http://10.0.0.3:9090/api/v1/targets
```

Prometheus UI:

```text
http://178.105.65.16:9090
```

## k6 remote write setup

Stavajici start skripty uz pouzivaji:

```bash
-e K6_PROMETHEUS_RW_SERVER_URL=http://10.0.0.3:9090/api/v1/write
-o experimental-prometheus-rw
```

Pro P99 staci aktualni konfigurace. k6 remote write ma ve vychozim nastaveni
pro trend metriky pouze `p(99)`, tedy napriklad `k6_http_req_duration_p99`.

Pokud chces v Grafane zobrazovat i `avg`, `min`, `max`, `p90` nebo `p95`,
dopln do `docker run` v `runK6Benchmark.sh` tento radek:

```bash
-e K6_PROMETHEUS_RW_TREND_STATS=p(90),p(95),p(99),avg,min,max \
```

Potom vzniknou napriklad tyto metriky:

```text
k6_http_req_duration_p90
k6_http_req_duration_p95
k6_http_req_duration_p99
k6_http_req_duration_avg
k6_http_req_duration_min
k6_http_req_duration_max
```

Start skripty predavaji `testid` automaticky. Pokud `TEST_ID` nezadas rucne,
vygeneruje se z benchmarku, runtime, ciloveho RPS a timestampu:

```bash
TEST_ID="${BENCHMARK}-${RUNTIME}-rps${TARGET_RPS}-$(date -u +%Y%m%dT%H%M%SZ)"
```

Beh potom spustis napriklad:

```bash
TEST_ID=read-node-01 ./startReadNode.sh
TEST_ID=read-deno-01 ./startReadDeno.sh
TEST_ID=read-bun-01 ./startReadBun.sh
```

## Grafana setup

Grafana UI:

```text
http://178.105.65.16:3000
```

Datasource:

```text
Type: Prometheus
URL: http://prometheus:9090
```

Pokud Grafana neni ve stejne Docker siti jako Prometheus, pouzij:

```text
URL: http://10.0.0.3:9090
```

### Hotovy dashboard

Aktualni doporuceny dashboard je:

```text
dashboard/runtimeBenchmarkDashboard_v2_measurement.json
```

Importuj ho jako novy dashboard, ne jako prepis stareho. Soubor ma `id: null`
a nema pevny `uid`, takze si Grafana muze vytvorit novou instanci. Tento
dashboard obsahuje promennou `$testid`, vsechny k6 vyhodnocovaci panely
filtruji `phase="measurement"` a panel `Dropped iterations/s` slouzi ke
kontrole, jestli k6 stihalo generovat cilovy `TARGET_RPS`.

### Doporucene dashboard variables

Dashboard v2 uz tyto promenne obsahuje. Pokud dashboard skladas rucne, vytvor
tyto promenne.

#### `$runtime`

```promql
label_values(k6_http_reqs_total, runtime)
```

Zapni `Multi-value` a `Include All option`.

#### `$benchmark`

```promql
label_values(k6_http_reqs_total, benchmark)
```

Zapni `Multi-value` a `Include All option`.

#### `$server_job`

```promql
label_values(node_cpu_seconds_total, job)
```

Pouzij hodnoty:

```text
app-server-node-exporter
measurement-server-node-exporter
db-server-node-exporter
```

#### `$db`

```promql
label_values(pg_stat_database_numbackends, datname)
```

Pro tento benchmark typicky `mydb`.

#### `$testid`

```promql
label_values(k6_http_reqs_total, testid)
```

#### `$phase`

Pro finalni panely nastav obvykle konstantu `measurement`. Promennou pouzij jen
pokud chces ladit warmup:

```promql
label_values(k6_http_reqs_total, phase)
```

## Kontrolni PromQL dotazy

Tyto dotazy pouzij jako prvni v Prometheus UI nebo Grafana Explore.

### Dostupnost exporteru

```promql
up{job=~"app-server-node-exporter|measurement-server-node-exporter|db-server-node-exporter|postgres"}
```

### Existuji k6 metriky?

```promql
count by (__name__) ({__name__=~"k6_.*"})
```

### Existuji runtime, benchmark, testid a phase labely?

```promql
count by (runtime, benchmark, testid, phase) (k6_http_reqs_total)
```

### P99 metriky z k6

```promql
{__name__=~"k6_http_req_duration_.*", runtime=~"node|deno|bun", phase="measurement"}
```

## Hlavni benchmark dotazy

Dotazy nize jsou pripravene pro Grafana promenne `$runtime`, `$benchmark` a
`$testid`. K6 metriky ve finalnich panelech filtruji `phase="measurement"`.

### 1. Propustnost, RPS

Aktualni RPS podle runtime a benchmarku:

```promql
sum by (runtime, benchmark, testid) (
  rate(k6_http_reqs_total{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"}[$__rate_interval])
)
```

Prumerne RPS za vybrane casove okno:

```promql
avg_over_time((
  sum by (runtime, benchmark, testid) (
    rate(k6_http_reqs_total{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"}[30s])
  )
)[$__range:$__interval])
```

Peak RPS za vybrane casove okno:

```promql
max_over_time((
  sum by (runtime, benchmark, testid) (
    rate(k6_http_reqs_total{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"}[30s])
  )
)[$__range:$__interval])
```

RPS pouze pro I/O scenare pro H1:

```promql
sum by (runtime, benchmark, testid) (
  rate(k6_http_reqs_total{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement", benchmark=~"ping|read|write"}[$__rate_interval])
)
```

Pokud je dostupny label `status`, lze zobrazit pouze uspesne 2xx pozadavky:

```promql
sum by (runtime, benchmark, testid) (
  rate(k6_http_reqs_total{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement", status=~"2.."}[$__rate_interval])
)
```

### 2. P99 doba odezvy

P99 latence podle runtime a benchmarku:

```promql
max by (runtime, benchmark, testid) (
  1000 * k6_http_req_duration_p99{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"}
)
```

Prumerna hodnota P99 za vybrane casove okno:

```promql
avg by (runtime, benchmark, testid) (
  1000 * avg_over_time(k6_http_req_duration_p99{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"}[$__range])
)
```

Nejhorsi P99 za vybrane casove okno:

```promql
max by (runtime, benchmark, testid) (
  1000 * max_over_time(k6_http_req_duration_p99{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"}[$__range])
)
```

P99 pro databazove scenare pro H2:

```promql
max by (runtime, benchmark, testid) (
  1000 * k6_http_req_duration_p99{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement", benchmark=~"read|write"}
)
```

P99 pro HTTP stack bez databaze pro H1/H3:

```promql
max by (runtime, benchmark, testid) (
  1000 * k6_http_req_duration_p99{runtime=~"$runtime", benchmark="ping", testid=~"$testid", phase="measurement"}
)
```

P99 pro CPU scenar:

```promql
max by (runtime, benchmark, testid) (
  1000 * k6_http_req_duration_p99{runtime=~"$runtime", benchmark="compute", testid=~"$testid", phase="measurement"}
)
```

### 3. Time To First Byte, vhodne pro DB interpretaci

`http_req_waiting` v k6 odpovida cekani na odpoved serveru, tedy TTFB. U
`read` a `write` dobre ukazuje cast odezvy, ve ktere se projevi serverova prace
a databazova komunikace.

```promql
max by (runtime, benchmark, testid) (
  1000 * k6_http_req_waiting_p99{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement", benchmark=~"read|write"}
)
```

### 4. Prumerna latence, pokud zapnes TREND_STATS

Tento dotaz funguje az po doplneni:

```bash
K6_PROMETHEUS_RW_TREND_STATS=p(90),p(95),p(99),avg,min,max
```

PromQL:

```promql
avg by (runtime, benchmark, testid) (
  1000 * avg_over_time(k6_http_req_duration_avg{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"}[$__range])
)
```

P95:

```promql
max by (runtime, benchmark, testid) (
  1000 * k6_http_req_duration_p95{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"}
)
```

Maximalni latence:

```promql
max by (runtime, benchmark, testid) (
  1000 * max_over_time(k6_http_req_duration_max{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"}[$__range])
)
```

### 5. Chybovost

HTTP failure rate v procentech:

```promql
100 * avg by (runtime, benchmark, testid) (
  k6_http_req_failed_rate{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"}
)
```

Check pass rate v procentech:

```promql
100 * avg by (runtime, benchmark, testid) (
  k6_checks_rate{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"}
)
```

Poznamka: `write.js` aktualne nema `check()`, jen vypisuje chybu do konzole,
takze pro write scenar muze byt `k6_checks_rate` prazdny. Pro write pouzivej
radeji `k6_http_req_failed_rate` nebo filtr pres `status`, pokud je dostupny.

### 6. Celkovy pocet pozadavku a iteraci

Celkovy pocet HTTP pozadavku ve vybranem okne:

```promql
sum by (runtime, benchmark, testid) (
  increase(k6_http_reqs_total{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"}[$__range])
)
```

Celkovy pocet k6 iteraci:

```promql
sum by (runtime, benchmark, testid) (
  increase(k6_iterations_total{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"}[$__range])
)
```

Aktivni virtual users:

```promql
max by (runtime, benchmark, testid) (
  k6_vus{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"}
)
```

Dropped iterations, kontrola load generatoru:

```promql
sum by (runtime, benchmark, testid) (
  rate(k6_dropped_iterations_total{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"}[$__rate_interval])
)
```

## Využiti zdroju pres node-exporter

Dulezita metodicka poznamka: soucasny setup pouziva node-exporter, tedy meri
cele servery, ne jednotlive kontejnery. Pokud bezi Node, Deno i Bun kontejnery
soucasne, nelze z techto metrik presne oddelit RAM/CPU konkretniho runtime.
Pro ferove porovnani spoustej jeden benchmark v jeden cas a vyhodnocuj app
server ve stejnem casovem okne. Per-container metriky by vyzadovaly napr.
cAdvisor.

### 7. CPU app serveru, aktualni hodnota

Pro app server nastav `$server_job` na `app-server-node-exporter`.

```promql
100 * (
  1 - avg by (job, instance) (
    rate(node_cpu_seconds_total{job=~"$server_job", mode="idle"}[$__rate_interval])
  )
)
```

Prumerne CPU za vybrane casove okno:

```promql
avg_over_time((
  100 * (
    1 - avg by (job, instance) (
      rate(node_cpu_seconds_total{job=~"$server_job", mode="idle"}[30s])
    )
  )
)[$__range:$__interval])
```

Maximum CPU za vybrane casove okno:

```promql
max_over_time((
  100 * (
    1 - avg by (job, instance) (
      rate(node_cpu_seconds_total{job=~"$server_job", mode="idle"}[30s])
    )
  )
)[$__range:$__interval])
```

### 8. RAM app serveru

Aktualne pouzita RAM v bajtech:

```promql
node_memory_MemTotal_bytes{job=~"$server_job"}
- node_memory_MemAvailable_bytes{job=~"$server_job"}
```

Aktualne pouzita RAM v procentech:

```promql
100 * (
  1 - node_memory_MemAvailable_bytes{job=~"$server_job"}
      / node_memory_MemTotal_bytes{job=~"$server_job"}
)
```

Maximum pouzite RAM v bajtech za vybrane casove okno:

```promql
max_over_time((
  node_memory_MemTotal_bytes{job=~"$server_job"}
  - node_memory_MemAvailable_bytes{job=~"$server_job"}
)[$__range:$__interval])
```

Maximum pouzite RAM v procentech za vybrane casove okno:

```promql
max_over_time((
  100 * (
    1 - node_memory_MemAvailable_bytes{job=~"$server_job"}
        / node_memory_MemTotal_bytes{job=~"$server_job"}
  )
)[$__range:$__interval])
```

### 9. DB server CPU a RAM

Pro DB server nastav `$server_job` na `db-server-node-exporter`.

CPU:

```promql
100 * (
  1 - avg by (job, instance) (
    rate(node_cpu_seconds_total{job="db-server-node-exporter", mode="idle"}[$__rate_interval])
  )
)
```

RAM:

```promql
100 * (
  1 - node_memory_MemAvailable_bytes{job="db-server-node-exporter"}
      / node_memory_MemTotal_bytes{job="db-server-node-exporter"}
)
```

## PostgreSQL metriky

Tyto dotazy pomahaji interpretovat `read` a `write` scenare. Nepouzivej je jako
nahradu za klientskou P99 latenci, ale jako kontext k H2.

### 10. Aktivni PostgreSQL spojeni

```promql
pg_stat_database_numbackends{datname=~"$db"}
```

### 11. Transakce za sekundu

Commity:

```promql
rate(pg_stat_database_xact_commit{datname=~"$db"}[$__rate_interval])
```

Rollbacky:

```promql
rate(pg_stat_database_xact_rollback{datname=~"$db"}[$__rate_interval])
```

### 12. Radky ctene a vlozene za sekundu

Radky vracene dotazy, vhodne pro `read`:

```promql
rate(pg_stat_database_tup_returned{datname=~"$db"}[$__rate_interval])
```

Radky vlozene, vhodne pro `write`:

```promql
rate(pg_stat_database_tup_inserted{datname=~"$db"}[$__rate_interval])
```

### 13. Cache hit ratio PostgreSQL

```promql
100 *
rate(pg_stat_database_blks_hit{datname=~"$db"}[$__rate_interval])
/
(
  rate(pg_stat_database_blks_hit{datname=~"$db"}[$__rate_interval])
  + rate(pg_stat_database_blks_read{datname=~"$db"}[$__rate_interval])
)
```

## Doporučene Grafana panely

### Overview row

| Panel | Typ | Query |
| --- | --- | --- |
| RPS by runtime | Time series | `sum by (runtime, benchmark, testid) (rate(k6_http_reqs_total{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"}[$__rate_interval]))` |
| P99 latency by runtime | Time series | `1000 * max by (runtime, benchmark, testid) (k6_http_req_duration_p99{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"})` |
| Error rate | Time series | `100 * avg by (runtime, benchmark, testid) (k6_http_req_failed_rate{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"})` |
| Total requests | Stat | `sum by (runtime, benchmark, testid) (increase(k6_http_reqs_total{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"}[$__range]))` |
| Dropped iterations/s | Time series | `sum by (runtime, benchmark, testid) (rate(k6_dropped_iterations_total{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"}[$__rate_interval]))` |

### Hypothesis H1 row

| Panel | Typ | Query |
| --- | --- | --- |
| I/O RPS comparison | Time series | `sum by (runtime, benchmark, testid) (rate(k6_http_reqs_total{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement", benchmark=~"ping|read|write"}[$__rate_interval]))` |
| Average I/O RPS | Bar gauge | `avg_over_time((sum by (runtime, benchmark, testid) (rate(k6_http_reqs_total{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement", benchmark=~"ping|read|write"}[30s])))[$__range:$__interval])` |

### Hypothesis H2 row

| Panel | Typ | Query |
| --- | --- | --- |
| DB P99 latency | Time series | `1000 * max by (runtime, benchmark, testid) (k6_http_req_duration_p99{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement", benchmark=~"read|write"})` |
| DB TTFB P99 | Time series | `1000 * max by (runtime, benchmark, testid) (k6_http_req_waiting_p99{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement", benchmark=~"read|write"})` |
| PostgreSQL connections | Time series | `pg_stat_database_numbackends{datname=~"$db"}` |
| PostgreSQL inserted rows/s | Time series | `rate(pg_stat_database_tup_inserted{datname=~"$db"}[$__rate_interval])` |
| PostgreSQL returned rows/s | Time series | `rate(pg_stat_database_tup_returned{datname=~"$db"}[$__rate_interval])` |

### Hypothesis H3 row

| Panel | Typ | Query |
| --- | --- | --- |
| P99 across all scenarios | Time series | `1000 * max by (runtime, benchmark, testid) (k6_http_req_duration_p99{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"})` |
| App server CPU | Time series | `100 * (1 - avg by (job, instance) (rate(node_cpu_seconds_total{job="app-server-node-exporter", mode="idle"}[$__rate_interval])))` |
| App server RAM | Time series | `100 * (1 - node_memory_MemAvailable_bytes{job="app-server-node-exporter"} / node_memory_MemTotal_bytes{job="app-server-node-exporter"})` |

## Export dat pro ANOVA a boxploty

Nejcistsi postup:

1. Kazdy beh spoustet s jednoznacnym `TEST_ID`.
2. Filtrovat `phase="measurement"`.
3. V Grafane pouzit panel typu `Table`.
4. Pres `Inspect > Data > Download CSV` exportovat hodnoty.

Priklad dotazu pro tabulku RPS vzorku:

```promql
sum by (testid, runtime, benchmark) (
  rate(k6_http_reqs_total{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"}[30s])
)
```

Priklad dotazu pro tabulku P99 vzorku:

```promql
max by (testid, runtime, benchmark) (
  1000 * k6_http_req_duration_p99{runtime=~"$runtime", benchmark=~"$benchmark", testid=~"$testid", phase="measurement"}
)
```

Priklad dotazu pro app-server CPU vzorku:

```promql
100 * (
  1 - avg by (instance) (
    rate(node_cpu_seconds_total{job="app-server-node-exporter", mode="idle"}[30s])
  )
)
```

Priklad dotazu pro app-server RAM vzorku:

```promql
100 * (
  1 - node_memory_MemAvailable_bytes{job="app-server-node-exporter"}
      / node_memory_MemTotal_bytes{job="app-server-node-exporter"}
)
```

Pokud `TEST_ID` nezadas rucne, start skripty ho vygeneruji automaticky.

## Doporučene jednotky v Grafane

| Metrika | Unit |
| --- | --- |
| RPS | `req/s` nebo `ops/s` |
| `1000 * k6_http_req_duration_p99` | `milliseconds` |
| `1000 * k6_http_req_waiting_p99` | `milliseconds` |
| `k6_dropped_iterations_total` rate | `ops/s` |
| Error rate | `percent (0-100)` |
| CPU | `percent (0-100)` |
| RAM bytes | `bytes` |
| RAM percent | `percent (0-100)` |
| PostgreSQL rows/s | `rows/sec` nebo `ops/s` |

## Interpretacni poznamky

- RPS pro H1 vyhodnocuj hlavne na `ping`, `read` a `write`.
- P99 pro H2 vyhodnocuj hlavne na `read` a `write`, protoze ty obsahuji
  komunikaci s PostgreSQL.
- Finalni k6 vysledky filtruj pres `phase="measurement"`.
- `compute` je dulezity doplnkovy scenar, ale neni I/O ani DB test.
- Node-exporter meri cely server. Pro prirazeni CPU/RAM konkretni runtime je
  nutne spoustet benchmarky sekvencne a porovnavat stejne casove useky.
- Percentily z `k6_http_req_duration_p99` jsou uz agregovane k6 metriky.
  Neagreguj je pres ruzne endpointy jako jeden absolutni percentil celeho
  systemu; pouzivej je pro porovnani stejneho benchmarku mezi runtime.
- Pro dlouhodobejsi analyzu nastav v Prometheu dostatecnou retenci dat, aby
  vysledky nezmizely pred exportem.

## Uzitecne odkazy

- k6 Prometheus remote write:
  https://grafana.com/docs/k6/latest/results-output/real-time/prometheus-remote-write/
- k6 built-in metrics:
  https://grafana.com/docs/k6/latest/using-k6/metrics/reference/
- Prometheus querying basics:
  https://prometheus.io/docs/prometheus/latest/querying/basics/
- Grafana Prometheus datasource:
  https://grafana.com/docs/grafana/latest/datasources/prometheus/
