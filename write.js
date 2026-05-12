import http from 'k6/http';
import { buildUrl, createBenchmarkConfig } from './k6Config.js';

const config = createBenchmarkConfig('write');
const WRITE_URL = buildUrl(config.BASE_URL, '/items');
const RUNTIME = config.RUNTIME;
const DATA_RUN_ID = __ENV.RUN_ID || config.TEST_ID;

export const options = config.options;

export default function () {
  const payload = JSON.stringify({
    name: `${RUNTIME}_${DATA_RUN_ID}_${__VU}_${__ITER}`,
    email: `${RUNTIME}_${DATA_RUN_ID}_${__VU}_${__ITER}@test.com`
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(WRITE_URL, payload, params);

  if (res.status !== 201 && res.status !== 200) {
    console.error(`ERROR: status ${res.status}, body ${res.body}`);
  }
}
