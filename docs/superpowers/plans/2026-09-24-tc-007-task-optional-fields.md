# TC-007 Task Required and Optional Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate TC-007: "A task can be created with the required fields only, and every optional field is stored exactly as it was entered", as two tests (TC-007a, TC-007b) in `tests/tasks/create-task.spec.ts`.

**Architecture:** No framework changes. Both tests use the existing `testData` fixture (creates and always deletes data), the `api.tasks` client, the worker-scoped `account` / `accountTimezone` fixtures and `src/utils/dates.ts`. Each test creates a task, checks the create response, then loads the task again with `GET /tasks/{id}` and checks the same values, so the test proves the values are *stored*, not only echoed.

**Tech Stack:** Playwright `APIRequestContext`, TypeScript (strict), Ajv schema matcher `toMatchSchema`.

**Spec:** GitHub issue #18 (https://github.com/gdonati78/tesenafest2026-claude-api-testing-team2/issues/18), `Test Cases for automation.md` (TC-007), `brief.md`, `docs/test-architecture-plan.md`, the pinned `src/schemas/openapi.json` (`Body_37565102` = create-task body, `ItemSyncView` = task).

**Branch:** `18-tc-007-task-optional-fields` (already created from the updated `main`).

**Outcome of Task 1 (probed 2026-09-24, free account):** `deadline_date` is rejected with 403 `PREMIUM_ONLY`; `duration` is accepted but stored as null (with `due_date`, `due_datetime`, `due_string` and without a due date). Both moved to TC-007c (`test.fixme()`). `order` is stored as `child_order`; the content-only defaults match Task 2.

## Global Constraints

- Test titles: `TC-007a A task can be created with the required fields only`, `TC-007b Every optional field of a task is stored exactly as it was entered`.
- Tags on both: `['@TC-007', '@regression']`.
- Every step is a `test.step()` with a readable name; one behavior per test.
- Import `test`, `expect`, `Schema` from `../../src/fixtures`; `uniqueName` from `../../src/data`.
- All data via `testData.create*` (prefix `autotest-<run id>-`, deleted in teardown also on failure). Anything created with `api.*.send` must be registered with `testData.track`.
- Every response body is checked with `expect(body).toMatchSchema(Schema.task)`.
- Dates are computed in the account timezone (`accountTimezone` + `tomorrowIn` / `addDays`), never the runner's clock.
- A feature not on the free plan is `test.fixme()` with the reason.
- Unclear behavior is probed against the real API first, asserted as observed, and listed as an assumption in the PR description.
- No `console` (ESLint forbids it). Never print the token.
- Commits: `#18 <summary>` plus the `Co-Authored-By` trailer. No pushes to `main`. Never merge the PR.

## Scope decisions (from the spec)

The create body `Body_37565102` requires only `content`. Optional fields and how TC-007b treats them:

| Field | In TC-007b | Stored as (checked on create and on reload) |
|---|---|---|
| `description` | yes | `description` |
| `project_id` | yes (own project) | `project_id` |
| `parent_id` | yes (parent task in the same project) | `parent_id` |
| `order` | yes | `child_order` (confirm in Task 1) |
| `labels` | yes (own label, by name) | `labels` |
| `priority` | yes, `3` (not the default `1`) | `priority` |
| `due_date` | yes, tomorrow in account tz | `due.date`, `due.is_recurring === false` |
| `duration` + `duration_unit` | yes, `30` `minute` (probe free plan) | `duration` `{ amount: 30, unit: 'minute' }` |
| `deadline_date` | yes, today + 7 in account tz (probe free plan) | `deadline.date` |
| `section_id` | no | sections are out of scope |
| `assignee_id` | no | needs a shared project; a free personal project has no other collaborators |
| `due_string`, `due_datetime`, `due_lang` | no | the API takes one due form per request; `due_date` is used here, natural language is TC-009 |

## Review Focus

