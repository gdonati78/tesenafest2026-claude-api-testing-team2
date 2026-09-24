# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Playwright + TypeScript API test suite (no browser, `APIRequestContext` only) for the Todoist API v1 (`https://api.todoist.com/api/v1/`), run against production on a free account. Built for the Tesena Fest 2026 workshop.

Key documents — read them before non-trivial work:

- `brief.md` — the requirements: scope, conventions, security, pipelines, git workflow, definition of done.
- `Test Cases for automation.md` — test cases TC-001 to TC-015, grouped into waves.
- `docs/test-architecture-plan.md` — the architecture and delivery plan, including which spec file each TC belongs in.

Scope: TC-001 to TC-009 and TC-011 to TC-015. Sections and TC-010 are **out of scope**. Task tests are the business priority. The pinned OpenAPI spec is the only reference for expected behavior (there are no written requirements).

## Commands

Node 24 (`.nvmrc`). `npm ci` installs the husky hooks. Copy `.env.example` to `.env` and set `TODOIST_API_TOKEN`.

```sh
npm run lint              # ESLint (type-checked typescript-eslint + eslint-plugin-playwright)
npm run format:check      # Prettier (npm run format to fix)
npm run typecheck         # tsc --noEmit, strict
npm test                  # all tests
npm run test:smoke        # tests tagged @smoke
npx playwright test --grep @TC-012                  # a single test case by tag
npx playwright test tests/tasks/create-task.spec.ts # a single file
npx playwright test --grep @TC-012 --repeat-each=3  # stability check expected before a PR
node scripts/update-openapi.mts                     # refresh the pinned spec by hand, then review the diff
```

`TEST_ENV` (default `prod`) selects `config/<TEST_ENV>.ts`, which holds only the base URL.

## Architecture

- **Clients** (`src/clients/`): `BaseClient` wraps an `APIRequestContext` that already carries the base URL and `Authorization: Bearer <token>` (built in `createApiContext.ts`). Paths are relative, e.g. `tasks/123`. Typed methods throw `ApiError` on non-2xx; `send(method, path, options)` returns the raw `APIResponse` for status-code assertions. List endpoints are cursor-paginated and read with `listAll`. One thin client per resource (projects, tasks, labels, comments, user); `UserClient` is only for the account timezone — there is no login.
- **Fixtures** (`src/fixtures/`): every spec imports `test`, `expect` and `Schema` from `src/fixtures` (a `mergeTests` of the api, data and user fixtures).
  - `api` — authenticated clients; `unauthenticatedApi` and `apiWithToken(token)` for negative auth tests (TC-014).
  - `testData.create*` — builds an `autotest-<run id>-` payload, creates it through the API and deletes it in teardown, even on failure (reverse order, 404 ignored). Anything created another way (e.g. via `send`) must be registered with `testData.track(kind, id)`.
  - `accountTimezone` (worker scope) with `src/utils/dates.ts` — date assertions use the account timezone, never the runner's clock (TC-003, TC-009, TC-013).
- **Test data** (`src/data/`): builders plus `runId.ts`. The run id starts with a UTC timestamp and is fixed in `playwright.config.ts` in the main process so all workers share it. `src/global-setup.ts` deletes `autotest-` data older than 1 hour, using that timestamp (labels have no creation date), to keep free-plan limits from blocking runs.
- **Schemas** (`src/schemas/`): `openapi.json` is pinned; Ajv validates against its component schemas. Use `expect(body).toMatchSchema(Schema.task)`; the `Schema` map in `validator.ts` names the component per resource (and per paginated list).
- **Token redaction**: `src/reporters/redact-reporter.ts` must stay the **first** reporter in `playwright.config.ts` — it rewrites traces, attachments and errors before the HTML reporter copies them, and is synchronous on purpose. CI runs `scripts/check-no-token.mts` over `playwright-report/` and `test-results/` before uploading artifacts. ESLint forbids `console`.

## Test conventions

- Name: `'TC-00X <name from the test case file>'`; tags: `['@TC-00X', '@<suite>']`. Suites: `@smoke` (TC-001–005), `@regression` (TC-006–009, TC-012, TC-013), `@e2e` (TC-011), `@negative` (TC-014, TC-015).
- Every step is a `test.step()` with a readable name. One behavior per test; multi-input cases are split with suffixes (`TC-014a`, `TC-015b`, …).
- Tests create their own data, share nothing and do not depend on order (`fullyParallel`).
- If a feature is not on the free plan, mark the test `test.fixme()` with the reason.
- If the expected result is unclear (e.g. status codes in TC-015), probe the real API first, assert the observed behavior, and list it as an assumption in the PR description.
- Validate response bodies against the schema.

## Git workflow

- Issue → branch `<issue id>-<short-description>` → PR (use `.github/pull_request_template.md`).
- Commit subject must match `#<issue id> <summary>` (enforced by `commit-msg`). `pre-commit` runs lint-staged; `pre-push` blocks pushes to `main`.
- Never merge PRs. Review your own PR and fix findings; a human merges. Start the next issue only from the updated `main`. When a PR is ready, reply with its URL and a short summary.
- Right after creating a PR, move its issue from "In progress" to "In review" on the Team Otter project board (user project 1 of `gdonati78`):

  ```sh
  item=$(gh project item-list 1 --owner gdonati78 --format json -L 200 --jq '.items[] | select(.content.type == "Issue" and .content.number == <issue id>) | .id')
  gh project item-edit --project-id PVT_kwHOATtCIM4BkjKH --id "$item" --field-id PVTSSF_lAHOATtCIM4BkjKHzhjTXBs --single-select-option-id df73e18b
  ```

- CI: `pr.yml` (lint, format, typecheck, all tests; never `pull_request_target`) and `smoke.yml` (hourly `@smoke` on `main`, opens/comments on a `smoke-failure` issue). Both share a concurrency group because all runs use one Todoist account; CI uses 2 workers and 1 retry.
