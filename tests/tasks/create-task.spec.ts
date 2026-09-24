import { uniqueName } from '../../src/data';
import { expect, Schema, test } from '../../src/fixtures';
import { tomorrowIn } from '../../src/utils/dates';

test.describe('Create task', () => {
  test(
    'TC-002 A new task is created with the text that was entered',
    { tag: ['@TC-002', '@smoke'] },
    async ({ api, testData }) => {
      const content = uniqueName('task');

      const created = await test.step('Create a task with the entered text', async () => {
        const task = await testData.createTask({ content });
        expect(task).toMatchSchema(Schema.task);
        expect(task.content).toBe(content);
        return task;
      });

      await test.step('Load the task again and check its text', async () => {
        const loaded = await api.tasks.get(created.id);
        expect(loaded).toMatchSchema(Schema.task);
        expect(loaded.id).toBe(created.id);
        expect(loaded.content).toBe(content);
      });
    },
  );

  test(
    'TC-003 A new task is created with the due date that was entered',
    { tag: ['@TC-003', '@smoke'] },
    async ({ api, testData, accountTimezone }) => {
      const dueDate = await test.step('Compute tomorrow in the account timezone', () =>
        tomorrowIn(accountTimezone));

      const created = await test.step('Create a task with the entered due date', async () => {
        const task = await testData.createTask({ content: uniqueName('task'), due_date: dueDate });
        expect(task).toMatchSchema(Schema.task);
        expect(task.due).not.toBeNull();
        expect(task.due?.date).toBe(dueDate);
        expect(task.due?.is_recurring).toBe(false);
        return task;
      });

      await test.step('Load the task again and check its due date', async () => {
        const loaded = await api.tasks.get(created.id);
        expect(loaded).toMatchSchema(Schema.task);
        expect(loaded.id).toBe(created.id);
        expect(loaded.due?.date).toBe(dueDate);
      });
    },
  );
});
