import http from 'k6/http';
import { check } from 'k6';
import { createBenchmarkConfig } from './k6Config.js';

const config = createBenchmarkConfig('compute');
const BASE_URL = config.BASE_URL;

const ITERATIONS = __ENV.ITERATIONS || __ENV.N || 10000;

export const options = config.options;

export default function () {
  const res = http.get(`${BASE_URL}/compute?iterations=${ITERATIONS}`);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  });
}
