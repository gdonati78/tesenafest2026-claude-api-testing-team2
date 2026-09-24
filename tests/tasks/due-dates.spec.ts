import type { Task, TodoistApi } from '../../src/clients';
import { uniqueName } from '../../src/data';
import { expect, Schema, test, type TestData } from '../../src/fixtures';
import { addDays, todayIn, tomorrowIn, weekdayOnOrAfter } from '../../src/utils/dates';

test.describe('Due dates', () => {
  test(
    'TC-009a A due date entered in words lands on the same day as the same date entered explicitly (tomorrow)',
    { tag: ['@TC-009', '@regression'] },
    async ({ api, testData, accountTimezone }) => {
      const expectedDate = await test.step('Compute tomorrow in the account timezone', () =>
        tomorrowIn(accountTimezone));

      const [inWords, explicit] = await createInWordsAndExplicit(
        api,
        testData,
        'tomorrow',
        expectedDate,
      );

      await test.step('Both tasks are due on the same day', () => {
        expect(inWords.due?.date).toBe(expectedDate);
        expect(explicit.due?.date).toBe(expectedDate);
      });
    },
  );

  test(
    'TC-009b A due date entered in words lands on the same day as the same date entered explicitly (next monday)',
    { tag: ['@TC-009', '@regression'] },
    async ({ api, testData, accountTimezone }) => {
      // Observed Todoist behavior: "monday" is the first Monday on or after today,
      // "next monday" is one week after that.
      const expectedDate = await test.step('Compute next Monday in the account timezone', () =>
        addDays(weekdayOnOrAfter(todayIn(accountTimezone), 'monday'), 7));

      const [inWords, explicit] = await createInWordsAndExplicit(
        api,
        testData,
        'next monday',
        expectedDate,
      );

      await test.step('Both tasks are due on the same day', () => {
        expect(inWords.due?.date).toBe(expectedDate);
        expect(explicit.due?.date).toBe(expectedDate);
      });
    },
  );
});

/**
 * Creates one task with the due date in words and one with the explicit date,
 * then returns both as loaded again from the API.
 */
async function createInWordsAndExplicit(
  api: TodoistApi,
  testData: TestData,
  dueString: string,
  dueDate: string,
): Promise<[Task, Task]> {
  const inWords = await test.step(`Create a task due "${dueString}"`, async () => {
    const task = await testData.createTask({ content: uniqueName('task'), due_string: dueString });
    expect(task).toMatchSchema(Schema.task);
    expect(task.due).not.toBeNull();
    expect(task.due?.is_recurring).toBe(false);
    return task;
  });

  const explicit = await test.step(`Create a task due ${dueDate}`, async () => {
    const task = await testData.createTask({ content: uniqueName('task'), due_date: dueDate });
    expect(task).toMatchSchema(Schema.task);
    return task;
  });

  return test.step('Load both tasks again', async () => {
    const loaded = await Promise.all([api.tasks.get(inWords.id), api.tasks.get(explicit.id)]);
    for (const task of loaded) expect(task).toMatchSchema(Schema.task);
    return loaded;
  });
}
