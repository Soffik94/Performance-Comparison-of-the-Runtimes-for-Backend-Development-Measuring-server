import http from "k6/http";
import { check } from "k6";
import { buildUrl, createBenchmarkConfig } from "./k6Config.js";

const config = createBenchmarkConfig("ping");
const PING_URL = buildUrl(config.BASE_URL, "/ping");

export const options = config.options;

export default function () {
  const res = http.get(PING_URL);

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 200ms": (r) => r.timings.duration < 200,
  });
}
