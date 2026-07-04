import http from 'k6/http';
import { Counter } from 'k6/metrics';
import { buildUrl, createBenchmarkConfig } from './k6Config.js';

const config = createBenchmarkConfig('write');
const WRITE_URL = buildUrl(config.BASE_URL, '/items');
const RUNTIME = config.RUNTIME;
const DATA_RUN_ID = __ENV.RUN_ID || config.TEST_ID;
const writeUnexpectedStatus = new Counter('write_unexpected_status');

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
    writeUnexpectedStatus.add(1, { status: String(res.status) });
  }
}