1. Free-plan fields (`deadline_date`, `duration`) silently ignored instead of rejected: the create returns 200 but the field is null. The test must fail on that rather than pass, so TC-007b asserts the stored value, not just status 200. If Task 1 shows a field is not stored on the free plan, it moves to TC-007c with `test.fixme()` (Task 3, Step 3).
2. Echo vs storage: the create response could reflect the request while the stored task differs. Both tests reload with `api.tasks.get` and re-check every field.
3. Midnight / timezone: a date computed with the runner clock can land on the wrong day. Both dates use `accountTimezone`.
4. Defaults drift in TC-007a: the Inbox is the default project; the test compares `project_id` with `account.inbox_project_id`, not a hard-coded id.
5. Cleanup order: the child task, parent task, label and project must all be deleted. `testData` deletes in reverse order and ignores 404 (a deleted project already took its tasks), so create the project first, then the label, then the parent, then the child.

---

### Task 1: Probe the real API for the optional fields (no repo changes)

**Files:**
- Create (scratchpad only, not committed): `<scratchpad>/probe-tc007.mjs`

**Interfaces:**
- Consumes: `TODOIST_API_TOKEN` from `.env`.
- Produces: observed facts for Tasks 2–3 and the PR assumptions: default values of a content-only task; whether `duration` and `deadline_date` are stored on the free plan; whether `order` shows up as `child_order`; the exact shape of `due`, `duration`, `deadline`.

- [ ] **Step 1: Write the probe script**

```js
// Run: node --env-file=.env <scratchpad>/probe-tc007.mjs
const base = 'https://api.todoist.com/api/v1/';
const headers = {
  Authorization: `Bearer ${process.env.TODOIST_API_TOKEN}`,
  'Content-Type': 'application/json',
};
const call = async (method, path, body) => {
  const res = await fetch(base + path, { method, headers, body: body && JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};
const pick = ({ project_id, parent_id, description, labels, priority, due, duration, deadline, child_order, checked }) =>
  ({ project_id, parent_id, description, labels, priority, due, duration, deadline, child_order, checked });

const stamp = `autotest-probe-${Date.now()}`;
const user = await call('GET', 'user');
process.stdout.write(`inbox ${user.body.inbox_project_id} tz ${user.body.tz_info.timezone} premium ${user.body.is_premium}\n`);

const minimal = await call('POST', 'tasks', { content: `${stamp}-min` });
process.stdout.write(`minimal ${minimal.status} ${JSON.stringify(pick(minimal.body))}\n`);

const project = await call('POST', 'projects', { name: `${stamp}-project` });
const label = await call('POST', 'labels', { name: `${stamp}-label` });
const parent = await call('POST', 'tasks', { content: `${stamp}-parent`, project_id: project.body.id });
const full = await call('POST', 'tasks', {
  content: `${stamp}-full`,
  description: 'probe description',
  project_id: project.body.id,
  parent_id: parent.body.id,
  order: 3,
  labels: [label.body.name],
  priority: 3,
  due_date: '2026-12-01',
  duration: 30,
  duration_unit: 'minute',
  deadline_date: '2026-12-08',
});
process.stdout.write(`full ${full.status} ${JSON.stringify(full.status === 200 ? pick(full.body) : full.body)}\n`);
if (full.status === 200) {
  const loaded = await call('GET', `tasks/${full.body.id}`);
  process.stdout.write(`loaded ${JSON.stringify(pick(loaded.body))}\n`);
}

await call('DELETE', `tasks/${minimal.body.id}`);
await call('DELETE', `labels/${label.body.id}`);
await call('DELETE', `projects/${project.body.id}`);
process.stdout.write('cleaned up\n');
```

- [ ] **Step 2: Run it and record the output**

Run: `node --env-file=.env <scratchpad>/probe-tc007.mjs`
Expected: `minimal 200 ...` and `full 200 ...`. Record for each of `duration`, `deadline`, `child_order`: stored as entered, null (silently ignored), or a 4xx error. Record the minimal task defaults. Confirm the script printed `cleaned up`.

- [ ] **Step 3: Decide**

