# TC-014 Auth negative tests (issue #36)

## Context

Issue #36 (wave 5, P1) needs automated checks that a create-project request fails with **401** and creates nothing, in two cases: **no token** (TC-014a) and a **malformed token** (TC-014b). The framework already has the parts: `unauthenticatedApi` and `apiWithToken(token)` in [src/fixtures/api.fixture.ts](src/fixtures/api.fixture.ts), and `send()` in [src/clients/BaseClient.ts](src/clients/BaseClient.ts) for raw responses. So this is a spec file plus doc updates. No production code changes.

## Probe results (2026-09-24, real API; no valid token, so no state could change)

`POST /api/v1/projects` with body `{"name":"autotest-probe-noauth"}`:

| Authorization header | Status | Body |
|---|---|---|
| none | 401 | `{"error":"Unauthorized","error_code":477,"error_extra":{"event_id":…,"retry_after":N},"error_tag":"UNAUTHORIZED","http_code":401}` |
| `Bearer autotest-malformed-token` | 401 | same |
| `Bearer ` (empty) | 401 | same |
| `Basic abc` | 401 | same |

- The pinned spec lists `401: Unauthorized` for this endpoint but gives **no body schema** (and has no generic error component). So `toMatchSchema` cannot be used on the 401 body. Assert the observed fields instead: `http_code: 401`, `error_tag: 'UNAUTHORIZED'`, `error_code: 477`.
- `retry_after` went up with each call (2 → 3 → 4 → 9), which suggests throttling of unauthenticated calls. Do not assert it. Watch for 429 during `--repeat-each=3`.

These go into the PR description as assumptions.

## Implementation

**Branch:** `36-tc-014-auth-negative` from an up-to-date `main`. Leave the untracked `docs/superpowers/plans/2026-09-24-tc-011-project-lifecycle.md` alone; it is not part of this issue. Move #36 to "In progress" on the board when work starts.

### 1. Create `tests/negative/auth.spec.ts`

- Import `test`, `expect` from `../../src/fixtures` and `uniqueName` from `../../src/data`.
- Module constant `MALFORMED_TOKEN = 'autotest-malformed-token'`, with a comment explaining why it is safe: it is a fixed, obviously fake value, **not derived from the real token**. A truncated or altered real token would slip past redaction ([src/utils/redact.ts](src/utils/redact.ts) matches only the whole token), so a value built from the real token must never be used here. The fake value can appear in traces, and that is harmless.
- A local helper holds the two shared steps, so a and b differ only in which client they use:

  ```ts
  async function expectRejectedAndNothingCreated(
    client: TodoistApi, api: TodoistApi, testData: TestData, name: string,
  ): Promise<void>
  ```
  - Step "Send a create-project request and check it is rejected with 401":
    `const response = await client.projects.send('POST', 'projects', { body: { name } });`
    Check with `expect.soft` that `status()` is 401 and the body matches `{ http_code: 401, error_tag: 'UNAUTHORIZED', error_code: 477 }` (`toMatchObject`). The assertions are soft so the next step always runs, and that step tracks any project that was created (no conditional in the test).
  - Step "List projects with the valid token and check none has the sent name":
    `const projects = await api.projects.list();` Track every match with `testData.track` so cleanup removes it. Then `expect(projects.map((p) => p.name)).not.toContain(name)`.
- Two tests, tags `['@TC-014', '@negative']` (not `@smoke`, the box in the issue is unticked):
  - `'TC-014a With no access token the create-project request fails with 401 and nothing is created'`, using `unauthenticatedApi`.
  - `'TC-014b With a malformed token the create-project request fails with 401 and nothing is created'`, using `await apiWithToken(MALFORMED_TOKEN)`.
  - Each uses `const name = uniqueName('project');`. The name starts with `autotest-`, so the global setup would also remove a leftover.
- Types `TodoistApi` and `TestData` come from `src/clients` and `src/fixtures`, which already export them.

### 2. Mark it done in `Test Cases for automation.md`

`- TC-014 ...` → `- ✅ TC-014 ...`

### 3. ESLint

In `eslint.config.mjs`, let `playwright/expect-expect` count helpers named `expect*` (`assertFunctionPatterns: ['^expect']`), because both tests assert through `expectRejectedAndNothingCreated`.

### 4. `docs/test-architecture-plan.md`

This already maps `tests/negative/auth.spec.ts` to TC-014a/b. No change unless implementation differs.

## Verification

```sh
npm run lint && npm run format:check && npm run typecheck
npx playwright test --grep @TC-014                  # both pass
npx playwright test --grep @TC-014 --repeat-each=3  # stability, watch for 429
npm test                                            # full suite still green
node scripts/check-no-token.mts                     # real token not in artifacts
```

Also, one time only: change the expected status to 400, confirm the failure report looks correct, then revert.

## Delivery

- Commit `#36 Add TC-014 auth negative tests` (with the Co-Authored-By trailer).
- Open the PR with `.github/pull_request_template.md`, `Closes #36`. Under assumptions, list the probe table (401 body shape, no schema in the spec, `retry_after` throttling, and "nothing created" checked by unique name through the full paginated project list).
- Move the #36 board item to "In review" using the commands in CLAUDE.md.
- Review the PR myself and fix findings. Do not merge. Reply with the URL and a summary.
