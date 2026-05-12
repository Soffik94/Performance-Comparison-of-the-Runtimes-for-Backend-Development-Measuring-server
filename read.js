import http from 'k6/http';
import { check } from 'k6';
import { buildUrl, createBenchmarkConfig } from './k6Config.js';

const config = createBenchmarkConfig('read');
const READ_URL = buildUrl(config.BASE_URL, '/items');

export const options = config.options;

export default function () {
  const res = http.get(READ_URL);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'small read payload': (r) => r.body.length < 4096,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
