import type { Page, Task, TodoistApi } from '../../src/clients';
import { uniqueName } from '../../src/data';
import { expect, Schema, test, type TestData } from '../../src/fixtures';

// The pinned spec lists 400 for `POST tasks` but gives it no body schema, so the stable fields of
// the observed bodies are asserted (probed 2026-09-24). `error_extra` also holds a per-request
// `event_id` and a growing `retry_after`, which are left out on purpose.
const EMPTY_CONTENT_BODY = {
  http_code: 400,
  error_tag: 'INVALID_ARGUMENT_VALUE',
  error_code: 20,
  error_extra: { argument: 'content', expected: 'minlen' },
};
const MISSING_CONTENT_BODY = {
  http_code: 400,
  error_tag: 'ARGUMENT_MISSING',
  error_code: 19,
  error_extra: { argument: 'content' },
};
const UNREADABLE_DUE_BODY = {
  http_code: 400,
  error_tag: 'BAD_REQUEST',
  error_code: 42,
  error: 'Invalid date format',
};

/**
 * Sends `body` as a create-task request into `projectId`, checks the 400 and its body, then
 * checks the project holds no task. A task created by mistake is tracked, so cleanup deletes it.
 */
async function expectRejectedAndNothingCreated(
  api: TodoistApi,
  testData: TestData,
  projectId: string,
  body: Record<string, unknown>,
  expectedBody: Record<string, unknown>,
): Promise<void> {
  await test.step('Send the create-task request and check it is rejected with 400', async () => {
    const response = await api.tasks.send('POST', 'tasks', { body });
    // Soft, so the next step still runs: if a task was created after all, it finds and tracks it.
    expect.soft(response.status()).toBe(400);
    // A non-JSON body becomes `undefined` and fails softly instead of skipping the next step.
    const responseBody: unknown = await response.json().catch(() => undefined);
    expect.soft(responseBody).toMatchObject(expectedBody);
  });

  await test.step("List the project's tasks and check there are none", async () => {
    const response = await api.tasks.send('GET', 'tasks', { query: { project_id: projectId } });
    expect(response.status()).toBe(200);
    const page = (await response.json()) as Page<Task>;
    // The project is this test's own and new, so one page holds any stray task. Track first, so
    // cleanup deletes it even if an assertion below fails.
    page.results.forEach((task) => {
      testData.track('task', task.id);
    });
    expect(page).toMatchSchema(Schema.taskPage);
    expect(page.results).toEqual([]);
  });
}

test.describe('Task validation', () => {
  test(
    'TC-015a A task with no text is rejected',
    { tag: ['@TC-015', '@negative'] },
    async ({ api, testData }) => {
      const project = await test.step('Create a project for the test', () =>
        testData.createProject());

      await expectRejectedAndNothingCreated(
        api,
        testData,
        project.id,
        { content: '', project_id: project.id },
        EMPTY_CONTENT_BODY,
      );
    },
  );

  test(
    'TC-015b A task with a required field missing is rejected',
    { tag: ['@TC-015', '@negative'] },
    async ({ api, testData }) => {
      const project = await test.step('Create a project for the test', () =>
        testData.createProject());

      await expectRejectedAndNothingCreated(
        api,
        testData,
        project.id,
        { project_id: project.id },
        MISSING_CONTENT_BODY,
      );
    },
  );

  test(
    'TC-015c A task with an unreadable due date is rejected',
    { tag: ['@TC-015', '@negative'] },
    async ({ api, testData }) => {
      const project = await test.step('Create a project for the test', () =>
        testData.createProject());

      await expectRejectedAndNothingCreated(
        api,
        testData,
        project.id,
        {
          content: uniqueName('task'),
          due_string: 'autotest-not-a-date',
          project_id: project.id,
        },
        UNREADABLE_DUE_BODY,
      );
    },
  );
});