- `duration` / `deadline` stored → keep them in TC-007b.
- Either one null or rejected on the free plan → drop it from TC-007b and add TC-007c `test.fixme()` for it (Task 3, Step 3). Note it as a PR assumption.
- `child_order` ≠ `3` → drop `order` from TC-007b and note it as a PR assumption ("`order` is a position hint, not stored verbatim").
- Minimal defaults differ from Task 2's expectations → change Task 2's expected object to the observed values and note it as a PR assumption.

No commit (nothing in the repo changed).

---

### Task 2: TC-007a — required fields only

**Files:**
- Modify: `tests/tasks/create-task.spec.ts` (add a test inside the existing `test.describe('Create task', ...)`, after TC-002)

**Interfaces:**
- Consumes: `testData.createTask(overrides)`, `api.tasks.get(id)`, `account.inbox_project_id`, `Task` type from `../../src/clients`.
- Produces: nothing used by other tasks.

- [ ] **Step 1: Add the test**

Add the import at the top of the file:

```ts
import type { Task } from '../../src/clients';
```

Add inside the `describe`:

```ts
  test(
    'TC-007a A task can be created with the required fields only',
    { tag: ['@TC-007', '@regression'] },
    async ({ api, testData, account }) => {
      const content = uniqueName('task');
      const expectDefaults = (task: Task): void => {
        expect(task).toMatchObject({
          content,
          project_id: account.inbox_project_id,
          parent_id: null,
          description: '',
          labels: [],
          priority: 1,
          due: null,
          deadline: null,
          duration: null,
          checked: false,
        });
      };

      const created = await test.step('Create a task with the content only', async () => {
        const task = await testData.createTask({ content });
        expect(task).toMatchSchema(Schema.task);
        return task;
      });

      await test.step('Check that the fields not entered have their default values', () => {
        expectDefaults(created);
      });

      await test.step('Load the task again and check the same values', async () => {
        const loaded = await api.tasks.get(created.id);
        expect(loaded).toMatchSchema(Schema.task);
        expect(loaded.id).toBe(created.id);
        expectDefaults(loaded);
      });
    },
  );
```

(`buildTask({ content })` adds nothing but `content`, so the request really has the required field only.)

- [ ] **Step 2: Run it**

Run: `npx playwright test --grep "@TC-007" tests/tasks/create-task.spec.ts`
Expected: 1 passed.

- [ ] **Step 3: Check the test can fail**

Temporarily change `priority: 1` to `priority: 2` in `expectDefaults`, run the Step 2 command, expect FAIL on `priority`, then revert.

- [ ] **Step 4: Lint, format, typecheck**

Run: `npm run lint && npm run format:check && npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add tests/tasks/create-task.spec.ts
git commit -m "#18 Add TC-007a task with required fields only" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: TC-007b — every optional field stored as entered

**Files:**
- Modify: `tests/tasks/create-task.spec.ts` (add after TC-007a)

**Interfaces:**
- Consumes: `testData.createProject()`, `testData.createLabel()`, `testData.createTask(overrides)`, `api.tasks.get(id)`, `accountTimezone`, `tomorrowIn(tz)`, `todayIn(tz)`, `addDays(date, days)` from `../../src/utils/dates`, `CreateTaskPayload` and `Task` types from `../../src/clients`.
- Produces: nothing used by other tasks.

- [ ] **Step 1: Add the test**

Update the imports:

```ts
import type { CreateTaskPayload, Task } from '../../src/clients';
import { uniqueName } from '../../src/data';
import { expect, Schema, test } from '../../src/fixtures';
import { addDays, todayIn, tomorrowIn } from '../../src/utils/dates';
```

Add inside the `describe`:

```ts
  test(
    'TC-007b Every optional field of a task is stored exactly as it was entered',
    { tag: ['@TC-007', '@regression'] },
    async ({ api, testData, accountTimezone }) => {
      const { project, label, parent } = await test.step(
        'Create a project, a label and a parent task',
        async () => {
          const project = await testData.createProject();
          const label = await testData.createLabel();
          const parent = await testData.createTask({ project_id: project.id });
          return { project, label, parent };
        },
      );

      const payload = {
        content: uniqueName('task'),
        description: 'autotest description: every optional field',
        project_id: project.id,
        parent_id: parent.id,
        order: 3,
        labels: [label.name],
        priority: 3,
        due_date: tomorrowIn(accountTimezone),
        duration: 30,
        duration_unit: 'minute',
        deadline_date: addDays(todayIn(accountTimezone), 7),
      } satisfies CreateTaskPayload;

      const expectAsEntered = (task: Task): void => {
        expect(task).toMatchObject({
          content: payload.content,
          description: payload.description,
          project_id: payload.project_id,
          parent_id: payload.parent_id,
          child_order: payload.order,
          labels: payload.labels,
          priority: payload.priority,
          due: { date: payload.due_date, is_recurring: false },
          duration: { amount: payload.duration, unit: payload.duration_unit },
          deadline: { date: payload.deadline_date },
        });
      };

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
    },
  );
