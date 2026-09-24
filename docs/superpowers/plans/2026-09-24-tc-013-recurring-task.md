# TC-013 Recurring Task Implementation Plan

**Goal:** Automate TC-013, "A recurring task does not disappear when ticked off and moves on to its next due date", as one test in `tests/tasks/due-dates.spec.ts` (next to TC-009).

**Architecture:** No framework changes. The test creates its own project and a task due `every day` in it through `testData`, closes the task with the raw `api.tasks.send` (to assert the status code), reloads it, and reads the project's open task list. Expected dates come from `accountTimezone` and `src/utils/dates.ts`.

**Spec:** GitHub issue #35, `Test Cases for automation.md` (TC-013), `docs/test-architecture-plan.md` (`tests/tasks/due-dates.spec.ts`), pinned `src/schemas/openapi.json` (`ItemSyncView` = `Schema.task`, `PaginatedList_ItemSyncView_` = `Schema.taskPage`).

**Branch:** `35-tc-013-recurring-task`.

## Probe results (2026-09-24, free plan, account timezone Europe/Berlin)

| Call                                                               | Observed                                                                                                   |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `POST tasks` with `due_string: "every day"`                        | 200, `due = { date: <today in account tz>, string: "every day", lang: "en", is_recurring: true, timezone: null }` |
| `POST tasks/{id}/close`                                            | 204, empty body (spec says 200)                                                                            |
| `GET tasks/{id}` after close                                       | 200, same `id`, `checked: false`, `completed_at: null`, `due.date` = today + 1, `is_recurring: true`, `string` unchanged |
| `GET tasks?project_id=`                                            | the task is still listed                                                                                   |
| Second close                                                       | 204, `due.date` = today + 2 (moves one occurrence per close)                                               |
| `GET tasks/completed/by_completion_date` (now ± 1 h, project)      | 200, **0 items**: closing a recurring task does not show up there                                          |

Recurring due dates work on the free plan, so no `fixme` is needed.

## Design

- Own project (not the Inbox) so the open-list check can be exact id equality despite other workers.
- "Today" is read before and after the create (midnight guard); the created `due.date` must be one of them, and the expected next date is `addDays(<created due.date>, 1)`.
- Assert on the reloaded task, not only on the create echo.

## Steps

- [ ] Add the `TC-013 ...` test to `tests/tasks/due-dates.spec.ts`, tags `['@TC-013', '@regression']`.
- [ ] `npx playwright test --grep @TC-013 --repeat-each=3`.
- [ ] Mutation check: expect `addDays(firstDate, 2)` as the next date, see it fail, revert.
- [ ] `npm test`, lint, format, typecheck; no `autotest-` leftovers.
- [ ] Mark TC-013 ✅; add the new findings to the skill's "Known API behavior" table.
- [ ] Commit `#35 ...`, push, open the PR, move the issue to "In review".
