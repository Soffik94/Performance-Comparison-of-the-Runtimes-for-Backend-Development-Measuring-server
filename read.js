import http from 'k6/http';
import { check } from 'k6';
import { buildUrl, createBenchmarkConfig } from './k6Config.js';

const config = createBenchmarkConfig('read');
const READ_URL = buildUrl(config.BASE_URL, '/items');
let loggedUnexpectedStatus = false;

export const options = config.options;

export default function () {
  const res = http.get(READ_URL);

  if (res.status !== 200 && !loggedUnexpectedStatus) {
    loggedUnexpectedStatus = true;
    console.error(
      `Unexpected read status: url=${READ_URL} status=${res.status} body=${res.body.slice(0, 200)}`
    );
  }

  check(res, {
    'status is 200': (r) => r.status === 200,
    'small read payload': (r) => r.body.length < 4096,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
