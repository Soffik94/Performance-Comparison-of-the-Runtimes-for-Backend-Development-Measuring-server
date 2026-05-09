import http from 'k6/http';
import { check } from 'k6';
import { createBenchmarkConfig } from './k6Config.js';

const config = createBenchmarkConfig('read');
const BASE_URL = config.BASE_URL;

export const options = config.options;

export default function () {
  const res = http.get(`${BASE_URL}/items`);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
