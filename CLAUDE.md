# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Playwright + TypeScript API tests (no browser) for the Todoist API v1, run against production with a free account. Requirements live in `brief.md`, the test cases in `Test Cases for automation.md`, and the architecture in `docs/test-architecture-plan.md`. Read `brief.md` before starting a new test case.

## Commands

Node 24 (`.nvmrc`). `npm ci` also installs the husky hooks. Copy `.env.example` to `.env` and set `TODOIST_API_TOKEN`.

- `npm run lint` / `npm run lint:fix`: ESLint (typescript-eslint strict type-checked, plus eslint-plugin-playwright on `tests/`)
- `npm run format:check` / `npm run format`: Prettier
- `npm run typecheck`: `tsc --noEmit`
- `npm test`: all tests. `npm run test:smoke`: only `@smoke`
- One test case: `npx playwright test --grep @TC-006`. Check stability with `--repeat-each=3`.
- `node scripts/update-openapi.mts`: refresh the pinned spec by hand, then review the diff
- `node scripts/check-no-token.mts`: search reports and traces for the token (CI runs this before uploading anything)

`TEST_ENV` selects `config/<TEST_ENV>.ts` (default `prod`, the only one). To add an environment, create the file and register it in `config/index.ts`.

## Architecture

- **Auth:** there is no login. `src/clients/createApiContext.ts` creates an `APIRequestContext` with the base URL and a Bearer header built from `TODOIST_API_TOKEN` (`src/env.ts`).
- **Clients** (`src/clients/`): `BaseClient` plus one thin client per resource, all combined in `TodoistApi` (the `api` fixture). Typed methods throw `ApiError` on non-2xx. `send(method, path, options)` returns the raw `APIResponse`, for status code assertions. `listAll` follows the `next_cursor` pagination of v1 list endpoints. Paths are relative to the API root (`tasks/123`).
- **Fixtures** (`src/fixtures/index.ts`): tests import `test`, `expect` and `Schema` only from here. Fixtures:
  - `api`
  - `unauthenticatedApi` and `apiWithToken(token)` for the negative auth tests
  - `testData`
  - `account` and `accountTimezone` (worker scoped, read from `GET /user`)
- **Test data:** `testData.create{Project,Task,Label,Comment}` build payloads (`src/data/*Builder.ts`) with unique `autotest-<run id>-` names (`uniqueName()` in `src/data/runId.ts`). They delete the items in reverse order after the test, also when it fails. A 404 during cleanup is ignored. Anything created through `send` or some other way must be registered with `testData.track(kind, id)`. The run id is fixed once in `playwright.config.ts` and shared by all workers through `AUTOTEST_RUN_ID`. It starts with a UTC timestamp, so `src/global-setup.ts` can delete `autotest-` leftovers older than 1 hour. This keeps runs within the free plan project limit.
- **Schema validation:** `expect(body).toMatchSchema(Schema.task)` validates against the pinned `src/schemas/openapi.json` with Ajv. `SchemaName` is typed from the spec's component names.
- **Dates:** assert calendar dates in `accountTimezone` with `src/utils/dates.ts`, not in the runner's local time.
- **Token redaction:** `src/reporters/redact-reporter.ts` must stay the first reporter in `playwright.config.ts`. It rewrites traces, attachments, errors and output synchronously in `onTestEnd`, before the HTML reporter copies them. Traces are kept only for failed tests. ESLint forbids `console` outside `scripts/`.

## Writing tests (conventions from brief.md)

- Name each test `'TC-00X <name>'`. Tag it with `@TC-00X` and its suite: `@smoke` (TC-001–005), `@regression` (TC-006–009, 012, 013), `@e2e` (TC-011) or `@negative` (TC-014, 015). Sections and TC-010 are out of scope.
- Wrap every step in `test.step('<readable name>', ...)`. Test one behavior per test. When a test case covers several inputs, write one test per input with a suffix: `TC-015a`, `TC-015b`.
- Tests must not share data or depend on the order they run in (`fullyParallel: true`).
- Group spec files by resource: `tests/<resource>/<resource>.spec.ts`. See `tests/projects/projects.spec.ts`.
- The OpenAPI spec is the only source of expected behavior. When the expected result is unclear, call the real API first, assert what it actually does, and list that as an assumption in the PR description.
- If a feature is not on the Todoist free plan, mark the test `test.fixme()` and give the reason.
- The TypeScript config is strict: `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` and `noPropertyAccessFromIndexSignature` (use `process.env['X']`).

## Git workflow

- Every change goes through a GitHub issue, then a branch, then a PR. Branch name: `<issue id>-<short-description>`.
- Commit messages must start with the issue ID, for example `#12 Add tasks API client` (the `commit-msg` hook checks this). `pre-commit` runs lint-staged. `pre-push` blocks pushes to `main`.
- Fill in `.github/pull_request_template.md`.
- Claude never merges a PR. Claude reviews its own PR and fixes the findings, then a human merges it. Start the next issue only from the updated `main`. When a PR is ready, reply with its URL and a short summary.
- CI: `pr.yml` runs lint, format, typecheck, tests, the token leak check and a flaky test comment. `smoke.yml` runs `@smoke` every hour and opens or comments on a `smoke-failure` issue. Both use the `todoist-account` concurrency group, 2 workers and 1 retry.
