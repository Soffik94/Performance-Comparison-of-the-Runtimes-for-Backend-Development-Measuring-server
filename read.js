import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { buildUrl, createBenchmarkConfig } from './k6Config.js';

const config = createBenchmarkConfig('read');
const READ_URL = buildUrl(config.BASE_URL, '/items');
const readUnexpectedStatus = new Counter('read_unexpected_status');

export const options = config.options;

export default function () {
  const res = http.get(READ_URL);

  if (res.status !== 200) {
    readUnexpectedStatus.add(1, { status: String(res.status) });
  }

  check(res, {
    'status is 200': (r) => r.status === 200,
    'small read payload': (r) => r.body.length < 4096,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
