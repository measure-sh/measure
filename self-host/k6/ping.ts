// @ts-nocheck
// biome-ignore-all lint: k6 executes in an embedded JavaScript runtime
import http from "k6/http";
import { check } from "k6";

const url = __ENV.URL || "http://localhost:8080/ping";

export const options = {
  scenarios: {
    default: {
      executor: "constant-vus",
      duration: "10s",
      vus: 10,
    },
  },
};

export default function main() {
  const res = http.get(url);

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time is less than 200ms": (r) => r.timings.duration < 200,
  });
}
