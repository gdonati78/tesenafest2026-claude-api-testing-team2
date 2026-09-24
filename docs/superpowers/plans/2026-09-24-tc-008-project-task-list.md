# TC-008 Project Task List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate TC-008, "A project's task list contains only the tasks of that project, nothing from elsewhere", as one test in the new `tests/tasks/task-list.spec.ts`.

**Architecture:** No framework changes. The test builds its own project A, with two tasks, plus distractor tasks in project B and the Inbox, all through `testData`. It then reads `GET /tasks?project_id=<A>` twice: once with the raw `api.tasks.send` to check the first page against the paginated schema, and once through `api.tasks.list` (which follows every cursor) to compare the full result with the expected ids. Project A is new and private to the test, so the check can be an exact set equality even while other workers write to the same account.

**Tech Stack:** Playwright `APIRequestContext`, TypeScript (strict), Ajv matcher `toMatchSchema`.

**Spec:** GitHub issue #23 (https://github.com/gdonati78/tesenafest2026-claude-api-testing-team2/issues/23), `Test Cases for automation.md` (TC-008), `docs/test-architecture-plan.md` (the spec file table), the pinned `src/schemas/openapi.json` (`PaginatedList_ItemSyncView_` = `Schema.taskPage`, `ItemSyncView` = `Schema.task`).

**Branch:** `23-tc-008-project-task-list` (created from the updated `main`).

## Global Constraints

- Test title: `TC-008 A project's task list contains only the tasks of that project, nothing from elsewhere`; tags `['@TC-008', '@regression']`.
- Every step is a `test.step()` with a readable name; one behavior per test.
- Import `test`, `expect`, `Schema` from `../../src/fixtures`.
- All data comes from `testData.create*` (prefix `autotest-<run id>-`, deleted in teardown even when the test fails).
- Response bodies are checked against the schema (`Schema.taskPage` for the raw page, `Schema.task` for each item).
- No `console` (ESLint forbids it), never print the token.
- Commits: `#23 <summary>` plus the `Co-Authored-By` trailer. No pushes to `main`. Never merge the PR.

## Review Focus

1. Distractors never created: if the B and Inbox tasks were never created, the "nothing from elsewhere" check would pass without testing anything. The test checks each distractor's `project_id` right after creating it (B's id, and not A's).
2. A project filter that is ignored: an API that returns every task would still include both A tasks. The check is exact id equality, not "contains", so extra tasks fail the test.
3. Pagination: `list` follows `next_cursor`, so a result spread over pages is compared in full. The raw page check covers the response envelope.
4. Parallel workers: other tests create Inbox tasks at the same moment. Only a fresh project A gives a stable exact result, so A must never be the Inbox.
5. Cleanup order: the projects are created first, so teardown (in reverse) deletes the tasks before the projects, and 404s are ignored.

---

### Task 1: TC-008 test

**Files:**
- Create: `tests/tasks/task-list.spec.ts`

**Interfaces:**
- Consumes: `testData.createProject(overrides?) => Promise<Project>`, `testData.createTask(overrides?) => Promise<Task>`, `api.tasks.list({ project_id }) => Promise<Task[]>`, `api.tasks.send('GET', 'tasks', { query }) => Promise<APIResponse>`, `Schema.taskPage`, `Schema.task`.
- Produces: nothing used by other tasks.

- [ ] **Step 1: Write the test**

```ts
import { expect, Schema, test } from '../../src/fixtures';

test.describe('Task list', () => {
  test(
    "TC-008 A project's task list contains only the tasks of that project, nothing from elsewhere",
    { tag: ['@TC-008', '@regression'] },
    async ({ api, testData }) => {
      const { projectA, tasksInA } =
        await test.step('Create project A with two tasks', async () => {
          const project = await testData.createProject();
          const tasks = [
            await testData.createTask({ project_id: project.id }),
            await testData.createTask({ project_id: project.id }),
          ];
          return { projectA: project, tasksInA: tasks };
        });

      await test.step('Create tasks elsewhere: in project B and in the Inbox', async () => {
        const projectB = await testData.createProject();
        const inB = await testData.createTask({ project_id: projectB.id });
        expect(inB.project_id).toBe(projectB.id);
        const inInbox = await testData.createTask();
        expect(inInbox.project_id).not.toBe(projectA.id);
      });

      await test.step("Read the first page of project A's task list", async () => {
        const response = await api.tasks.send('GET', 'tasks', {
          query: { project_id: projectA.id },
        });
        expect(response.status()).toBe(200);
        const page: unknown = await response.json();
        expect(page).toMatchSchema(Schema.taskPage);
      });

      await test.step("Project A's task list holds exactly its own two tasks", async () => {
        const listed = await api.tasks.list({ project_id: projectA.id });
        for (const task of listed) {
          expect(task).toMatchSchema(Schema.task);
          expect(task.project_id).toBe(projectA.id);
        }
        expect(listed.map((task) => task.id).sort()).toEqual(
          tasksInA.map((task) => task.id).sort(),
        );
      });
    },
  );
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test --grep @TC-008`
Expected: 1 passed. A failure here means the API behaves differently than the spec says: look into it (systematic-debugging) before changing any assertion.

- [ ] **Step 3: Check the test can fail**

For a moment, change the last expectation to compare with `[tasksInA[0].id]` and run again. Expected: FAIL, with the extra id shown in the diff. Then revert.

- [ ] **Step 4: Stability and static checks**

Run: `npx playwright test --grep @TC-008 --repeat-each=3`, then `npm run lint`, `npm run format:check`, `npm run typecheck`.
Expected: 3 passed; all checks clean (run `npm run format` if Prettier complains).

- [ ] **Step 5: Commit**

```bash
git add tests/tasks/task-list.spec.ts docs/superpowers/plans/2026-09-24-tc-008-project-task-list.md
git commit -m "#23 Add TC-008 project task list regression test"
```

### Task 2: Pull request

- [ ] **Step 1:** `git push -u origin 23-tc-008-project-task-list`
- [ ] **Step 2:** Open the PR from `.github/pull_request_template.md` with `Closes #23`, type "New test case", the commands and results from Task 1, and the ticked checklist.
- [ ] **Step 3:** Review your own PR, fix what the review finds, and hand the URL over. Do not merge.
