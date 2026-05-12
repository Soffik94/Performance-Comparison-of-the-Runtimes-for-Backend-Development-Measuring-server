import http from 'k6/http';
import { check } from 'k6';
import { buildUrl, createBenchmarkConfig } from './k6Config.js';

const config = createBenchmarkConfig('compute');
const COMPUTE_URL = buildUrl(config.BASE_URL, '/compute');

const COMPUTE_ITERATIONS = __ENV.COMPUTE_ITERATIONS || __ENV.ITERATIONS || __ENV.N || 1000;

export const options = config.options;

export default function () {
  const res = http.get(`${COMPUTE_URL}?iterations=${COMPUTE_ITERATIONS}`);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  });
}
