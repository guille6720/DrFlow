/**
 * Shared k6 metrics + status classification for Phase 7.
 * Import from app-capacity / auth / spike / soak scripts.
 */
import { Counter, Rate, Trend } from "k6/metrics";

export const http2xx = new Counter("http_2xx");
export const http3xx = new Counter("http_3xx");
export const http400 = new Counter("http_400");
export const http401 = new Counter("http_401");
export const http403 = new Counter("http_403");
export const http404 = new Counter("http_404");
export const http409 = new Counter("http_409");
export const http429 = new Counter("http_429");
export const http5xx = new Counter("http_5xx");
export const httpTimeout = new Counter("http_timeout");
export const httpNetwork = new Counter("http_network");
export const errorRate = new Rate("errors");
export const opDuration = new Trend("op_duration", true);

export function classify(res) {
  if (res.status === 0) {
    if (/timeout/i.test(res.error || "")) httpTimeout.add(1);
    else httpNetwork.add(1);
    errorRate.add(1);
    return "network";
  }
  if (res.status >= 200 && res.status < 300) {
    http2xx.add(1);
    return "2xx";
  }
  if (res.status >= 300 && res.status < 400) {
    http3xx.add(1);
    return "3xx";
  }
  if (res.status === 400) http400.add(1);
  else if (res.status === 401) http401.add(1);
  else if (res.status === 403) http403.add(1);
  else if (res.status === 404) http404.add(1);
  else if (res.status === 409) http409.add(1);
  else if (res.status === 429) http429.add(1);
  else if (res.status >= 500) http5xx.add(1);

  if (res.status >= 400) errorRate.add(1);
  return String(res.status);
}

export function baseThresholds() {
  return {
    http_req_failed: ["rate<0.01"],
    errors: ["rate<0.01"],
    http_req_duration: ["p(95)<1500", "p(99)<3000"],
    http_429: ["count<20"],
    http_5xx: ["count<5"],
  };
}
