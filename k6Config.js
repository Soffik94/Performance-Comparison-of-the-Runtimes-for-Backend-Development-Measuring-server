const DEFAULT_BASE_URL = 'http://10.0.0.4:3000';
const DEFAULT_RUNTIME = 'node';
const DEFAULT_TARGET_RPS = 1000;
const DEFAULT_WARMUP_DURATION = '1m';
const DEFAULT_MEASURE_DURATION = '3m';
const DEFAULT_PRE_ALLOCATED_VUS = 100;
const DEFAULT_MAX_VUS = 1000;

function envString(name, defaultValue) {
  const value = __ENV[name] ? String(__ENV[name]).trim() : '';

  return value !== ''
    ? value
    : defaultValue;
}

function envPositiveInt(name, defaultValue) {
  const raw = envString(name, `${defaultValue}`);

  if (!/^[0-9]+$/.test(raw)) {
    throw new Error(`${name} must be a positive integer, got "${raw}"`);
  }

  const value = Number(raw);

  if (value <= 0) {
    throw new Error(`${name} must be a positive integer, got "${raw}"`);
  }

  return value;
}

function sanitizeIdPart(value) {
  const sanitized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitized || 'unknown';
}

function timestampForId() {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function buildTestId(benchmark, runtime, targetRps) {
  return [
    sanitizeIdPart(benchmark),
    sanitizeIdPart(runtime),
    `rps${targetRps}`,
    timestampForId(),
  ].join('-');
}

export function createBenchmarkConfig(defaultBenchmark) {
  const BASE_URL = envString('BASE_URL', DEFAULT_BASE_URL);
  const RUNTIME = envString('RUNTIME', DEFAULT_RUNTIME);
  const BENCHMARK = envString('BENCHMARK', defaultBenchmark);
  const TARGET_RPS = envPositiveInt('TARGET_RPS', DEFAULT_TARGET_RPS);
  const WARMUP_DURATION = envString('WARMUP_DURATION', DEFAULT_WARMUP_DURATION);
  const MEASURE_DURATION = envString('MEASURE_DURATION', DEFAULT_MEASURE_DURATION);
  const PRE_ALLOCATED_VUS = envPositiveInt('PRE_ALLOCATED_VUS', DEFAULT_PRE_ALLOCATED_VUS);
  const MAX_VUS = envPositiveInt('MAX_VUS', DEFAULT_MAX_VUS);
  const TEST_ID = envString('TEST_ID', buildTestId(BENCHMARK, RUNTIME, TARGET_RPS));

  if (MAX_VUS < PRE_ALLOCATED_VUS) {
    throw new Error('MAX_VUS must be greater than or equal to PRE_ALLOCATED_VUS');
  }

  const baseScenario = {
    executor: 'constant-arrival-rate',
    rate: TARGET_RPS,
    timeUnit: '1s',
    preAllocatedVUs: PRE_ALLOCATED_VUS,
    maxVUs: MAX_VUS,
  };

  return {
    BASE_URL,
    RUNTIME,
    BENCHMARK,
    TEST_ID,
    TARGET_RPS,
    WARMUP_DURATION,
    MEASURE_DURATION,
    PRE_ALLOCATED_VUS,
    MAX_VUS,
    options: {
      tags: {
        runtime: RUNTIME,
        benchmark: BENCHMARK,
        testid: TEST_ID,
      },
      scenarios: {
        warmup: {
          ...baseScenario,
          duration: WARMUP_DURATION,
          gracefulStop: '0s',
          tags: {
            phase: 'warmup',
          },
        },
        measurement: {
          ...baseScenario,
          duration: MEASURE_DURATION,
          startTime: WARMUP_DURATION,
          tags: {
            phase: 'measurement',
          },
        },
      },
    },
  };
}
