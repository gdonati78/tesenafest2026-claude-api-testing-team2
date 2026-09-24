# TC-012 Reopen Task Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate TC-012, "A task ticked off by mistake can be put back among the open ones, and it is the same task, not a new one", as one test in the new `tests/tasks/reopen-task.spec.ts`.

**Architecture:** No framework changes. The test creates its own project and one task through `testData`, closes it and reopens it with the raw `api.tasks.send` (to assert the 204 status), reloads the task with `api.tasks.get`, and reads the project's open tasks with `api.tasks.list({ project_id })`. The project is new and belongs only to this test, so after the reopen the list must hold exactly the original id.

**Tech Stack:** Playwright `APIRequestContext`, TypeScript (strict), Ajv matcher `toMatchSchema`.

**Spec:** GitHub issue #34, `Test Cases for automation.md` (TC-012), `docs/test-architecture-plan.md` (the spec file table), the pinned `src/schemas/openapi.json` (`ItemSyncView` = `Schema.task`).

**Branch:** `34-tc-012-reopen-task` (created from the updated `main`).

## Probe results (2026-09-24, free plan)

| Call                                   | Observed                                                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `POST tasks/{id}/close`                | 204, empty body (spec: 200)                                                                                |
| `GET tasks/{id}` after close           | 200, `checked: true`, `completed_at` set                                                                   |
| `GET tasks?project_id=` after close    | the task is gone                                                                                           |
| `POST tasks/{id}/reopen`               | 204, empty body (spec: 200)                                                                                |
| `POST tasks/{id}/reopen` on open task  | also 204 (not asserted)                                                                                    |
| `GET tasks/{id}` after reopen          | same `id`, `content`, `project_id`, `child_order`, `added_at`; `checked: false`, `completed_at: null`; `updated_at` changes |
| `GET tasks?project_id=` after reopen   | exactly the original id                                                                                    |

## Review Focus

1. "Same task, not a new one": the reload checks `id` and `added_at` against the create response, and the final list is an exact equality with `[created.id]`, so a replacement task fails the test.
2. Reopen really happened: `checked: false` and `completed_at: null` are asserted on a fresh `GET`, not on a response echo. Mutation check: closing again instead of reopening fails on these two fields.
3. Parallel workers: every list is filtered by the test's own project.

---

### Task 1: TC-012 test

**Files:**

- Create: `tests/tasks/reopen-task.spec.ts`
- Modify: `Test Cases for automation.md` (✅ on TC-012), `.claude/skills/writing-todoist-api-tests/SKILL.md` (reopen finding)

- [x] Probe the API (results above)
- [x] Write the test: create → close (204) → not in open list → reopen (204) → reload matches → list is exactly `[created.id]`
- [x] `npx playwright test --grep @TC-012 --repeat-each=3`: 3 passed
- [x] Mutation check: close instead of reopen → fails on `checked`/`completed_at`; reverted
- [ ] `npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck`
- [ ] Commit `#34 Add TC-012 reopen task test`, PR, move issue to "In review"
