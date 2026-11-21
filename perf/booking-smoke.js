// k6 performance smoke test for the Booking API.
//
// Deliberately small (5 virtual users for 30 seconds) because Restful-Booker is a
// shared public demo service. The aim is to prove the read endpoints stay within
// agreed response times under light concurrent load, and to fail the pipeline if
// they do not.
//
// Run locally:  k6 run perf/booking-smoke.js
// Override:     k6 run -e API_BASE_URL=https://my-env.example.com perf/booking-smoke.js

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.API_BASE_URL || 'https://restful-booker.herokuapp.com';
const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };

export const options = {
  scenarios: {
    smoke: { executor: 'constant-vus', vus: 5, duration: '30s' },
  },
  // Thresholds are the pass/fail criteria. If any is breached, k6 exits non-zero
  // and the CI job fails.
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    'http_req_duration{endpoint:list}': ['p(95)<1500'],
    'http_req_duration{endpoint:get}': ['p(95)<1000'],
  },
};

// Runs once before the load starts. Wakes the service (it can cold start) and
// creates a booking this run owns, so the test does not depend on shared data.
export function setup() {
  http.get(`${BASE_URL}/ping`);

  const created = http.post(
    `${BASE_URL}/booking`,
    JSON.stringify({
      firstname: 'Perf',
      lastname: `Smoke${Date.now()}`,
      totalprice: 100,
      depositpaid: true,
      bookingdates: { checkin: '2026-12-01', checkout: '2026-12-02' },
    }),
    { headers: JSON_HEADERS },
  );
  check(created, { 'setup booking created': (r) => r.status === 200 });

  return { bookingId: created.json('bookingid') };
}

export default function (data) {
  const list = http.get(`${BASE_URL}/booking`, { tags: { endpoint: 'list' } });
  check(list, {
    'list returns 200': (r) => r.status === 200,
    'list returns booking ids': (r) => Array.isArray(r.json()) && r.json().length > 0,
  });

  const one = http.get(`${BASE_URL}/booking/${data.bookingId}`, {
    headers: { Accept: 'application/json' },
    tags: { endpoint: 'get' },
  });
  check(one, {
    'get returns 200': (r) => r.status === 200,
    'get returns the booking': (r) => r.json('firstname') === 'Perf',
  });

  sleep(1);
}

// Runs once after the load. Removes the booking created in setup.
export function teardown(data) {
  const auth = http.post(
    `${BASE_URL}/auth`,
    JSON.stringify({
      username: __ENV.BOOKER_USER || 'admin',
      password: __ENV.BOOKER_PASSWORD || 'password123',
    }),
    { headers: JSON_HEADERS },
  );
  const token = auth.json('token');
  if (token) {
    http.del(`${BASE_URL}/booking/${data.bookingId}`, null, {
      headers: { Cookie: `token=${token}` },
    });
  }
}