```

Priority `3` is used because `1` is the default and would not prove the value was stored.

- [ ] **Step 2: Apply the Task 1 decisions**

For each field Task 1 showed is not stored verbatim, remove it from both `payload` and `expectAsEntered` (`order`/`child_order`, `duration`+`duration_unit`/`duration`, `deadline_date`/`deadline`). If `duration` and `deadline` both stay, skip Step 3.

- [ ] **Step 3: Only if a field is not on the free plan — add TC-007c as fixme**

Example for `deadline_date`; for `duration` use the same shape with `duration: 30, duration_unit: 'minute'` and `duration: { amount: 30, unit: 'minute' }`, and put both in one test if both are affected:

```ts
  test(
    'TC-007c A deadline is stored exactly as it was entered',
    { tag: ['@TC-007', '@regression'] },
    async ({ api, testData, accountTimezone }) => {
      test.fixme(true, 'Deadlines are not stored on the free Todoist plan (probed on 2026-09-24).');
      const deadline = addDays(todayIn(accountTimezone), 7);

      const created = await test.step('Create a task with a deadline', async () => {
        const task = await testData.createTask({ deadline_date: deadline });
        expect(task).toMatchSchema(Schema.task);
        expect(task.deadline).toMatchObject({ date: deadline });
        return task;
      });

      await test.step('Load the task again and check the deadline', async () => {
        const loaded = await api.tasks.get(created.id);
        expect(loaded.deadline).toMatchObject({ date: deadline });
      });
    },
  );
```

- [ ] **Step 4: Run it**

Run: `npx playwright test --grep "@TC-007" tests/tasks/create-task.spec.ts`
Expected: TC-007a and TC-007b passed (TC-007c, if added, reported as skipped/fixme).

- [ ] **Step 5: Check the test can fail**

Temporarily change `priority: payload.priority` to `priority: 1` in `expectAsEntered`, run Step 4, expect FAIL on `priority`, revert.

- [ ] **Step 6: Lint, format, typecheck**

Run: `npm run lint && npm run format:check && npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add tests/tasks/create-task.spec.ts
git commit -m "#18 Add TC-007b task with every optional field" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Stability, cleanup check, PR

**Files:** none changed (unless review finds something).

- [ ] **Step 1: Stability**

Run: `npx playwright test --grep @TC-007 --repeat-each=3`
Expected: all passed, none flaky.

- [ ] **Step 2: Full suite**

Run: `npm test`
Expected: all passed (TC-007 does not disturb TC-002 / TC-003 in the same file).

- [ ] **Step 3: No leftovers**

Run with the probe-style `fetch` (scratchpad script): list `GET projects`, `GET labels`, `GET tasks` and confirm no names starting with `autotest-<this run id>-` remain.
Expected: none.

- [ ] **Step 4: Self code review**

Run the `code-review` skill on the branch diff, fix the findings or explain them.

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin 18-tc-007-task-optional-fields
gh pr create --title "#18 TC-007 task with required fields only and every optional field" --body-file <scratchpad>/pr-body.md
```

The body follows `.github/pull_request_template.md`, links `Closes #18`, lists the assumptions from Task 1 (defaults of a content-only task, free-plan behavior of `duration` / `deadline_date`, `order` → `child_order`, fields left out and why), and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do not merge. Reply with the PR URL and a short summary.
