---
name: writing-todoist-api-tests
description: Use when adding or changing a test case (TC-0XX) in this Todoist API Playwright suite, planning a new spec file, or when a Todoist endpoint behaves differently from the pinned OpenAPI spec or the test case text (status codes, missing fields, free-plan limits).
---

# Writing Todoist API tests

## Overview

A test here proves what the **production API stores**, on a **free account** shared by parallel workers and CI. The pinned spec and the test case text are often wrong about details, so probe first, then assert what you observed. CLAUDE.md holds the conventions (naming, tags, fixtures, git flow); this skill holds the lessons learned applying them.

## Workflow for a new TC

1. Read the issue (`gh issue view <id>`), the TC in `Test Cases for automation.md`, and the target file in `docs/test-architecture-plan.md`.
2. Find the request/response schemas in `src/schemas/openapi.json` (create bodies have generated names such as `Body_37565102`; use the `Schema` map for responses).
3. **Probe the real API** with a scratchpad script (`probe-template.mjs` in this folder, run with `node --env-file=.env`). Record status codes, defaults, field shapes, and free-plan behavior. Clean up what the probe created.
4. Write the plan in `docs/superpowers/plans/<date>-tc-0XX-<name>.md`, including a "Probe results" table.
5. Write the test (pattern below), then run the checks in the Done list.

## Test pattern

```ts
const created = await test.step('Create a task with every optional field', async () => {
  const task = await testData.createTask(payload);
  expect(task).toMatchSchema(Schema.task);
  expectAsEntered(task);
  return task;
});

await test.step('Load the task again and check every field', async () => {
  const loaded = await api.tasks.get(created.id);
  expect(loaded).toMatchSchema(Schema.task);
  expect(loaded.id).toBe(created.id);
  expectAsEntered(loaded);
});
```

- **Echo vs storage:** always reload with `GET` and assert again. The create response alone proves nothing.
- A local `expectAsEntered` / `expectDefaults` with `toMatchObject` keeps the create and reload checks identical.
- Use **non-default values** (priority `3`, not `1`) so a dropped field fails the test.
- Build payloads with `satisfies CreateTaskPayload` and assert against `payload.*`, not repeated literals.
- Dates: `tomorrowIn(accountTimezone)` / `addDays(todayIn(accountTimezone), n)`. Never `new Date()` for a calendar day.
- Default project: `account.inbox_project_id`, never a hard-coded id.

## Shared-account rules

- Every list call filters by **this test's own `project_id`**. Other workers and CI create data at the same time.
- Lists have no guaranteed order: compare **sorted id arrays**.
- Time windows (e.g. completed tasks `since`/`until`): use now ± 1 hour, and filter by project too.
- Child tasks go through `testData.createTask({ project_id })`. Deleting the project cascades, and cleanup ignores the later 404s.

## Known API behavior (probed 2026-09-24, free plan)

| Behavior                                                                                                                         | Consequence                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `deadline_date` → 403 `PREMIUM_ONLY`                                                                                             | `test.fixme()` with that reason                                                          |
| `duration` accepted (200) but stored as `null`                                                                                   | Silently dropped. Only a stored-value assertion catches it. Treat it as paid, so `fixme` |
| `order` is stored as `child_order`                                                                                               | Assert `child_order`                                                                     |
| `POST tasks/{id}/close` → **204**, empty body (spec says 200)                                                                    | Use `send`, assert 204, list as an assumption                                            |
| Closed task: `checked: true`, `completed_at` set, gone from `GET tasks?project_id=`                                              |                                                                                          |
| `GET tasks/completed/by_completion_date` works, but `next_cursor` is **absent**                                                  | Treat `undefined` as the last page (`?? null`)                                           |
| No token or a bad token → 401 `{"error_tag":"UNAUTHORIZED","error_code":477,"http_code":401,…}`; the spec has no 401 body schema | Assert the observed fields with `toMatchObject`, not `toMatchSchema`                     |

Add new findings to this table.

## Free-plan feature missing?

Keep the test and split out the paid part as its own case (`TC-00Xc`) with `test.fixme(true, '<what the API did> (probed <date>)')` as the first line. Don't delete the test, and don't weaken the assertion until it passes.

## Done list

- `npx playwright test --grep @TC-0XX --repeat-each=3`, all passing, none flaky
- `npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck`
- **Mutation check:** break one expected value, see the test fail, revert. Record it in the PR.
- No `autotest-<run id>-` leftovers (list projects, labels and tasks)
- Mark the TC with ✅ in `Test Cases for automation.md` once all its parts exist (fixme parts count)
- Run the `code-review` skill on the diff and fix what it finds
- PR body: every probe finding goes under **Assumptions**, and every field left out gets a reason
- Move the issue to "In review" (command in CLAUDE.md)

## Common mistakes

| Mistake                                                     | Fix                                                                                                                                      |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Asserting status 200 only                                   | Assert the stored values after a reload                                                                                                  |
| Trusting the spec's status code                             | Probe, then assert what you observed                                                                                                     |
| `api.tasks.send('POST', 'tasks', …)` without tracking       | `testData.track('task', id)`, or use `testData.createTask`                                                                               |
| `expect(list).toEqual([a, b])` in response order            | Compare sorted ids, filtered by project                                                                                                  |
| Default values as the "entered" values                      | Choose values that differ from the defaults                                                                                              |
| `npx playwright test --reporter=line` (or any `--reporter`) | It replaces the configured reporters, including the redaction reporter, so failure traces keep the real token. Keep the config reporters |
| A "malformed" token built from the real one                 | Use a fixed fake value. Redaction only matches the whole real token                                                                      |
