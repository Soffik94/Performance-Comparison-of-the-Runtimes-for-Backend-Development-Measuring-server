import http from 'k6/http';
import { createBenchmarkConfig } from './k6Config.js';

const config = createBenchmarkConfig('write');
const BASE_URL = config.BASE_URL;
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

  const res = http.post(`${BASE_URL}/items`, payload, params);

  if (res.status !== 201 && res.status !== 200) {
    console.error(`ERROR: status ${res.status}, body ${res.body}`);
  }
}
