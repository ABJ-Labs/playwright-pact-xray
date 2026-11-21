# Playwright + Pact + Xray test framework

[![Tests](https://github.com/bathur88/playwright-pact-xray/actions/workflows/tests.yml/badge.svg)](https://github.com/bathur88/playwright-pact-xray/actions/workflows/tests.yml)

A small, production-style test automation framework in **TypeScript**:

| Layer | Tool | Target |
|---|---|---|
| UI tests | Playwright (Chromium), Page Object Model | [SauceDemo](https://www.saucedemo.com) |
| Accessibility | axe-core (WCAG 2.1 A and AA) | SauceDemo login, inventory, checkout |
| API tests | Playwright `request` fixture | [Restful-Booker](https://restful-booker.herokuapp.com) |
| Contract test | Pact JS (consumer side, Pact spec V3) | Pact mock server |
| Performance | k6 (5 virtual users, 30 seconds, thresholds) | Restful-Booker |
| CI | GitHub Actions | push, PR, nightly, manual |
| Test management | Xray Cloud (JUnit import) | Jira project of your choice |

## Project layout

```
src/
  pages/        Page objects (LoginPage, InventoryPage, CheckoutPage)
  clients/      Typed API client used by the Pact consumer test
  data/         Test data builders, demo users, accessibility baseline
tests/
  ui/           Browser tests, including axe accessibility scans
  api/          REST API tests (auth, CRUD, negative case)
  contract/     Pact consumer contract test
perf/
  booking-smoke.js  k6 performance smoke test
scripts/
  xray-import.sh  Authenticates with Xray and uploads reports/junit.xml
.github/workflows/tests.yml
```

## Run locally

```bash
npm ci
npx playwright install chromium
npm test                 # everything
npm run test:ui          # UI only
npm run test:api         # API only
npm run test:contract    # Pact only, writes pacts/BookingWebClient-BookingAPI.json
npm run test:a11y        # accessibility scans only
npm run test:perf        # k6 smoke test (needs k6 installed)
npm run report           # open the HTML report
```

Base URLs can be overridden with `UI_BASE_URL` and `API_BASE_URL`.

## Pact contract

`tests/contract/booking.consumer.pact.spec.ts` drives the real `BookingClient` against a Pact mock server
and records the interaction (`GET /booking/:id`) with type and regex matchers rather than fixed values.
The generated pact file is uploaded as a CI artifact. In a full setup it would be published to a
Pact Broker / PactFlow and verified by the provider pipeline, with `can-i-deploy` gating releases.

## Accessibility checks

`tests/ui/accessibility.spec.ts` runs axe against the login, inventory and checkout pages using the
WCAG 2.1 A and AA rule sets. The full axe output for each page is attached to the HTML report.

Issues that can't be fixed straight away go in a known-issues baseline (`src/data/a11yKnownIssues.ts`).
The tests fail only on new violations and flag any baseline entry that is no longer found, so
accessibility debt is tracked rather than ignored. The baseline is currently empty because the scans
are clean.

## Performance smoke test

`perf/booking-smoke.js` runs 5 virtual users for 30 seconds against the Booking API list and read
endpoints. It is kept small on purpose because Restful-Booker is a shared public demo service.

- **Setup** wakes the service and creates a booking the run owns, so results don't depend on shared data.
- **Thresholds** are the pass or fail criteria: error rate under 1%, checks over 99%, and p95 response
  time under 1500 ms for the list endpoint and 1000 ms for a single booking.
- **Teardown** deletes the booking.

If a threshold is breached, k6 exits non-zero and the CI job fails. The summary is uploaded as an artifact.

## CI pipeline

`.github/workflows/tests.yml`:

1. Install dependencies and type check
2. Install Chromium and run all three Playwright projects (`ui`, `api`, `contract`)
3. Upload the HTML report, traces/videos on failure, and the pact file
4. Push the JUnit results to Xray (runs even when tests fail, so failures are recorded)
5. Fail the job if any test failed

A separate `performance` job installs k6, runs the smoke test and uploads `k6-summary.json`.

## Xray integration

Playwright writes `reports/junit.xml`. The pipeline sends it to the Xray Cloud REST API
(`/api/v2/import/execution/junit`), which creates a **Test Execution** in Jira and links or creates a
**Test** issue for each test case.

**Setup** (repo Settings → Secrets and variables → Actions):

| Name | Type | Example |
|---|---|---|
| `XRAY_CLIENT_ID` | Secret | from Xray → Settings → API Keys |
| `XRAY_CLIENT_SECRET` | Secret | from Xray → Settings → API Keys |
| `XRAY_PROJECT_KEY` | Variable | `ABJ` |
| `XRAY_TEST_PLAN_KEY` | Variable (optional) | `ABJ-10` |
| `XRAY_BASE_URL` | Variable (optional) | `https://eu.xray.cloud.getxray.app` |

Without these, the Xray step is skipped with a notice and the rest of the pipeline still runs.

**Linking to existing Xray Tests:** add a `test_key` annotation. The JUnit reporter is configured with
`embedAnnotationsAsProperties`, so Xray picks it up:

```ts
test('standard user can log in', async ({ page }) => {
  test.info().annotations.push({ type: 'test_key', description: 'ABJ-1' });
  // ...
});
```

Manual upload from your machine:

```bash
XRAY_CLIENT_ID=... XRAY_CLIENT_SECRET=... XRAY_PROJECT_KEY=ABJ npm run xray:import
```
